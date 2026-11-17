/**
 * Business-calendar helpers. Love Lives Here runs on Africa/Lagos time (UTC+1,
 * no daylight saving). Everything here works on YYYY-MM-DD strings so we never
 * get the off-by-one errors that `new Date().toISOString()` caused in the
 * original site (which computed "today" in UTC).
 */
export const BUSINESS_TZ = "Africa/Lagos";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, hour: "2-digit", hourCycle: "h23" });

export function lagosToday(now: Date = new Date()): string {
  return fmt.format(now); // en-CA gives YYYY-MM-DD
}

export function lagosHour(now: Date = new Date()): number {
  return Number(hourFmt.format(now));
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = Sunday
}

/** Adds working days (Mon–Sat; LLH's Sunday hours are for messages only). */
export function addWorkingDays(iso: string, days: number): string {
  let d = iso;
  let left = days;
  while (left > 0) {
    d = addDays(d, 1);
    if (dayOfWeek(d) !== 0) left--;
  }
  return d;
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatLongDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-NG", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", { timeZone: BUSINESS_TZ, dateStyle: "medium", timeStyle: "short" });
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";
/** Time-of-day bucket in Lagos, used by Gold Card message variations. */
export function lagosDayPart(now: Date = new Date()): DayPart {
  const h = lagosHour(now);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}
