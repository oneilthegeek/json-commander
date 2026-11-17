import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { addDays, lagosToday } from "@/lib/dates";
import type { CheckoutInput } from "@/lib/validation";
import { checkoutSchema } from "@/lib/validation";

export async function variantBySku(sku: string) {
  const v = await getDb().query.productVariants.findFirst({ where: eq(schema.productVariants.sku, sku) });
  if (!v) throw new Error("no variant " + sku);
  return v;
}
export async function zoneByName(name: string) {
  const z = await getDb().query.deliveryZones.findFirst({ where: eq(schema.deliveryZones.name, name) });
  if (!z) throw new Error("no zone " + name);
  return z;
}
let n = 0;
export async function checkoutInput(over: Partial<Record<string, unknown>> & { lines?: { variantId: string; quantity: number }[] } = {}): Promise<CheckoutInput> {
  const letter = await variantBySku("LLH-LETTER");
  const zone = await zoneByName("Yaba, Mushin, Ilupeju");
  const raw = {
    checkoutKey: `testkey_${Date.now()}_${n++}_abcdefgh`,
    lines: [{ variantId: letter.id, quantity: 1 }],
    buyer: { name: "Tolu Test", phone: "0803 123 4567", email: "tolu@example.com" },
    recipient: { name: "Ada", phone: "" },
    delivery: { zoneId: zone.id, address: "12 Herbert Macaulay Way, Yaba", date: addDays(lagosToday(), 10), window: "any" },
    letter: { mode: "own_words", message: "Dear Ada, I don't say it enough, but you make every day lighter." },
    consent: true,
    ...over,
  };
  return checkoutSchema.parse(raw);
}
