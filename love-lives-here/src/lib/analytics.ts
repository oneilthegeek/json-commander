/**
 * First-party, cookieless analytics. Events carry no personal data: no names,
 * phone numbers, emails, addresses or message contents. The browser sends a
 * random per-tab session id only.
 */
import { getDb, schema, type Tx } from "./db";

export const CLIENT_EVENTS = [
  "page_view", "product_view", "variant_select", "add_to_cart", "remove_from_cart",
  "letter_start", "letter_complete", "checkout_start", "delivery_select",
  "newsletter_signup_click", "whatsapp_click", "checkout_abandon",
] as const;
export const SERVER_EVENTS = ["order_created", "payment_initiated", "purchase", "payment_failed", "newsletter_signup", "refund"] as const;
export type EventName = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

export type TrackInput = {
  name: EventName; sessionId?: string; path?: string; product?: string; value?: number | null;
  orderNumber?: string; source?: string; medium?: string; campaign?: string; test?: boolean;
};

const short = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : undefined);

export async function track(tx: Tx | null, e: TrackInput) {
  try {
    await (tx ?? getDb()).insert(schema.analyticsEvents).values({
      name: e.name,
      sessionId: short(e.sessionId, 40) ?? null,
      // Strip query strings: they can carry tracking tokens
      path: short(e.path?.split("?")[0], 200) ?? null,
      product: short(e.product, 80) ?? null,
      value: Number.isInteger(e.value) ? e.value! : null,
      orderNumber: short(e.orderNumber, 20) ?? null,
      source: short(e.source, 80) ?? null,
      medium: short(e.medium, 80) ?? null,
      campaign: short(e.campaign, 120) ?? null,
      test: e.test ?? false,
    });
  } catch (err) {
    if (tx) throw err; // inside a transaction, surface it
    console.error("analytics insert failed", (err as Error).message);
  }
}
