import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "./db";
import { ORDER_STATUSES, type OrderStatus } from "./order-status";
import { isIsoDate } from "./dates";

export type OrderFilters = { q?: string; status?: string; payment?: string; from?: string; to?: string; mine?: string; staffId?: string; flag?: string; nfc?: string; test?: string };

export function orderWhere(f: OrderFilters): SQL | undefined {
  const w: (SQL | undefined)[] = [];
  const q = (f.q ?? "").trim().slice(0, 80);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const digits = q.replace(/\D/g, "");
    w.push(or(ilike(schema.orders.number, like), ilike(schema.orders.buyerName, like), ilike(schema.orders.recipientName, like), ilike(schema.orders.buyerEmail, like),
      ...(digits.length >= 6 ? [ilike(schema.orders.buyerPhone, `%${digits.slice(-9)}%`)] : [])));
  }
  if (f.status && ORDER_STATUSES.includes(f.status as OrderStatus)) w.push(eq(schema.orders.status, f.status as OrderStatus));
  if (f.status === "open") w.push(inArray(schema.orders.status, ["paid", "drafting", "awaiting_approval", "approved", "in_production", "packed", "dispatched", "on_hold", "delivery_failed"]));
  if (f.payment && ["unpaid", "paid", "refunded", "partially_refunded"].includes(f.payment)) w.push(eq(schema.orders.paymentStatus, f.payment as "paid"));
  if (isIsoDate(f.from)) w.push(gte(schema.orders.deliveryDate, f.from));
  if (isIsoDate(f.to)) w.push(lte(schema.orders.deliveryDate, f.to));
  if (f.mine && f.staffId) w.push(eq(schema.orders.assignedTo, f.staffId));
  if (f.flag === "duplicate") w.push(eq(schema.orders.duplicatePaymentFlag, true));
  if (f.nfc === "1") w.push(sql`exists (select 1 from nfc_experiences e where e.order_id = ${schema.orders.id} and e.status = 'draft')`);
  if (f.test !== "1") w.push(eq(schema.orders.testMode, false));
  return and(...w.filter(Boolean));
}

export async function listOrders(f: OrderFilters, limit = 100, offset = 0) {
  return getDb().select().from(schema.orders).where(orderWhere(f)).orderBy(desc(schema.orders.createdAt)).limit(limit).offset(offset);
}
