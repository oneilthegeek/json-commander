import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function GET() {
  const zones = await getDb().select({ id: schema.deliveryZones.id, name: schema.deliveryZones.name, areas: schema.deliveryZones.areas, mode: schema.deliveryZones.mode, fee: schema.deliveryZones.fee, region: schema.deliveryZones.region })
    .from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true)).orderBy(asc(schema.deliveryZones.sort));
  return NextResponse.json({ zones });
}
