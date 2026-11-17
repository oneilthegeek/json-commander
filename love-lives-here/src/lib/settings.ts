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

export type Claim = { value: string; label: string; verified: boolean };
export type BusinessSettings = {
  whatsapp: string;
  phoneDisplay: string;
  email: string;
  hours: { days: string; time: string }[];
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
    // Claims from the original site. Hidden until a staff member marks them verified.
    claims: [
      { value: "200+", label: "Letters delivered in Lagos", verified: false },
      { value: "4.9★", label: "Customer rating", verified: false },
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
  return { ...DEFAULTS[key], ...((row?.value as object) ?? {}) } as (typeof DEFAULTS)[K];
}

export async function setSetting<K extends Key>(key: K, value: (typeof DEFAULTS)[K], tx: Tx = getDb()) {
  await tx.insert(schema.settings).values({ key, value }).onConflictDoUpdate({
    target: schema.settings.key, set: { value, updatedAt: new Date() },
  });
}
