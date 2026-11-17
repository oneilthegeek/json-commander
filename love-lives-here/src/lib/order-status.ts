/** Order lifecycle. Pure (no DB) so it can be shared by UI and tests. */
export const ORDER_STATUSES = [
  "awaiting_quote", "pending_payment", "paid", "drafting", "awaiting_approval", "approved",
  "in_production", "packed", "dispatched", "delivered",
  "on_hold", "delivery_failed", "cancelled", "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_quote: "Awaiting delivery quote",
  pending_payment: "Pending payment",
  paid: "Paid",
  drafting: "Drafting your letter",
  awaiting_approval: "Awaiting your approval",
  approved: "Letter approved",
  in_production: "In production",
  packed: "Packed",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  on_hold: "On hold",
  delivery_failed: "Delivery attempt failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** What the customer sees on the tracking page for each status change. */
export const CUSTOMER_MESSAGE: Partial<Record<OrderStatus, string>> = {
  awaiting_quote: "We're working out the delivery fee for your address. We'll send the final total before you pay.",
  pending_payment: "Your order is saved and waiting for payment.",
  paid: "Payment confirmed. Thank you — we've started on your order.",
  drafting: "We're shaping your words into your letter.",
  awaiting_approval: "Your letter is ready for you to read. Nothing is sealed until you say yes.",
  approved: "You approved your letter. We'll handwrite and seal it next.",
  in_production: "Your order is being handmade.",
  packed: "Sealed in wax and packed.",
  dispatched: "Your order is out with our rider.",
  delivered: "Delivered.",
  delivery_failed: "Our rider couldn't complete the delivery. We'll be in touch to arrange another attempt.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
};

/** The happy path, for progress displays. */
export const PROGRESS: OrderStatus[] = ["paid", "drafting", "awaiting_approval", "approved", "in_production", "packed", "dispatched", "delivered"];

const OPERATIONAL: OrderStatus[] = ["drafting", "awaiting_approval", "approved", "in_production", "packed", "dispatched"];

/**
 * Manual transitions staff may make. "paid" is deliberately absent:
 * only verified payments (or an audited manual-payment record) set it.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_quote: ["cancelled"], // becomes payable only via the delivery-quote form (sets the fee)
  pending_payment: ["awaiting_quote", "cancelled"],
  paid: ["drafting", "in_production", "on_hold", "cancelled"],
  drafting: ["awaiting_approval", "in_production", "on_hold", "cancelled"],
  awaiting_approval: ["approved", "drafting", "on_hold", "cancelled"],
  approved: ["in_production", "drafting", "on_hold"],
  in_production: ["packed", "on_hold"],
  packed: ["dispatched", "on_hold"],
  dispatched: ["delivered", "delivery_failed"],
  delivery_failed: ["dispatched", "on_hold", "cancelled"],
  on_hold: [...OPERATIONAL, "cancelled"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export type TransitionContext = {
  approvalRequired: boolean;
  hasApprovedDraft: boolean;
  paymentStatus: string;
};

export function canTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): { ok: true } | { ok: false; reason: string } {
  if (!TRANSITIONS[from]?.includes(to)) return { ok: false, reason: `Can't move an order from "${STATUS_LABEL[from]}" to "${STATUS_LABEL[to]}".` };
  if (OPERATIONAL.includes(to) && !["paid", "partially_refunded"].includes(ctx.paymentStatus))
    return { ok: false, reason: "This order hasn't been paid." };
  if (to === "in_production" && ctx.approvalRequired && !ctx.hasApprovedDraft)
    return { ok: false, reason: "The buyer hasn't approved the letter yet. Production must wait for approval." };
  if (to === "approved" && !ctx.hasApprovedDraft)
    return { ok: false, reason: "Record the buyer's approval on a draft first." };
  if (to === "cancelled" && ["paid", "partially_refunded"].includes(ctx.paymentStatus))
    return { ok: false, reason: "This order was paid. Issue a refund instead of cancelling it." };
  return { ok: true };
}
