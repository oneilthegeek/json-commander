import { NextResponse } from "next/server";
import { supportSchema } from "@/lib/validation";
import { getDb, schema } from "@/lib/db";
import { errorResponse, limited, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const rl = await limited("support", 5, 10 * 60);
    if (rl) return rl;
    const b = supportSchema.parse(await readJson(req));
    if (b.website) return NextResponse.json({ ok: true }); // honeypot: pretend success to bots
    await getDb().insert(schema.supportMessages).values({ name: b.name, contact: b.contact, message: b.message, orderNumber: b.orderNumber || null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
