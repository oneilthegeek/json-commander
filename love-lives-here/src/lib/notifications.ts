/**
 * Notifications go through an outbox table so nothing is lost if the email
 * provider is down or not configured.
 *  - With RESEND_API_KEY set, every queued message is sent automatically right
 *    after the action that created it (`kickOutbox`), and a cron job
 *    (`scripts/flush-outbox.ts`) retries anything that failed.
 *  - Without it, messages stay "queued" and the admin Outbox shows one-tap
 *    email/WhatsApp links so staff can send them by hand. Nothing is ever
 *    reported as sent when it wasn't.
 */
import { inArray, sql } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";
import { alert } from "./alert";

export async function queueNotification(tx: Tx, n: { orderId?: string; channel: "email"; to: string; subject: string; body: string }) {
  await tx.insert(schema.outbox).values({ orderId: n.orderId ?? null, channel: n.channel, to: n.to, subject: n.subject, body: n.body });
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

type Sender = (m: { to: string; subject: string; body: string }) => Promise<void>;

const resend: Sender = async (m) => {
  const res = await fetch(process.env.RESEND_BASE_URL ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};

/**
 * Sends queued messages (and retries failures from the last 24 hours).
 * Rows are claimed with FOR UPDATE SKIP LOCKED so two concurrent flushes can
 * never send the same message twice.
 */
export async function flushOutbox(limit = 20, send: Sender = resend): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: true };
  const db = getDb();
  let sent = 0, failed = 0;
  await db.transaction(async (tx) => {
    const rows = (await tx.execute<{ id: string; to: string; subject: string; body: string }>(sql`
      select id, "to", subject, body from notification_outbox
      where status = 'queued' or (status = 'failed' and created_at > now() - interval '1 day')
      order by created_at limit ${limit} for update skip locked`)).rows;
    for (const r of rows) {
      try {
        await send(r);
        await tx.update(schema.outbox).set({ status: "sent", sentAt: new Date(), error: null }).where(sql`id = ${r.id}`);
        sent++;
      } catch (e) {
        await tx.update(schema.outbox).set({ status: "failed", error: String((e as Error).message).slice(0, 300) }).where(sql`id = ${r.id}`);
        failed++;
      }
    }
  });
  if (failed) await alert("email_send_failed", `${failed} customer email(s) failed to send; see Admin → Outbox.`);
  return { sent, failed, skipped: false };
}

/** Fire-and-forget send after an action. Never throws into the caller. */
export function kickOutbox() {
  if (!emailConfigured()) return;
  flushOutbox().catch((e) => console.error("outbox flush failed", (e as Error).message));
}

export async function markManual(ids: string[]) {
  if (!ids.length) return;
  await getDb().update(schema.outbox).set({ status: "manual", sentAt: new Date() }).where(inArray(schema.outbox.id, ids));
}
