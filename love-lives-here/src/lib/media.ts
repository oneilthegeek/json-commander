/**
 * Upload validation for Gold Card photos and voice notes. The file type is
 * decided from the file's own bytes (magic numbers), never from its name or
 * the browser-supplied content type. SVG/HTML are never accepted.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { sha256 } from "./tokens";

export const LIMITS = { image: 6 * 1024 * 1024, audio: 12 * 1024 * 1024, perExperience: 12 };

type Sniffed = { mime: string; kind: "image" | "audio" } | null;

export function sniff(b: Buffer): Sniffed {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", kind: "image" };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", kind: "image" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", kind: "image" };
  if (b.toString("ascii", 4, 8) === "ftyp") {
    const brand = b.toString("ascii", 8, 12);
    // HEIC/HEIF is deliberately not accepted: Chrome, Firefox and most Android browsers can't display it.
    if (["heic", "heix", "mif1", "msf1"].includes(brand)) return null;
    if (["M4A ", "M4B ", "mp42", "isom", "dash"].includes(brand)) return { mime: "audio/mp4", kind: "audio" };
  }
  if (b.toString("ascii", 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", kind: "audio" };
  if (b.toString("ascii", 0, 4) === "OggS") return { mime: "audio/ogg", kind: "audio" };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE") return { mime: "audio/wav", kind: "audio" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "audio/webm", kind: "audio" };
  return null;
}

export class UploadError extends Error {}

export async function storeUpload(file: File, opts: { experienceId: string; uploadedBy: string; expect: "image" | "audio" }) {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("Choose a file to upload.");
  const limit = LIMITS[opts.expect];
  if (file.size > limit) throw new UploadError(`That file is too large. The limit is ${Math.round(limit / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const s = sniff(buf);
  if (!s || s.kind !== opts.expect)
    throw new UploadError(opts.expect === "image" ? "Upload a JPEG, PNG or WebP photo. (iPhone HEIC photos: share or export them as JPEG — most phones do this automatically when you pick a photo here.)" : "Upload an MP3, M4A, OGG, WAV or WebM voice note.");
  const db = getDb();
  const count = await db.$count(schema.mediaAssets, eq(schema.mediaAssets.experienceId, opts.experienceId));
  if (count >= LIMITS.perExperience) throw new UploadError(`You can add up to ${LIMITS.perExperience} files to one card.`);
  const [a] = await db.insert(schema.mediaAssets).values({
    experienceId: opts.experienceId, mime: s.mime, size: buf.length, sha256: sha256(buf), data: buf, uploadedBy: opts.uploadedBy,
  }).returning({ id: schema.mediaAssets.id, mime: schema.mediaAssets.mime });
  return a;
}
