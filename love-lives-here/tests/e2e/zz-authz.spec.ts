import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { sql } from "./fixtures";

/**
 * Hidden buttons are not security. These tests call privileged server actions
 * directly (by their real action IDs) with lower-privileged sessions, and
 * check role access to every admin page.
 */
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node as Record<string, { exportedName?: string }>;
const actionId = (name: string) => Object.entries(manifest).find(([, v]) => v.exportedName === name)![0];

async function callAction(req: APIRequestContext, name: string, args: unknown[]) {
  const r = await req.post("/admin/audit", {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Origin: "http://localhost:3100", Accept: "text/x-component" },
    data: JSON.stringify(args),
  });
  return { status: r.status(), text: await r.text() };
}

const roles = { writer: "reports/.auth-writer.json", fulfilment: "reports/.auth-fulfilment.json", anon: undefined } as const;

test("privileged server actions refuse lower roles and anonymous callers", async ({ playwright }) => {
  const [o] = await sql<{ id: string }>(`insert into orders (number, status, buyer_name, buyer_phone, recipient_name, zone_name, delivery_mode, delivery_date, subtotal, tracking_token_hash, privacy_notice_version, consent_at)
    values ('LLH-AUTHZ' || substr(md5(random()::text),1,2), 'pending_payment', 'Authz', '+2348031234567', 'R', 'Ajah', 'fixed', current_date + 10, 100000, 'x', 'v', now()) returning id`);
  const [p] = await sql<{ reference: string; order_id: string }>(`insert into payments (order_id, reference, amount) values ($1, 'AUTHZ-' || md5(random()::text), 100000) returning reference, order_id`, [o.id]);
  const cases: [keyof typeof roles, string, unknown[]][] = [
    ["writer", "outboxFlush", []],                       // needs settings.edit
    ["writer", "reverify", [p.order_id, p.reference]],  // needs payments.view
    ["fulfilment", "createCard", [o.id, "gold_card"]],  // needs nfc.edit
    ["fulfilment", "outboxFlush", []],
  ];
  for (const [role, name, args] of cases) {
    const req = await playwright.request.newContext({ baseURL: "http://localhost:3100", storageState: roles[role] });
    const r = await callAction(req, name, args);
    expect(r.text, `${role} → ${name}`).toMatch(/can't do this/);
    await req.dispose();
  }
  const before = (await sql<{ n: number }>(`select count(*)::int n from nfc_experiences`))[0].n;
  const anon = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
  const r = await callAction(anon, "createCard", [o.id, "gold_card"]);
  expect(r.text).not.toMatch(/Card created/);
  expect((await sql<{ n: number }>(`select count(*)::int n from nfc_experiences`))[0].n).toBe(before);
  // Cross-site call to a server action is rejected by Next's Origin check
  const owner = await playwright.request.newContext({ baseURL: "http://localhost:3100", storageState: "reports/.auth-owner.json" });
  const x = await owner.post("/admin/audit", { headers: { "Next-Action": actionId("outboxFlush"), "Content-Type": "text/plain;charset=UTF-8", Origin: "https://evil.example", Accept: "text/x-component" }, data: "[]" });
  expect(x.status()).toBeGreaterThanOrEqual(400);
});

test("admin pages are restricted by role", async ({ browser }) => {
  const denied: Record<string, string[]> = {
    writer: ["/admin/payments", "/admin/staff", "/admin/content", "/admin/delivery", "/admin/audit"],
    fulfilment: ["/admin/payments", "/admin/staff", "/admin/content", "/admin/delivery", "/admin/audit"],
  };
  for (const [role, paths] of Object.entries(denied)) {
    const ctx = await browser.newContext({ storageState: roles[role as "writer"] });
    const page = await ctx.newPage();
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: /don't have access/ }), `${role} ${path}`).toBeVisible();
    }
    await ctx.close();
  }
});
