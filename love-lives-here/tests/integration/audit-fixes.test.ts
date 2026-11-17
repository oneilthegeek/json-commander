import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema, closeDb } from "@/lib/db";
import { priceCart } from "@/lib/pricing";
import { createOrder } from "@/lib/orders";
import { recordManualPayment } from "@/lib/payments";
import { flushOutbox } from "@/lib/notifications";
import { sniff } from "@/lib/media";
import { DEFAULTS, publicClaims } from "@/lib/settings";
import { checkoutInput, variantBySku } from "../helpers";

afterAll(closeDb);

describe("curated bundles", () => {
  let bundleVariant: string;
  beforeAll(async () => {
    const db = getDb();
    const [p] = await db.insert(schema.products).values({ slug: "test-bundle", name: "Test Bundle", kind: "bundle", active: true }).returning();
    const [v] = await db.insert(schema.productVariants).values({ productId: p.id, name: "Bundle", sku: "TEST-BUNDLE", price: 2_000_000, priceStatus: "confirmed" }).returning();
    bundleVariant = v.id;
    // empty bundle can't be bought
    expect((await priceCart([{ variantId: v.id, quantity: 1 }], null)).errors[0].message).toMatch(/isn't ready/);
    const candle = await variantBySku("LLH-CANDLE-CHOC");
    const tag = await variantBySku("LLH-TAG");
    await db.update(schema.productVariants).set({ stock: 3 }).where(eq(schema.productVariants.id, candle.id));
    await db.insert(schema.bundleItems).values([{ bundleProductId: p.id, variantId: candle.id, quantity: 2 }, { bundleProductId: p.id, variantId: tag.id, quantity: 1 }]);
  });
  it("checks component stock and reduces it when paid", async () => {
    expect((await priceCart([{ variantId: bundleVariant, quantity: 2 }], null)).errors[0].message).toMatch(/out of stock/); // needs 4 candles, 3 left
    const ok = await priceCart([{ variantId: bundleVariant, quantity: 1 }], null);
    expect(ok.errors).toEqual([]);
    expect(ok.subtotal).toBe(2_000_000);
    const { order } = await createOrder(await checkoutInput({ lines: [{ variantId: bundleVariant, quantity: 1 }], letter: undefined }));
    const [staff] = await getDb().insert(schema.staffUsers).values({ email: "bundle@example.com", name: "b", role: "owner", passwordHash: "x" }).returning();
    await recordManualPayment(order.id, "Bank ref 4455", { id: staff.id, email: staff.email });
    // bank-transfer payments consume stock too (2 candles per bundle)
    expect((await variantBySku("LLH-CANDLE-CHOC")).stock).toBe(1);
    await getDb().update(schema.productVariants).set({ stock: null }).where(eq(schema.productVariants.sku, "LLH-CANDLE-CHOC"));
  });
});

describe("customer emails send automatically, exactly once", () => {
  it("flushes queued messages, retries failures, never double-sends under concurrency", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const db = getDb();
    await db.delete(schema.outbox);
    await db.insert(schema.outbox).values([1, 2, 3].map((i) => ({ channel: "email", to: `c${i}@example.com`, subject: "s", body: "b" })));
    const sent: string[] = [];
    let fail = true;
    const send = async (m: { to: string }) => { await new Promise((r) => setTimeout(r, 20)); if (m.to === "c2@example.com" && fail) throw new Error("HTTP 500"); sent.push(m.to); };
    const [a, b] = await Promise.all([flushOutbox(10, send), flushOutbox(10, send)]);
    expect(a.sent + b.sent).toBe(2);
    expect(new Set(sent).size).toBe(sent.length); // no duplicates
    fail = false;
    const retry = await flushOutbox(10, send);
    expect(retry.sent).toBe(1);
    const rows = await db.select().from(schema.outbox);
    expect(rows.every((r) => r.status === "sent")).toBe(true);
    delete process.env.RESEND_API_KEY;
    expect((await flushOutbox(10, send)).skipped).toBe(true);
  });
});

describe("audit fixes", () => {
  it("rejects HEIC photos that most browsers can't display", () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(8)]);
    expect(sniff(heic)).toBeNull();
  });
  it("hides evidence-based claims until verified; shows operational facts", () => {
    const shown = publicClaims(DEFAULTS.business).map((c) => c.value);
    expect(shown).toEqual(["Est. 2025", "48 hrs", "Nationwide"]);
    const verified = { ...DEFAULTS.business, claims: DEFAULTS.business.claims.map((c) => ({ ...c, verified: true })) };
    expect(publicClaims(verified)).toHaveLength(5);
  });
});
