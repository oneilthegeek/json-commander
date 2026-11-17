/**
 * Regression tests for defects found in the independent review (18 Nov 2026).
 * Each test fails on the code before the fix.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema, closeDb } from "@/lib/db";
import { createOrder } from "@/lib/orders";
import { handleWebhook, refundOrder, startPayment, verifyAndApply } from "@/lib/payments";
import { ipFromHeaders } from "@/lib/client-ip";
import { startMockPaystack } from "../mocks/paystack-server";
import { checkoutInput } from "../helpers";

const SECRET = "sk_test_review_mock";
const PORT = 4013;
let mock: Awaited<ReturnType<typeof startMockPaystack>>;

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  process.env.PAYSTACK_BASE_URL = `http://127.0.0.1:${PORT}`;
  mock = await startMockPaystack({ port: PORT, secret: SECRET, webhookUrl: "http://127.0.0.1:4014/hook", autoWebhook: false });
});
afterAll(async () => { await mock.close(); await closeDb(); });

async function pay(reference: string) {
  const r = await fetch(`http://127.0.0.1:${PORT}/checkout/${encodeURIComponent(reference)}/pay`, { method: "POST", redirect: "manual" });
  expect(r.status).toBe(302);
}
async function staff(email: string) {
  const [u] = await getDb().insert(schema.staffUsers).values({ email, name: email, role: "owner", passwordHash: "x" }).onConflictDoNothing().returning();
  return { id: u?.id ?? (await getDb().query.staffUsers.findFirst({ where: eq(schema.staffUsers.email, email) }))!.id, email };
}
async function paidOrder() {
  const { order, token } = await createOrder(await checkoutInput());
  const p = await startPayment(order.number, token);
  await pay(p.reference);
  expect((await verifyAndApply(p.reference, "callback")).outcome).toBe("paid");
  return { order, reference: p.reference };
}
const reload = (id: string) => getDb().query.orders.findFirst({ where: eq(schema.orders.id, id), with: { refunds: true, events: true } });

describe("refunds", () => {
  it("two simultaneous full refunds: exactly one is accepted (no double refund)", async () => {
    const { order } = await paidOrder();
    const a = await staff("refund-a@example.com"), b = await staff("refund-b@example.com");
    await fetch(`http://127.0.0.1:${PORT}/__control/refund-delay/300`); // both clicks land while Paystack is still answering
    const results = await Promise.allSettled([
      refundOrder(order.id, order.total!, "Customer cancelled", a),
      refundOrder(order.id, order.total!, "Customer cancelled", b),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/Nothing left|at most/);
    await fetch(`http://127.0.0.1:${PORT}/__control/refund-delay/0`);
    const o = await reload(order.id);
    expect(o!.refunds.filter((r) => r.status !== "failed")).toHaveLength(1);
  });

  it("a refund made in the Paystack dashboard is recorded with its real amount", async () => {
    const { order, reference } = await paidOrder();
    const r = await handleWebhook(JSON.stringify({ event: "refund.processed", data: { id: 555001, transaction_reference: reference, amount: order.total, status: "processed" } }));
    expect(r).toBe("refund_processed");
    const o = await reload(order.id);
    expect(o!.refunds).toHaveLength(1);
    expect(o!.refunds[0]).toMatchObject({ amount: order.total, status: "processed", providerRefundId: "555001" });
    expect(o!.paymentStatus).toBe("refunded");
    expect(o!.events.some((e) => /₦0/.test(e.message ?? ""))).toBe(false); // old bug: "partial refund of ₦0"
  });

  it("refund webhooks are idempotent even when delivered with different ids for the same refund", async () => {
    const { order, reference } = await paidOrder();
    const s = await staff("refund-c@example.com");
    await refundOrder(order.id, 100_000, "Partial goodwill", s);
    expect(await handleWebhook(JSON.stringify({ event: "refund.processed", data: { id: 777, transaction_reference: reference, amount: 100_000, status: "processed" } }))).toBe("refund_processed");
    // a second, differently-shaped delivery for an already processed refund must not settle again
    await handleWebhook(JSON.stringify({ event: "refund.processed", data: { id: 777, transaction_reference: reference, amount: 100_000, status: "processed", extra: 1 } }));
    const o = await reload(order.id);
    expect(o!.paymentStatus).toBe("partially_refunded");
    expect(o!.events.filter((e) => e.type === "refund")).toHaveLength(1);
  });

  it("a refund Paystack rejects is released so it can be retried", async () => {
    const { order } = await paidOrder();
    const s = await staff("refund-d@example.com");
    const saved = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = "sk_test_wrong_key"; // mock answers 401
    await expect(refundOrder(order.id, order.total!, "Customer cancelled", s)).rejects.toThrow(/didn't accept/);
    process.env.PAYSTACK_SECRET_KEY = saved;
    expect((await reload(order.id))!.refunds[0].status).toBe("failed");
    await refundOrder(order.id, order.total!, "Customer cancelled", s); // retry allowed
  });
});

describe("payment amount must match the order's current total", () => {
  it("is not marked paid if staff changed the total after the payment started", async () => {
    const { order, token } = await createOrder(await checkoutInput());
    const p = await startPayment(order.number, token);
    await getDb().update(schema.orders).set({ total: order.total! + 500_000 }).where(eq(schema.orders.id, order.id));
    await pay(p.reference);
    expect((await verifyAndApply(p.reference, "webhook")).outcome).toBe("mismatch");
    const o = await reload(order.id);
    expect(o!.paymentStatus).toBe("unpaid");
    expect(o!.events.some((e) => e.type === "payment_mismatch")).toBe(true);
  });
});

describe("client IP for rate limiting can't be spoofed through X-Forwarded-For", () => {
  const h = (xff?: string, real?: string) => ({ get: (k: string) => (k === "x-forwarded-for" ? xff ?? null : k === "x-real-ip" ? real ?? null : null) });
  it("uses the entry added by our own proxy (right-most), not the client-supplied one", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(ipFromHeaders(h("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(ipFromHeaders(h("203.0.113.9"))).toBe("203.0.113.9");
    expect(ipFromHeaders(h(undefined, "198.51.100.2"))).toBe("198.51.100.2");
    expect(ipFromHeaders(h())).toBe("unknown");
    process.env.TRUSTED_PROXY_HOPS = "2"; // e.g. Cloudflare in front of Caddy
    expect(ipFromHeaders(h("6.6.6.6, 203.0.113.9, 10.0.0.2"))).toBe("203.0.113.9");
    delete process.env.TRUSTED_PROXY_HOPS;
  });
});
