import { NextResponse } from "next/server";
import { emailSchema } from "@/lib/validation";
import { unsubscribe } from "@/lib/newsletter";
import { limited, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const rl = await limited("unsub", 10, 10 * 60);
  if (rl) return rl;
  const b = (await readJson(req).catch(() => ({}))) as { email?: string };
  const email = emailSchema.safeParse(String(b.email ?? "").trim().toLowerCase());
  if (!email.success) return NextResponse.json({ error: "Enter the email address you subscribed with." }, { status: 422 });
  const r = await unsubscribe(email.data);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
