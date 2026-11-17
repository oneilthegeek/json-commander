/**
 * Data-retention job (NDPA 2023: storage limitation & data minimisation).
 *
 * For orders whose retain_until date has passed and that are finished
 * (delivered, cancelled or refunded), this removes the personal content we no
 * longer need while keeping the financial record required for accounting:
 *   - letter briefs and drafts: deleted
 *   - recipient name/phone, address, directions, candle note: removed
 *   - buyer email/phone: removed (name kept on the receipt record)
 *   - Gold Card / Tag content and media: deleted (unless the card is still
 *     active and has no expiry — those are kept until the owner disables it)
 *   - closed support messages older than 12 months: deleted
 *   - analytics events older than 25 months: deleted
 *
 * Run daily (cron / scheduled job):  npm run retention   (add --dry-run to preview)
 */
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb, closeDb, schema } from "../src/lib/db";
import { lagosToday } from "../src/lib/dates";

export async function runRetention(opts: { dryRun?: boolean; today?: string } = {}) {
  const db = getDb();
  const today = opts.today ?? lagosToday();
  const due = await db.select({ id: schema.orders.id, number: schema.orders.number }).from(schema.orders).where(and(
    lt(schema.orders.retainUntil, today),
    isNull(schema.orders.anonymisedAt),
    inArray(schema.orders.status, ["delivered", "cancelled", "refunded"]),
  ));
  const ids = due.map((d) => d.id);
  const summary = { orders: ids.length, supportDeleted: 0, analyticsDeleted: 0 };
  if (opts.dryRun) return { ...summary, numbers: due.map((d) => d.number) };

  if (ids.length) {
    await db.transaction(async (tx) => {
      await tx.delete(schema.letterBriefs).where(inArray(schema.letterBriefs.orderId, ids));
      await tx.delete(schema.letterDrafts).where(inArray(schema.letterDrafts.orderId, ids));
      await tx.update(schema.orders).set({
        recipientName: "(removed)", recipientPhone: null, deliveryAddress: null, deliveryInstructions: null, giftNote: null,
        buyerEmail: null, buyerPhone: "(removed)", anonymisedAt: new Date(),
      }).where(inArray(schema.orders.id, ids));
      await tx.update(schema.deliveries).set({ riderPhone: null, notes: null }).where(inArray(schema.deliveries.orderId, ids));
      await tx.update(schema.orderEvents).set({ message: "(removed)" }).where(and(inArray(schema.orderEvents.orderId, ids), inArray(schema.orderEvents.type, ["note", "approval_recorded", "card_edit"])));
      // Card content: remove unless the card is still live with no expiry chosen
      const exps = await tx.select().from(schema.nfcExperiences).where(inArray(schema.nfcExperiences.orderId, ids));
      const purge = exps.filter((e) => !(e.status === "active" && !e.expiresAt)).map((e) => e.id);
      if (purge.length) {
        await tx.delete(schema.nfcItems).where(inArray(schema.nfcItems.experienceId, purge));
        await tx.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.experienceId, purge));
        await tx.update(schema.nfcExperiences).set({ status: "disabled", recipientName: null, fromName: null, redirectUrl: null, accessCodeHash: null }).where(inArray(schema.nfcExperiences.id, purge));
      }
      await tx.insert(schema.auditLogs).values({ action: "retention.anonymise", entity: "orders", meta: { count: ids.length, numbers: due.map((d) => d.number) } });
    });
  }
  const s = await db.delete(schema.supportMessages).where(and(eq(schema.supportMessages.status, "closed"), lt(schema.supportMessages.createdAt, sql`now() - interval '12 months'`))).returning({ id: schema.supportMessages.id });
  const a = await db.delete(schema.analyticsEvents).where(lt(schema.analyticsEvents.createdAt, sql`now() - interval '25 months'`)).returning({ id: schema.analyticsEvents.id });
  // Expired staff sessions and old rate-limit rows
  await db.delete(schema.staffSessions).where(lt(schema.staffSessions.expiresAt, new Date()));
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, sql`now() - interval '1 day'`));
  return { ...summary, numbers: due.map((d) => d.number), supportDeleted: s.length, analyticsDeleted: a.length };
}

if (process.argv[1]?.endsWith("retention.ts")) {
  runRetention({ dryRun: process.argv.includes("--dry-run") })
    .then((r) => { console.log(JSON.stringify(r)); return closeDb(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
