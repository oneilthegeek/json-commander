import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { eq } from "drizzle-orm";
import { getDb, schema, closeDb } from "@/lib/db";
import { priceCart } from "@/lib/pricing";
import { createOrder, OrderError, setDeliveryQuote, transitionOrder, verifyTracking, trackingToken } from "@/lib/orders";
import { handleWebhook, refundOrder, startPayment, verifyAndApply, recordManualPayment } from "@/lib/payments";
import { signWebhook } from "@/lib/paystack";
import { checkDeliveryDate } from "@/lib/scheduling";
import { addDays, lagosToday } from "@/lib/dates";
import { setSetting, DEFAULTS } from "@/lib/settings";
import { subscribe, unsubscribe } from "@/lib/newsletter";
import { startMockPaystack } from "../mocks/paystack-server";
import { checkoutInput, variantBySku, zoneByName } from "../helpers";

const SECRET = "sk_test_integration_mock";
let mock: Awaited<ReturnType<typeof startMockPaystack>>;

async function payViaMock(reference: string, outcome: "pay" | "fail") {
  const r = await fetch(`http://127.0.0.1:4011/checkout/${encodeURIComponent(reference)}/${outcome}`, { method: "POST", redirect: "manual" });
  expect(r.status).toBe(302);
  return r.headers.get("location")!;
}

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  process.env.PAYSTACK_BASE_URL = "http://127.0.0.1:4011";
  // Webhooks from the mock are delivered straight into the app's handler.
  mock = await startMockPaystack({ port: 4011, secret: SECRET, webhookUrl: "http://127.0.0.1:4012/hook", autoWebhook: false });
});
afterAll(async () => { await mock.close(); await closeDb(); });

describe("server-side pricing is authoritative", () => {
  it("prices from the database, including delivery", async () => {
    const letter = await variantBySku("LLH-LETTER");
    const roses = await variantBySku("LLH-ROSE-FULL-10");
    const zone = await zoneByName("Lekki Phase 1");
    const c = await priceCart([{ variantId: letter.id, quantity: 1 }, { variantId: roses.id, quantity: 1 }], zone.id);
    expect(c.errors).toEqual([]);
    expect(c.subtotal).toBe(1_000_000 + 10_500_000);
    expect(c.delivery?.fee).toBe(700_000);
    expect(c.total).toBe(1_000_000 + 10_500_000 + 700_000);
    expect(c.approvalRequired).toBe(true);
  });
  it("updates immediately when the flower or zone changes (root cause of the old stale-total bug)", async () => {
    const letter = await variantBySku("LLH-LETTER");
    const roses5 = await variantBySku("LLH-ROSE-JUST-5");
    const yaba = await zoneByName("Yaba, Mushin, Ilupeju");
    const ajah = await zoneByName("Ajah");
    const a = await priceCart([{ variantId: letter.id, quantity: 1 }], yaba.id);
    const b = await priceCart([{ variantId: letter.id, quantity: 1 }, { variantId: roses5.id, quantity: 1 }], yaba.id);
    const c = await priceCart([{ variantId: letter.id, quantity: 1 }, { variantId: roses5.id, quantity: 1 }], ajah.id);
    expect(a.total).toBe(1_300_000);
    expect(b.total).toBe(1_300_000 + 5_000_000);
    expect(c.total).toBe(1_000_000 + 5_000_000 + 850_000);
  });
  it("refuses quote-only items, inactive items and multiple letters", async () => {
    const chrys = await variantBySku("LLH-CHRYS-FULL-6");
    const letter = await variantBySku("LLH-LETTER");
    const c = await priceCart([{ variantId: chrys.id, quantity: 1 }, { variantId: letter.id, quantity: 2 }], null);
    expect(c.lines).toHaveLength(0);
    expect(c.errors.map((e) => e.message).join(" ")).toMatch(/priced on request/);
    expect(c.errors.map((e) => e.message).join(" ")).toMatch(/one letter per order/);
  });
  it("leaves the total open when delivery needs a quote", async () => {
    const candle = await variantBySku("LLH-CANDLE-CHOC");
    const other = await zoneByName("Another state");
    const c = await priceCart([{ variantId: candle.id, quantity: 2 }], other.id);
    expect(c.subtotal).toBe(1_700_000);
    expect(c.total).toBeNull();
  });
  it("lets customers buy a gift without a letter", async () => {
    const tag = await variantBySku("LLH-TAG");
    const c = await priceCart([{ variantId: tag.id, quantity: 3 }], (await zoneByName("Ajah")).id);
    expect(c.errors).toEqual([]);
    expect(c.needsLetterBrief).toBe(false);
  });
});

describe("orders", () => {
  it("saves the full order, brief and timeline; replays the same checkout key without duplicating", async () => {
    const input = await checkoutInput();
    const a = await createOrder(input);
    const b = await createOrder(input);
    expect(b.replayed).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    const o = await getDb().query.orders.findFirst({ where: eq(schema.orders.id, a.order.id), with: { items: true, briefs: true, events: true } });
    expect(o!.status).toBe("pending_payment");
    expect(o!.total).toBe(1_300_000);
    expect(o!.buyerPhone).toBe("+2348031234567");
    expect(o!.briefs[0].message).toMatch(/Dear Ada/);
    expect(o!.events[0].type).toBe("created");
    expect(verifyTracking(o!, a.token)).toBe(true);
    expect(verifyTracking(o!, "x".repeat(32))).toBe(false);
  });
  it("requires a letter brief when a letter is in the order", async () => {
    await expect(createOrder(await checkoutInput({ letter: undefined }))).rejects.toThrow(/what your letter should say/);
  });
  it("rejects dates that are too soon, blocked or full", async () => {
    await expect(createOrder(await checkoutInput({ delivery: { zoneId: (await zoneByName("Ajah")).id, address: "1 Ajah Road, Ajah", date: lagosToday(), window: "any" } }))).rejects.toThrow(/earliest/);
    const day = addDays(lagosToday(), 20);
    await getDb().insert(schema.calendarDays).values({ day, blocked: true, note: "Public holiday" });
    const r = await checkDeliveryDate(day, { productionDays: 2, transitDays: 0 });
    expect(r.ok).toBe(false);
    const day2 = addDays(lagosToday(), 21);
    await getDb().insert(schema.calendarDays).values({ day: day2, capacity: 1 });
    const zone = await zoneByName("Ajah");
    await createOrder(await checkoutInput({ delivery: { zoneId: zone.id, address: "1 Ajah Road, Ajah", date: day2, window: "any" } }));
    await expect(createOrder(await checkoutInput({ delivery: { zoneId: zone.id, address: "1 Ajah Road, Ajah", date: day2, window: "any" } }))).rejects.toThrow(/fully booked/);
  });
  it("awaiting-quote orders can't be paid until staff set the fee", async () => {
    const zone = await zoneByName("Another state");
    const { order, token } = await createOrder(await checkoutInput({ delivery: { zoneId: zone.id, address: "5 Wuse II, Abuja", date: addDays(lagosToday(), 12), window: "any" } }));
    expect(order.status).toBe("awaiting_quote");
    expect(order.total).toBeNull();
    await expect(startPayment(order.number, token)).rejects.toThrow(/confirming your delivery fee/);
    const staff = await makeStaff("quote@example.com");
    const u = await setDeliveryQuote(order.id, 1_200_000, { id: staff, email: "quote@example.com" });
    expect(u.status).toBe("pending_payment");
    expect(u.total).toBe(order.subtotal + 1_200_000);
  });
});

async function makeStaff(email: string) {
  const [u] = await getDb().insert(schema.staffUsers).values({ email, name: email, role: "owner", passwordHash: "x" }).onConflictDoNothing().returning();
  return u?.id ?? (await getDb().query.staffUsers.findFirst({ where: eq(schema.staffUsers.email, email) }))!.id;
}

describe("Paystack payments (sandbox contract via local mock)", () => {
  it("only marks paid after server verification, and callback + webhook are idempotent", async () => {
    const tag = await variantBySku("LLH-TAG");
    const card = await variantBySku("LLH-GOLDCARD");
    const { order, token } = await createOrder(await checkoutInput({ lines: [{ variantId: tag.id, quantity: 1 }, { variantId: card.id, quantity: 1 }], letter: undefined }));
    const { authorizationUrl, reference } = await startPayment(order.number, token);
    expect(authorizationUrl).toContain("/checkout/");
    // Not paid just because a payment was started
    expect((await getDb().query.orders.findFirst({ where: eq(schema.orders.id, order.id) }))!.paymentStatus).toBe("unpaid");
    expect((await verifyAndApply(reference, "callback")).outcome).toBe("pending");
    await payViaMock(reference, "pay");
    expect((await verifyAndApply(reference, "callback")).outcome).toBe("paid");
    // Duplicate webhook deliveries
    const body = JSON.stringify({ event: "charge.success", data: { id: 1, reference, amount: order.total, status: "success" } });
    expect(await handleWebhook(body)).toBe("already_paid");
    expect(await handleWebhook(body)).toBe("duplicate-ignored");
    const o = await getDb().query.orders.findFirst({ where: eq(schema.orders.id, order.id), with: { events: true, experiences: true } });
    expect(o!.status).toBe("paid");
    expect(o!.testMode).toBe(true);
    expect(o!.events.filter((e) => e.toStatus === "paid")).toHaveLength(1);
    // Gold Card + Tag experiences created once, with unguessable tokens
    expect(o!.experiences.map((e) => e.kind).sort()).toEqual(["gold_card", "llh_tag"]);
    expect(o!.experiences[0].publicToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    await expect(startPayment(order.number, token)).rejects.toThrow(/already been paid/);
  });

  it("handles a failed payment and a successful retry", async () => {
    const { order, token } = await createOrder(await checkoutInput());
    const first = await startPayment(order.number, token);
    await payViaMock(first.reference, "fail");
    expect((await verifyAndApply(first.reference, "callback")).outcome).toBe("failed");
    expect((await getDb().query.orders.findFirst({ where: eq(schema.orders.id, order.id) }))!.paymentStatus).toBe("unpaid");
    const retry = await startPayment(order.number, token);
    expect(retry.reference).not.toBe(first.reference);
    await payViaMock(retry.reference, "pay");
    expect((await verifyAndApply(retry.reference, "callback")).outcome).toBe("paid");
  });

  it("never marks paid when the amount doesn't match", async () => {
    const { order, token } = await createOrder(await checkoutInput());
    const p = await startPayment(order.number, token);
    await fetch(`http://127.0.0.1:4011/__control/tamper/${encodeURIComponent(p.reference)}`);
    await payViaMock(p.reference, "pay");
    expect((await verifyAndApply(p.reference, "webhook")).outcome).toBe("mismatch");
    expect((await getDb().query.orders.findFirst({ where: eq(schema.orders.id, order.id) }))!.paymentStatus).toBe("unpaid");
  });

  it("flags a second successful payment for refund instead of double-processing", async () => {
    const { order, token } = await createOrder(await checkoutInput());
    const a = await startPayment(order.number, token);
    const b = await startPayment(order.number, token); // customer opened two tabs
    await payViaMock(a.reference, "pay");
    await payViaMock(b.reference, "pay");
    expect((await verifyAndApply(a.reference, "callback")).outcome).toBe("paid");
    expect((await verifyAndApply(b.reference, "webhook")).outcome).toBe("duplicate");
    const o = await getDb().query.orders.findFirst({ where: eq(schema.orders.id, order.id) });
    expect(o!.duplicatePaymentFlag).toBe(true);
  });

  it("refunds through Paystack and settles on the refund webhook", async () => {
    const { order, token } = await createOrder(await checkoutInput());
    const p = await startPayment(order.number, token);
    await payViaMock(p.reference, "pay");
    await verifyAndApply(p.reference, "callback");
    const staff = await makeStaff("refund@example.com");
    await refundOrder(order.id, order.total!, "Customer cancelled before production", { id: staff, email: "refund@example.com" });
    await handleWebhook(JSON.stringify({ event: "refund.processed", data: { id: 99, transaction_reference: p.reference, amount: order.total, status: "processed" } }));
    const o = await getDb().query.orders.findFirst({ where: eq(schema.orders.id, order.id), with: { refunds: true } });
    expect(o!.paymentStatus).toBe("refunded");
    expect(o!.status).toBe("refunded");
    expect(o!.refunds[0].status).toBe("processed");
    await expect(refundOrder(order.id, 100, "again", { id: staff, email: "refund@example.com" })).rejects.toThrow(/at most/);
  });

  it("webhook signatures use the secret key (HMAC-SHA512)", () => {
    expect(signWebhook("{}", SECRET)).toMatch(/^[0-9a-f]{128}$/);
  });

  it("decrements tracked stock on payment, and blocks overselling at checkout", async () => {
    const candle = await variantBySku("LLH-CANDLE-TROP");
    await getDb().update(schema.productVariants).set({ stock: 2 }).where(eq(schema.productVariants.id, candle.id));
    const c = await priceCart([{ variantId: candle.id, quantity: 3 }], null);
    expect(c.errors[0].message).toMatch(/Only 2/);
    const { order, token } = await createOrder(await checkoutInput({ lines: [{ variantId: candle.id, quantity: 2 }], letter: undefined }));
    const p = await startPayment(order.number, token);
    await payViaMock(p.reference, "pay");
    await verifyAndApply(p.reference, "callback");
    expect((await variantBySku("LLH-CANDLE-TROP")).stock).toBe(0);
    expect((await priceCart([{ variantId: candle.id, quantity: 1 }], null)).errors[0].message).toMatch(/sold out/);
    await getDb().update(schema.productVariants).set({ stock: null }).where(eq(schema.productVariants.id, candle.id));
  });
});

describe("letter approval gate", () => {
  it("production is blocked until the buyer approves", async () => {
    const { order } = await createOrder(await checkoutInput());
    const staff = await makeStaff("writer@example.com");
    await recordManualPayment(order.id, "Bank transfer ref 12345", { id: staff, email: "writer@example.com" });
    await transitionOrder(order.id, "drafting", { id: staff, label: "writer" });
    await expect(transitionOrder(order.id, "in_production", { id: staff, label: "writer" })).rejects.toThrow(/approved/);
    await getDb().insert(schema.letterDrafts).values({ orderId: order.id, version: 1, body: "Dear Ada…", status: "approved" });
    await expect(transitionOrder(order.id, "in_production", { id: staff, label: "writer" })).resolves.toMatchObject({ status: "in_production" });
  });
  it("unpaid orders can't move into production steps", async () => {
    const { order } = await createOrder(await checkoutInput());
    await expect(transitionOrder(order.id, "drafting", { id: null, label: "x" })).rejects.toBeInstanceOf(OrderError);
  });
  it("tracking tokens are deterministic per order and unguessable across orders", async () => {
    expect(trackingToken("a")).not.toBe(trackingToken("b"));
    expect(trackingToken("a")).toHaveLength(32);
  });
});

describe("newsletter (Mailchimp API contract via local mock)", () => {
  let server: Server;
  const members = new Map<string, string>();
  beforeAll(async () => {
    server = createServer((req, res) => {
      const id = req.url!.split("/members/")[1];
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET") { if (members.has(id)) { res.end(JSON.stringify({ status: members.get(id) })); } else { res.statusCode = 404; res.end("{}"); } return; }
        const b = JSON.parse(body || "{}");
        if (b.email_address?.endsWith("@invalid.test")) { res.statusCode = 400; res.end(JSON.stringify({ title: "Invalid Resource" })); return; }
        if (req.method === "PUT") members.set(id, b.status_if_new);
        if (req.method === "PATCH") { if (!members.has(id)) { res.statusCode = 404; res.end("{}"); return; } members.set(id, b.status); }
        res.end(JSON.stringify({ status: members.get(id) }));
      });
    });
    await new Promise<void>((r) => server.listen(4013, "127.0.0.1", () => r()));
    Object.assign(process.env, { NEWSLETTER_PROVIDER: "mailchimp", MAILCHIMP_API_KEY: "test-us1", MAILCHIMP_AUDIENCE_ID: "aud1", MAILCHIMP_BASE_URL: "http://127.0.0.1:4013" });
  });
  afterAll(() => { server.close(); delete process.env.MAILCHIMP_API_KEY; process.env.NEWSLETTER_PROVIDER = "substack"; });

  it("double opt-in, duplicate detection, errors and unsubscribe", async () => {
    expect((await subscribe("ada@example.com", "test")).status).toBe("pending");
    expect((await subscribe("ada@example.com", "test")).status).toBe("pending"); // already pending
    members.set([...members.keys()][0], "subscribed");
    expect((await subscribe("ada@example.com")).status).toBe("already");
    expect((await subscribe("bad@invalid.test")).status).toBe("error");
    expect((await unsubscribe("ada@example.com")).ok).toBe(true);
    expect([...members.values()][0]).toBe("unsubscribed");
    expect((await unsubscribe("never@example.com")).ok).toBe(true); // no enumeration
    const logs = await getDb().select().from(schema.newsletterSignups);
    expect(logs.every((l) => /^[0-9a-f]{64}$/.test(l.emailHash))).toBe(true); // no plaintext emails stored
  });

  it("Substack mode hands the visitor to Substack's hosted page and never claims success", async () => {
    Object.assign(process.env, { NEWSLETTER_PROVIDER: "substack", SUBSTACK_PUBLICATION_URL: "https://example.substack.com" });
    const r = await subscribe("ada@example.com");
    expect(r.status).toBe("redirect");
    expect(r.status === "redirect" && r.url).toBe("https://example.substack.com/subscribe?email=ada%40example.com");
    delete process.env.SUBSTACK_PUBLICATION_URL;
    expect((await subscribe("ada@example.com")).status).toBe("error");
  });
});

describe("settings", () => {
  it("unverified claims stay hidden by default", () => {
    expect(DEFAULTS.business.claims.every((c) => !c.verified)).toBe(true);
    void setSetting;
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within the window", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const prev = process.env.RATE_LIMIT_DISABLED;
    delete process.env.RATE_LIMIT_DISABLED;
    const key = `test:${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit(key, 3, 60)).ok);
    expect(results).toEqual([true, true, true, false]);
    process.env.RATE_LIMIT_DISABLED = prev;
  });
});
