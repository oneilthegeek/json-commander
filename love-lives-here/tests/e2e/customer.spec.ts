import { test, expect } from "@playwright/test";
import { addLetter, fillCheckout, mockState, sql } from "./fixtures";
import { pdpAdd, resetCatalog } from "./fixtures";

test.beforeEach(resetCatalog);

test.describe("Shopping", () => {
  test("open a product, choose a variant, add, change quantity, remove", async ({ page }) => {
    await page.goto("/shop/secret-candle");
    await expect(page.getByRole("heading", { level: 1, name: "The Secret Candle" })).toBeVisible();
    await page.getByRole("radio", { name: /Tropical/ }).check();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator(".pdp-info .price").first()).toContainText("₦17,000");
    await pdpAdd(page).click();
    await expect(page.getByRole("link", { name: /Your bag, 2 items/ })).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByText("Tropical")).toBeVisible();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("₦17,000");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("₦25,500");
    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("₦17,000");
    await page.getByRole("button", { name: /Remove The Secret Candle/ }).click();
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
  });

  test("quote-only flowers can't be added; they offer WhatsApp instead", async ({ page }) => {
    await page.goto("/shop/chrysanthemums-full-bouquet");
    await expect(page.getByText("Price on request").first()).toBeVisible();
    await expect(pdpAdd(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Ask for a price on WhatsApp/ })).toHaveAttribute("href", /wa\.me\/2348107134258/);
  });

  test("a gift can be bought without a letter (fixes: every action used to force a letter)", async ({ page }) => {
    await page.goto("/shop/llh-tag");
    await pdpAdd(page).click();
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Your letter" })).toHaveCount(0);
    await expect(page.getByTestId("summary")).toContainText("The LLH Tag");
  });
});

test.describe("Letter personalisation", () => {
  test("help-me flow validates each step, keeps progress, and reaches checkout", async ({ page }) => {
    await page.goto("/letter");
    await page.getByRole("button", { name: /Help me find the words/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    const summary = page.locator(".errsum");
    await expect(summary).toContainText("Enter their name");
    await expect(summary).toContainText("Tell us who they are to you");
    await page.getByLabel("Their name").fill("Kemi");
    await page.getByLabel("They are your").selectOption("Wife or husband");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Occasion").selectOption("Anniversary");
    await page.getByText("Deep", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator(".errsum")).toContainText("what you want them to feel");
    await page.getByLabel("What you want them to feel").fill("That ten years in, I'd still choose her every single morning.");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(/Memories and details/).fill("Our first date at Terra Kulture; the night the generator died and we sang.");
    await page.getByLabel(/Anything to avoid/).fill("Don't mention her job.");
    // Save & resume: reload keeps progress
    await page.reload();
    await expect(page.getByLabel(/Memories and details/)).toHaveValue(/Terra Kulture/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Anniversary")).toBeVisible();
    await expect(page.getByText("Don't mention her job.")).toBeVisible();
    await page.getByRole("button", { name: /Add letter & check out/ }).click();
    await page.waitForURL("**/checkout");
    await expect(page.getByText(/We'll find the words · to Kemi/)).toBeVisible();
    await expect(page.getByLabel("Their name")).toHaveValue("Kemi");
  });
});

test.describe("Flowers & totals", () => {
  test("total updates immediately when a flower or delivery area changes", async ({ page }) => {
    await addLetter(page);
    await page.goto("/shop/roses-full-bouquet");
    await page.getByRole("radio", { name: /10 stems/ }).check();
    await expect(page.locator(".pdp-info .price").first()).toContainText("₦105,000");
    await pdpAdd(page).click();
    await page.goto("/checkout");
    const total = page.getByTestId("sum-total");
    await expect(total).toHaveText("₦115,000 + delivery");
    await page.getByLabel("Delivery area").selectOption({ label: "Yaba, Mushin, Ilupeju (₦3,000)" });
    await expect(total).toHaveText("₦118,000");
    await page.getByLabel("Delivery area").selectOption({ label: "Ajah (₦8,500)" });
    await expect(total).toHaveText("₦123,500");
    await page.getByLabel("Delivery area").selectOption({ label: "Another state (we'll quote)" });
    await expect(page.getByTestId("sum-delivery")).toHaveText("We'll quote");
    await expect(page.getByRole("button", { name: "Send for a delivery quote" })).toBeVisible();
    await page.goto("/cart");
    await page.getByRole("button", { name: /Remove Roses, full bouquet/ }).click();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("₦10,000");
  });
});

test.describe("Checkout & payment", () => {
  test("rejects an invalid phone number (server-side), then pays via sandbox and records everything", async ({ page }) => {
    await addLetter(page, "Funke");
    await page.goto("/shop/secret-candle");
    await pdpAdd(page).click();
    await page.goto("/checkout");
    await fillCheckout(page, { phone: "0803 12" });
    await page.getByLabel(/The message to hide inside/).fill("Look up. I'm proud of you.");
    await page.getByRole("button", { name: /Pay/ }).click();
    await expect(page.locator(".errsum")).toContainText(/WhatsApp number/);
    // A number that passes the light browser check but fails real validation
    await page.getByLabel("Your WhatsApp number").fill("0000 000 0000");
    await page.getByRole("button", { name: /Pay ₦21,500/ }).click();
    await expect(page.locator(".errsum")).toContainText(/valid phone number/);
    await page.getByLabel("Your WhatsApp number").fill("0803 123 4567");
    await page.getByRole("button", { name: /Pay ₦21,500/ }).click();
    await page.waitForURL(/127\.0\.0\.1:4010\/checkout/);
    await expect(page.getByText("Amount: ₦21,500")).toBeVisible();
    await page.getByRole("button", { name: "Pay (test success)" }).click();
    await page.waitForURL(/\/checkout\/complete/);
    await expect(page.getByRole("heading", { name: /It's in our hands now/ })).toBeVisible();
    const [o] = await sql<{ number: string; status: string; payment_status: string; total: number; gift_note: string; buyer_phone: string; test_mode: boolean }>(
      `select number, status, payment_status, total, gift_note, buyer_phone, test_mode from orders where recipient_name = 'Funke' order by created_at desc limit 1`);
    expect(o).toMatchObject({ status: "paid", payment_status: "paid", total: 2_150_000, gift_note: "Look up. I'm proud of you.", buyer_phone: "+2348031234567", test_mode: true });
    const [b] = await sql<{ message: string; mode: string }>(`select b.message, b.mode from letter_briefs b join orders o on o.id = b.order_id where o.number = $1`, [o.number]);
    expect(b.mode).toBe("own_words");
    expect(b.message).toMatch(/Dear Funke/);
    // The mock delivers a signed charge.success webhook too — it must not double-apply.
    await expect.poll(async () => (await mockState()).webhooks.filter((w) => w.event === "charge.success").length).toBeGreaterThan(0);
    const paidEvents = await sql(`select 1 from order_events e join orders o on o.id = e.order_id where o.number = $1 and e.to_status = 'paid'`, [o.number]);
    expect(paidEvents).toHaveLength(1);
    // Bag cleared after ordering
    await page.goto("/cart");
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
  });

  test("failed payment shows the truth, then retry succeeds; replayed webhook is ignored", async ({ page, request }) => {
    await page.goto("/shop/gold-card");
    await pdpAdd(page).click();
    await page.goto("/checkout");
    await fillCheckout(page, { email: "retry@example.com" });
    await page.getByRole("button", { name: /Pay ₦15,500/ }).click();
    await page.waitForURL(/4010\/checkout/);
    await page.getByRole("button", { name: "Decline (test failure)" }).click();
    await page.waitForURL(/\/checkout\/complete/);
    await expect(page.getByRole("heading", { name: "Your payment didn't go through" })).toBeVisible();
    await expect(page.getByText(/It's in our hands/)).toHaveCount(0);
    await page.getByRole("button", { name: "Try paying again" }).click();
    await page.waitForURL(/4010\/checkout/);
    await page.getByRole("button", { name: "Pay (test success)" }).click();
    await page.waitForURL(/\/checkout\/complete/);
    await expect(page.getByText("Payment confirmed")).toBeVisible();
    const [o] = await sql<{ id: string; number: string }>(`select id, number from orders where buyer_email = 'retry@example.com'`);
    const pays = await sql<{ status: string; reference: string }>(`select status, reference from payments where order_id = $1 order by created_at`, [o.id]);
    expect(pays.map((p) => p.status)).toEqual(["failed", "success"]);
    // Replay the successful webhook through the mock: still exactly one "paid" event
    await fetch(`http://127.0.0.1:4010/__control/webhook/${encodeURIComponent(pays[1].reference)}`);
    await fetch(`http://127.0.0.1:4010/__control/webhook/${encodeURIComponent(pays[1].reference)}`);
    expect(await sql(`select 1 from order_events where order_id = $1 and to_status = 'paid'`, [o.id])).toHaveLength(1);
    // Unsigned / wrongly signed webhooks are rejected
    const bad = await request.post("/api/webhooks/paystack", { data: { event: "charge.success", data: { reference: pays[1].reference } }, headers: { "x-paystack-signature": "deadbeef" } });
    expect(bad.status()).toBe(401);
  });

  test("an order outside the listed areas is saved as awaiting a quote — nothing is charged", async ({ page }) => {
    await page.goto("/shop/secret-candle");
    await pdpAdd(page).click();
    await page.goto("/checkout");
    await fillCheckout(page, { zone: "Another state (we'll quote)", email: "quote@example.com" });
    await page.getByLabel("Delivery address").fill("5 Aminu Kano Crescent, Wuse II, Abuja");
    await page.getByRole("button", { name: "Send for a delivery quote" }).click();
    await page.waitForURL(/\/orders\/LLH-/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Awaiting delivery quote");
    await expect(page.getByText(/We'll confirm the delivery fee/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
  });
});

test.describe("Order tracking privacy", () => {
  test("wrong token shows not found; lookup needs number + phone", async ({ page }) => {
    const [o] = await sql<{ number: string }>(`select number from orders where buyer_phone = '+2348031234567' limit 1`);
    const r = await page.goto(`/orders/${o.number}?t=${"a".repeat(32)}`);
    expect(r?.status()).toBe(404);
    await page.goto("/track");
    await page.getByLabel("Order number").fill(o.number);
    await page.getByLabel("Your phone number").fill("0809 999 9999");
    await page.getByRole("button", { name: "Find my order" }).click();
    await expect(page.getByText(/couldn't find an order/)).toBeVisible();
    await page.getByLabel("Your phone number").fill("0803 123 4567");
    await page.getByRole("button", { name: "Find my order" }).click();
    await expect(page.getByText(new RegExp(`${o.number}`))).toBeVisible();
  });
});

test.describe("Newsletter", () => {
  test("validates, requires consent, and hands off to Substack's hosted signup", async ({ page }) => {
    let substackUrl = "";
    await page.route("https://example.substack.com/**", (route) => { substackUrl = route.request().url(); return route.fulfill({ status: 200, body: "substack (mocked in test)" }); });
    await page.goto("/#join");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText("Enter an email address like ada@gmail.com.")).toBeVisible();
    await page.getByLabel("Email address").fill("ada@example.com");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.getByText(/Tick the box/)).toBeVisible();
    await page.getByRole("checkbox", { name: /Dear Lovers emails/ }).check();
    await page.getByRole("button", { name: "Join" }).click();
    await page.waitForURL("https://example.substack.com/**");
    expect(substackUrl).toBe("https://example.substack.com/subscribe?email=ada%40example.com");
  });
  test("unsubscribe explains the provider's real mechanism", async ({ page }) => {
    await page.goto("/newsletter/unsubscribe");
    await expect(page.getByText(/Unsubscribe” link at the bottom of any Dear Lovers email/)).toBeVisible();
  });
});

test.describe("Support", () => {
  test("contact form saves a message staff can see", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Please check the highlighted fields.")).toBeVisible();
    await page.getByLabel("Your name").fill("Bisi");
    await page.getByLabel("Phone or email").fill("bisi@example.com");
    await page.getByLabel("How can we help?").fill("Can you deliver to Ibadan next Friday?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/we've got your message/)).toBeVisible();
    expect(await sql(`select 1 from support_messages where contact = 'bisi@example.com'`)).toHaveLength(1);
  });
});
