import { NextResponse } from "next/server";
import { unavailableDates } from "@/lib/scheduling";
import { addDays, lagosToday } from "@/lib/dates";

export async function GET() {
  const from = lagosToday();
  return NextResponse.json({ unavailable: await unavailableDates(from, addDays(from, 180)) });
}
