/** Content operations on a Gold Card / LLH Tag experience. Callers must authorise first. */
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { safeExternalUrl, setAccessCode, PLAYLIST_HOSTS } from "./nfc";
import { storeUpload, UploadError } from "./media";
import type { ActionResult } from "@/components/ActionForm";

const WINDOWS = ["any", "morning", "afternoon", "evening", "night"] as const;
const MAX_ITEMS = 30;

async function itemCount(expId: string) {
  return getDb().$count(schema.nfcItems, eq(schema.nfcItems.experienceId, expId));
}
async function touch(expId: string) {
  await getDb().update(schema.nfcExperiences).set({ updatedAt: new Date() }).where(eq(schema.nfcExperiences.id, expId));
}

export async function addNote(expId: string, fd: FormData): Promise<ActionResult> {
  const body = String(fd.get("body") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim().slice(0, 120) || null;
  const w = String(fd.get("window") ?? "any") as (typeof WINDOWS)[number];
  if (body.length < 2) return { error: "Write your note first." };
  if (body.length > 5000) return { error: "Keep a note under 5,000 characters." };
  if (!WINDOWS.includes(w)) return { error: "Choose when it should show." };
  if ((await itemCount(expId)) >= MAX_ITEMS) return { error: "This card is full." };
  await getDb().insert(schema.nfcItems).values({ experienceId: expId, kind: "note", title, body, window: w, sort: await itemCount(expId) });
  await touch(expId);
  return { ok: true, message: "Note added." };
}

export async function addLink(expId: string, fd: FormData): Promise<ActionResult> {
  const url = safeExternalUrl(String(fd.get("url") ?? ""));
  const title = String(fd.get("title") ?? "").trim().slice(0, 120) || null;
  if (!url) return { error: "Paste a full link starting with https://" };
  const host = new URL(url).hostname;
  const kind = PLAYLIST_HOSTS.includes(host) ? "playlist" : "link";
  if ((await itemCount(expId)) >= MAX_ITEMS) return { error: "This card is full." };
  await getDb().insert(schema.nfcItems).values({ experienceId: expId, kind, title, url, sort: await itemCount(expId) });
  await touch(expId);
  return { ok: true, message: kind === "playlist" ? "Playlist added." : "Link added." };
}

export async function addMedia(expId: string, fd: FormData, by: string, kind: "photo" | "audio"): Promise<ActionResult> {
  try {
    const file = fd.get("file") as File | null;
    if (!file) return { error: "Choose a file." };
    const a = await storeUpload(file, { experienceId: expId, uploadedBy: by, expect: kind === "photo" ? "image" : "audio" });
    const title = String(fd.get("title") ?? "").trim().slice(0, 120) || null;
    await getDb().insert(schema.nfcItems).values({ experienceId: expId, kind, title, assetId: a.id, sort: await itemCount(expId) });
    await touch(expId);
    return { ok: true, message: kind === "photo" ? "Photo added." : "Voice note added." };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
}

export async function deleteItem(expId: string, itemId: string): Promise<ActionResult> {
  const db = getDb();
  const item = await db.query.nfcItems.findFirst({ where: and(eq(schema.nfcItems.id, itemId), eq(schema.nfcItems.experienceId, expId)) });
  if (!item) return { error: "Already removed." };
  await db.delete(schema.nfcItems).where(eq(schema.nfcItems.id, itemId));
  if (item.assetId) await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, item.assetId));
  await touch(expId);
  return { ok: true, message: "Removed." };
}

export async function setDetails(expId: string, fd: FormData): Promise<ActionResult> {
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const fromName = String(fd.get("fromName") ?? "").trim().slice(0, 80) || null;
  const recipientName = String(fd.get("recipientName") ?? "").trim().slice(0, 80) || null;
  await getDb().update(schema.nfcExperiences).set({ title, fromName, recipientName, updatedAt: new Date() }).where(eq(schema.nfcExperiences.id, expId));
  return { ok: true, message: "Saved." };
}

export async function setRedirect(expId: string, fd: FormData): Promise<ActionResult> {
  const raw = String(fd.get("redirectUrl") ?? "").trim();
  const url = raw ? safeExternalUrl(raw) : null;
  if (raw && !url) return { error: "Paste a full link starting with https://" };
  await getDb().update(schema.nfcExperiences).set({ redirectUrl: url, updatedAt: new Date() }).where(eq(schema.nfcExperiences.id, expId));
  return { ok: true, message: url ? "Link saved." : "Link cleared." };
}

/** Staff-only controls. */
export async function setControls(expId: string, fd: FormData): Promise<ActionResult> {
  const status = String(fd.get("status") ?? "");
  if (!["draft", "active", "disabled"].includes(status)) return { error: "Invalid status." };
  const parse = (k: string) => { const v = String(fd.get(k) ?? ""); if (!v) return null; const d = new Date(v + (v.length === 16 ? ":00+01:00" : "")); return Number.isNaN(d.getTime()) ? undefined : d; };
  const startsAt = parse("startsAt"), expiresAt = parse("expiresAt");
  if (startsAt === undefined || expiresAt === undefined) return { error: "Check the dates." };
  if (startsAt && expiresAt && expiresAt <= startsAt) return { error: "The end must be after the start." };
  const e = await getDb().query.nfcExperiences.findFirst({ where: eq(schema.nfcExperiences.id, expId), with: { items: true } });
  if (!e) return { error: "Not found." };
  if (status === "active") {
    if (e.kind === "gold_card" && !e.items.some((i) => i.kind === "note")) return { error: "Add at least one note before switching the card on." };
    if (e.kind === "llh_tag" && !e.redirectUrl && !e.items.length) return { error: "Set the tag's link before switching it on." };
  }
  await getDb().update(schema.nfcExperiences).set({
    status: status as "draft" | "active" | "disabled", startsAt, expiresAt, buyerCanEdit: fd.get("buyerCanEdit") === "on", updatedAt: new Date(),
  }).where(eq(schema.nfcExperiences.id, expId));
  const code = String(fd.get("accessCode") ?? "").trim().toLowerCase();
  if (fd.get("clearCode") === "on") await setAccessCode(expId, null);
  else if (code) {
    if (code.length < 4) return { error: "Make the secret word at least 4 characters." };
    await setAccessCode(expId, code);
  }
  return { ok: true, message: "Card settings saved." };
}

export async function markTagWritten(expId: string, staffId: string): Promise<ActionResult> {
  await getDb().update(schema.nfcExperiences).set({ tagWrittenAt: sql`now()`, tagWrittenBy: staffId }).where(eq(schema.nfcExperiences.id, expId));
  return { ok: true, message: "Recorded as written and tested." };
}
