import { test, expect } from "@playwright/test";
import { sql } from "./fixtures";

/** Found in the independent review: writers could read customers' phone numbers/emails in Messages. */
const as = (who: "owner" | "writer" | "fulfilment") => ({ storageState: `reports/.auth-${who}.json` });

test("customer contact details in Messages are hidden from letter writers", async ({ browser }) => {
  const contact = `+2348000${Date.now().toString().slice(-6)}`;
  await sql(`insert into support_messages (name, contact, message) values ('Review Tester', $1, 'Can you deliver on Sunday?')`, [contact]);
  for (const [who, sees] of [["writer", false], ["fulfilment", true], ["owner", true]] as const) {
    const ctx = await browser.newContext(as(who));
    const page = await ctx.newPage();
    await page.goto("/admin/messages");
    const card = page.locator("article").filter({ hasText: "Review Tester" }).first();
    await expect(card).toBeVisible();
    if (sees) await expect(card).toContainText(contact);
    else {
      await expect(card).not.toContainText(contact);
      await expect(card).toContainText("contact hidden for your role");
      expect(await page.content()).not.toContain(contact); // not in the HTML/RSC payload either
    }
    await ctx.close();
  }
});
