/**
 * Operational alerts. Always logged as structured JSON (picked up by the host's
 * log collector). If ALERT_WEBHOOK_URL is set — e.g. a Slack/Discord/Google
 * Chat incoming webhook — a short message is also posted there.
 * Alerts never include customer personal data or letter content.
 */
export type AlertKind = "refund_failed"
  | "server_error" | "payment_mismatch" | "duplicate_payment" | "payment_after_close"
  | "webhook_failed" | "email_send_failed" | "stock_short";

const recent = new Map<string, number>();

export async function alert(kind: AlertKind, message: string, ref?: string) {
  console.error(JSON.stringify({ level: "alert", kind, message, ref, at: new Date().toISOString() }));
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  // De-duplicate bursts: one alert per kind+ref per 10 minutes per instance.
  const key = `${kind}:${ref ?? ""}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 600_000) return;
  recent.set(key, now);
  try {
    await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ text: `LLH ${kind}: ${message}${ref ? ` (${ref})` : ""}`, content: `LLH ${kind}: ${message}${ref ? ` (${ref})` : ""}` }),
    });
  } catch { /* alerting must never break the request */ }
}
