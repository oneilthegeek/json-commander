import { ipFromHeaders } from "@/lib/client-ip";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { headers } from "next/headers";
import { fieldErrors } from "./validation";
import { OrderError } from "./orders";
import { rateLimit } from "./rate-limit";

export async function ip(): Promise<string> {
  const h = await headers();
  return ipFromHeaders(h);
}

export async function limited(bucket: string, limit: number, windowSec: number) {
  const r = await rateLimit(`${bucket}:${await ip()}`, limit, windowSec);
  return r.ok ? null : NextResponse.json({ error: "Too many requests. Please wait a moment and try again." }, { status: 429 });
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new OrderError("Request too large.", undefined, 413);
  try { return JSON.parse(text); } catch { throw new OrderError("Invalid request.", undefined, 400); }
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) return NextResponse.json({ error: "Please check the highlighted fields.", fields: fieldErrors(e) }, { status: 422 });
  if (e instanceof OrderError) return NextResponse.json({ error: e.message, field: e.field }, { status: e.status });
  // Log only the error's type, code and message: database errors carry a `detail` field that can
  // contain customer values (emails, phone numbers), which must not end up in logs.
  const err = e as { name?: string; code?: string; message?: string; stack?: string };
  console.error(JSON.stringify({ level: "error", name: err?.name, code: err?.code, message: String(err?.message ?? e).slice(0, 300), at: err?.stack?.split("\n")[1]?.trim() }));
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}
