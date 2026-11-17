import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Policy } from "@/components/Policy";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { formatNaira } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delivery fees and policy", description: "Delivery fees by area across Lagos, nationwide delivery quotes, timings and what happens on the day.", alternates: { canonical: "/delivery" } };

export default async function Delivery() {
  const [zones, sched] = await Promise.all([
    getDb().select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true)).orderBy(asc(schema.deliveryZones.sort)),
    getSetting("scheduling"),
  ]);
  return (
    <Policy title="Delivery" lab="Where and when" updated="17 November 2026">
      <h2>Fees</h2>
      <div className="table-wrap" style={{ maxWidth: 560 }}>
        <table className="t"><caption className="sr-only">Delivery fee by area</caption>
          <thead><tr><th scope="col">Area</th><th scope="col" className="num">Fee</th></tr></thead>
          <tbody>{zones.map((z) => <tr key={z.id}><td>{z.name}{z.mode !== "fixed" && <div className="hint">{z.areas}</div>}</td><td className="num">{z.mode === "fixed" ? formatNaira(z.fee) : z.mode === "pickup" ? "Free" : "Quoted"}</td></tr>)}</tbody>
        </table>
      </div>
      <h2>Making time and delivery time</h2>
      <p><strong>Making</strong> is the time we need to write, seal and pack your order — usually under 48 hours. <strong>Delivery</strong> happens on the date you choose. The checkout only offers dates we can make: at least {sched.minLeadDays} days ahead, and later if your order needs more making time. Orders placed after {sched.cutoffHour > 12 ? sched.cutoffHour - 12 + "pm" : sched.cutoffHour + "am"} (Lagos time) count from the next day.</p>
      <p>Two days&apos; notice is a minimum, not a promise for every day: around Valentine&apos;s and other big days we can only make so many letters, and some days fill up or are closed. If a date isn&apos;t available, the checkout will tell you.</p>
      <h2>Outside our listed areas</h2>
      <p>Choose “Another Lagos area” or “Another state”. Your order is saved, we confirm the delivery fee and timing, and you pay the final total from your order page. Nothing is charged until then.</p>
      <h2>On the day</h2>
      <ul>
        <li>Choose a preferred time window at checkout. We&apos;ll do our best to match it.</li>
        <li>If you give the recipient&apos;s phone number, our rider may call them to find the address. We only share it with the rider.</li>
        <li>If no one is available, the rider will try to reach you. We&apos;ll agree another attempt (a second trip may cost the delivery fee again).</li>
        <li>Want to see it first? Tick “Send me a photo before it goes out” at checkout.</li>
      </ul>
      <p>See also our <Link href="/refunds">refunds policy</Link> for late or failed deliveries.</p>
    </Policy>
  );
}
