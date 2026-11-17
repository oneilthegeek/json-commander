import { createHmac } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";
import { priceCart } from "./pricing";
import { checkDeliveryDate } from "./scheduling";
import { orderNumber, safeEqual, sha256 } from "./tokens";
import { addDays } from "./dates";
import { getSetting } from "./settings";
import type { CheckoutInput } from "./validation";
import { CUSTOMER_MESSAGE, STATUS_LABEL, canTransition, type OrderStatus } from "./order-status";
import { queueNotification } from "./notifications";
import { track } from "./analytics";
import { appUrl } from "./config";

export type Order = typeof schema.orders.$inferSelect;

export class OrderError extends Error {
  constructor(message: string, public field?: string, public status = 400) { super(message); }
}

function secret() {
  const s = process.env.APP_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set");
  return s ?? "development-only-secret-do-not-use-in-production!!";
}

/** Tracking token = HMAC(order id). Unguessable, never stored in plain text, re-derivable. */
export function trackingToken(orderId: string): string {
  return createHmac("sha256", secret()).update(`track:${orderId}`).digest("base64url").slice(0, 32);
}

export function trackingUrl(order: Pick<Order, "id" | "number">): string {
  return `${appUrl()}/orders/${order.number}?t=${trackingToken(order.id)}`;
}

export { appUrl };

export function verifyTracking(order: Pick<Order, "id" | "trackingTokenHash">, token: string | null | undefined): boolean {
  if (!token || token.length !== 32) return false;
  return safeEqual(sha256(token), order.trackingTokenHash) && safeEqual(token, trackingToken(order.id));
}

export async function addEvent(
  tx: Tx,
  e: { orderId: string; type: string; from?: string | null; to?: string | null; message?: string | null; visible?: boolean; actorId?: string | null; actorLabel: string },
) {
  await tx.insert(schema.orderEvents).values({
    orderId: e.orderId, type: e.type, fromStatus: e.from ?? null, toStatus: e.to ?? null,
    message: e.message ?? null, visibleToCustomer: e.visible ?? false, actorId: e.actorId ?? null, actorLabel: e.actorLabel,
  });
}

export type CreatedOrder = { order: Order; token: string; url: string; replayed: boolean };

export async function createOrder(input: CheckoutInput, db = getDb()): Promise<CreatedOrder> {
  const existing = await db.query.orders.findFirst({ where: eq(schema.orders.checkoutKey, input.checkoutKey) });
  if (existing) return { order: existing, token: trackingToken(existing.id), url: trackingUrl(existing), replayed: true };

  const legal = await getSetting("legal", db);

  return db.transaction(async (tx) => {
    // Serialise bookings for the same delivery date so capacity can't be oversold.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"delivery:" + input.delivery.date}))`);

    const cart = await priceCart(input.lines, input.delivery.zoneId, tx);
    if (cart.errors.length) throw new OrderError(cart.errors[0].message, "lines", 409);
    if (!cart.lines.length) throw new OrderError("Your bag is empty.", "lines");
    if (!cart.delivery) throw new OrderError("Choose a delivery area.", "delivery.zoneId");
    if (cart.needsLetterBrief && !input.letter) throw new OrderError("Tell us what your letter should say.", "letter");
    if (cart.delivery.mode !== "pickup" && (!input.delivery.address || input.delivery.address.length < 8))
      throw new OrderError("Enter the full delivery address, including street and area.", "delivery.address");

    const dateCheck = await checkDeliveryDate(input.delivery.date, { productionDays: cart.productionDays, transitDays: cart.delivery.transitDays }, tx);
    if (!dateCheck.ok) throw new OrderError(dateCheck.error, "delivery.date");

    const status: OrderStatus = cart.delivery.mode === "quote" ? "awaiting_quote" : "pending_payment";
    let number = orderNumber();
    for (let i = 0; i < 5; i++) {
      const clash = await tx.query.orders.findFirst({ where: eq(schema.orders.number, number), columns: { id: true } });
      if (!clash) break;
      number = orderNumber();
    }

    const id = crypto.randomUUID();
    const token = trackingToken(id);
    const [order] = await tx.insert(schema.orders).values({
      id,
      number,
      checkoutKey: input.checkoutKey,
      status,
      buyerName: input.buyer.name,
      buyerPhone: input.buyer.phone,
      buyerEmail: input.buyer.email ?? null,
      recipientName: input.recipient.name,
      recipientPhone: input.recipient.phone ?? null,
      zoneId: cart.delivery.zoneId,
      zoneName: cart.delivery.zoneName,
      deliveryMode: cart.delivery.mode,
      deliveryAddress: cart.delivery.mode === "pickup" ? null : input.delivery.address ?? null,
      deliveryInstructions: input.delivery.instructions ?? null,
      giftNote: input.giftNote ?? null,
      deliveryDate: input.delivery.date,
      deliveryWindow: input.delivery.window,
      deliveryFee: cart.delivery.fee,
      subtotal: cart.subtotal,
      total: cart.total,
      approvalRequired: cart.approvalRequired,
      photoBeforeDispatch: input.photoBeforeDispatch,
      trackingTokenHash: sha256(token),
      source: input.source ?? {},
      privacyNoticeVersion: legal.version,
      consentAt: new Date(),
      marketingOptIn: input.marketingOptIn,
      retainUntil: addDays(input.delivery.date, 120),
    }).returning();

    const items = await tx.insert(schema.orderItems).values(cart.lines.map((l) => ({
      orderId: id, productId: l.productId, variantId: l.variantId, productName: l.productName,
      variantName: l.variantName, kind: l.kind, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal,
    }))).returning();

    if (input.letter) {
      const letterItem = items.find((i) => cart.lines.find((l) => l.variantId === i.variantId)?.requiresLetterBrief);
      const L = input.letter;
      await tx.insert(schema.letterBriefs).values({
        orderId: id,
        orderItemId: letterItem?.id ?? null,
        mode: L.mode,
        message: L.mode === "own_words" ? L.message : null,
        relationship: L.mode === "help_me" ? L.relationship : null,
        occasion: L.mode === "help_me" ? L.occasion : null,
        feelings: L.mode === "help_me" ? L.feelings : null,
        memories: L.mode === "help_me" ? L.memories ?? null : null,
        nicknames: L.mode === "help_me" ? L.nicknames ?? null : null,
        avoid: L.mode === "help_me" ? L.avoid ?? null : null,
        tone: L.tone ?? null,
        signOff: L.signOff ?? null,
      });
    }

    await addEvent(tx, { orderId: id, type: "created", to: status, message: CUSTOMER_MESSAGE[status], visible: true, actorLabel: "customer" });
    await track(tx, { name: "order_created", orderNumber: number, value: cart.total ?? cart.subtotal, source: input.source?.source, medium: input.source?.medium, campaign: input.source?.campaign });

    const url = `${appUrl()}/orders/${number}?t=${token}`;
    if (order.buyerEmail) {
      await queueNotification(tx, {
        orderId: id, channel: "email", to: order.buyerEmail,
        subject: `Your Love Lives Here order ${number}`,
        body: status === "awaiting_quote"
          ? `Hi ${order.buyerName},\n\nThank you. We've saved your order ${number}. Because the address needs a delivery quote, we'll send you the final total before you pay.\n\nTrack your order: ${url}\n\nLove Lives Here`
          : `Hi ${order.buyerName},\n\nWe've saved your order ${number}. If you haven't finished paying, you can do it here: ${url}\n\nLove Lives Here`,
      });
    }
    return { order, token, url, replayed: false };
  });
}

/** Staff sets the delivery fee for an awaiting-quote order; it then becomes payable. */
export async function setDeliveryQuote(orderId: string, feeKobo: number, actor: { id: string; email: string }) {
  if (!Number.isInteger(feeKobo) || feeKobo < 0 || feeKobo > 50_000_000) throw new OrderError("Enter a valid delivery fee.");
  return getDb().transaction(async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!o) throw new OrderError("Order not found", undefined, 404);
    if (o.status !== "awaiting_quote" && o.status !== "pending_payment") throw new OrderError("Only unpaid orders can have their delivery fee changed.");
    const [u] = await tx.update(schema.orders)
      .set({ deliveryFee: feeKobo, total: o.subtotal + feeKobo, status: "pending_payment", updatedAt: new Date() })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.paymentStatus, "unpaid")))
      .returning();
    if (!u) throw new OrderError("Order was paid in the meantime.");
    await addEvent(tx, {
      orderId, type: "quote", from: o.status, to: "pending_payment", visible: true, actorId: actor.id, actorLabel: actor.email,
      message: `Delivery fee confirmed. Your total is ready to pay.`,
    });
    if (u.buyerEmail) {
      await queueNotification(tx, {
        orderId, channel: "email", to: u.buyerEmail, subject: `Your delivery quote for ${u.number}`,
        body: `Hi ${u.buyerName},\n\nYour delivery fee is confirmed. You can review the final total and pay here: ${trackingUrl(u)}\n\nLove Lives Here`,
      });
    }
    return u;
  });
}

export async function transitionOrder(orderId: string, to: OrderStatus, actor: { id: string | null; label: string }, note?: string) {
  return getDb().transaction(async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!o) throw new OrderError("Order not found", undefined, 404);
    const approved = await tx.query.letterDrafts.findFirst({ where: and(eq(schema.letterDrafts.orderId, orderId), eq(schema.letterDrafts.status, "approved")) });
    const check = canTransition(o.status, to, { approvalRequired: o.approvalRequired, hasApprovedDraft: !!approved, paymentStatus: o.paymentStatus });
    if (!check.ok) throw new OrderError(check.reason, undefined, 409);
    const patch: Partial<Order> = { status: to, updatedAt: new Date() };
    if (to === "delivered") patch.deliveredAt = new Date();
    const [u] = await tx.update(schema.orders).set(patch).where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, o.status))).returning();
    if (!u) throw new OrderError("This order changed while you were editing. Reload and try again.", undefined, 409);
    await addEvent(tx, { orderId, type: "status", from: o.status, to, message: note || CUSTOMER_MESSAGE[to] || STATUS_LABEL[to], visible: true, actorId: actor.id, actorLabel: actor.label });
    if (to === "dispatched") await tx.insert(schema.deliveries).values({ orderId, dispatchedAt: new Date() }).onConflictDoUpdate({ target: schema.deliveries.orderId, set: { dispatchedAt: new Date() } });
    if (to === "delivered") await tx.insert(schema.deliveries).values({ orderId, deliveredAt: new Date() }).onConflictDoUpdate({ target: schema.deliveries.orderId, set: { deliveredAt: new Date() } });
    if (u.buyerEmail && ["dispatched", "delivered", "delivery_failed", "awaiting_approval"].includes(to)) {
      await queueNotification(tx, {
        orderId, channel: "email", to: u.buyerEmail, subject: `${u.number}: ${STATUS_LABEL[to]}`,
        body: `Hi ${u.buyerName},\n\n${CUSTOMER_MESSAGE[to] ?? STATUS_LABEL[to]}\n\nSee your order: ${trackingUrl(u)}\n\nLove Lives Here`,
      });
    }
    return u;
  });
}

export async function getOrderByNumber(number: string, tx: Tx = getDb()) {
  return tx.query.orders.findFirst({
    where: eq(schema.orders.number, number.toUpperCase()),
    with: {
      items: true,
      events: { orderBy: [desc(schema.orderEvents.createdAt)] },
      drafts: { orderBy: [desc(schema.letterDrafts.version)] },
      payments: { orderBy: [desc(schema.payments.createdAt)] },
      delivery: true,
      experiences: true,
    },
  });
}
