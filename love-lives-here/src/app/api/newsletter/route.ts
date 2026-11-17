import { NextResponse } from "next/server";
import { emailSchema } from "@/lib/validation";
import { subscribe } from "@/lib/newsletter";
import { limited, readJson } from "@/lib/http";

export async function POST(req: Request) {
  const rl = await limited("newsletter", 8, 10 * 60);
  if (rl) return rl;
  const b = (await readJson(req).catch(() => ({}))) as { email?: string; consent?: boolean; source?: string };
  const email = emailSchema.safeParse(String(b.email ?? "").trim().toLowerCase());
  if (!email.success) return NextResponse.json({ error: "Enter an email address like ada@gmail.com." }, { status: 422 });
  if (b.consent !== true) return NextResponse.json({ error: "Tick the box to confirm you'd like our emails." }, { status: 422 });
  const r = await subscribe(email.data, typeof b.source === "string" ? b.source.slice(0, 40) : undefined);
  return NextResponse.json(r, { status: r.status === "error" ? 502 : 200 });
}
