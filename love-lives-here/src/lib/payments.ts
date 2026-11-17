/**
 * Payment lifecycle. An order only becomes "paid" after the server has
 * verified the transaction with Paystack and checked amount, currency and
 * reference. Processing is idempotent: callbacks, retries and duplicate
 * webhooks all converge on the same result.
 */
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { appUrl, addEvent, OrderError, trackingUrl, verifyTracking } from "./orders";
import * as paystack from "./paystack";
import { paymentReference, sha256 } from "./tokens";
import { track } from "./analytics";
import { kickOutbox, queueNotification } from "./notifications";
import { alert } from "./alert";
import { CUSTOMER_MESSAGE } from "./order-status";
import { compareIso, lagosToday, addDays } from "./dates";
import { formatNaira } from "./money";
import { createExperience } from "./nfc";
import { bundleContents } from "./catalog";

/** Decrements tracked stock for a paid order (bundles consume their contents). Flags shortfalls for staff. */
async function consumeStock(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], orderId: string, orderNumber: string) {
  const rawItems = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  const parts = await bundleContents(rawItems.filter((i) => i.kind === "bundle").map((i) => i.productId), tx);
  const items = rawItems.flatMap((it) => it.kind !== "bundle" ? [it] : [it, ...(parts.get(it.productId) ?? []).map((p) => ({ ...it, variantId: p.variantId, quantity: p.quantity * it.quantity, productName: p.productName, variantName: p.variantName }))]);
  for (const it of items) {
    const r = await tx.execute(sql`update product_variants set stock = stock - ${it.quantity} where id = ${it.variantId} and stock is not null and stock >= ${it.quantity} returning id`);
    const tracked = await tx.query.productVariants.findFirst({ where: eq(schema.productVariants.id, it.variantId), columns: { stock: true } });
    if (tracked?.stock != null && r.rowCount === 0) {
      await alert("stock_short", `Not enough stock for ${it.productName} (${it.variantName}).`, orderNumber);
      await addEvent(tx, { orderId, type: "stock_short", message: `Not enough stock of ${it.productName} (${it.variantName}) to cover this paid order. Restock or contact the buyer.`, actorLabel: "system" });
    }
  }
}

/** One digital experience per Gold Card / LLH Tag bought. Idempotent. */
async function ensureExperiences(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], orderId: string) {
  const o = (await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { items: true, experiences: true } }))!;
  for (const kind of ["gold_card", "llh_tag"] as const) {
    const want = o.items.filter((i) => i.kind === kind).reduce((n, i) => n + i.quantity, 0);
    const have = o.experiences.filter((e) => e.kind === kind).length;
    for (let k = have; k < want; k++) await createExperience({ orderId, kind, recipientName: o.recipientName, fromName: o.buyerName }, tx);
  }
}

export async function startPayment(orderNumber: string, token: string): Promise<{ authorizationUrl: string; reference: string }> {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.number, orderNumber) });
  if (!order || !verifyTracking(order, token)) throw new OrderError("Order not found.", undefined, 404);
  if (order.paymentStatus !== "unpaid") throw new OrderError("This order has already been paid.", undefined, 409);
  if (order.status === "awaiting_quote") throw new OrderError("We're still confirming your delivery fee. We'll message you with the final total.", undefined, 409);
  if (order.status !== "pending_payment" || order.total == null) throw new OrderError("This order can't be paid right now. Please contact us.", undefined, 409);
  if (compareIso(order.deliveryDate, addDays(lagosToday(), 1)) < 0)
    throw new OrderError("The delivery date on this order is too close now. Message us on WhatsApp and we'll find a new date before you pay.", undefined, 409);
  if (!order.buyerEmail) throw new OrderError("Add an email address to pay online.", undefined, 400);
  if (!paystack.paystackConfigured()) throw new OrderError("Online payment isn't switched on yet. Please message us on WhatsApp to pay — your order is saved.", undefined, 503);

  const reference = paymentReference(order.number);
  await db.insert(schema.payments).values({ orderId: order.id, reference, amount: order.total, status: "initialized" });
  try {
    const init = await paystack.initializeTransaction({
      email: order.buyerEmail,
      amount: order.total,
      reference,
      callbackUrl: `${appUrl()}/checkout/complete?order=${order.number}&t=${encodeURIComponent(token)}`,
      metadata: { order_number: order.number, cancel_action: trackingUrl(order) },
    });
    await track(null, { name: "payment_initiated", orderNumber: order.number, value: order.total });
    return { authorizationUrl: init.authorization_url, reference };
  } catch (e) {
    await db.update(schema.payments).set({ status: "failed", gatewayResponse: `init: ${(e as Error).message}`.slice(0, 200) }).where(eq(schema.payments.reference, reference));
    throw new OrderError("We couldn't start the payment. Please try again in a moment.", undefined, 502);
  }
}

export type ApplyResult = { outcome: "paid" | "already_paid" | "duplicate" | "failed" | "pending" | "mismatch" | "unknown_reference"; orderNumber?: string };

/** Verify a reference with Paystack and apply the result. Safe to call any number of times. */
export async function verifyAndApply(reference: string, via: "callback" | "webhook" | "staff"): Promise<ApplyResult> {
  const db = getDb();
  const payment = await db.query.payments.findFirst({ where: eq(schema.payments.reference, reference) });
  if (!payment) return { outcome: "unknown_reference" };
  const v = await paystack.verifyTransaction(reference);

  const result = await db.transaction(async (tx): Promise<ApplyResult> => {
    // Lock the order row so concurrent callback + webhook can't both apply.
    await tx.execute(sql`select id from orders where id = ${payment.orderId} for update`);
    const order = (await tx.query.orders.findFirst({ where: eq(schema.orders.id, payment.orderId) }))!;
    const p = (await tx.query.payments.findFirst({ where: eq(schema.payments.id, payment.id) }))!;
    const base = { channel: v.channel ?? null, gatewayResponse: v.gateway_response ?? null, providerTransactionId: String(v.id), testMode: v.domain === "test" };

    if (v.status === "success") {
      // The paid amount must match both what we asked Paystack to charge and the order's current total
      // (if staff changed the total after this payment was started, it must not silently count as full payment).
      if (v.reference !== reference || v.amount !== p.amount || v.currency !== "NGN" || (order.paymentStatus === "unpaid" && order.total !== p.amount)) {
        await tx.update(schema.payments).set({ ...base, status: "failed", gatewayResponse: `Mismatch: paid ${v.amount} ${v.currency}, expected ${order.total ?? p.amount} NGN` }).where(eq(schema.payments.id, p.id));
        await addEvent(tx, { orderId: order.id, type: "payment_mismatch", message: `Paystack reported ${formatNaira(v.amount)} ${v.currency} for ${reference}; the order total is ${formatNaira(order.total ?? p.amount)}. Not marked paid — check and refund or collect the difference.`, actorLabel: `system:${via}` });
        return { outcome: "mismatch", orderNumber: order.number };
      }
      const alreadyApplied = p.status === "success";
      if (!alreadyApplied) {
        await tx.update(schema.payments).set({ ...base, status: "success", verifiedAt: new Date() }).where(eq(schema.payments.id, p.id));
      }
      if (order.paymentStatus !== "unpaid") {
        // Same payment seen again (callback + webhook, or a webhook retry): nothing to do.
        if (alreadyApplied) return { outcome: "already_paid", orderNumber: order.number };
        // A *different* successful payment for an order that is already paid.
        await tx.update(schema.orders).set({ duplicatePaymentFlag: true }).where(eq(schema.orders.id, order.id));
        await addEvent(tx, { orderId: order.id, type: "duplicate_payment", message: `A second successful payment (${reference}) arrived for an already-paid order. Refund it.`, actorLabel: `system:${via}` });
        return { outcome: "duplicate", orderNumber: order.number };
      }
      if (order.status !== "pending_payment") {
        // e.g. cancelled while the customer was on the payment page
        await tx.update(schema.orders).set({ duplicatePaymentFlag: true, paymentStatus: "paid", paidAt: new Date() }).where(eq(schema.orders.id, order.id));
        await addEvent(tx, { orderId: order.id, type: "payment_after_close", message: `Payment ${reference} succeeded but the order was "${order.status}". Review and refund.`, actorLabel: `system:${via}` });
        return { outcome: "duplicate", orderNumber: order.number };
      }

      await tx.update(schema.orders).set({ status: "paid", paymentStatus: "paid", paidAt: new Date(), testMode: v.domain === "test", updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      await addEvent(tx, { orderId: order.id, type: "status", from: order.status, to: "paid", message: CUSTOMER_MESSAGE.paid, visible: true, actorLabel: `system:${via}` });

      await consumeStock(tx, order.id, order.number);
      await ensureExperiences(tx, order.id);
      await track(tx, { name: "purchase", orderNumber: order.number, value: p.amount, test: v.domain === "test", source: order.source?.source, medium: order.source?.medium, campaign: order.source?.campaign });
      if (order.buyerEmail) {
        await queueNotification(tx, {
          orderId: order.id, channel: "email", to: order.buyerEmail, subject: `Payment received — ${order.number}`,
          body: `Hi ${order.buyerName},\n\nWe've received your payment of ${formatNaira(p.amount)} (ref ${reference}). Thank you.\n\n${order.approvalRequired ? "We'll send you your letter to read before we seal it.\n\n" : ""}Track your order: ${trackingUrl(order)}\n\nLove Lives Here`,
        });
      }
      return { outcome: "paid", orderNumber: order.number };
    }

    if (["failed", "abandoned", "reversed"].includes(v.status)) {
      if (p.status === "initialized") {
        await tx.update(schema.payments).set({ ...base, status: v.status === "reversed" ? "reversed" : v.status === "abandoned" ? "abandoned" : "failed", verifiedAt: new Date() }).where(eq(schema.payments.id, p.id));
        await track(tx, { name: "payment_failed", orderNumber: order.number, value: p.amount, test: v.domain === "test" });
      }
      return { outcome: "failed", orderNumber: order.number };
    }
    return { outcome: "pending", orderNumber: order.number };
  });
  if (result.outcome === "paid") kickOutbox();
  if (result.outcome === "mismatch") await alert("payment_mismatch", "Paystack amount/currency didn't match; order not marked paid.", result.orderNumber);
  if (result.outcome === "duplicate") await alert("duplicate_payment", "A second successful payment needs a refund.", result.orderNumber);
  return result;
}

/** Handles a verified webhook body. Returns a short result string for logging. */
export async function handleWebhook(raw: string): Promise<string> {
  const evt = JSON.parse(raw) as { event?: string; data?: Record<string, unknown> };
  const event = String(evt.event ?? "unknown");
  const data = evt.data ?? {};
  const reference = (data.reference ?? (data as { transaction_reference?: string }).transaction_reference ?? null) as string | null;
  const dedupeKey = `${event}:${String(data.id ?? "")}:${reference ?? ""}:${String(data.status ?? "")}` || sha256(raw);
  const db = getDb();
  const ins = await db.insert(schema.webhookEvents).values({ provider: "paystack", dedupeKey, event, reference }).onConflictDoNothing().returning();
  if (!ins.length) return "duplicate-ignored";
  let result = "ignored";
  try {
    if (event === "charge.success" && reference) {
      result = (await verifyAndApply(reference, "webhook")).outcome;
    } else if (event.startsWith("refund.") && reference) {
      result = await applyRefundEvent(reference, String(data.status ?? event.split(".")[1]), Number(data.amount ?? 0), data.id != null ? String(data.id) : null);
      if (result === "refund_failed") await alert("refund_failed", "A Paystack refund failed.", reference);
    }
  } catch (e) {
    await alert("webhook_failed", `Paystack ${event} processing failed: ${(e as Error).message}`, reference ?? undefined);
    // Let Paystack retry: remove the dedupe row so the next delivery is processed.
    await db.delete(schema.webhookEvents).where(eq(schema.webhookEvents.id, ins[0].id));
    throw e;
  }
  await db.update(schema.webhookEvents).set({ processedAt: new Date(), result }).where(eq(schema.webhookEvents.id, ins[0].id));
  return result;
}

async function applyRefundEvent(reference: string, status: string, amount: number, providerRefundId: string | null): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const p = await tx.query.payments.findFirst({ where: eq(schema.payments.reference, reference) });
    if (!p) return "unknown_reference";
    await tx.execute(sql`select id from orders where id = ${p.orderId} for update`);
    const mapped = status === "processed" ? "processed" : status === "failed" ? "failed" : "processing";
    // Match the refund we started (by Paystack's refund id, else the open one); a refund started in the
    // Paystack dashboard has no row yet, so record it rather than mis-reporting the order.
    let refund = providerRefundId ? await tx.query.refunds.findFirst({ where: and(eq(schema.refunds.paymentId, p.id), eq(schema.refunds.providerRefundId, providerRefundId)) }) : undefined;
    refund ??= await tx.query.refunds.findFirst({ where: and(eq(schema.refunds.paymentId, p.id), sql`${schema.refunds.status} in ('pending','processing')`) });
    if (!refund) {
      if (!(amount > 0)) return "refund_ignored_no_amount";
      [refund] = await tx.insert(schema.refunds).values({ orderId: p.orderId, paymentId: p.id, amount, reason: "Refund made in the Paystack dashboard", status: "processing", providerRefundId }).returning();
      await addEvent(tx, { orderId: p.orderId, type: "refund_requested", message: `Paystack reported a refund of ${formatNaira(amount)} that wasn't started here (Paystack dashboard).`, actorLabel: "system:webhook" });
    }
    if (refund.status === mapped || refund.status === "manual") return `refund_${mapped}_unchanged`;
    if (refund.status === "processed") return "refund_already_processed";
    await tx.update(schema.refunds).set({ status: mapped, providerRefundId: refund.providerRefundId ?? providerRefundId }).where(eq(schema.refunds.id, refund.id));
    if (mapped === "processed") await settleRefund(tx, p.orderId, refund.amount, "system:webhook");
    if (mapped === "failed") await addEvent(tx, { orderId: p.orderId, type: "refund_failed", message: `Paystack could not complete the refund of ${formatNaira(refund.amount)}. Retry or refund manually.`, actorLabel: "system:webhook" });
    return `refund_${mapped}`;
  });
}

async function settleRefund(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], orderId: string, _amount: number, actor: string) {
  const order = (await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) }))!;
  const [{ refunded }] = await tx.select({ refunded: sql<number>`coalesce(sum(amount) filter (where status in ('processed','manual')),0)::int` }).from(schema.refunds).where(eq(schema.refunds.orderId, orderId));
  const [{ paid }] = await tx.select({ paid: sql<number>`coalesce(sum(amount) filter (where status = 'success'),0)::int` }).from(schema.payments).where(eq(schema.payments.orderId, orderId));
  const full = refunded >= paid && paid > 0;
  await tx.update(schema.orders).set({
    paymentStatus: full ? "refunded" : "partially_refunded",
    status: full ? "refunded" : order.status,
    updatedAt: new Date(),
  }).where(eq(schema.orders.id, orderId));
  await addEvent(tx, { orderId, type: "refund", from: order.status, to: full ? "refunded" : order.status, message: full ? "Your payment has been refunded." : `A partial refund of ${formatNaira(refunded)} has been processed.`, visible: true, actorLabel: actor });
  await track(tx, { name: "refund", orderNumber: order.number, value: refunded, test: order.testMode });
}

export async function refundOrder(orderId: string, amount: number, reason: string, actor: { id: string; email: string }, manual = false) {
  const db = getDb();
  if (!Number.isInteger(amount) || amount <= 0) throw new OrderError("Enter a refund amount.");
  if (reason.trim().length < 3) throw new OrderError("Give a reason for the refund.");
  // Step 1, under a row lock: check what's still refundable and reserve this refund, so two staff
  // members (or a double click) can't both refund the same money.
  const reserved = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from orders where id = ${orderId} for update`);
    const order = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { payments: true, refunds: true } });
    if (!order) throw new OrderError("Order not found", undefined, 404);
    const live = order.refunds.filter((r) => r.status !== "failed");
    const paid = order.payments.filter((p) => p.status === "success").sort((a, b) => +a.createdAt - +b.createdAt);
    const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
    const already = live.reduce((s, r) => s + r.amount, 0);
    if (amount > paidTotal - already) throw new OrderError(paidTotal - already > 0 ? `You can refund at most ${formatNaira(paidTotal - already)}.` : "Nothing left to refund on this order.");
    // A single Paystack refund can't exceed the transaction it refunds: pick the latest payment with room.
    const left = (p: (typeof paid)[number]) => p.amount - live.filter((r) => r.paymentId === p.id).reduce((s, r) => s + r.amount, 0);
    const payment = [...paid].reverse().find((p) => left(p) >= amount);
    if (!payment) throw new OrderError(`Refund at most ${formatNaira(Math.max(0, ...paid.map(left)))} at a time (one payment per refund).`);
    const isManual = manual || payment.provider === "manual";
    const [row] = await tx.insert(schema.refunds).values({ orderId, paymentId: payment.id, amount, reason, status: isManual ? "manual" : "pending", createdBy: actor.id }).returning();
    if (isManual) await settleRefund(tx, orderId, amount, actor.email);
    else await addEvent(tx, { orderId, type: "refund_requested", message: `Refund of ${formatNaira(amount)} requested from Paystack: ${reason}`, actorId: actor.id, actorLabel: actor.email });
    return { row, payment, isManual };
  });
  if (reserved.isManual) return;
  // Step 2: ask Paystack. On failure the reservation is released (marked failed) so it can be retried.
  let r: paystack.RefundData;
  try {
    r = await paystack.createRefund({ reference: reserved.payment.reference, amount, note: reason });
  } catch (e) {
    await db.update(schema.refunds).set({ status: "failed" }).where(eq(schema.refunds.id, reserved.row.id));
    await addEvent(db, { orderId, type: "refund_failed", message: `Paystack refused the refund: ${(e as Error).message}`.slice(0, 300), actorId: actor.id, actorLabel: actor.email });
    throw new OrderError(`Paystack didn't accept the refund: ${(e as Error).message}`, undefined, 502);
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from orders where id = ${orderId} for update`);
    const cur = (await tx.query.refunds.findFirst({ where: eq(schema.refunds.id, reserved.row.id) }))!;
    const providerRefundId = r.id ? String(r.id) : null;
    // The refund.processed webhook may already have settled it while we waited.
    if (cur.status === "processed") { await tx.update(schema.refunds).set({ providerRefundId }).where(eq(schema.refunds.id, cur.id)); return; }
    await tx.update(schema.refunds).set({ status: r.status === "processed" ? "processed" : cur.status, providerRefundId }).where(eq(schema.refunds.id, cur.id));
    if (r.status === "processed") await settleRefund(tx, orderId, amount, actor.email);
  });
}

/** Records a payment received outside Paystack (e.g. bank transfer). Owner/manager only; audited. */
export async function recordManualPayment(orderId: string, note: string, actor: { id: string; email: string }) {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from orders where id = ${orderId} for update`);
    const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!o) throw new OrderError("Order not found", undefined, 404);
    if (o.status !== "pending_payment" || o.total == null || o.paymentStatus !== "unpaid") throw new OrderError("Only an unpaid order with a final total can be marked as paid.");
    if (note.trim().length < 6) throw new OrderError("Note the bank reference or how it was paid.");
    await tx.insert(schema.payments).values({ orderId, provider: "manual", reference: `${o.number}-manual-${Date.now()}`, amount: o.total, status: "success", gatewayResponse: note.slice(0, 200), verifiedAt: new Date(), testMode: false });
    await tx.update(schema.orders).set({ status: "paid", paymentStatus: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
    await addEvent(tx, { orderId, type: "status", from: o.status, to: "paid", message: CUSTOMER_MESSAGE.paid, visible: true, actorId: actor.id, actorLabel: actor.email });
    await addEvent(tx, { orderId, type: "manual_payment", message: `Marked paid manually: ${note}`, actorId: actor.id, actorLabel: actor.email });
    await consumeStock(tx, orderId, o.number);
    await ensureExperiences(tx, orderId);
    await track(tx, { name: "purchase", orderNumber: o.number, value: o.total });
  });
}
