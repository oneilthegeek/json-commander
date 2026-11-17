"use server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validatePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { STATUS_LABEL } from "@/lib/order-status";
import { formatLongDate, formatDateTime } from "@/lib/dates";

export type LookupState = { error?: string; result?: { number: string; status: string; date: string; updates: { at: string; text: string }[] } };

/** Limited status lookup: order number + the buyer's phone. Shows no address, letter or payment details. */
export async function lookup(_: LookupState, fd: FormData): Promise<LookupState> {
  const rl = await rateLimit(`track:${await clientIp()}`, 10, 15 * 60);
  if (!rl.ok) return { error: "Too many attempts. Please wait 15 minutes, or message us on WhatsApp." };
  const number = String(fd.get("number") ?? "").trim().toUpperCase();
  const phone = validatePhone(String(fd.get("phone") ?? ""));
  if (!/^LLH-[A-Z0-9]{7}$/.test(number)) return { error: "Order numbers look like LLH-AB3CD7E. You'll find it in your confirmation email." };
  if (!phone.ok) return { error: phone.error };
  const db = getDb();
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.number, number) });
  if (!o || o.buyerPhone !== phone.e164) return { error: "We couldn't find an order with that number and phone. Check both, or message us." };
  const ev = await db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, o.id)).orderBy(desc(schema.orderEvents.createdAt)).limit(10);
  return {
    result: {
      number: o.number, status: STATUS_LABEL[o.status], date: formatLongDate(o.deliveryDate),
      updates: ev.filter((e) => e.visibleToCustomer && e.message).map((e) => ({ at: formatDateTime(e.createdAt), text: e.message! })),
    },
  };
}
