/**
 * Notifications go through an outbox table so nothing is lost if the email
 * provider is down or not configured. With RESEND_API_KEY set, `flushOutbox`
 * delivers email. Without it, messages stay "queued" and the admin shows a
 * one-tap WhatsApp/email link so staff can send them by hand — the system
 * never claims a message was sent when it wasn't.
 */
import { eq, inArray } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";

export async function queueNotification(tx: Tx, n: { orderId?: string; channel: "email"; to: string; subject: string; body: string }) {
  await tx.insert(schema.outbox).values({ orderId: n.orderId ?? null, channel: n.channel, to: n.to, subject: n.subject, body: n.body });
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function flushOutbox(limit = 20): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: true };
  const db = getDb();
  const rows = await db.select().from(schema.outbox).where(eq(schema.outbox.status, "queued")).limit(limit);
  let sent = 0, failed = 0;
  for (const r of rows) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [r.to], subject: r.subject, text: r.body }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await db.update(schema.outbox).set({ status: "sent", sentAt: new Date(), error: null }).where(eq(schema.outbox.id, r.id));
      sent++;
    } catch (e) {
      await db.update(schema.outbox).set({ status: "failed", error: String((e as Error).message).slice(0, 300) }).where(eq(schema.outbox.id, r.id));
      failed++;
    }
  }
  return { sent, failed, skipped: false };
}

export async function markManual(ids: string[]) {
  if (!ids.length) return;
  await getDb().update(schema.outbox).set({ status: "manual", sentAt: new Date() }).where(inArray(schema.outbox.id, ids));
}
