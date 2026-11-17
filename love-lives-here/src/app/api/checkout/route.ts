import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { createOrder } from "@/lib/orders";
import { errorResponse, limited, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const rl = await limited("checkout", 15, 10 * 60);
    if (rl) return rl;
    const input = checkoutSchema.parse(await readJson(req, 96 * 1024));
    const { order, token, replayed } = await createOrder(input);
    return NextResponse.json({
      orderNumber: order.number, token, status: order.status, total: order.total, replayed,
      next: order.status === "awaiting_quote" ? "await_quote" : "pay",
    }, { status: replayed ? 200 : 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
