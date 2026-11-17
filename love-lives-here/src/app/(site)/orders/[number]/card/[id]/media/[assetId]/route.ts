import { buyerCard } from "../../access";
import { serveAsset } from "@/lib/media-serve";

export async function GET(req: Request, { params }: { params: Promise<{ number: string; id: string; assetId: string }> }) {
  const { number, id, assetId } = await params;
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const ctx = await buyerCard(number, id, t);
  if (!ctx) return new Response("Not found", { status: 404 });
  return serveAsset(assetId, ctx.e.id);
}
