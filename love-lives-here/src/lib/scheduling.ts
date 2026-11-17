/**
 * Delivery-date rules, in the Africa/Lagos business calendar.
 * Production time (making it) and transit time (getting it there) are kept
 * separate; two days' notice is a minimum, not a guarantee — blackout dates
 * and daily capacity are checked too.
 */
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";
import { addDays, addWorkingDays, compareIso, dayOfWeek, isIsoDate, lagosHour, lagosToday } from "./dates";
import { getSetting, type SchedulingSettings } from "./settings";

/** Orders that hold a delivery slot. Unpaid orders older than 2h release theirs. */
const NON_HOLDING = ["cancelled", "refunded"] as const;

export function earliestDate(opts: { now?: Date; productionDays: number; transitDays: number; settings: SchedulingSettings }): string {
  const { now = new Date(), productionDays, transitDays, settings } = opts;
  let start = lagosToday(now);
  if (lagosHour(now) >= settings.cutoffHour) start = addDays(start, 1);
  const lead = Math.max(settings.minLeadDays, productionDays);
  let d = addDays(addWorkingDays(start, lead), transitDays);
  // never earlier than the plain minimum lead in calendar days
  const floor = addDays(lagosToday(now), settings.minLeadDays);
  if (compareIso(d, floor) < 0) d = floor;
  let guard = 0;
  while (settings.closedWeekdays.includes(dayOfWeek(d)) && guard++ < 7) d = addDays(d, 1);
  return d;
}

export async function bookedCount(day: string, tx: Tx = getDb()): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(
      eq(schema.orders.deliveryDate, day),
      notInArray(schema.orders.status, [...NON_HOLDING]),
      sql`(${schema.orders.paymentStatus} <> 'unpaid' or ${schema.orders.createdAt} > now() - interval '2 hours' or ${schema.orders.status} = 'awaiting_quote')`,
    ));
  return r?.n ?? 0;
}

export type DateCheck = { ok: true; earliest: string } | { ok: false; error: string; earliest: string };

export async function checkDeliveryDate(
  day: unknown,
  opts: { productionDays: number; transitDays: number; now?: Date; excludeOrderId?: string },
  tx: Tx = getDb(),
): Promise<DateCheck> {
  const settings = await getSetting("scheduling", tx);
  const earliest = earliestDate({ ...opts, settings });
  if (!isIsoDate(day)) return { ok: false, error: "Pick a delivery date.", earliest };
  if (compareIso(day, earliest) < 0) return { ok: false, error: `The earliest we can deliver this order is ${earliest}.`, earliest };
  if (compareIso(day, addDays(lagosToday(opts.now), settings.maxDaysAhead)) > 0)
    return { ok: false, error: `We take orders up to ${settings.maxDaysAhead} days ahead.`, earliest };
  if (settings.closedWeekdays.includes(dayOfWeek(day))) return { ok: false, error: "We don't deliver on that day of the week.", earliest };
  const override = await tx.query.calendarDays.findFirst({ where: eq(schema.calendarDays.day, day) });
  if (override?.blocked) return { ok: false, error: override.note ? `We can't deliver that day: ${override.note}` : "We can't deliver that day. Please choose another.", earliest };
  const capacity = override?.capacity ?? settings.defaultDailyCapacity;
  if (capacity != null && (await bookedCount(day, tx)) >= capacity)
    return { ok: false, error: "That day is fully booked. Please choose another date.", earliest };
  return { ok: true, earliest };
}

/** Blocked or full dates in a range, for the date picker. */
export async function unavailableDates(from: string, to: string, tx: Tx = getDb()): Promise<string[]> {
  const settings = await getSetting("scheduling", tx);
  const days = await tx.select().from(schema.calendarDays).where(and(gte(schema.calendarDays.day, from), lte(schema.calendarDays.day, to)));
  const out = new Set(days.filter((d) => d.blocked).map((d) => d.day));
  const counts = await tx
    .select({ day: schema.orders.deliveryDate, n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(gte(schema.orders.deliveryDate, from), lte(schema.orders.deliveryDate, to), notInArray(schema.orders.status, [...NON_HOLDING])))
    .groupBy(schema.orders.deliveryDate);
  const caps = new Map(days.map((d) => [d.day, d.capacity]));
  for (const c of counts) {
    const cap = caps.get(c.day) ?? settings.defaultDailyCapacity;
    if (cap != null && c.n >= cap) out.add(c.day);
  }
  return [...out].sort();
}
