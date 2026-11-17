import { availability, getExperienceByToken } from "@/lib/nfc";
import { isUnlocked } from "@/lib/nfc-access";
import { serveAsset } from "@/lib/media-serve";

export async function GET(_: Request, { params }: { params: Promise<{ token: string; assetId: string }> }) {
  const { token, assetId } = await params;
  const e = await getExperienceByToken(token);
  const av = availability(e, new Date(), { unlocked: e ? await isUnlocked(e.id) : false });
  if (!av.ok) return new Response("Not found", { status: 404 });
  return serveAsset(assetId, e!.id);
}
