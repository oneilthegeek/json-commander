/**
 * Dear Lovers newsletter.
 *
 * Substack has no official public API for adding subscribers, so we never
 * POST to undocumented Substack endpoints. Two supported options:
 *
 *  - "substack": the visitor confirms on Substack's own hosted subscribe page
 *    (SUBSTACK_PUBLICATION_URL/subscribe?email=…). Substack sends the
 *    confirmation email and handles unsubscribes. We record only that the
 *    visitor was handed over — we do NOT claim they subscribed.
 *  - "mailchimp": Mailchimp Marketing API v3 with double opt-in ("pending").
 *    Duplicates are detected, and unsubscribe is supported via the API and
 *    Mailchimp's own footer link.
 */
import { createHash } from "node:crypto";
import { getDb, schema } from "./db";
import { track } from "./analytics";

export const CONSENT_TEXT = "I'd like to receive Dear Lovers emails from Love Lives Here. I can unsubscribe at any time.";

export type SignupResult =
  | { status: "redirect"; url: string; message: string }
  | { status: "pending"; message: string }
  | { status: "already"; message: string }
  | { status: "error"; message: string };

export function provider(): "substack" | "mailchimp" | "none" {
  const p = process.env.NEWSLETTER_PROVIDER;
  if (p === "mailchimp" && process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_AUDIENCE_ID) return "mailchimp";
  if (p !== "mailchimp" && process.env.SUBSTACK_PUBLICATION_URL) return "substack";
  return "none";
}

const emailHash = (e: string) => createHash("sha256").update(e.trim().toLowerCase()).digest("hex");

function mailchimpBase() {
  const key = process.env.MAILCHIMP_API_KEY!;
  const dc = key.split("-")[1];
  return (process.env.MAILCHIMP_BASE_URL || `https://${dc}.api.mailchimp.com`).replace(/\/$/, "") + "/3.0";
}
function mcHeaders() {
  return { Authorization: "Basic " + Buffer.from("llh:" + process.env.MAILCHIMP_API_KEY).toString("base64"), "Content-Type": "application/json" };
}
const memberId = (email: string) => createHash("md5").update(email.toLowerCase()).digest("hex");

async function log(email: string, result: string, source?: string) {
  await getDb().insert(schema.newsletterSignups).values({ emailHash: emailHash(email), provider: provider(), result, source: source ?? null, consentText: CONSENT_TEXT });
}

export async function subscribe(email: string, source?: string): Promise<SignupResult> {
  const p = provider();
  if (p === "none") return { status: "error", message: "Signups aren't switched on yet. Follow us on Instagram for news in the meantime." };

  if (p === "substack") {
    const base = process.env.SUBSTACK_PUBLICATION_URL!.replace(/\/$/, "");
    await log(email, "handed_to_substack", source);
    return { status: "redirect", url: `${base}/subscribe?email=${encodeURIComponent(email)}`, message: "Almost there — confirm on Substack to join Dear Lovers." };
  }

  const url = `${mailchimpBase()}/lists/${process.env.MAILCHIMP_AUDIENCE_ID}/members/${memberId(email)}`;
  try {
    const existing = await fetch(url, { headers: mcHeaders(), signal: AbortSignal.timeout(10_000) });
    if (existing.ok) {
      const m = (await existing.json()) as { status?: string };
      if (m.status === "subscribed") { await log(email, "already", source); return { status: "already", message: "You're already on the list. Thank you for being here." }; }
      if (m.status === "pending") { await log(email, "already_pending", source); return { status: "pending", message: "We've already sent you a confirmation email — check your inbox (and spam)." }; }
    }
    const res = await fetch(url, {
      method: "PUT", headers: mcHeaders(), signal: AbortSignal.timeout(10_000),
      // "pending" = double opt-in: Mailchimp emails a confirmation link before adding them.
      body: JSON.stringify({ email_address: email, status_if_new: "pending", status: "pending", tags: ["website", ...(source ? [source] : [])] }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { title?: string; detail?: string };
      await log(email, `error:${res.status}`, source);
      if (body.title === "Invalid Resource" || body.title === "Forgotten Email Not Subscribed")
        return { status: "error", message: "We couldn't add that address. Please check it, or use another email." };
      return { status: "error", message: "Something went wrong on our side. Please try again in a moment." };
    }
    await log(email, "pending", source);
    await track(null, { name: "newsletter_signup", source });
    return { status: "pending", message: "Check your inbox to confirm your subscription to Dear Lovers." };
  } catch {
    return { status: "error", message: "We couldn't reach our mailing service. Please try again in a moment." };
  }
}

export async function unsubscribe(email: string): Promise<{ ok: boolean; message: string }> {
  const p = provider();
  if (p === "substack") {
    return { ok: true, message: "Use the “Unsubscribe” link at the bottom of any Dear Lovers email, or manage your subscription in your Substack account settings." };
  }
  if (p !== "mailchimp") return { ok: false, message: "Newsletter isn't switched on." };
  const res = await fetch(`${mailchimpBase()}/lists/${process.env.MAILCHIMP_AUDIENCE_ID}/members/${memberId(email)}`, {
    method: "PATCH", headers: mcHeaders(), body: JSON.stringify({ status: "unsubscribed" }), signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  // Respond the same whether or not the address was on the list (no list enumeration).
  if (res && (res.ok || res.status === 404)) { await log(email, "unsubscribed"); return { ok: true, message: "If that address was subscribed, it's now unsubscribed. You won't get further emails." }; }
  return { ok: false, message: "We couldn't process that right now. Please try again." };
}
