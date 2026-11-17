import { test, expect, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import { addLetter, fillCheckout, sql } from "./fixtures";
import { pdpAdd, resetCatalog } from "./fixtures";

const as = (who: "owner" | "writer" | "fulfilment") => ({ storageState: `reports/.auth-${who}.json` });

async function paidLetterOrder(browser: Browser, recipient: string, extra?: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await addLetter(page, recipient);
  if (extra) { await page.goto(`/shop/${extra}`); await pdpAdd(page).click(); }
  await page.goto("/checkout");
  await fillCheckout(page);
  await page.getByRole("button", { name: /^Pay/ }).click();
  await page.waitForURL(/4010\/checkout/);
  await page.getByRole("button", { name: "Pay (test success)" }).click();
  await page.waitForURL(/\/checkout\/complete/);
  const orderLink = await page.getByRole("link", { name: "View and track your order" }).getAttribute("href");
  const [o] = await sql<{ id: string; number: string }>(`select id, number from orders where recipient_name = $1 order by created_at desc limit 1`, [recipient]);
  return { ctx, page, orderLink: orderLink!, ...o };
}

test.describe("Admin access control", () => {
  test("public visitors can't reach the admin or private exports", async ({ page, request }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await request.get("/admin/export")).status()).toBe(403);
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("owner@e2e.test");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });

  test("password alone isn't enough for the owner (two-factor)", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("owner@e2e.test");
    await page.getByLabel("Password").fill("owner-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/login/verify");
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/login\/verify/);
    await page.getByLabel(/6-digit code/).fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
  });
});

test.describe("Order workflow: draft → buyer approval → production → delivery", () => {
  test("full letter approval loop with role restrictions", async ({ browser }) => {
    const buyer = await paidLetterOrder(browser, "Ngozi");

    // Writer: sees the letter brief but not the address or payments
    const writer = await browser.newContext(as("writer"));
    const w = await writer.newPage();
    await w.goto(`/admin/orders/${buyer.id}`);
    await expect(w.getByRole("heading", { name: /Letter brief/ })).toBeVisible();
    await expect(w.getByText("Dear Ngozi").first()).toBeVisible();
    await expect(w.getByText("12 Herbert Macaulay Way")).toHaveCount(0);
    await expect(w.getByRole("heading", { name: "Payments" })).toHaveCount(0);
    await w.goto("/admin/payments");
    await expect(w.getByRole("heading", { name: /don't have access/ })).toBeVisible();
    // Write and send a draft
    await w.goto(`/admin/orders/${buyer.id}`);
    await w.getByRole("textbox", { name: "Draft" }).fill("Dear Ngozi,\n\nI don't say it enough, but you make every day lighter. Thank you for everything.\n\nTolu");
    await w.getByRole("button", { name: "Save first draft" }).click();
    await expect(w.getByText("Draft saved.")).toBeVisible();
    await w.reload();
    w.once("dialog", (d) => d.accept());
    await w.getByRole("button", { name: "Send version 1 to buyer for approval" }).click();
    await expect.poll(async () => (await sql<{ status: string }>(`select status from orders where id = $1`, [buyer.id]))[0].status).toBe("awaiting_approval");
    // Production is blocked before approval
    await w.reload();
    await expect(w.getByLabel("New status").locator("option", { hasText: "In production" })).toHaveCount(0);

    // Buyer reads and approves on their private order page
    const p = buyer.page;
    await p.goto(buyer.orderLink);
    await expect(p.getByRole("heading", { name: "Read your letter" })).toBeVisible();
    await p.getByRole("button", { name: "I approve this letter" }).click();
    await p.getByRole("button", { name: "Yes, approve and seal it" }).click();
    await expect(p.getByRole("heading", { level: 1 })).toHaveText("Letter approved");
    await expect(p.getByText("You approved version 1 of your letter.")).toBeVisible();
    await expect.poll(async () => (await sql<{ status: string }>(`select status from orders where id = $1`, [buyer.id]))[0].status).toBe("approved");

    // Packing & delivery: sees the address, not the brief; moves it through fulfilment
    const packer = await browser.newContext(as("fulfilment"));
    const f = await packer.newPage();
    await f.goto(`/admin/orders/${buyer.id}`);
    await expect(f.getByText("12 Herbert Macaulay Way")).toBeVisible();
    await expect(f.getByRole("heading", { name: /Letter brief/ })).toHaveCount(0);
    for (const next of ["In production", "Packed", "Out for delivery", "Delivered"]) {
      await f.getByLabel("New status").selectOption({ label: next });
      await f.getByRole("button", { name: "Update status" }).click();
      await expect(f.locator(".badge").first()).toHaveText(next);
    }
    expect((await sql<{ status: string }>(`select status from orders where id = $1`, [buyer.id]))[0].status).toBe("delivered");
    // Customer sees the timeline
    await p.goto(buyer.orderLink);
    await expect(p.getByRole("heading", { level: 1 })).toHaveText("Delivered");
    await expect(p.getByText("Your order is out with our rider.")).toBeVisible();
    await writer.close(); await packer.close(); await buyer.ctx.close();
  });
});

test.describe("Catalogue management", () => {
  test.afterEach(resetCatalog);
  test("owner updates a price and stock; the shop and checkout follow", async ({ browser }) => {
    const ctx = await browser.newContext(as("owner"));
    const a = await ctx.newPage();
    await a.goto("/admin/products");
    await expect(a.getByText(/prices came from the old website/)).toBeVisible();
    const row = a.locator("form").filter({ has: a.locator('input[value="Tropical"]') });
    await row.getByLabel("Price", { exact: true }).fill("9000");
    await row.getByLabel("Price status").selectOption("confirmed");
    await row.getByLabel("Stock").fill("1");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.getByText("Saved.")).toBeVisible();
    const shopper = await (await browser.newContext()).newPage();
    await shopper.goto("/shop/secret-candle");
    await shopper.getByRole("radio", { name: /Tropical/ }).check();
    await expect(shopper.getByText("Only 1 left").first()).toBeVisible();
    await expect(shopper.locator(".pdp-info .price").first()).toContainText("₦9,000");
    await shopper.getByRole("button", { name: "Increase quantity" }).click();
    await pdpAdd(shopper).click();
    await shopper.goto("/cart");
    await expect(shopper.getByText(/Only 1 of The Secret Candle/).first()).toBeVisible();
    // Owner chrysanthemum price: switch from quote to a confirmed price
    const chrys = a.locator("form").filter({ has: a.locator('input[value="6 stems"]') }).first();
    await chrys.getByLabel("Price", { exact: true }).fill("20000");
    await chrys.getByLabel("Price status").selectOption("confirmed");
    await chrys.getByRole("button", { name: "Save" }).click();
    await expect(chrys.getByText("Saved.")).toBeVisible();
    const log = await sql(`select 1 from audit_logs where action = 'variant.update'`);
    expect(log.length).toBeGreaterThanOrEqual(2);
    // restore seed values for other tests
    await sql(`update product_variants set price = 850000, price_status = 'unverified', stock = null where sku = 'LLH-CANDLE-TROP'`);
    await sql(`update product_variants set price = null, price_status = 'quote' where sku = 'LLH-CHRYS-FULL-6'`);
    await ctx.close();
  });

  test("delivery fee change applies to new checkouts", async ({ browser }) => {
    const ctx = await browser.newContext(as("owner"));
    const a = await ctx.newPage();
    await a.goto("/admin/delivery");
    const row = a.locator("form").filter({ has: a.locator('input[value="Ajah"]') });
    await row.getByLabel("₦").fill("9000");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.getByText("Saved.")).toBeVisible();
    const s = await (await browser.newContext()).newPage();
    await s.goto("/shop/llh-tag");
    await pdpAdd(s).click();
    await s.goto("/checkout");
    await s.getByLabel("Delivery area").selectOption({ label: "Ajah (₦9,000)" });
    await expect(s.getByTestId("sum-total")).toHaveText("₦13,500");
    await sql(`update delivery_zones set fee = 850000 where name = 'Ajah'`);
    await ctx.close();
  });
});

test.describe("Gold Card digital experience", () => {
  test("buyer adds content, staff locks & activates, recipient opens it; QR and privacy work", async ({ browser }) => {
    const buyer = await paidLetterOrder(browser, "Amaka", "gold-card");
    const p = buyer.page;
    await p.goto(buyer.orderLink);
    await p.getByRole("link", { name: /Add or edit what's on the card/ }).click();
    await p.getByLabel("Note").fill("Good morning, my love. Coffee's on me today.");
    await p.getByLabel("Show it").selectOption("morning");
    await p.getByRole("button", { name: "Add note" }).click();
    await expect(p.getByText("Note added.")).toBeVisible();
    await p.getByLabel("Note").fill("Whenever you read this: I'm proud of you.");
    await p.getByLabel("Show it").selectOption("any");
    await p.getByRole("button", { name: "Add note" }).click();
    await expect(p.getByText("Note added.")).toBeVisible();
    await p.getByLabel("Link").fill("javascript:alert(1)");
    await p.getByRole("button", { name: "Add link" }).click();
    await expect(p.getByText(/full link starting with https/)).toBeVisible();
    await p.getByLabel("Link").fill("https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd");
    await p.getByLabel("Label").first().fill("Our songs");
    await p.getByRole("button", { name: "Add link" }).click();
    await expect(p.getByText("Playlist added.")).toBeVisible();
    await p.getByLabel(/Photo \(JPEG/).setInputFiles({ name: "us.jpg", mimeType: "image/jpeg", buffer: readFileSync("public/images/secret-candle-red-tin.jpg") });
    await p.getByRole("button", { name: "Upload photo" }).click();
    await expect(p.getByText("Photo added.")).toBeVisible();
    await p.getByLabel(/Photo \(JPEG/).setInputFiles({ name: "evil.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<svg onload=alert(1)>") });
    await p.getByRole("button", { name: "Upload photo" }).click();
    await expect(p.getByText(/Upload a JPEG, PNG/)).toBeVisible();
    // Preview by time of day
    await p.getByRole("link", { name: /Preview what they'll see/ }).click();
    await p.getByRole("link", { name: "morning" }).click();
    await expect(p.getByText("Good morning, my love.")).toBeVisible();
    await p.getByRole("link", { name: "evening" }).click();
    await expect(p.getByText("Whenever you read this")).toBeVisible();
    await expect(p.getByRole("link", { name: /Our songs/ })).toHaveAttribute("href", /open\.spotify\.com/);

    const [e] = await sql<{ id: string; public_token: string }>(`select e.id, e.public_token from nfc_experiences e join orders o on o.id = e.order_id where o.id = $1 and e.kind = 'gold_card'`, [buyer.id]);
    const recipient = await (await browser.newContext({ viewport: { width: 375, height: 740 } })).newPage();
    await recipient.goto(`/c/${e.public_token}`);
    await expect(recipient.getByRole("heading", { name: "Almost ready" })).toBeVisible(); // not live yet

    const owner = await browser.newContext(as("owner"));
    const a = await owner.newPage();
    await a.goto(`/admin/nfc/${e.id}`);
    await expect(a.locator("code", { hasText: `/c/${e.public_token}` })).toBeVisible();
    await a.getByLabel("Status").selectOption("active");
    await a.getByLabel(/Secret word/).fill("jollof");
    await a.getByRole("button", { name: "Save settings" }).click();
    await expect(a.getByText("Card settings saved.")).toBeVisible();
    const qr = await a.request.get(`/admin/nfc/${e.id}/qr`);
    expect(qr.status()).toBe(200);
    expect(await qr.text()).toContain("<svg");
    await a.getByRole("button", { name: "I've written and tested the tag" }).click();
    await expect(a.getByText(/Tag written and tested/)).toBeVisible();

    await recipient.goto(`/c/${e.public_token}`);
    await recipient.getByRole("textbox").fill("wrong");
    await recipient.getByRole("button", { name: "Open my message" }).click();
    await expect(recipient.getByText(/not quite it/)).toBeVisible();
    await recipient.getByRole("textbox").fill("Jollof");
    await recipient.getByRole("button", { name: "Open my message" }).click();
    await expect(recipient.getByRole("heading", { name: "A letter is waiting for you" })).toBeVisible();
    await expect(recipient.locator(".gc .photos img")).toHaveCount(1);
    const overflow = await recipient.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Guessing tokens doesn't work; media isn't reachable without access
    await recipient.goto(`/c/${"Z".repeat(22)}`);
    await expect(recipient.getByRole("heading", { name: /isn't set up/ })).toBeVisible();
    const anon = await (await browser.newContext()).request.get(`/c/${e.public_token}/media/${(await sql<{ id: string }>(`select id from media_assets limit 1`))[0].id}`);
    expect(anon.status()).toBe(404);
    expect((await sql<{ view_count: number }>(`select view_count from nfc_experiences where id = $1`, [e.id]))[0].view_count).toBeGreaterThan(0);
    await owner.close(); await buyer.ctx.close();
  });

  test("LLH Tag redirects to the buyer's chosen link once live", async ({ browser }) => {
    const buyer = await paidLetterOrder(browser, "Chidi", "llh-tag");
    const [e] = await sql<{ id: string; public_token: string }>(`select e.id, e.public_token from nfc_experiences e where e.order_id = $1 and e.kind = 'llh_tag'`, [buyer.id]);
    await buyer.page.goto(buyer.orderLink);
    await buyer.page.getByRole("link", { name: /Set the tag's link/ }).click();
    await buyer.page.getByLabel(/Link \(playlist/).fill("https://example.com/our-album");
    await buyer.page.getByRole("button", { name: "Save link" }).click();
    await expect(buyer.page.getByText("Link saved.")).toBeVisible();
    const owner = await browser.newContext(as("owner"));
    const a = await owner.newPage();
    await a.goto(`/admin/nfc/${e.id}`);
    await a.getByLabel("Status").selectOption("active");
    await a.getByRole("button", { name: "Save settings" }).click();
    await expect(a.getByText("Card settings saved.")).toBeVisible();
    const r = await (await browser.newContext()).request.get(`/c/${e.public_token}`, { maxRedirects: 0 });
    expect([307, 302, 303]).toContain(r.status());
    expect(r.headers()["location"]).toBe("https://example.com/our-album");
    await owner.close(); await buyer.ctx.close();
  });
});

test.describe("Admin analytics", () => {
  test("dashboard shows real (test-flagged) data only when asked", async ({ browser }) => {
    const ctx = await browser.newContext(as("owner"));
    const a = await ctx.newPage();
    await a.goto("/admin");
    await expect(a.getByRole("heading", { name: "Needs attention" })).toBeVisible();
    // All e2e payments used a Paystack test key, so they are excluded by default
    await expect(a.locator(".kpi").filter({ hasText: "Paid orders" }).locator("b")).toHaveText("0");
    await a.getByLabel("Include test orders").check();
    await a.getByRole("button", { name: "Update" }).click();
    await expect(a.getByText("Showing test orders too")).toBeVisible();
    await expect(a.locator(".kpi").filter({ hasText: "Paid orders" }).locator("b")).not.toHaveText("0");
    const csv = await a.request.get("/admin/export?test=1");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toMatch(/^number,created_at,status/);
    await ctx.close();
  });
});
