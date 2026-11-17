import { NextResponse } from "next/server";
import { startPayment } from "@/lib/payments";
import { errorResponse, limited, readJson } from "@/lib/http";

/** Starts (or retries) a Paystack payment for an order. Requires the order's tracking token. */
export async function POST(req: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const rl = await limited("pay", 20, 10 * 60);
    if (rl) return rl;
    const { number } = await params;
    const body = (await readJson(req)) as { token?: string };
    const r = await startPayment(number.toUpperCase(), String(body.token ?? ""));
    return NextResponse.json({ authorizationUrl: r.authorizationUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
