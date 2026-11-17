import { Client } from "pg";
import { type Page, expect } from "@playwright/test";
import { E2E_DB } from "../../playwright.config";

export const STAFF = {
  owner: { email: "owner@e2e.test", password: "owner-password-123", role: "owner" as const, totp: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" },
  writer: { email: "writer@e2e.test", password: "writer-password-123", role: "writer" as const },
  fulfilment: { email: "pack@e2e.test", password: "packer-password-123", role: "fulfilment" as const },
};

export async function sql<T = Record<string, unknown>>(q: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: E2E_DB });
  await c.connect();
  try { return (await c.query(q, params)).rows as T[]; } finally { await c.end(); }
}

/** Puts a letter into the bag through the real guided flow ("own words"). */
export async function addLetter(page: Page, recipient = "Ada") {
  await page.goto("/letter?mode=own_words");
  await page.getByLabel("Their name").fill(recipient);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Your message").fill(`Dear ${recipient}, I don't say it enough, but you make every day lighter. Thank you for everything.`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /Review/ })).toBeVisible();
  await page.getByRole("button", { name: /Add letter & choose gifts/ }).click();
  await page.waitForURL("**/shop");
}

export async function fillCheckout(page: Page, opts: { phone?: string; zone?: string; email?: string } = {}) {
  await page.getByLabel("Your name").fill("Tolu Buyer");
  await page.getByLabel("Your WhatsApp number").fill(opts.phone ?? "0803 123 4567");
  await page.getByRole("textbox", { name: /^Email/ }).fill(opts.email ?? "tolu@example.com");
  const rn = page.getByLabel("Their name");
  if (!(await rn.inputValue())) await rn.fill("Ada");
  await page.getByLabel("Delivery area").selectOption({ label: opts.zone ?? "Yaba, Mushin, Ilupeju (₦3,000)" });
  if (await page.getByLabel("Delivery address").isVisible()) await page.getByLabel("Delivery address").fill("12 Herbert Macaulay Way, Yaba, Lagos");
  const min = await page.getByLabel("Deliver on").getAttribute("min");
  const d = new Date((min ?? new Date().toISOString().slice(0, 10)) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 5);
  await page.getByLabel("Deliver on").fill(d.toISOString().slice(0, 10));
  await page.getByRole("checkbox", { name: /I've read how Love Lives Here uses/ }).check();
}

export async function mockState() {
  return (await (await fetch("http://127.0.0.1:4010/__control/state")).json()) as { txns: { reference: string; status: string }[]; webhooks: { event: string; status: number }[] };
}

/** The main "Add to bag" on a product page (related products have their own). */
export const pdpAdd = (page: Page) => page.locator(".pdp-info").getByRole("button", { name: "Add to bag" });

/** Restores seeded catalogue values that admin tests change. */
export async function resetCatalog() {
  await sql(`update product_variants set price = 850000, price_status = 'unverified', stock = null, active = true where sku in ('LLH-CANDLE-TROP','LLH-CANDLE-CHOC')`);
  await sql(`update product_variants set price = null, price_status = 'quote' where sku like 'LLH-CHRYS-%'`);
  await sql(`update delivery_zones set fee = 850000 where name = 'Ajah'`);
}
