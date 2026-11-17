/**
 * TEST-ONLY local stand-in for the Paystack API, implementing the subset of
 * the documented contract the app uses:
 *   POST /transaction/initialize   GET /transaction/verify/:reference   POST /refund
 * plus a hosted "checkout" page with Pay / Decline buttons and signed
 * webhooks (x-paystack-signature = HMAC-SHA512(secret, body)).
 * It is never used by the running shop unless explicitly configured for tests.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, randomInt } from "node:crypto";

type Txn = { reference: string; amount: number; email: string; callback: string; status: "pending" | "success" | "failed" | "abandoned"; id: number; tamper?: number };

export function startMockPaystack(opts: { port: number; secret: string; webhookUrl: string; autoWebhook?: boolean }) {
  const txns = new Map<string, Txn>();
  const webhooks: { event: string; reference: string; status: number }[] = [];

  async function sendWebhook(event: string, data: object) {
    const body = JSON.stringify({ event, data });
    const sig = createHmac("sha512", opts.secret).update(body).digest("hex");
    try {
      const r = await fetch(opts.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-paystack-signature": sig }, body });
      webhooks.push({ event, reference: (data as { reference?: string }).reference ?? "", status: r.status });
    } catch { webhooks.push({ event, reference: "", status: 0 }); }
  }

  const json = (res: ServerResponse, code: number, body: object) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  const read = (req: IncomingMessage) => new Promise<string>((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });
  const authed = (req: IncomingMessage) => req.headers.authorization === `Bearer ${opts.secret}`;

  let refundDelayMs = 0; // simulates a slow Paystack refund call (for race tests)
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${opts.port}`);
    const p = url.pathname;
    if (p.startsWith("/__control/")) {
      if (p === "/__control/state") return json(res, 200, { txns: [...txns.values()], webhooks });
      const d = /^\/__control\/refund-delay\/(\d+)$/.exec(p);
      if (d) { refundDelayMs = Number(d[1]); return json(res, 200, { ok: true }); }
      const m = /^\/__control\/tamper\/(.+)$/.exec(p);
      if (m && txns.has(m[1])) { txns.get(m[1])!.tamper = 100; return json(res, 200, { ok: true }); }
      const w = /^\/__control\/webhook\/(.+)$/.exec(p);
      if (w && txns.has(w[1])) { const t = txns.get(w[1])!; await sendWebhook("charge.success", { id: t.id, reference: t.reference, amount: t.amount, status: "success" }); return json(res, 200, { ok: true }); }
      return json(res, 404, {});
    }
    if (req.method === "POST" && p === "/transaction/initialize") {
      if (!authed(req)) return json(res, 401, { status: false, message: "Invalid key" });
      const b = JSON.parse(await read(req));
      if (!b.email || !Number.isInteger(b.amount) || b.amount < 100) return json(res, 400, { status: false, message: "Invalid amount or email" });
      if (txns.has(b.reference)) return json(res, 400, { status: false, message: "Duplicate Transaction Reference" });
      txns.set(b.reference, { reference: b.reference, amount: b.amount, email: b.email, callback: b.callback_url, status: "pending", id: randomInt(1e9) });
      return json(res, 200, { status: true, message: "Authorization URL created", data: { authorization_url: `http://127.0.0.1:${opts.port}/checkout/${encodeURIComponent(b.reference)}`, access_code: "mock_" + randomInt(1e6), reference: b.reference } });
    }
    const v = /^\/transaction\/verify\/(.+)$/.exec(p);
    if (req.method === "GET" && v) {
      if (!authed(req)) return json(res, 401, { status: false, message: "Invalid key" });
      const t = txns.get(decodeURIComponent(v[1]));
      if (!t) return json(res, 400, { status: false, message: "Transaction reference not found" });
      return json(res, 200, { status: true, message: "Verification successful", data: {
        id: t.id, domain: "test", status: t.status === "pending" ? "ongoing" : t.status, reference: t.reference, amount: t.amount + (t.tamper ?? 0),
        currency: "NGN", gateway_response: t.status === "success" ? "Successful" : t.status === "failed" ? "Declined" : "Pending", channel: "card", paid_at: t.status === "success" ? new Date().toISOString() : null } });
    }
    if (req.method === "POST" && p === "/refund") {
      if (!authed(req)) return json(res, 401, { status: false, message: "Invalid key" });
      const b = JSON.parse(await read(req));
      if (refundDelayMs) await new Promise((r) => setTimeout(r, refundDelayMs));
      const t = txns.get(b.transaction);
      if (!t || t.status !== "success") return json(res, 400, { status: false, message: "Transaction not found or not successful" });
      setTimeout(() => sendWebhook("refund.processed", { id: randomInt(1e9), transaction_reference: t.reference, amount: b.amount ?? t.amount, status: "processed" }), 150);
      return json(res, 200, { status: true, message: "Refund has been queued for processing", data: { id: randomInt(1e9), status: "pending", amount: b.amount ?? t.amount, transaction: { reference: t.reference } } });
    }
    const c = /^\/checkout\/([^/]+)(?:\/(pay|fail))?$/.exec(p);
    if (c) {
      const t = txns.get(decodeURIComponent(c[1]));
      if (!t) { res.writeHead(404); return res.end("unknown transaction"); }
      if (req.method === "POST" && c[2]) {
        t.status = c[2] === "pay" ? "success" : "failed";
        if (t.status === "success" && opts.autoWebhook !== false) setTimeout(() => sendWebhook("charge.success", { id: t.id, reference: t.reference, amount: t.amount, status: "success" }), 50);
        const back = new URL(t.callback); back.searchParams.set("trxref", t.reference); back.searchParams.set("reference", t.reference);
        res.writeHead(302, { Location: back.toString() }); return res.end();
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><meta charset="utf-8"><title>Mock Paystack (test)</title><h1>Mock Paystack checkout — TEST ONLY</h1><p>Amount: ₦${(t.amount / 100).toLocaleString()}</p>
        <form method="post" action="/checkout/${encodeURIComponent(t.reference)}/pay"><button id="pay">Pay (test success)</button></form>
        <form method="post" action="/checkout/${encodeURIComponent(t.reference)}/fail"><button id="fail">Decline (test failure)</button></form>`);
    }
    json(res, 404, { status: false, message: "Not found" });
  });
  return new Promise<{ close: () => Promise<void>; txns: typeof txns; webhooks: typeof webhooks }>((ok) => server.listen(opts.port, "127.0.0.1", () => ok({
    close: () => new Promise((r) => server.close(() => r())), txns, webhooks,
  })));
}

if (process.argv[1]?.endsWith("paystack-server.ts")) {
  const port = Number(process.env.MOCK_PAYSTACK_PORT ?? 4010);
  startMockPaystack({ port, secret: process.env.PAYSTACK_SECRET_KEY ?? "sk_test_mock", webhookUrl: process.env.WEBHOOK_URL ?? "http://127.0.0.1:3100/api/webhooks/paystack" })
    .then(() => console.log(`mock paystack on :${port}`));
}
