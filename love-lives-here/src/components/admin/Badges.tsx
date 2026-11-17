import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

export function StatusBadge({ s }: { s: OrderStatus }) {
  const cls = ["delivered", "approved"].includes(s) ? "ok" : ["cancelled", "refunded", "delivery_failed", "on_hold"].includes(s) ? "bad" : ["awaiting_quote", "pending_payment", "awaiting_approval"].includes(s) ? "warn" : "";
  return <span className={`badge ${cls}`}>{STATUS_LABEL[s]}</span>;
}
export function PayBadge({ s }: { s: string }) {
  const cls = s === "paid" ? "ok" : s === "unpaid" ? "warn" : "bad";
  return <span className={`badge ${cls}`}>{s.replace("_", " ")}</span>;
}
