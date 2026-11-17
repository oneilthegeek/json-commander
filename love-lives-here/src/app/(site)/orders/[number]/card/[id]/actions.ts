"use server";
import { revalidatePath } from "next/cache";
import { buyerCard } from "./access";
import * as ops from "@/lib/nfc-edit";
import { addEvent } from "@/lib/orders";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/components/ActionForm";

type Op = "details" | "note" | "link" | "photo" | "audio" | "remove" | "redirect";

/** Every call re-checks the order token: bound arguments come back from the browser and are not trusted. */
export async function buyerOp(number: string, id: string, token: string, op: Op, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const ctx = await buyerCard(number, id, token, { requireEdit: true });
  if (!ctx) return { error: "You can't edit this card. Message us if you need a change." };
  const rl = await rateLimit(`card-edit:${id}`, 60, 10 * 60);
  if (!rl.ok) return { error: "Too many changes at once. Please wait a few minutes." };
  let r: ActionResult;
  switch (op) {
    case "details": r = await ops.setDetails(id, fd); break;
    case "note": r = await ops.addNote(id, fd); break;
    case "link": r = await ops.addLink(id, fd); break;
    case "photo": r = await ops.addMedia(id, fd, "buyer", "photo"); break;
    case "audio": r = await ops.addMedia(id, fd, "buyer", "audio"); break;
    case "remove": r = await ops.deleteItem(id, String(fd.get("itemId") ?? "")); break;
    case "redirect": r = await ops.setRedirect(id, fd); break;
  }
  if (r.ok) {
    await addEvent(getDb(), { orderId: ctx.order.id, type: "card_edit", message: `Buyer updated the ${ctx.e.kind === "gold_card" ? "Gold Card" : "LLH Tag"} (${op}).`, actorLabel: "customer" });
    revalidatePath(`/orders/${number}/card/${id}`);
  }
  return r;
}
