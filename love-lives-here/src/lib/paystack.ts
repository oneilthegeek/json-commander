/**
 * Minimal Paystack API client (server only), following
 * https://paystack.com/docs/api/transaction/ and /docs/payments/webhooks/.
 * The secret key never leaves the server and is never logged.
 */
import "server-only";
import { createHmac } from "node:crypto";
import { safeEqual } from "./tokens";

const LIVE_BASE = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(message: string, public httpStatus?: number) { super(message); }
}

export function paystackConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

function base(): string {
  const b = (process.env.PAYSTACK_BASE_URL || LIVE_BASE).replace(/\/$/, "");
  // Only the automated end-to-end test run (LLH_E2E=1 with a sk_test_ key) may point elsewhere.
  if (process.env.NODE_ENV === "production" && b !== LIVE_BASE && !(process.env.LLH_E2E === "1" && isTestKey()))
    throw new PaystackError("PAYSTACK_BASE_URL must be the real Paystack API in production");
  return b;
}

function key(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new PaystackError("Online payment isn't set up yet.");
  return k;
}

/** True when using a Paystack test key. Orders paid this way are test data. */
export function isTestKey(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test_");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(base() + path, {
      ...init,
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new PaystackError(`Couldn't reach Paystack: ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) throw new PaystackError(body?.message ?? `Paystack error (HTTP ${res.status})`, res.status);
  return body.data as T;
}

export type InitResult = { authorization_url: string; access_code: string; reference: string };

export function initializeTransaction(p: { email: string; amount: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }) {
  return call<InitResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: p.email, amount: p.amount, currency: "NGN", reference: p.reference,
      callback_url: p.callbackUrl, metadata: p.metadata ?? {},
    }),
  });
}

export type VerifyData = {
  id: number;
  domain: "test" | "live";
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed";
  reference: string;
  amount: number;
  currency: string;
  gateway_response?: string;
  channel?: string;
  paid_at?: string | null;
};

export function verifyTransaction(reference: string) {
  return call<VerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export type RefundData = { id?: number; status: string; amount?: number; transaction?: { reference?: string } };

export function createRefund(p: { reference: string; amount: number; note: string }) {
  return call<RefundData>("/refund", { method: "POST", body: JSON.stringify({ transaction: p.reference, amount: p.amount, merchant_note: p.note.slice(0, 200) }) });
}

/** Webhook signature: HMAC-SHA512 of the raw body with the secret key, hex-encoded. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k || !signature) return false;
  const expected = createHmac("sha512", k).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

export function signWebhook(rawBody: string, secret: string): string {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}
