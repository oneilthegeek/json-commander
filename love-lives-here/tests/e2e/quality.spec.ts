import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pdpAdd } from "./fixtures";

const PAGES = ["/", "/shop", "/shop/handwritten-letter", "/shop/roses-full-bouquet", "/letter", "/cart", "/checkout", "/gold-card", "/faq", "/delivery", "/privacy", "/terms", "/refunds", "/contact", "/track", "/admin/login"];
const WIDTHS = [320, 360, 390, 428, 768, 1024, 1440];

test.describe("Responsive layout", () => {
  for (const w of WIDTHS) {
    test(`no horizontal overflow at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      for (const path of PAGES) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${path} at ${w}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("Accessibility (axe, WCAG 2.2 AA rules)", () => {
  for (const path of PAGES) {
    test(`no serious or critical violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const r = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
});

test.describe("Keyboard & screen-reader basics", () => {
  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });
  test("mobile menu opens and closes by keyboard with correct state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const btn = page.getByRole("button", { name: "Open menu" });
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });
  test("one h1 per page and labelled form controls", async ({ page }) => {
    for (const path of ["/", "/checkout", "/letter", "/contact"]) {
      await page.goto(path);
      expect(await page.locator("h1").count(), path).toBe(1);
    }
  });
  test("validation errors are announced and linked", async ({ page }) => {
    await page.goto("/shop/llh-tag");
    await pdpAdd(page).click();
    await page.goto("/checkout");
    await page.locator("aside button[type=submit]").click();
    const sum = page.locator(".errsum");
    await expect(sum).toHaveAttribute("role", "alert");
    await expect(sum).toBeFocused();
    await expect(page.getByLabel(/Your name/)).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("Security headers & SEO", () => {
  test("security headers present; private pages are noindex/no-store", async ({ request }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["strict-transport-security"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
    const c = await request.get("/checkout");
    expect(c.headers()["x-robots-tag"]).toContain("noindex");
    expect(c.headers()["cache-control"]).toContain("no-store");
  });
  test("cross-site POSTs to the API are blocked", async ({ request }) => {
    const r = await request.post("/api/checkout", { data: {}, headers: { Origin: "https://evil.example" } });
    expect(r.status()).toBe(403);
  });
  test("no CSP violations or console errors on key pages", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    for (const p of ["/", "/shop/handwritten-letter", "/letter", "/checkout"]) await page.goto(p);
    expect(errors).toEqual([]);
  });
  test("product pages have canonical, OG image and Product JSON-LD; no fake ratings", async ({ page }) => {
    await page.goto("/shop/handwritten-letter");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/shop\/handwritten-letter$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /handwritten-love-letter/);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = ld.map((t) => JSON.parse(t)).find((j) => j["@type"] === "Product");
    expect(product.offers.priceCurrency).toBe("NGN");
    expect(JSON.stringify(ld)).not.toContain("aggregateRating");
    await page.goto("/shop/chrysanthemums-full-bouquet");
    const ld2 = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)).find((j) => j["@type"] === "Product");
    expect(ld2.offers).toBeUndefined(); // no price claimed for quote-only items
  });
  test("sitemap and robots", async ({ request }) => {
    const s = await (await request.get("/sitemap.xml")).text();
    expect(s).toContain("/shop/handwritten-letter");
    expect(s).not.toContain("/admin");
    const r = await (await request.get("/robots.txt")).text();
    expect(r).toContain("Disallow: /admin");
    expect(r).toContain("Disallow: /c/");
  });
  test("unverified claims (200+, 4.9★) are not published", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("4.9★")).toHaveCount(0);
    await expect(page.getByText("200+")).toHaveCount(0);
  });
  test("email and phone are clickable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('footer a[href="mailto:always@loveliveshereng.com"]')).toBeVisible();
    await expect(page.locator('footer a[href^="https://wa.me/2348107134258"]')).toBeVisible();
  });
});
