import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { verifyAndApply } from "@/lib/payments";
import { verifyTracking } from "@/lib/orders";
import { paystackConfigured } from "@/lib/paystack";
import { PayButton } from "@/components/PayButton";
import { formatNaira } from "@/lib/money";
import { formatLongDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

/** Paystack redirects here with ?reference=. We verify server-side before saying anything is paid. */
export default async function Complete({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const number = (sp.order ?? "").toUpperCase();
  const token = sp.t ?? "";
  const reference = sp.reference ?? sp.trxref ?? "";
  const db = getDb();
  const order = number ? await db.query.orders.findFirst({ where: eq(schema.orders.number, number) }) : null;
  if (!order || !verifyTracking(order, token)) redirect("/track");

  let outcome = "unknown";
  if (reference && paystackConfigured()) {
    const p = await db.query.payments.findFirst({ where: and(eq(schema.payments.reference, reference), eq(schema.payments.orderId, order.id)) });
    if (p) {
      try { outcome = (await verifyAndApply(reference, "callback")).outcome; } catch { outcome = "verify_error"; }
    }
  }
  const fresh = (await db.query.orders.findFirst({ where: eq(schema.orders.id, order.id) }))!;
  const orderUrl = `/orders/${fresh.number}?t=${encodeURIComponent(token)}`;
  const paid = fresh.paymentStatus === "paid";

  return (
    <section className="sec" aria-labelledby="pc-h">
      <div className="box narrow stack" style={{ marginInline: "auto", gap: 20 }}>
        {paid ? (<>
          <span className="lab">Payment confirmed</span>
          <h1 id="pc-h">Thank you. <i>It&apos;s in our hands now.</i></h1>
          <p className="alert ok" role="status">We&apos;ve received {formatNaira(fresh.total)} for order <strong>{fresh.number}</strong>. A receipt is on its way to {fresh.buyerEmail}.</p>
          <ol className="dlv" style={{ paddingLeft: 0 }}>
            {fresh.approvalRequired && <li><b>We write your letter.</b> Then we send it to you to read — on WhatsApp and on your order page.</li>}
            {fresh.approvalRequired && <li><b>You approve it.</b> Nothing is sealed until you say yes.</li>}
            <li><b>Sealed, packed and delivered</b> on {formatLongDate(fresh.deliveryDate)}.</li>
          </ol>
          <Link className="btn btn-dark" href={orderUrl} style={{ alignSelf: "flex-start" }}>View and track your order</Link>
          <p className="hint">Bookmark your order page — it&apos;s private to you.</p>
        </>) : outcome === "failed" ? (<>
          <span className="lab">Payment not completed</span>
          <h1 id="pc-h">Your payment didn&apos;t go through</h1>
          <p className="alert" role="alert">Your bank or Paystack declined it, or it was cancelled. You haven&apos;t been charged for this attempt. Your order {fresh.number} is saved — you can try again.</p>
          <PayButton number={fresh.number} token={token} label="Try paying again" />
          <Link href={orderUrl}>Go to your order</Link>
        </>) : (<>
          <span className="lab">Checking your payment</span>
          <h1 id="pc-h">We&apos;re confirming your payment</h1>
          <p className="alert info" role="status">
            {!paystackConfigured() ? "Online payment isn't switched on yet, so no payment was taken. Your order is saved — message us on WhatsApp to pay." :
              outcome === "verify_error" ? "We couldn't reach Paystack to confirm just now. If you paid, it will show on your order page shortly — please don't pay twice." :
              "This can take a moment. If you completed payment, your order page will update shortly — please don't pay twice."}
          </p>
          <Link className="btn btn-dark" href={orderUrl} style={{ alignSelf: "flex-start" }}>Go to your order</Link>
        </>)}
      </div>
    </section>
  );
}
