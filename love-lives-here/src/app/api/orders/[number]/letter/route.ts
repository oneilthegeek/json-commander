import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { addEvent, OrderError, verifyTracking } from "@/lib/orders";
import { errorResponse, limited, readJson } from "@/lib/http";

/** Buyer approves the letter draft or asks for changes. Authenticated by the order's tracking token. */
export async function POST(req: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const rl = await limited("approve", 20, 10 * 60);
    if (rl) return rl;
    const { number } = await params;
    const b = (await readJson(req)) as { token?: string; draftId?: string; action?: string; feedback?: string };
    const db = getDb();
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.number, number.toUpperCase()) });
    if (!order || !verifyTracking(order, b.token)) throw new OrderError("Order not found.", undefined, 404);
    if (b.action !== "approve" && b.action !== "changes") throw new OrderError("Invalid action.");
    const feedback = String(b.feedback ?? "").trim().slice(0, 3000);
    if (b.action === "changes" && feedback.length < 5) throw new OrderError("Tell us what you'd like changed.");

    await db.transaction(async (tx) => {
      const draft = await tx.query.letterDrafts.findFirst({ where: and(eq(schema.letterDrafts.id, String(b.draftId ?? "")), eq(schema.letterDrafts.orderId, order.id)) });
      if (!draft || draft.status !== "sent") throw new OrderError("This version is no longer awaiting your approval. Refresh the page.", undefined, 409);
      if (order.status !== "awaiting_approval") throw new OrderError("This order isn't waiting for approval.", undefined, 409);
      if (b.action === "approve") {
        await tx.update(schema.letterDrafts).set({ status: "approved", respondedAt: new Date() }).where(eq(schema.letterDrafts.id, draft.id));
        await tx.update(schema.orders).set({ status: "approved", updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
        await addEvent(tx, { orderId: order.id, type: "status", from: order.status, to: "approved", message: `You approved version ${draft.version} of your letter.`, visible: true, actorLabel: "customer" });
      } else {
        await tx.update(schema.letterDrafts).set({ status: "changes_requested", customerFeedback: feedback, respondedAt: new Date() }).where(eq(schema.letterDrafts.id, draft.id));
        await tx.update(schema.orders).set({ status: "drafting", updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
        await addEvent(tx, { orderId: order.id, type: "status", from: order.status, to: "drafting", message: `You asked for changes to version ${draft.version}. We're revising it.`, visible: true, actorLabel: "customer" });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
