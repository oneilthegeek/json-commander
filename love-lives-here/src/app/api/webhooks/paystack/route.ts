import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { handleWebhook } from "@/lib/payments";

/**
 * Paystack webhook. Authenticated by the x-paystack-signature HMAC; anything
 * unsigned is rejected. Payment state is re-verified against Paystack's API
 * rather than trusting the body, and processing is idempotent.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  try {
    const result = await handleWebhook(raw);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("paystack webhook failed", (e as Error).message);
    // 5xx makes Paystack retry later
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
