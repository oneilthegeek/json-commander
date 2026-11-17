import { getStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { serveAsset } from "@/lib/media-serve";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const s = await getStaff();
  if (!s || (s.totpEnabled && !s.mfaPassed) || !can(s.role, "nfc.edit")) return new Response("Forbidden", { status: 403 });
  const { id, assetId } = await params;
  return serveAsset(assetId, id);
}
