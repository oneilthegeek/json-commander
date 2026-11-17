import { test, expect } from "@playwright/test";
import { sql, resetCatalog } from "./fixtures";

/**
 * Two staff members editing the same record: the second, stale save must be refused instead of
 * silently overwriting (lost update). Also covers a paid order using stock while a form is open.
 */
const owner = { storageState: "reports/.auth-owner.json" };

test.describe("Concurrent staff edits", () => {
  test.afterAll(resetCatalog);

  test("stock and price: a stale form can't overwrite a newer value", async ({ browser }) => {
    await sql(`update product_variants set stock = 10 where sku = 'LLH-CANDLE-TROP'`);
    const [ca, cb] = [await browser.newContext(owner), await browser.newContext(owner)];
    const [a, b] = [await ca.newPage(), await cb.newPage()];
    await a.goto("/admin/products"); await b.goto("/admin/products");
    const row = (p: typeof a) => p.locator("form").filter({ has: p.locator('input[value="Tropical"]') });

    await row(a).getByLabel("Stock").fill("12");
    await row(a).getByRole("button", { name: "Save" }).click();
    await expect(row(a).getByText("Saved.")).toBeVisible();
    // A saves again without reloading: its form picked up its own change, so this works
    await row(a).getByLabel("Stock").fill("11");
    await row(a).getByRole("button", { name: "Save" }).click();
    await expect(row(a).getByText("Saved.")).toBeVisible();

    // B still shows 10 and tries to save 9: refused, value unchanged
    await row(b).getByLabel("Stock").fill("9");
    await row(b).getByRole("button", { name: "Save" }).click();
    await expect(row(b).getByText(/Someone else changed this option/)).toBeVisible();
    expect((await sql<{ stock: number }>(`select stock from product_variants where sku = 'LLH-CANDLE-TROP'`))[0].stock).toBe(11);

    // A paid order uses 2 while A's form is open: A's save is refused too (no lost stock deduction)
    await sql(`update product_variants set stock = stock - 2 where sku = 'LLH-CANDLE-TROP'`);
    await row(a).getByLabel("Stock").fill("20");
    await row(a).getByRole("button", { name: "Save" }).click();
    await expect(row(a).getByText(/an order used some stock/)).toBeVisible();
    expect((await sql<{ stock: number }>(`select stock from product_variants where sku = 'LLH-CANDLE-TROP'`))[0].stock).toBe(9);

    // After reloading, B sees 9 and can save
    await b.reload();
    await expect(row(b).getByLabel("Stock")).toHaveValue("9");
    await row(b).getByLabel("Stock").fill("15");
    await row(b).getByRole("button", { name: "Save" }).click();
    await expect(row(b).getByText("Saved.")).toBeVisible();
    await ca.close(); await cb.close();
  });

  test("product details: the second of two simultaneous editors is told to reload", async ({ browser }) => {
    const [{ id }] = await sql<{ id: string }>(`select id from products where slug = 'llh-tag'`);
    const [ca, cb] = [await browser.newContext(owner), await browser.newContext(owner)];
    const [a, b] = [await ca.newPage(), await cb.newPage()];
    await a.goto(`/admin/products/${id}`); await b.goto(`/admin/products/${id}`);
    await a.getByLabel("Short description").fill("Tap it and it opens any link you choose.");
    await a.getByRole("button", { name: "Save product" }).click();
    await expect(a.getByText("Saved", { exact: false }).first()).toBeVisible();
    await b.getByLabel("Badge").fill("NEW!");
    await b.getByRole("button", { name: "Save product" }).click();
    await expect(b.getByText(/Someone else saved this product/)).toBeVisible();
    expect((await sql<{ badge: string | null }>(`select badge from products where id = $1`, [id]))[0].badge).not.toBe("NEW!");
    await ca.close(); await cb.close();
  });

  test("delivery fee: a stale fee edit is refused", async ({ browser }) => {
    const [ca, cb] = [await browser.newContext(owner), await browser.newContext(owner)];
    const [a, b] = [await ca.newPage(), await cb.newPage()];
    await a.goto("/admin/delivery"); await b.goto("/admin/delivery");
    const zone = (p: typeof a) => p.locator("form").filter({ has: p.locator('input[value="Ajah"]') });
    await zone(a).getByLabel("₦").fill("9000");
    await zone(a).getByRole("button", { name: "Save" }).click();
    await expect(zone(a).getByText(/Saved|updated/i)).toBeVisible();
    await zone(b).getByLabel("₦").fill("7000");
    await zone(b).getByRole("button", { name: "Save" }).click();
    await expect(zone(b).getByText(/Someone else changed this area's fee/)).toBeVisible();
    expect((await sql<{ fee: number }>(`select fee from delivery_zones where name = 'Ajah'`))[0].fee).toBe(900000);
    await ca.close(); await cb.close();
  });
});
