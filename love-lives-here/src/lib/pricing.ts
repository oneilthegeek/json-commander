/**
 * The single source of truth for what an order costs. Runs on the server only.
 * The browser sends variant IDs and quantities; prices, fees and totals are
 * always looked up here from the database.
 */
import { eq } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";
import { bundleContents, variantsByIds } from "./catalog";

export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 30;

export type CartLineInput = { variantId: string; quantity: number };

export type PricedLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  kind: (typeof schema.productKind.enumValues)[number];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  requiresLetterBrief: boolean;
  requiresApproval: boolean;
  productionDays: number;
  nfc: "gold_card" | "llh_tag" | null;
  priceStatus: "confirmed" | "unverified" | "quote";
};

export type DeliveryQuote =
  | { mode: "fixed"; zoneId: number; zoneName: string; fee: number; transitDays: number }
  | { mode: "quote"; zoneId: number; zoneName: string; fee: null; transitDays: number }
  | { mode: "pickup"; zoneId: number; zoneName: string; fee: 0; transitDays: 0 };

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  delivery: DeliveryQuote | null;
  /** null when delivery still needs a quote or no zone chosen */
  total: number | null;
  productionDays: number;
  needsLetterBrief: boolean;
  approvalRequired: boolean;
  errors: { variantId?: string; message: string }[];
};

export function normaliseLines(input: unknown): CartLineInput[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<string, number>();
  for (const raw of input.slice(0, MAX_LINES)) {
    if (!raw || typeof raw !== "object") continue;
    const { variantId, quantity } = raw as Record<string, unknown>;
    if (typeof variantId !== "string" || !/^[0-9a-f-]{36}$/i.test(variantId)) continue;
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) continue;
    merged.set(variantId, Math.min((merged.get(variantId) ?? 0) + q, MAX_QTY_PER_LINE));
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export async function quoteZone(zoneId: number | null | undefined, tx: Tx = getDb()): Promise<DeliveryQuote | null> {
  if (zoneId == null) return null;
  const z = await tx.query.deliveryZones.findFirst({ where: eq(schema.deliveryZones.id, zoneId) });
  if (!z || !z.active) return null;
  if (z.mode === "fixed") return { mode: "fixed", zoneId: z.id, zoneName: z.name, fee: z.fee!, transitDays: z.transitDays };
  if (z.mode === "pickup") return { mode: "pickup", zoneId: z.id, zoneName: z.name, fee: 0, transitDays: 0 };
  return { mode: "quote", zoneId: z.id, zoneName: z.name, fee: null, transitDays: z.transitDays };
}

export async function priceCart(rawLines: unknown, zoneId: number | null | undefined, tx: Tx = getDb()): Promise<PricedCart> {
  const input = normaliseLines(rawLines);
  const errors: PricedCart["errors"] = [];
  const variants = await variantsByIds(input.map((l) => l.variantId), tx);
  const byId = new Map(variants.map((v) => [v.id, v]));
  const bundles = await bundleContents(variants.filter((v) => v.product.kind === "bundle").map((v) => v.productId), tx);
  const lines: PricedLine[] = [];

  for (const l of input) {
    const v = byId.get(l.variantId);
    if (!v || !v.active || !v.product.active) {
      errors.push({ variantId: l.variantId, message: "An item in your bag is no longer available. It has been removed." });
      continue;
    }
    if (v.price == null || v.priceStatus === "quote") {
      errors.push({ variantId: v.id, message: `${v.product.name} (${v.name}) is priced on request. Ask us on WhatsApp for a quote.` });
      continue;
    }
    if (v.product.kind === "letter" && l.quantity > 1) {
      errors.push({ variantId: v.id, message: "Each letter is written for one person, so it's one letter per order. Place a second order for another letter." });
      continue;
    }
    if (v.product.kind === "bundle") {
      const parts = bundles.get(v.productId) ?? [];
      const short = parts.find((p) => !p.active || (p.stock != null && p.stock < p.quantity * l.quantity));
      if (!parts.length || short) {
        errors.push({ variantId: v.id, message: !parts.length ? `${v.product.name} isn't ready to order yet.` : `${v.product.name} is unavailable right now (${short!.productName} is out of stock).` });
        continue;
      }
    }
    if (v.stock != null && v.stock < l.quantity) {
      errors.push({
        variantId: v.id,
        message: v.stock === 0 ? `${v.product.name} is sold out right now.` : `Only ${v.stock} of ${v.product.name} (${v.name}) left.`,
      });
      continue;
    }
    lines.push({
      variantId: v.id,
      productId: v.productId,
      productSlug: v.product.slug,
      productName: v.product.name,
      variantName: v.name,
      kind: v.product.kind,
      unitPrice: v.price,
      quantity: l.quantity,
      lineTotal: v.price * l.quantity,
      requiresLetterBrief: v.product.requiresLetterBrief,
      requiresApproval: v.product.requiresApproval,
      productionDays: v.product.productionDays,
      nfc: v.product.nfc,
      priceStatus: v.priceStatus,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const delivery = await quoteZone(zoneId, tx);
  if (zoneId != null && !delivery) errors.push({ message: "That delivery area is not available. Choose another." });
  const total = delivery && delivery.fee != null ? subtotal + delivery.fee : null;

  return {
    lines,
    subtotal,
    delivery,
    total,
    productionDays: lines.reduce((m, l) => Math.max(m, l.productionDays), 0),
    needsLetterBrief: lines.some((l) => l.requiresLetterBrief),
    approvalRequired: lines.some((l) => l.requiresApproval),
    errors,
  };
}
