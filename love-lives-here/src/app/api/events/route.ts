import { NextResponse } from "next/server";
import { CLIENT_EVENTS, track } from "@/lib/analytics";
import { limited } from "@/lib/http";

export async function POST(req: Request) {
  const rl = await limited("events", 240, 60);
  if (rl) return new NextResponse(null, { status: 204 });
  const text = await req.text();
  if (text.length > 4096) return new NextResponse(null, { status: 413 });
  let b: Record<string, unknown>;
  try { b = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  if (!CLIENT_EVENTS.includes(b.name as (typeof CLIENT_EVENTS)[number])) return new NextResponse(null, { status: 400 });
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);
  await track(null, {
    name: b.name as (typeof CLIENT_EVENTS)[number], sessionId: s("sessionId"), path: s("path"), product: s("product"),
    value: Number.isInteger(b.value) ? (b.value as number) : undefined, orderNumber: s("orderNumber"),
    source: s("source"), medium: s("medium"), campaign: s("campaign"),
  });
  return new NextResponse(null, { status: 204 });
}
