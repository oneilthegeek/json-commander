import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const [zones, legal] = await Promise.all([
    getDb().select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true)).orderBy(asc(schema.deliveryZones.sort)),
    getSetting("legal"),
  ]);
  return (
    <section className="sec" aria-labelledby="co-h">
      <div className="box">
        <div className="head"><span className="lab">Almost there</span><h1 id="co-h">Checkout</h1></div>
        <CheckoutForm zones={zones.map((z) => ({ id: z.id, name: z.name, areas: z.areas, mode: z.mode, fee: z.fee, region: z.region }))} privacyVersion={legal.version} />
      </div>
    </section>
  );
}
