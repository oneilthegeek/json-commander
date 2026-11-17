import { eq } from "drizzle-orm";
import { getStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db";
import { qrSvg } from "@/lib/nfc";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getStaff();
  if (!s || (s.totpEnabled && !s.mfaPassed) || !(can(s.role, "nfc.edit") || can(s.role, "nfc.write"))) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const e = await getDb().query.nfcExperiences.findFirst({ where: eq(schema.nfcExperiences.id, id) });
  if (!e) return new Response("Not found", { status: 404 });
  return new Response(await qrSvg(e.publicToken), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="llh-card.svg"` } });
}
