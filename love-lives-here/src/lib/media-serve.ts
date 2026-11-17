import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";

/** Streams a private media asset if it belongs to the given experience. */
export async function serveAsset(assetId: string, experienceId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return new Response("Not found", { status: 404 });
  const a = await getDb().query.mediaAssets.findFirst({ where: and(eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.experienceId, experienceId)) });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime,
      "Content-Length": String(a.size),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
