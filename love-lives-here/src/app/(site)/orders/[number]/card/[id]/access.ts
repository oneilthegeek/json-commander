import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { verifyTracking } from "@/lib/orders";

/** Buyer access to one of their order's cards: valid tracking token, paid order, card belongs to it. */
export async function buyerCard(number: string, id: string, token: string, opts: { requireEdit?: boolean } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.number, number.toUpperCase()) });
  if (!order || !verifyTracking(order, token) || order.paymentStatus !== "paid") return null;
  const e = await db.query.nfcExperiences.findFirst({
    where: and(eq(schema.nfcExperiences.id, id), eq(schema.nfcExperiences.orderId, order.id)),
    with: { items: { orderBy: (t, { asc }) => [asc(t.sort), asc(t.createdAt)] } },
  });
  if (!e || (opts.requireEdit && !e.buyerCanEdit)) return null;
  return { order, e };
}
