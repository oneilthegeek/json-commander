"use server";
/**
 * Admin server actions. Every action: (1) re-authenticates the staff session,
 * (2) checks the role permission, (3) validates input on the server,
 * (4) writes an audit log entry. Next.js checks the Origin header on server
 * actions, which protects them against CSRF.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { ForbiddenError, requireStaff, logout, clientIp, type Staff } from "@/lib/auth/session";
import { can, canMoveTo, ROLES, type Permission, type Role } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { addEvent, OrderError, setDeliveryQuote, transitionOrder, trackingUrl } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { refundOrder, recordManualPayment, verifyAndApply } from "@/lib/payments";
import { PaystackError } from "@/lib/paystack";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { newTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { getSetting, setSetting } from "@/lib/settings";
import { isIsoDate } from "@/lib/dates";
import * as nfc from "@/lib/nfc-edit";
import { createExperience } from "@/lib/nfc";
import { flushOutbox, kickOutbox, markManual, queueNotification } from "@/lib/notifications";
import type { ActionResult } from "@/components/ActionForm";

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
const nairaToKobo = (v: string): number | null => {
  const t = v.replace(/[₦,\s]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
};

async function guard<T>(perm: Permission, fn: (s: Staff) => Promise<T>): Promise<T | ActionResult> {
  const s = await requireStaff();
  if (!can(s.role, perm)) return { error: `Your role (${s.role}) can't do this.` };
  try {
    return await fn(s);
  } catch (e) {
    if (e instanceof OrderError || e instanceof ForbiddenError) return { error: e.message };
    if (e instanceof PaystackError) return { error: `Paystack: ${e.message}` };
    throw e;
  }
}
async function log(s: Staff, action: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  await audit({ actorId: s.id, actorEmail: s.email, action, entity, entityId, meta, ip: await clientIp() });
}

// ------------------------------------------------------------------ orders
export async function changeStatus(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("orders.status", async (s) => {
    const to = str(fd, "to") as OrderStatus;
    if (!ORDER_STATUSES.includes(to)) return { error: "Unknown status." };
    if (!canMoveTo(s.role, to)) return { error: "Your role can't set this status." };
    await transitionOrder(orderId, to, { id: s.id, label: s.email }, str(fd, "note", 500) || undefined);
    await log(s, "order.status", "order", orderId, { to });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Status updated." };
  }) as Promise<ActionResult>;
}

export async function addNote(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("orders.notes", async (s) => {
    const note = str(fd, "note", 2000);
    if (note.length < 2) return { error: "Write a note." };
    await addEvent(getDb(), { orderId, type: "note", message: note, actorId: s.id, actorLabel: s.email });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Note added." };
  }) as Promise<ActionResult>;
}

export async function assignOrder(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("orders.assign", async (s) => {
    const to = str(fd, "staffId");
    const db = getDb();
    if (to) {
      const u = await db.query.staffUsers.findFirst({ where: and(eq(schema.staffUsers.id, to), eq(schema.staffUsers.active, true)) });
      if (!u) return { error: "Choose an active team member." };
    }
    await db.update(schema.orders).set({ assignedTo: to || null, updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
    await addEvent(db, { orderId, type: "assign", message: to ? "Assigned to a team member." : "Unassigned.", actorId: s.id, actorLabel: s.email });
    await log(s, "order.assign", "order", orderId, { to });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function quoteDelivery(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("orders.quote", async (s) => {
    const fee = nairaToKobo(str(fd, "fee", 20));
    if (fee == null || Number.isNaN(fee)) return { error: "Enter the delivery fee in naira." };
    await setDeliveryQuote(orderId, fee, { id: s.id, email: s.email });
    await log(s, "order.quote", "order", orderId, { fee });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Quote saved. The buyer can now pay from their order page." };
  }) as Promise<ActionResult>;
}

export async function saveDelivery(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("customers.pii", async (s) => {
    await getDb().insert(schema.deliveries).values({ orderId, riderName: str(fd, "riderName", 80) || null, riderPhone: str(fd, "riderPhone", 30) || null, notes: str(fd, "notes", 1000) || null, failedReason: str(fd, "failedReason", 300) || null })
      .onConflictDoUpdate({ target: schema.deliveries.orderId, set: { riderName: str(fd, "riderName", 80) || null, riderPhone: str(fd, "riderPhone", 30) || null, notes: str(fd, "notes", 1000) || null, failedReason: str(fd, "failedReason", 300) || null } });
    await log(s, "order.delivery", "order", orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Delivery details saved." };
  }) as Promise<ActionResult>;
}

// ------------------------------------------------------------------ letter drafts
export async function saveDraft(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("letters.edit", async (s) => {
    const body = str(fd, "body", 8000);
    if (body.length < 20) return { error: "The draft looks too short." };
    const db = getDb();
    const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!o || !["paid", "drafting", "awaiting_approval", "on_hold"].includes(o.status)) return { error: "Drafts can be written once the order is paid and before approval." };
    await db.transaction(async (tx) => {
      const [{ v }] = await tx.select({ v: sql<number>`coalesce(max(version),0)::int` }).from(schema.letterDrafts).where(eq(schema.letterDrafts.orderId, orderId));
      await tx.update(schema.letterDrafts).set({ status: "superseded" }).where(and(eq(schema.letterDrafts.orderId, orderId), inArray(schema.letterDrafts.status, ["draft", "sent"])));
      await tx.insert(schema.letterDrafts).values({ orderId, version: v + 1, body, status: "draft", createdBy: s.id });
      if (o.status === "paid" || o.status === "awaiting_approval") {
        await tx.update(schema.orders).set({ status: "drafting", updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
        await addEvent(tx, { orderId, type: "status", from: o.status, to: "drafting", message: "We're shaping your words into your letter.", visible: true, actorId: s.id, actorLabel: s.email });
      }
    });
    await log(s, "letter.draft", "order", orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Draft saved." };
  }) as Promise<ActionResult>;
}

export async function sendDraft(orderId: string, draftId: string): Promise<ActionResult> {
  return guard("letters.edit", async (s) => {
    const db = getDb();
    await db.transaction(async (tx) => {
      const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
      const d = await tx.query.letterDrafts.findFirst({ where: and(eq(schema.letterDrafts.id, draftId), eq(schema.letterDrafts.orderId, orderId)) });
      if (!o || !d || d.status !== "draft") throw new OrderError("Only an unsent draft can be sent.");
      if (o.status !== "drafting") throw new OrderError("The order must be in “Drafting” to send a draft for approval.");
      await tx.update(schema.letterDrafts).set({ status: "sent", sentAt: new Date() }).where(eq(schema.letterDrafts.id, draftId));
      await tx.update(schema.orders).set({ status: "awaiting_approval", updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
      await addEvent(tx, { orderId, type: "status", from: "drafting", to: "awaiting_approval", message: "Your letter is ready for you to read. Nothing is sealed until you say yes.", visible: true, actorId: s.id, actorLabel: s.email });
      if (o.buyerEmail) await queueNotification(tx, { orderId, channel: "email", to: o.buyerEmail, subject: `Your letter is ready to read — ${o.number}`, body: `Hi ${o.buyerName},\n\nYour letter for ${o.recipientName} is ready. Read it and approve it (or ask for changes) here:\n${trackingUrl(o)}\n\nNothing is sealed until you say yes.\n\nLove Lives Here` });
    });
    kickOutbox();
    await log(s, "letter.send", "order", orderId, { draftId });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Sent for approval." };
  }) as Promise<ActionResult>;
}

/** When the buyer approves on WhatsApp instead of the website. Requires a note; audited. */
export async function recordApproval(orderId: string, draftId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("letters.edit", async (s) => {
    const note = str(fd, "note", 300);
    if (note.length < 5) return { error: "Note how the buyer approved (e.g. “Approved on WhatsApp 14:02”)." };
    const db = getDb();
    await db.transaction(async (tx) => {
      const d = await tx.query.letterDrafts.findFirst({ where: and(eq(schema.letterDrafts.id, draftId), eq(schema.letterDrafts.orderId, orderId)) });
      const o = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
      if (!d || d.status !== "sent" || o?.status !== "awaiting_approval") throw new OrderError("This draft isn't awaiting approval.");
      await tx.update(schema.letterDrafts).set({ status: "approved", respondedAt: new Date(), customerFeedback: `Recorded by staff: ${note}` }).where(eq(schema.letterDrafts.id, draftId));
      await tx.update(schema.orders).set({ status: "approved", updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
      await addEvent(tx, { orderId, type: "status", from: "awaiting_approval", to: "approved", message: `You approved version ${d.version} of your letter.`, visible: true, actorId: s.id, actorLabel: s.email });
      await addEvent(tx, { orderId, type: "approval_recorded", message: `Approval recorded by staff: ${note}`, actorId: s.id, actorLabel: s.email });
    });
    await log(s, "letter.approval_recorded", "order", orderId, { draftId, note });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Approval recorded." };
  }) as Promise<ActionResult>;
}

// ------------------------------------------------------------------ payments
export async function reverify(orderId: string, reference: string): Promise<ActionResult> {
  return guard("payments.view", async (s) => {
    const p = await getDb().query.payments.findFirst({ where: and(eq(schema.payments.reference, reference), eq(schema.payments.orderId, orderId)) });
    if (!p || p.provider !== "paystack") return { error: "Not a Paystack payment." };
    const r = await verifyAndApply(reference, "staff");
    await log(s, "payment.reverify", "order", orderId, { reference, outcome: r.outcome });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: `Paystack says: ${r.outcome}` };
  }) as Promise<ActionResult>;
}

export async function refund(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("payments.refund", async (s) => {
    const amount = nairaToKobo(str(fd, "amount", 20));
    if (amount == null || Number.isNaN(amount)) return { error: "Enter the amount in naira." };
    await refundOrder(orderId, amount, str(fd, "reason", 300), { id: s.id, email: s.email }, fd.get("manual") === "on");
    await log(s, "payment.refund", "order", orderId, { amount, manual: fd.get("manual") === "on" });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Refund recorded." };
  }) as Promise<ActionResult>;
}

export async function manualPayment(orderId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("payments.manual", async (s) => {
    await recordManualPayment(orderId, str(fd, "note", 200), { id: s.id, email: s.email });
    await log(s, "payment.manual", "order", orderId, { note: str(fd, "note", 200) });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Marked as paid." };
  }) as Promise<ActionResult>;
}

// ------------------------------------------------------------------ products & stock
export async function saveVariant(variantId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await requireStaff();
  const canPrice = can(s.role, "products.edit"), canStock = can(s.role, "inventory.edit");
  if (!canPrice && !canStock) return { error: "Your role can't edit products." };
  const db = getDb();
  const v = await db.query.productVariants.findFirst({ where: eq(schema.productVariants.id, variantId) });
  if (!v) return { error: "Not found." };
  const patch: Partial<typeof schema.productVariants.$inferInsert> = {};
  if (canStock) {
    const st = str(fd, "stock", 10);
    if (st !== "" && !/^\d+$/.test(st)) return { error: "Stock must be a whole number, or blank for made-to-order." };
    patch.stock = st === "" ? null : Number(st);
  }
  if (canPrice) {
    const status = str(fd, "priceStatus") as "confirmed" | "unverified" | "quote";
    if (!["confirmed", "unverified", "quote"].includes(status)) return { error: "Choose a price status." };
    const price = nairaToKobo(str(fd, "price", 20));
    if (status === "quote") patch.price = null;
    else if (price == null || Number.isNaN(price) || price <= 0) return { error: "Enter a price in naira, or choose “Request a quote”." };
    else patch.price = price;
    patch.priceStatus = status;
    patch.name = str(fd, "name", 80) || v.name;
    patch.active = fd.get("active") === "on";
  }
  await db.update(schema.productVariants).set(patch).where(eq(schema.productVariants.id, variantId));
  await log(s, "variant.update", "variant", variantId, { before: { price: v.price, status: v.priceStatus, stock: v.stock }, after: patch });
  revalidatePath("/admin/products");
  return { ok: true, message: "Saved." };
}

export async function saveProduct(productId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("products.edit", async (s) => {
    const name = str(fd, "name", 120);
    if (name.length < 2) return { error: "Name is required." };
    const pd = Number(str(fd, "productionDays", 3));
    if (!Number.isInteger(pd) || pd < 0 || pd > 60) return { error: "Production days must be 0–60." };
    await getDb().update(schema.products).set({
      name, tagline: str(fd, "tagline", 200), description: str(fd, "description", 4000), badge: str(fd, "badge", 40) || null,
      productionDays: pd, active: fd.get("active") === "on", featured: fd.get("featured") === "on", standalone: fd.get("standalone") === "on",
      requiresApproval: fd.get("requiresApproval") === "on", seoTitle: str(fd, "seoTitle", 120) || null, seoDescription: str(fd, "seoDescription", 300) || null,
      updatedAt: new Date(),
    }).where(eq(schema.products.id, productId));
    for (const [k, v] of fd.entries()) {
      const m = /^alt-(\d+)$/.exec(k);
      if (m) await getDb().update(schema.productImages).set({ alt: String(v).slice(0, 200) }).where(and(eq(schema.productImages.id, Number(m[1])), eq(schema.productImages.productId, productId)));
    }
    await log(s, "product.update", "product", productId);
    revalidatePath("/admin/products");
    return { ok: true, message: "Product saved." };
  }) as Promise<ActionResult>;
}

export async function addVariant(productId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("products.edit", async (s) => {
    const name = str(fd, "name", 80);
    const price = nairaToKobo(str(fd, "price", 20));
    if (name.length < 1) return { error: "Name the option (e.g. “30 stems”)." };
    if (price !== null && (Number.isNaN(price) || price <= 0)) return { error: "Enter a price in naira, or leave blank for “Request a quote”." };
    const p = await getDb().query.products.findFirst({ where: eq(schema.products.id, productId) });
    if (!p) return { error: "Not found." };
    const sku = `${p.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 60);
    await getDb().insert(schema.productVariants).values({ productId, name, sku, price, priceStatus: price == null ? "quote" : "confirmed", sort: 99 });
    await log(s, "variant.create", "product", productId, { name, price });
    revalidatePath("/admin/products");
    return { ok: true, message: "Option added." };
  }) as Promise<ActionResult>;
}

export async function createProduct(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const r = await guard("products.edit", async (s) => {
    const name = str(fd, "name", 120);
    const kind = str(fd, "kind") as (typeof schema.productKind.enumValues)[number];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (name.length < 2 || !slug) return { error: "Name is required." };
    if (!schema.productKind.enumValues.includes(kind)) return { error: "Choose a type." };
    const price = nairaToKobo(str(fd, "price", 20));
    if (price !== null && (Number.isNaN(price) || price <= 0)) return { error: "Enter a price, or leave blank for “Request a quote”." };
    const db = getDb();
    if (await db.query.products.findFirst({ where: eq(schema.products.slug, slug) })) return { error: "A product with that name already exists." };
    const [p] = await db.insert(schema.products).values({ slug, name, kind, tagline: str(fd, "tagline", 200), active: false, nfc: kind === "gold_card" ? "gold_card" : kind === "llh_tag" ? "llh_tag" : null, sort: 50 }).returning();
    await db.insert(schema.productVariants).values({ productId: p.id, name: name, sku: slug.toUpperCase().slice(0, 50), price, priceStatus: price == null ? "quote" : "confirmed" });
    await log(s, "product.create", "product", p.id, { name });
    return { ok: true, id: p.id };
  });
  if ("id" in r && r.id) redirect(`/admin/products/${r.id}`);
  return r as ActionResult;
}

// ------------------------------------------------------------------ delivery
export async function saveZone(zoneId: number | null, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("delivery.edit", async (s) => {
    const name = str(fd, "name", 80);
    const mode = str(fd, "mode") as "fixed" | "quote" | "pickup";
    const fee = nairaToKobo(str(fd, "fee", 20));
    const transitDays = Number(str(fd, "transitDays", 3) || "0");
    if (name.length < 2) return { error: "Name the area." };
    if (!["fixed", "quote", "pickup"].includes(mode)) return { error: "Choose how the fee works." };
    if (mode === "fixed" && (fee == null || Number.isNaN(fee))) return { error: "Enter the fixed fee in naira." };
    if (!Number.isInteger(transitDays) || transitDays < 0 || transitDays > 30) return { error: "Transit days must be 0–30." };
    const values = { name, areas: str(fd, "areas", 300), mode, fee: mode === "fixed" ? fee : null, transitDays, region: str(fd, "region", 40) || "lagos", active: fd.get("active") === "on", sort: Number(str(fd, "sort", 4) || 0) || 0 };
    const db = getDb();
    if (zoneId) await db.update(schema.deliveryZones).set(values).where(eq(schema.deliveryZones.id, zoneId));
    else await db.insert(schema.deliveryZones).values(values);
    await log(s, zoneId ? "zone.update" : "zone.create", "zone", zoneId ? String(zoneId) : null, values);
    revalidatePath("/admin/delivery");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function saveScheduling(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("delivery.edit", async (s) => {
    const n = (k: string) => Number(str(fd, k, 6));
    const cap = str(fd, "defaultDailyCapacity", 6);
    const v = {
      minLeadDays: n("minLeadDays"), cutoffHour: n("cutoffHour"), maxDaysAhead: n("maxDaysAhead"),
      defaultDailyCapacity: cap === "" ? null : Number(cap),
      closedWeekdays: fd.getAll("closedWeekdays").map(Number).filter((d) => d >= 0 && d <= 6),
    };
    if (![v.minLeadDays, v.cutoffHour, v.maxDaysAhead].every(Number.isInteger) || v.minLeadDays < 0 || v.cutoffHour < 0 || v.cutoffHour > 23 || v.maxDaysAhead < 7) return { error: "Check the numbers." };
    if (v.defaultDailyCapacity !== null && (!Number.isInteger(v.defaultDailyCapacity) || v.defaultDailyCapacity < 0)) return { error: "Capacity must be a whole number or blank." };
    await setSetting("scheduling", v);
    await log(s, "settings.scheduling", "settings", "scheduling", v);
    revalidatePath("/admin/delivery");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function saveDay(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("delivery.edit", async (s) => {
    const day = str(fd, "day", 10);
    if (!isIsoDate(day)) return { error: "Pick a date." };
    const cap = str(fd, "capacity", 6);
    if (cap !== "" && !/^\d+$/.test(cap)) return { error: "Capacity must be a whole number." };
    const v = { day, blocked: fd.get("blocked") === "on", capacity: cap === "" ? null : Number(cap), note: str(fd, "note", 200) || null };
    if (fd.get("remove") === "on") await getDb().delete(schema.calendarDays).where(eq(schema.calendarDays.day, day));
    else await getDb().insert(schema.calendarDays).values(v).onConflictDoUpdate({ target: schema.calendarDays.day, set: v });
    await log(s, "calendar.day", "calendar", day, v);
    revalidatePath("/admin/delivery");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

// ------------------------------------------------------------------ NFC
export async function createCard(orderId: string, kind: "gold_card" | "llh_tag"): Promise<ActionResult> {
  return guard("nfc.edit", async (s) => {
    const o = await getDb().query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!o) return { error: "Order not found." };
    const e = await createExperience({ orderId, kind, recipientName: o.recipientName, fromName: o.buyerName });
    await log(s, "nfc.create", "nfc", e.id, { orderId });
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Card created." };
  }) as Promise<ActionResult>;
}

type CardOp = "details" | "note" | "link" | "photo" | "audio" | "remove" | "redirect" | "controls" | "written";
export async function cardOp(expId: string, op: CardOp, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard(op === "written" ? "nfc.write" : "nfc.edit", async (s) => {
    const e = await getDb().query.nfcExperiences.findFirst({ where: eq(schema.nfcExperiences.id, expId) });
    if (!e) return { error: "Not found." };
    let r: ActionResult;
    switch (op) {
      case "details": r = await nfc.setDetails(expId, fd); break;
      case "note": r = await nfc.addNote(expId, fd); break;
      case "link": r = await nfc.addLink(expId, fd); break;
      case "photo": r = await nfc.addMedia(expId, fd, s.email, "photo"); break;
      case "audio": r = await nfc.addMedia(expId, fd, s.email, "audio"); break;
      case "remove": r = await nfc.deleteItem(expId, str(fd, "itemId", 40)); break;
      case "redirect": r = await nfc.setRedirect(expId, fd); break;
      case "controls": r = await nfc.setControls(expId, fd); break;
      case "written": r = await nfc.markTagWritten(expId, s.id); break;
    }
    if (r.ok) await log(s, `nfc.${op}`, "nfc", expId);
    revalidatePath(`/admin/nfc/${expId}`);
    return r;
  }) as Promise<ActionResult>;
}

// ------------------------------------------------------------------ support, outbox, content
export async function closeMessage(id: string): Promise<ActionResult> {
  return guard("messages.view", async (s) => {
    await getDb().update(schema.supportMessages).set({ status: "closed", handledBy: s.id }).where(eq(schema.supportMessages.id, id));
    await log(s, "support.close", "support", id);
    revalidatePath("/admin/messages");
    return { ok: true, message: "Closed." };
  }) as Promise<ActionResult>;
}

export async function outboxManual(id: string): Promise<ActionResult> {
  return guard("orders.notes", async (s) => {
    await markManual([id]);
    await log(s, "outbox.manual", "outbox", id);
    revalidatePath("/admin/outbox");
    return { ok: true, message: "Marked as sent by hand." };
  }) as Promise<ActionResult>;
}

export async function outboxFlush(): Promise<ActionResult> {
  return guard("settings.edit", async (s) => {
    const r = await flushOutbox(50);
    await log(s, "outbox.flush", "outbox", null, r);
    revalidatePath("/admin/outbox");
    return r.skipped ? { error: "Email isn't configured (RESEND_API_KEY). Send these by hand and mark them." } : { ok: true, message: `Sent ${r.sent}, failed ${r.failed}.` };
  }) as Promise<ActionResult>;
}

export async function saveBusiness(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("settings.edit", async (s) => {
    const b = await getSetting("business");
    const claims = b.claims.map((c, i) => ({ ...c, value: str(fd, `claim-value-${i}`, 20) || c.value, label: str(fd, `claim-label-${i}`, 60) || c.label, verified: fd.get(`claim-verified-${i}`) === "on" }));
    const openingHoursSchema = str(fd, "openingHoursSchema", 400).split("\n").map((l) => l.trim()).filter(Boolean);
    if (openingHoursSchema.some((l) => !/^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su))* \d{2}:\d{2}-\d{2}:\d{2}$/.test(l)))
      return { error: "Opening hours for Google must look like “Mo-Fr 08:00-16:00”, one per line." };
    const hours = b.hours.map((h, i) => ({ days: str(fd, `hours-days-${i}`, 40) || h.days, time: str(fd, `hours-time-${i}`, 40) || h.time }));
    const wa = str(fd, "whatsapp", 20).replace(/\D/g, "");
    const email = str(fd, "email", 160);
    if (!/^\d{10,15}$/.test(wa)) return { error: "WhatsApp number must be digits with country code, e.g. 2348107134258." };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
    const next = { ...b, whatsapp: wa, email, phoneDisplay: str(fd, "phoneDisplay", 30) || b.phoneDisplay, claims, hours, openingHoursSchema };
    await setSetting("business", next);
    await log(s, "settings.business", "settings", "business", { claims: claims.map((c) => [c.value, c.verified]) });
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function saveLegal(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("settings.edit", async (s) => {
    const version = str(fd, "version", 40);
    if (version.length < 3) return { error: "Give the policy version a name." };
    const v = { reviewed: fd.get("reviewed") === "on", version };
    await setSetting("legal", v);
    await log(s, "settings.legal", "settings", "legal", v);
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function saveJournal(id: number, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("settings.edit", async (s) => {
    const url = str(fd, "url", 400);
    const published = fd.get("published") === "on";
    if (url && !/^https:\/\/[a-z0-9.-]+\/p\/[a-z0-9-]+/i.test(url)) return { error: "Use the individual post URL, like https://yourname.substack.com/p/post-title" };
    if (published && !url) return { error: "Add the real post URL before publishing the card." };
    await getDb().update(schema.journalPosts).set({ title: str(fd, "title", 160), label: str(fd, "label", 30), url: url || null, published }).where(eq(schema.journalPosts.id, id));
    await log(s, "journal.update", "journal", String(id), { url, published });
    revalidatePath("/");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

// ------------------------------------------------------------------ staff & security
export async function createStaff(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("staff.manage", async (s) => {
    const email = str(fd, "email", 160).toLowerCase();
    const role = str(fd, "role") as Role;
    const pw = String(fd.get("password") ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
    if (!ROLES.includes(role)) return { error: "Choose a role." };
    const problem = passwordProblem(pw);
    if (problem) return { error: problem };
    const db = getDb();
    if (await db.query.staffUsers.findFirst({ where: sql`lower(${schema.staffUsers.email}) = ${email}` })) return { error: "That email already has an account." };
    await db.insert(schema.staffUsers).values({ email, name: str(fd, "name", 80) || email, role, passwordHash: await hashPassword(pw) });
    await log(s, "staff.create", "staff", email, { role });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Account created. Share the temporary password privately; they should change it." };
  }) as Promise<ActionResult>;
}

export async function updateStaff(id: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("staff.manage", async (s) => {
    const role = str(fd, "role") as Role;
    if (!ROLES.includes(role)) return { error: "Choose a role." };
    const active = fd.get("active") === "on";
    if (id === s.id && (!active || role !== "owner")) return { error: "You can't demote or deactivate yourself." };
    const patch: Partial<typeof schema.staffUsers.$inferInsert> = { role, active };
    if (fd.get("resetMfa") === "on") { patch.totpEnabled = false; patch.totpSecret = null; patch.totpLastStep = null; }
    await getDb().update(schema.staffUsers).set(patch).where(eq(schema.staffUsers.id, id));
    if (!active || fd.get("resetMfa") === "on") await getDb().delete(schema.staffSessions).where(eq(schema.staffSessions.userId, id));
    await log(s, "staff.update", "staff", id, { role, active, resetMfa: fd.get("resetMfa") === "on" });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function startMfa(): Promise<ActionResult> {
  const s = await requireStaff(undefined, { allowUnenrolled: true });
  if (s.totpEnabled) return { error: "Two-factor sign-in is already on." };
  await getDb().update(schema.staffUsers).set({ totpSecret: newTotpSecret() }).where(eq(schema.staffUsers.id, s.id));
  revalidatePath("/admin/security");
  return { ok: true };
}

export async function confirmMfa(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await requireStaff(undefined, { allowUnenrolled: true });
  const db = getDb();
  const u = await db.query.staffUsers.findFirst({ where: eq(schema.staffUsers.id, s.id) });
  if (!u?.totpSecret) return { error: "Start setup first." };
  const step = verifyTotp(u.totpSecret, str(fd, "code", 10));
  if (step == null) return { error: "That code didn't match. Check your phone's time is automatic, then try the newest code." };
  await db.update(schema.staffUsers).set({ totpEnabled: true, totpLastStep: step }).where(eq(schema.staffUsers.id, s.id));
  await db.update(schema.staffSessions).set({ mfaPassed: true }).where(eq(schema.staffSessions.id, s.sessionId));
  await log(s, "mfa.enabled", "staff", s.id);
  redirect("/admin");
}

export async function changePassword(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await requireStaff(undefined, { allowUnenrolled: true });
  const db = getDb();
  const u = await db.query.staffUsers.findFirst({ where: eq(schema.staffUsers.id, s.id) });
  if (!u || !(await verifyPassword(String(fd.get("current") ?? ""), u.passwordHash))) return { error: "Your current password is incorrect." };
  const pw = String(fd.get("next") ?? "");
  const problem = passwordProblem(pw);
  if (problem) return { error: problem };
  await db.update(schema.staffUsers).set({ passwordHash: await hashPassword(pw) }).where(eq(schema.staffUsers.id, s.id));
  // sign out other sessions
  await db.delete(schema.staffSessions).where(and(eq(schema.staffSessions.userId, s.id), sql`${schema.staffSessions.id} <> ${s.sessionId}`));
  await log(s, "password.changed", "staff", s.id);
  return { ok: true, message: "Password changed. Other devices were signed out." };
}

export async function signOut() {
  await logout();
  redirect("/admin/login");
}

// ------------------------------------------------------------------ bundles
export async function addBundleItem(productId: string, _p: ActionResult, fd: FormData): Promise<ActionResult> {
  return guard("products.edit", async (s) => {
    const db = getDb();
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, productId) });
    if (!p || p.kind !== "bundle") return { error: "Only bundle products have contents." };
    const variantId = str(fd, "variantId", 40);
    const qty = Number(str(fd, "quantity", 3) || "1");
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { error: "Quantity must be 1–20." };
    const v = await db.query.productVariants.findFirst({ where: eq(schema.productVariants.id, variantId), with: { product: true } });
    if (!v || v.product.kind === "bundle") return { error: "Choose an item (bundles can't contain bundles)." };
    await db.insert(schema.bundleItems).values({ bundleProductId: productId, variantId, quantity: qty })
      .onConflictDoUpdate({ target: [schema.bundleItems.bundleProductId, schema.bundleItems.variantId], set: { quantity: qty } });
    await log(s, "bundle.item", "product", productId, { variantId, qty });
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Saved." };
  }) as Promise<ActionResult>;
}

export async function removeBundleItem(productId: string, variantId: string): Promise<ActionResult> {
  return guard("products.edit", async (s) => {
    await getDb().delete(schema.bundleItems).where(and(eq(schema.bundleItems.bundleProductId, productId), eq(schema.bundleItems.variantId, variantId)));
    await log(s, "bundle.remove", "product", productId, { variantId });
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, message: "Removed." };
  }) as Promise<ActionResult>;
}
