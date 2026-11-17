import { NextResponse } from "next/server";
import { priceCart } from "@/lib/pricing";
import { errorResponse, limited, readJson } from "@/lib/http";
import { earliestDate } from "@/lib/scheduling";
import { getSetting } from "@/lib/settings";

/** Authoritative price breakdown for whatever is in the bag. */
export async function POST(req: Request) {
  try {
    const rl = await limited("quote", 120, 60);
    if (rl) return rl;
    const body = (await readJson(req)) as { lines?: unknown; zoneId?: unknown };
    const zoneId = Number.isInteger(body.zoneId) ? (body.zoneId as number) : null;
    const cart = await priceCart(body.lines, zoneId);
    const settings = await getSetting("scheduling");
    const earliest = earliestDate({ productionDays: cart.productionDays, transitDays: cart.delivery?.transitDays ?? 0, settings });
    return NextResponse.json({ ...cart, earliestDate: earliest });
  } catch (e) {
    return errorResponse(e);
  }
}
