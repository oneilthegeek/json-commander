/**
 * Gold Card & LLH Tag digital experiences.
 *
 * The physical NFC chip only ever stores a URL: {APP_URL}/c/{token}. All
 * content lives here, so it can be previewed, edited, scheduled, expired or
 * switched off without touching the card. Writing that URL onto the chip is a
 * separate, manual step (see docs/NFC-TAG-WRITING.md).
 */
import { asc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb, schema, type Tx } from "./db";
import { randomToken } from "./tokens";
import { hashPassword, verifyPassword } from "./auth/password";
import { appUrl } from "./orders";
import { lagosDayPart, type DayPart } from "./dates";

export type Experience = typeof schema.nfcExperiences.$inferSelect;
export type NfcItem = typeof schema.nfcItems.$inferSelect;

export function publicUrl(token: string) {
  return `${appUrl()}/c/${token}`;
}

export async function qrSvg(token: string): Promise<string> {
  return QRCode.toString(publicUrl(token), { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#2A0C13", light: "#FFFFFF" } });
}

export async function createExperience(p: { orderId: string | null; kind: "gold_card" | "llh_tag"; recipientName?: string | null; fromName?: string | null }, tx: Tx = getDb()) {
  const [e] = await tx.insert(schema.nfcExperiences).values({
    orderId: p.orderId, kind: p.kind, publicToken: randomToken(16), // 128-bit, 22 chars
    title: p.kind === "gold_card" ? "A letter is waiting for you" : "",
    recipientName: p.recipientName ?? null, fromName: p.fromName ?? null,
  }).returning();
  return e;
}

export async function getExperienceByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  return getDb().query.nfcExperiences.findFirst({
    where: eq(schema.nfcExperiences.publicToken, token),
    with: { items: { orderBy: [asc(schema.nfcItems.sort), asc(schema.nfcItems.createdAt)] } },
  });
}

export type Availability = { ok: true } | { ok: false; reason: "not_found" | "inactive" | "not_yet" | "expired" | "locked" };

export function availability(e: Experience | null | undefined, now = new Date(), opts: { preview?: boolean; unlocked?: boolean } = {}): Availability {
  if (!e) return { ok: false, reason: "not_found" };
  if (opts.preview) return { ok: true };
  if (e.status !== "active") return { ok: false, reason: "inactive" };
  if (e.startsAt && e.startsAt > now) return { ok: false, reason: "not_yet" };
  if (e.expiresAt && e.expiresAt <= now) return { ok: false, reason: "expired" };
  if (e.accessCodeHash && !opts.unlocked) return { ok: false, reason: "locked" };
  return { ok: true };
}

/**
 * Chooses what to show right now. Notes for the current part of the day come
 * first; "any time" notes are the fallback. Media and links always show.
 */
export function selectForNow(items: NfcItem[], part: DayPart = lagosDayPart()) {
  const notes = items.filter((i) => i.kind === "note");
  const timed = notes.filter((n) => n.window === part);
  const anytime = notes.filter((n) => n.window === "any");
  const note = (timed.length ? timed : anytime)[0] ?? notes[0] ?? null;
  return {
    note,
    otherNotes: notes.filter((n) => n !== note && (n.window === "any" || n.window === part)),
    photos: items.filter((i) => i.kind === "photo"),
    audio: items.filter((i) => i.kind === "audio"),
    links: items.filter((i) => i.kind === "playlist" || i.kind === "link"),
    part,
  };
}

export async function setAccessCode(id: string, code: string | null) {
  const hash = code ? await hashPassword(code) : null;
  await getDb().update(schema.nfcExperiences).set({ accessCodeHash: hash, updatedAt: new Date() }).where(eq(schema.nfcExperiences.id, id));
}

export async function checkAccessCode(e: Experience, code: string) {
  if (!e.accessCodeHash) return true;
  return verifyPassword(code.trim().toLowerCase(), e.accessCodeHash);
}

/** Only https links to the web; blocks javascript:, data:, and private hosts. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)) return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const PLAYLIST_HOSTS = ["open.spotify.com", "music.apple.com", "music.youtube.com", "www.youtube.com", "youtu.be", "audiomack.com", "boomplay.com", "www.boomplay.com", "soundcloud.com"];
