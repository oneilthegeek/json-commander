/**
 * Payment lifecycle. An order only becomes "paid" after the server has
 * verified the transaction with Paystack and checked amount, currency and
 * reference. Processing is idempotent: callbacks, retries and duplicate
 * webhooks all converge on the same result.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { appUrl, addEvent, OrderError, trackingUrl, verifyTracking } from "./orders";
import * as paystack from "./paystack";
import { paymentReference, sha256 } from "./tokens";
import { track } from "./analytics";
import { queueNotification } from "./notifications";
import { CUSTOMER_MESSAGE } from "./order-status";
import { compareIso, lagosToday, addDays } from "./dates";
import { formatNaira } from "./money";
import { createExperience } from "./nfc";

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

  return db.transaction(async (tx) => {
    // Lock the order row so concurrent callback + webhook can't both apply.
    await tx.execute(sql`select id from orders where id = ${payment.orderId} for update`);
    const order = (await tx.query.orders.findFirst({ where: eq(schema.orders.id, payment.orderId) }))!;
    const p = (await tx.query.payments.findFirst({ where: eq(schema.payments.id, payment.id) }))!;
    const base = { channel: v.channel ?? null, gatewayResponse: v.gateway_response ?? null, providerTransactionId: String(v.id), testMode: v.domain === "test" };

    if (v.status === "success") {
      if (v.reference !== reference || v.amount !== p.amount || v.currency !== "NGN") {
        await tx.update(schema.payments).set({ ...base, status: "failed", gatewayResponse: `Mismatch: paid ${v.amount} ${v.currency}, expected ${p.amount} NGN` }).where(eq(schema.payments.id, p.id));
        await addEvent(tx, { orderId: order.id, type: "payment_mismatch", message: `Paystack reported ${formatNaira(v.amount)} ${v.currency} for ${reference}; expected ${formatNaira(p.amount)}. Not marked paid — check and refund if needed.`, actorLabel: `system:${via}` });
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

      // Decrement tracked stock now that the sale is real.
      const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
      for (const it of items) {
        const r = await tx.execute(sql`update product_variants set stock = stock - ${it.quantity} where id = ${it.variantId} and stock is not null and stock >= ${it.quantity} returning id`);
        const tracked = await tx.query.productVariants.findFirst({ where: eq(schema.productVariants.id, it.variantId), columns: { stock: true } });
        if (tracked?.stock != null && r.rowCount === 0) {
          await addEvent(tx, { orderId: order.id, type: "stock_short", message: `Not enough stock of ${it.productName} (${it.variantName}) to cover this paid order. Restock or contact the buyer.`, actorLabel: "system" });
        }
      }

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
      result = await applyRefundEvent(reference, String(data.status ?? event.split(".")[1]), Number(data.amount ?? 0));
    }
  } catch (e) {
    // Let Paystack retry: remove the dedupe row so the next delivery is processed.
    await db.delete(schema.webhookEvents).where(eq(schema.webhookEvents.id, ins[0].id));
    throw e;
  }
  await db.update(schema.webhookEvents).set({ processedAt: new Date(), result }).where(eq(schema.webhookEvents.id, ins[0].id));
  return result;
}

async function applyRefundEvent(reference: string, status: string, amount: number): Promise<string> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const p = await tx.query.payments.findFirst({ where: eq(schema.payments.reference, reference) });
    if (!p) return "unknown_reference";
    const refund = await tx.query.refunds.findFirst({ where: and(eq(schema.refunds.paymentId, p.id), sql`${schema.refunds.status} in ('pending','processing')`) });
    const mapped = status === "processed" ? "processed" : status === "failed" ? "failed" : "processing";
    if (refund) await tx.update(schema.refunds).set({ status: mapped }).where(eq(schema.refunds.id, refund.id));
    if (mapped === "processed") await settleRefund(tx, p.orderId, refund?.amount ?? amount, "system:webhook");
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
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { payments: true, refunds: true } });
  if (!order) throw new OrderError("Order not found", undefined, 404);
  const paid = order.payments.filter((p) => p.status === "success");
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  const already = order.refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount, 0);
  if (!Number.isInteger(amount) || amount <= 0) throw new OrderError("Enter a refund amount.");
  if (amount > paidTotal - already) throw new OrderError(`You can refund at most ${formatNaira(paidTotal - already)}.`);
  if (reason.trim().length < 3) throw new OrderError("Give a reason for the refund.");
  const payment = paid[paid.length - 1];

  if (manual || payment?.provider === "manual") {
    return db.transaction(async (tx) => {
      await tx.insert(schema.refunds).values({ orderId, paymentId: payment?.id ?? null, amount, reason, status: "manual", createdBy: actor.id });
      await settleRefund(tx, orderId, amount, actor.email);
    });
  }
  const r = await paystack.createRefund({ reference: payment.reference, amount, note: reason });
  await db.transaction(async (tx) => {
    await tx.insert(schema.refunds).values({ orderId, paymentId: payment.id, amount, reason, status: r.status === "processed" ? "processed" : "pending", providerRefundId: r.id ? String(r.id) : null, createdBy: actor.id });
    await addEvent(tx, { orderId, type: "refund_requested", message: `Refund of ${formatNaira(amount)} requested from Paystack: ${reason}`, actorId: actor.id, actorLabel: actor.email });
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
    await ensureExperiences(tx, orderId);
    await track(tx, { name: "purchase", orderNumber: o.number, value: o.total });
  });
}
