import { eq } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";

export type SchedulingSettings = {
  /** Minimum full days between ordering and delivery (source site: 2). */
  minLeadDays: number;
  /** Orders after this Lagos hour count from the next day. */
  cutoffHour: number;
  /** Default max deliveries per day; null = no limit. Per-day overrides live in calendar_days. */
  defaultDailyCapacity: number | null;
  maxDaysAhead: number;
  /** 0 = Sunday … 6 = Saturday. Days with no deliveries. */
  closedWeekdays: number[];
};

/**
 * A statement shown in the stats strip. `needsEvidence` claims (counts, ratings)
 * are hidden until staff tick "verified"; operational facts from the original
 * site are shown but flagged in the admin until confirmed.
 */
export type Claim = { value: string; label: string; verified: boolean; needsEvidence: boolean };
export type BusinessSettings = {
  whatsapp: string;
  phoneDisplay: string;
  email: string;
  hours: { days: string; time: string }[];
  /** schema.org openingHours strings, e.g. "Mo-Fr 08:00-16:00" — keep in step with `hours`. */
  openingHoursSchema: string[];
  claims: Claim[];
  instagram: string;
  tiktok: string;
  substackProfile: string;
};
export type LegalSettings = { reviewed: boolean; version: string };

export const DEFAULTS = {
  scheduling: { minLeadDays: 2, cutoffHour: 16, defaultDailyCapacity: null, maxDaysAhead: 180, closedWeekdays: [] } as SchedulingSettings,
  business: {
    // Source values from the original site, pending verification by LLH.
    whatsapp: "2348107134258",
    phoneDisplay: "0810 713 4258",
    email: "always@loveliveshereng.com",
    hours: [
      { days: "Monday to Friday", time: "8am to 4pm" },
      { days: "Saturday", time: "10am to 2pm" },
      { days: "Sunday", time: "2pm to 4pm" },
    ],
    openingHoursSchema: ["Mo-Fr 08:00-16:00", "Sa 10:00-14:00", "Su 14:00-16:00"],
    // All from the original site's stats strip, none yet confirmed by LLH.
    claims: [
      { value: "Est. 2025", label: "Made by hand in Lagos", verified: false, needsEvidence: false },
      { value: "48 hrs", label: "Most orders ready", verified: false, needsEvidence: false },
      { value: "Nationwide", label: "Delivery across Nigeria", verified: false, needsEvidence: false },
      { value: "200+", label: "Letters delivered in Lagos", verified: false, needsEvidence: true },
      { value: "4.9★", label: "Customer rating", verified: false, needsEvidence: true },
    ],
    instagram: "https://www.instagram.com/loveliveshere.ng/",
    tiktok: "https://www.tiktok.com/@loveliveshere.ng",
    substackProfile: "https://substack.com/@fromthelovers",
  } as BusinessSettings,
  legal: { reviewed: false, version: "2026-11-draft-1" } as LegalSettings,
};

type Key = keyof typeof DEFAULTS;

export async function getSetting<K extends Key>(key: K, tx: Tx = getDb()): Promise<(typeof DEFAULTS)[K]> {
  const row = await tx.query.settings.findFirst({ where: eq(schema.settings.key, key) });
  const v = { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as (typeof DEFAULTS)[K];
  if (key === "business") {
    // Older saved rows predate needsEvidence: treat numeric/rating claims as needing evidence.
    const b = v as BusinessSettings;
    b.claims = b.claims.map((c) => ({ ...c, needsEvidence: c.needsEvidence ?? /\d+\+|★|rating/i.test(c.value + c.label) }));
  }
  return v;
}

/** Claims that may be shown publicly right now. */
export function publicClaims(b: BusinessSettings) {
  return b.claims.filter((c) => c.verified || !c.needsEvidence);
}

export async function setSetting<K extends Key>(key: K, value: (typeof DEFAULTS)[K], tx: Tx = getDb()) {
  await tx.insert(schema.settings).values({ key, value }).onConflictDoUpdate({
    target: schema.settings.key, set: { value, updatedAt: new Date() },
  });
}
