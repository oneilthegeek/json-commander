import { test, expect, type Page } from "@playwright/test";
import { sql } from "./fixtures";

/** Visits every reachable page, checks every internal link and image, and records external links. */
async function crawl(page: Page, starts: string[], scope: RegExp, limit = 80) {
  const seen = new Set<string>(), queue = [...starts], external = new Set<string>(), problems: string[] = [];
  while (queue.length && seen.size < limit) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await page.goto(path);
    if (!res || res.status() >= 400) { problems.push(`${path} → ${res?.status()}`); continue; }
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } });
    await page.waitForLoadState("networkidle");
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")));
    for (const b of broken) problems.push(`${path}: broken image ${b}`);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => (a as HTMLAnchorElement).href));
    for (const h of hrefs) {
      const u = new URL(h);
      if (u.origin !== new URL(page.url()).origin) { if (/^https?:/.test(u.protocol)) external.add(u.origin + u.pathname); continue; }
      const p = u.pathname + u.search;
      if (scope.test(u.pathname) && !seen.has(p) && !queue.includes(p) && !/\/export|\/qr|\/media\//.test(p)) queue.push(p);
    }
  }
  return { seen, external, problems };
}

test("public site: every page, link and image works", async ({ page }) => {
  const [o] = await sql<{ number: string }>(`select number from orders limit 1`);
  const r = await crawl(page, ["/", "/shop", "/gold-card", "/letter", "/cart", "/checkout", "/track", `/orders/${o?.number ?? "LLH-AAAAAAA"}?t=bad`, "/c/doesnotexist0000000000"], /^\/(?!admin|api)/);
  console.log(`public pages visited: ${r.seen.size}`);
  console.log(`external links found (not fetched — network sandboxed): ${[...r.external].sort().join(", ")}`);
  expect(r.problems.filter((p) => !/orders\/LLH-.*bad|\/c\/doesnotexist/.test(p))).toEqual([]);
  expect(r.seen.size).toBeGreaterThan(15);
});

test("admin: every page reachable from the admin nav loads for the owner", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "reports/.auth-owner.json" });
  const page = await ctx.newPage();
  const r = await crawl(page, ["/admin", "/admin/orders?test=1", "/admin/products", "/admin/delivery", "/admin/messages", "/admin/outbox", "/admin/payments", "/admin/content", "/admin/staff", "/admin/audit", "/admin/security"], /^\/admin/, 60);
  console.log(`admin pages visited: ${r.seen.size}`);
  expect(r.problems).toEqual([]);
  await ctx.close();
});

test("slow 3G mobile: hero and product photos still load, nothing overflows", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 });
  for (const p of ["/", "/shop/handwritten-letter", "/shop?c=flowers", "/gold-card"]) {
    const t0 = Date.now();
    await page.goto(p, { timeout: 60_000 });
    const hero = page.locator("main img").first();
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => hero.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 30_000 }).toBe(true);
    console.log(`${p}: first image decoded after ${Date.now() - t0} ms on slow 3G`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
  await ctx.close();
});

test("home stats show operational facts but not unverified counts/ratings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "About Love Lives Here" }).getByText("Est. 2025")).toBeVisible();
  await expect(page.getByText("4.9★")).toHaveCount(0);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)).find((j) => j["@type"] === "LocalBusiness");
  expect(ld.openingHours).toEqual(["Mo-Fr 08:00-16:00", "Sa 10:00-14:00", "Su 14:00-16:00"]);
});
