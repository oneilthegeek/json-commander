import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber, verifyTracking } from "@/lib/orders";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { PROGRESS, STATUS_LABEL } from "@/lib/order-status";
import { getSetting } from "@/lib/settings";
import { PayButton } from "@/components/PayButton";
import { LetterApproval } from "@/components/LetterApproval";
import { WhatsAppLink } from "@/components/WhatsApp";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; payerror?: string; new?: string }> }) {
  const { number } = await params;
  const { t = "", payerror, new: isNew } = await searchParams;
  const order = await getOrderByNumber(number);
  // Same response for "no such order" and "wrong token": no order enumeration.
  if (!order || !verifyTracking(order, t)) notFound();
  const business = await getSetting("business");

  const events = order.events.filter((e) => e.visibleToCustomer);
  const pendingDraft = order.status === "awaiting_approval" ? order.drafts.find((d) => d.status === "sent") : undefined;
  const progressIndex = PROGRESS.indexOf(order.status);
  const steps = order.approvalRequired ? PROGRESS : PROGRESS.filter((s) => !["drafting", "awaiting_approval", "approved"].includes(s));
  const paidPayment = order.payments.find((p) => p.status === "success");
  const cards = order.experiences ?? [];

  return (
    <section className="sec" aria-labelledby="o-h">
      <div className="box">
        <div className="head">
          <span className="lab">Order {order.number}</span>
          <h1 id="o-h">{STATUS_LABEL[order.status]}</h1>
          <p className="muted" style={{ margin: 0 }}>For {order.recipientName} · delivery {order.deliveryMode === "pickup" ? "pickup" : "on"} {formatLongDate(order.deliveryDate)}</p>
        </div>

        {isNew && order.status === "awaiting_quote" && <p className="alert ok" role="status">Thank you — your order is saved. We&apos;ll confirm the delivery fee and send you the final total to pay. Keep this page: it&apos;s your private order link.</p>}
        {payerror && order.paymentStatus === "unpaid" && <p className="alert" role="alert">{payerror}</p>}
        {order.paymentStatus === "unpaid" && order.status === "pending_payment" && order.total != null && (
          <div className="panel stack" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22 }}>Ready to pay</h2>
            <p style={{ margin: 0 }}>Total due: <strong>{formatNaira(order.total)}</strong>. You&apos;ll pay on Paystack&apos;s secure page.</p>
            <PayButton number={order.number} token={t} label={`Pay ${formatNaira(order.total)}`} />
            {order.payments.some((p) => p.status === "failed" || p.status === "abandoned") && <p className="hint" style={{ margin: 0 }}>A previous attempt didn&apos;t go through. You haven&apos;t been charged for it.</p>}
          </div>
        )}

        {progressIndex >= 0 && (
          <ol className="steps" aria-label={`Progress: ${STATUS_LABEL[order.status]}`} style={{ marginBottom: 28 }}>
            {steps.map((s) => <li key={s} className={PROGRESS.indexOf(s) <= progressIndex ? "done" : ""}><span className="sr-only">{STATUS_LABEL[s]}{PROGRESS.indexOf(s) <= progressIndex ? " (done)" : ""}</span></li>)}
          </ol>
        )}

        <div className="co">
          <div className="stack" style={{ gap: 28 }}>
            {pendingDraft && (
              <section className="panel" aria-labelledby="draft-h">
                <h2 id="draft-h" style={{ fontSize: 24, marginBottom: 12 }}>Read your letter</h2>
                <LetterApproval number={order.number} token={t} draftId={pendingDraft.id} version={pendingDraft.version} body={pendingDraft.body} />
              </section>
            )}

            {cards.length > 0 && order.paymentStatus === "paid" && (
              <section className="panel stack" aria-labelledby="card-h">
                <h2 id="card-h" style={{ fontSize: 22 }}>{cards.some((c) => c.kind === "gold_card") ? "Your Gold Card" : "Your LLH Tag"}</h2>
                {cards.map((c) => (
                  <div key={c.id} className="stack" style={{ gap: 8 }}>
                    <p style={{ margin: 0 }}>
                      {c.kind === "gold_card" ? "Add the note, photos, voice message or playlist that opens when they tap the card." : "Tell us the link the tag should open."}
                      {" "}{c.status === "active" ? "It's live." : "We'll check it before it goes live."}
                    </p>
                    {c.buyerCanEdit ? <Link className="btn btn-ghost" style={{ alignSelf: "flex-start" }} href={`/orders/${order.number}/card/${c.id}?t=${encodeURIComponent(t)}`}>{c.kind === "gold_card" ? "Add or edit what's on the card" : "Set the tag's link"}</Link>
                      : <p className="hint" style={{ margin: 0 }}>Editing is closed for this card. Message us if you need a change.</p>}
                  </div>
                ))}
              </section>
            )}

            <section aria-labelledby="tl-h">
              <h2 id="tl-h" style={{ fontSize: 22, marginBottom: 12 }}>Updates</h2>
              <ol className="timeline">
                {events.map((e) => <li key={e.id}><time dateTime={new Date(e.createdAt).toISOString()}>{formatDateTime(e.createdAt)}</time>{e.message}</li>)}
              </ol>
            </section>
          </div>

          <aside className="panel stack" aria-labelledby="rc-h" id="receipt">
            <div className="row between"><h2 id="rc-h" style={{ fontSize: 22 }}>{order.paymentStatus === "paid" ? "Receipt" : "Order details"}</h2><PrintButton /></div>
            <div className="sum">
              {order.items.map((i) => <div className="sr" key={i.id}><span>{i.productName}{i.variantName !== i.productName ? `, ${i.variantName}` : ""}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span><span>{formatNaira(i.lineTotal)}</span></div>)}
              <div className="sr"><span>Delivery · {order.zoneName}</span><span>{order.deliveryFee == null ? "Being quoted" : order.deliveryFee === 0 ? "Free" : formatNaira(order.deliveryFee)}</span></div>
              <div className="sr tot"><span>Total</span><span>{order.total == null ? `${formatNaira(order.subtotal)} + delivery` : formatNaira(order.total)}</span></div>
            </div>
            <dl className="small" style={{ margin: 0, display: "grid", gap: 6 }}>
              <div><dt className="hint">Payment</dt><dd style={{ margin: 0 }}>{order.paymentStatus === "paid" ? `Paid ${formatDateTime(order.paidAt)}${paidPayment ? ` · ref ${paidPayment.reference}` : ""}` : order.paymentStatus.replace("_", " ")}</dd></div>
              <div><dt className="hint">Buyer</dt><dd style={{ margin: 0 }}>{order.buyerName}</dd></div>
              <div><dt className="hint">Delivery</dt><dd style={{ margin: 0 }}>{order.deliveryMode === "pickup" ? "Pickup in Lagos — we'll confirm the pickup point" : order.deliveryAddress}</dd></div>
            </dl>
            <p className="hint" style={{ margin: 0 }}>Questions? <WhatsAppLink number={business.whatsapp} text={`Hi LLH, it's about order ${order.number}.`}>WhatsApp us</WhatsAppLink> or <Link href={`/contact?order=${order.number}`}>send a message</Link>. Please quote {order.number}.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
