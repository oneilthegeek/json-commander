import { test as setup, expect } from "@playwright/test";
import { STAFF } from "./fixtures";
import { totpAt, currentStep } from "../../src/lib/auth/totp";

for (const [name, s] of Object.entries(STAFF)) {
  setup(`sign in as ${name}`, async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(s.email);
    await page.getByLabel("Password").fill(s.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    if ("totp" in s && s.totp) {
      await page.waitForURL("**/admin/login/verify");
      await page.getByLabel(/6-digit code/).fill(totpAt(s.totp, currentStep()));
      await page.getByRole("button", { name: "Verify" }).click();
    }
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await page.context().storageState({ path: `reports/.auth-${name}.json` });
  });
}
