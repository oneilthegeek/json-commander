import { test, expect, type Page } from "@playwright/test";
import { addLetter, resetCatalog } from "./fixtures";

/**
 * The original site's flower bug: choosing a flower didn't refresh the total.
 * Each sequence below checks the checkout total (from the server) against the
 * expected value after every interaction.
 */
test.beforeEach(resetCatalog);

const total = (p: Page) => p.getByTestId("sum-total");
const zone = (p: Page, label: string) => p.getByLabel("Delivery area").selectOption({ label });

async function addFlowerFromCard(page: Page, product: string, stems: string) {
  await page.goto("/shop?c=flowers");
  const card = page.getByRole("article", { name: product });
  const sel = card.getByRole("combobox");
  const value = await sel.evaluate((el, n) => [...(el as HTMLSelectElement).options].find((o) => o.text.startsWith(`${n} stems`))!.value, stems);
  await sel.selectOption(value);
  await card.getByRole("button", { name: /Add to bag|Added/ }).click();
  await expect(card.getByText("View your bag")).toBeVisible();
}

test("A: letter → flower from shop card (non-default stems) → zone → total", async ({ page }) => {
  await addLetter(page);
  await page.goto("/shop?c=flowers");
  const card = page.getByRole("article", { name: "Roses, just roses" });
  await card.getByRole("combobox").selectOption({ index: 2 }); // 15 stems
  await expect(card.locator(".price")).toHaveText("₦145,000");
  await card.getByRole("button", { name: "Add to bag" }).click();
  await page.goto("/checkout");
  await expect(total(page)).toHaveText("₦155,000 + delivery");
  await zone(page, "Victoria Island (₦5,500)");
  await expect(total(page)).toHaveText("₦160,500");
});

test("B: zone chosen first, then flower added via another tab → checkout reflects it on return", async ({ page, context }) => {
  await addLetter(page);
  await page.goto("/checkout");
  await zone(page, "Ikeja, Gbagada, Apapa (₦4,500)");
  await expect(total(page)).toHaveText("₦14,500");
  const other = await context.newPage();
  await other.goto("/shop/roses-full-bouquet");
  await other.locator(".pdp-info").getByRole("radio", { name: /^5 stems/ }).check();
  await other.locator(".pdp-info").getByRole("button", { name: "Add to bag" }).click();
  await page.bringToFront();
  await expect(total(page)).toHaveText("₦69,500"); // 10,000 + 55,000 + 4,500 (bag synced across tabs)
});

test("C: two bouquets, quantity changes and removal each update the total", async ({ page }) => {
  await addFlowerFromCard(page, "Roses, full bouquet", "10");
  await addFlowerFromCard(page, "Roses, just roses", "5");
  await page.goto("/cart");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("₦155,000");
  await page.getByRole("group", { name: "Quantity of Roses, just roses" }).getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("₦205,000");
  await page.goto("/checkout");
  await zone(page, "Ajah (₦8,500)");
  await expect(total(page)).toHaveText("₦213,500");
  await page.goto("/cart");
  await page.getByRole("button", { name: /Remove Roses, full bouquet/ }).click();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("₦100,000");
  await page.goto("/checkout");
  await zone(page, "Ajah (₦8,500)");
  await expect(total(page)).toHaveText("₦108,500");
});

test("D: same bouquet added twice merges; different stems stay separate", async ({ page }) => {
  await addFlowerFromCard(page, "Roses, full bouquet", "5");
  await addFlowerFromCard(page, "Roses, full bouquet", "5");
  await addFlowerFromCard(page, "Roses, full bouquet", "20");
  await page.goto("/cart");
  await expect(page.locator(".line")).toHaveCount(2);
  await expect(page.getByTestId("cart-subtotal")).toHaveText("₦320,000"); // 2×55,000 + 210,000
});

test("E: reload and back/forward keep the bag and the total consistent", async ({ page }) => {
  await addLetter(page);
  await addFlowerFromCard(page, "Roses, just roses", "10");
  await page.goto("/checkout");
  await zone(page, "Yaba, Mushin, Ilupeju (₦3,000)");
  await expect(total(page)).toHaveText("₦108,000");
  await page.reload();
  await zone(page, "Yaba, Mushin, Ilupeju (₦3,000)");
  await expect(total(page)).toHaveText("₦108,000");
  await page.goBack();
  await page.goForward();
  await zone(page, "Lekki Phase 2 (₦7,500)");
  await expect(total(page)).toHaveText("₦112,500");
});

test("F: price changed by staff after the flower is in the bag → checkout shows the new server price", async ({ page }) => {
  await addFlowerFromCard(page, "Roses, just roses", "5");
  const { sql } = await import("./fixtures");
  await sql(`update product_variants set price = 5200000 where sku = 'LLH-ROSE-JUST-5'`);
  await page.goto("/checkout");
  await expect(total(page)).toHaveText("₦52,000 + delivery");
  await sql(`update product_variants set price = 5000000 where sku = 'LLH-ROSE-JUST-5'`);
});
