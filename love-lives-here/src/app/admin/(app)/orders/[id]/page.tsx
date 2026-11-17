import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { can, canMoveTo } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { STATUS_LABEL, TRANSITIONS } from "@/lib/order-status";
import { trackingUrl } from "@/lib/orders";
import { waLink } from "@/lib/wa";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge, PayBadge } from "@/components/admin/Badges";
import * as A from "../../actions";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const o = await db.query.orders.findFirst({
    where: eq(schema.orders.id, id),
    with: {
      items: true, briefs: true, drafts: { orderBy: [desc(schema.letterDrafts.version)] }, payments: { orderBy: [desc(schema.payments.createdAt)] },
      refunds: true, events: { orderBy: [desc(schema.orderEvents.createdAt)] }, delivery: true, assignee: true, experiences: true,
    },
  });
  if (!o) notFound();
  const staff = can(s.role, "orders.assign") ? await db.select({ id: schema.staffUsers.id, name: schema.staffUsers.name }).from(schema.staffUsers).where(eq(schema.staffUsers.active, true)).orderBy(asc(schema.staffUsers.name)) : [];
  const outbox = await db.select().from(schema.outbox).where(eq(schema.outbox.orderId, o.id)).orderBy(desc(schema.outbox.createdAt));
  const pii = can(s.role, "customers.pii");
  const letters = can(s.role, "letters.view");
  const pay = can(s.role, "payments.view");
  const targets = TRANSITIONS[o.status].filter((t) => canMoveTo(s.role, t));
  const sentDraft = o.drafts.find((d) => d.status === "sent");
  const openDraft = o.drafts.find((d) => d.status === "draft");
  const trackUrl = trackingUrl(o);
  const paidTotal = o.payments.filter((p) => p.status === "success").reduce((n, p) => n + p.amount, 0);
  const refunded = o.refunds.filter((r) => r.status !== "failed").reduce((n, r) => n + r.amount, 0);
  const nfcItems = o.items.filter((i) => i.kind === "gold_card" || i.kind === "llh_tag");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <p><Link href="/admin/orders">← Orders</Link></p>
      <div className="row between">
        <div>
          <h1 style={{ fontSize: 34 }}>{o.number}</h1>
          <div className="row" style={{ gap: 8 }}><StatusBadge s={o.status} /><PayBadge s={o.paymentStatus} />{o.testMode && <span className="badge warn">TEST ORDER</span>}{o.duplicatePaymentFlag && <span className="badge bad">Duplicate payment — refund needed</span>}{o.approvalRequired && <span className="badge">Approval required</span>}</div>
        </div>
        <div className="row"><Link className="btn btn-ghost btn-sm" href={`/admin/orders/${o.id}/receipt`}>Receipt</Link></div>
      </div>

      <div className="cols">
        <div className="stack" style={{ gap: 20 }}>
          {can(s.role, "orders.status") && (
            <section className="card" aria-labelledby="st-h">
              <h2 id="st-h">Move order</h2>
              {targets.length === 0 ? <p className="muted small">No further status changes available to your role from “{STATUS_LABEL[o.status]}”.</p> : (
                <ActionForm action={A.changeStatus.bind(null, o.id)} submit="Update status">
                  <div className="fg2">
                    <div className="f"><label htmlFor="to">New status</label><select id="to" name="to">{targets.map((t) => <option key={t} value={t}>{STATUS_LABEL[t]}</option>)}</select></div>
                    <div className="f"><label htmlFor="note">Message to customer <span className="opt-l">optional — default text used if blank</span></label><input id="note" name="note" type="text" maxLength={500} /></div>
                  </div>
                </ActionForm>
              )}
              {o.approvalRequired && !o.drafts.some((d) => d.status === "approved") && <p className="hint" style={{ margin: 0 }}>Production is blocked until the buyer approves a draft.</p>}
            </section>
          )}

          {(o.status === "awaiting_quote" || (o.status === "pending_payment" && o.deliveryMode === "quote")) && can(s.role, "orders.quote") && (
            <section className="card" aria-labelledby="q-h">
              <h2 id="q-h">Delivery quote</h2>
              <p className="small" style={{ margin: 0 }}>Zone: {o.zoneName}. Items: {formatNaira(o.subtotal)}. {pii ? `Address: ${o.deliveryAddress}` : ""}</p>
              <ActionForm action={A.quoteDelivery.bind(null, o.id)} submit="Save quote and let the buyer pay">
                <div className="f" style={{ maxWidth: 220 }}><label htmlFor="fee">Delivery fee (₦)</label><input id="fee" name="fee" type="text" inputMode="decimal" defaultValue={o.deliveryFee != null ? String(o.deliveryFee / 100) : ""} required /></div>
              </ActionForm>
              {pii && <a className="small" href={waLink(o.buyerPhone, `Hi ${o.buyerName}, your delivery quote for ${o.number} is ready. You can pay here: ${trackUrl}`)} target="_blank" rel="noopener noreferrer">Message buyer on WhatsApp after saving</a>}
            </section>
          )}

          {letters && o.briefs.length > 0 && (
            <section className="card" aria-labelledby="lb-h">
              <h2 id="lb-h">Letter brief <span className="badge">{o.briefs[0].mode === "own_words" ? "Own words" : "Help me write"}</span></h2>
              {o.briefs.map((b) => (
                <dl key={b.id} style={{ margin: 0, display: "grid", gap: 8 }}>
                  {[["Message (write exactly)", b.message], ["Relationship", b.relationship], ["Occasion", b.occasion], ["Tone", b.tone], ["What they want them to feel", b.feelings], ["Memories & details", b.memories], ["Nicknames", b.nicknames], ["Avoid", b.avoid], ["Sign off", b.signOff]]
                    .filter(([, v]) => v).map(([k, v]) => <div key={k as string}><dt className="hint">{k}</dt><dd style={{ margin: 0 }}><pre className="brief">{v}</pre></dd></div>)}
                </dl>
              ))}
              <p className="hint" style={{ margin: 0 }}>Only use details the buyer gave. Don&apos;t invent memories.</p>
            </section>
          )}

          {letters && o.approvalRequired && (
            <section className="card" aria-labelledby="dr-h">
              <h2 id="dr-h">Drafts &amp; approval</h2>
              {o.drafts.length === 0 && <p className="muted small">No drafts yet.</p>}
              {o.drafts.map((d) => (
                <details key={d.id} open={d.status === "draft" || d.status === "sent" || d.status === "changes_requested"}>
                  <summary>Version {d.version} · <span className="badge">{d.status.replace("_", " ")}</span> · {formatDateTime(d.createdAt)}</summary>
                  <pre className="brief">{d.body}</pre>
                  {d.customerFeedback && <p className="alert warn small">Buyer: {d.customerFeedback}</p>}
                </details>
              ))}
              {can(s.role, "letters.edit") && (<>
                {openDraft && o.status === "drafting" && (
                  <ActionForm action={async () => { "use server"; return A.sendDraft(o.id, openDraft.id); }} submit={`Send version ${openDraft.version} to buyer for approval`} confirm="Send this draft to the buyer?" />
                )}
                {sentDraft && o.status === "awaiting_approval" && (<>
                  {pii && <a className="small" href={waLink(o.buyerPhone, `Hi ${o.buyerName}, your letter for ${o.recipientName} is ready to read. Approve it or ask for changes here: ${trackUrl}`)} target="_blank" rel="noopener noreferrer">Send the approval link on WhatsApp</a>}
                  <ActionForm action={A.recordApproval.bind(null, o.id, sentDraft.id)} submit="Record approval received on WhatsApp">
                    <div className="f"><label htmlFor="ap-note">How did they approve?</label><input id="ap-note" name="note" type="text" maxLength={300} placeholder="Approved on WhatsApp at 14:02" required /></div>
                  </ActionForm>
                </>)}
                {["paid", "drafting", "awaiting_approval", "on_hold"].includes(o.status) && (
                  <ActionForm action={A.saveDraft.bind(null, o.id)} submit={o.drafts.length ? "Save as new version" : "Save first draft"}>
                    <div className="f"><label htmlFor="body">{o.drafts.length ? "New version" : "Draft"}</label><textarea id="body" name="body" rows={10} defaultValue={o.drafts[0]?.body ?? (o.briefs[0]?.mode === "own_words" ? o.briefs[0]?.message ?? "" : "")} /></div>
                  </ActionForm>
                )}
              </>)}
            </section>
          )}

          {nfcItems.length > 0 && can(s.role, "nfc.edit") && (
            <section className="card" aria-labelledby="nfc-h">
              <h2 id="nfc-h">Gold Card / LLH Tag</h2>
              {o.experiences.length === 0 && <p className="muted small">Cards are created automatically when the order is paid.</p>}
              <ul style={{ margin: 0, paddingLeft: 18 }}>{o.experiences.map((e) => <li key={e.id}><Link href={`/admin/nfc/${e.id}`}>{e.kind === "gold_card" ? "Gold Card" : "LLH Tag"}</Link> · <span className="badge">{e.status}</span>{e.tagWrittenAt ? " · tag written" : " · tag not written yet"}</li>)}</ul>
              {o.paymentStatus === "paid" && (
                <ActionForm action={async () => { "use server"; return A.createCard(o.id, nfcItems[0].kind as "gold_card" | "llh_tag"); }} submit="Add another card" submitClass="link-btn" />
              )}
            </section>
          )}

          <section className="card" aria-labelledby="tl-h">
            <h2 id="tl-h">Timeline</h2>
            {can(s.role, "orders.notes") && (
              <ActionForm action={A.addNote.bind(null, o.id)} submit="Add staff note" resetOnSuccess>
                <div className="f"><label htmlFor="snote">Internal note (not shown to the customer)</label><input id="snote" name="note" type="text" maxLength={2000} /></div>
              </ActionForm>
            )}
            <ol className="timeline">
              {o.events.map((e) => (
                <li key={e.id}><time>{formatDateTime(e.createdAt)} · {e.actorLabel}{e.visibleToCustomer ? " · customer sees this" : ""}</time>{e.toStatus && <strong>{STATUS_LABEL[e.toStatus as keyof typeof STATUS_LABEL] ?? e.toStatus}: </strong>}{e.message}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="card" aria-labelledby="sum-h">
            <h2 id="sum-h">Summary</h2>
            <div className="sum">
              {o.items.map((i) => <div className="sr" key={i.id}><span>{i.productName}{i.variantName !== i.productName ? `, ${i.variantName}` : ""} × {i.quantity}</span><span>{formatNaira(i.lineTotal)}</span></div>)}
              <div className="sr"><span>Delivery · {o.zoneName}</span><span>{o.deliveryFee == null ? "to quote" : formatNaira(o.deliveryFee)}</span></div>
              <div className="sr tot"><span>Total</span><span>{o.total == null ? "—" : formatNaira(o.total)}</span></div>
            </div>
            <dl className="small" style={{ margin: 0, display: "grid", gap: 6 }}>
              <div><dt className="hint">Deliver</dt><dd style={{ margin: 0 }}>{formatLongDate(o.deliveryDate)} · {o.deliveryWindow ?? "any time"}</dd></div>
              <div><dt className="hint">Recipient</dt><dd style={{ margin: 0 }}>{o.recipientName}{pii && o.recipientPhone ? ` · ${o.recipientPhone}` : ""}</dd></div>
              {pii && <div><dt className="hint">Address</dt><dd style={{ margin: 0 }}>{o.deliveryMode === "pickup" ? "Pickup" : o.deliveryAddress}{o.deliveryInstructions ? <div className="hint">{o.deliveryInstructions}</div> : null}</dd></div>}
              {pii && <div><dt className="hint">Buyer</dt><dd style={{ margin: 0 }}>{o.buyerName} · <a href={waLink(o.buyerPhone, `Hi ${o.buyerName}, it's Love Lives Here about order ${o.number}.`)} target="_blank" rel="noopener noreferrer">{o.buyerPhone}</a>{o.buyerEmail ? <> · <a href={`mailto:${o.buyerEmail}`}>{o.buyerEmail}</a></> : null}</dd></div>}
              {o.giftNote && <div><dt className="hint">Hidden candle message</dt><dd style={{ margin: 0 }}>{letters ? o.giftNote : "(visible to writers)"}</dd></div>}
              {o.photoBeforeDispatch && <div><dt className="hint">Photo</dt><dd style={{ margin: 0 }}><strong>Send the buyer a photo before dispatch</strong></dd></div>}
              <div><dt className="hint">Source</dt><dd style={{ margin: 0 }}>{o.source?.source ?? "—"}{o.source?.campaign ? ` / ${o.source.campaign}` : ""}</dd></div>
              {pii && <div><dt className="hint">Customer link</dt><dd style={{ margin: 0, wordBreak: "break-all" }}><a href={trackUrl} target="_blank" rel="noopener noreferrer">Open buyer&apos;s order page</a></dd></div>}
            </dl>
          </section>

          {can(s.role, "orders.assign") && (
            <section className="card" aria-labelledby="as-h">
              <h2 id="as-h">Assigned to</h2>
              <ActionForm action={A.assignOrder.bind(null, o.id)} submit="Assign">
                <div className="f"><label htmlFor="staffId" className="sr-only">Team member</label><select id="staffId" name="staffId" defaultValue={o.assignedTo ?? ""}><option value="">Nobody</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              </ActionForm>
            </section>
          )}

          {pii && ["packed", "dispatched", "delivered", "delivery_failed", "in_production"].includes(o.status) && (
            <section className="card" aria-labelledby="dl-h">
              <h2 id="dl-h">Rider</h2>
              <ActionForm action={A.saveDelivery.bind(null, o.id)} submit="Save">
                <div className="fg2">
                  <div className="f"><label htmlFor="riderName">Rider name</label><input id="riderName" name="riderName" type="text" defaultValue={o.delivery?.riderName ?? ""} /></div>
                  <div className="f"><label htmlFor="riderPhone">Rider phone</label><input id="riderPhone" name="riderPhone" type="tel" defaultValue={o.delivery?.riderPhone ?? ""} /></div>
                </div>
                <div className="f"><label htmlFor="dnotes">Notes</label><input id="dnotes" name="notes" type="text" defaultValue={o.delivery?.notes ?? ""} /></div>
                <div className="f"><label htmlFor="failedReason">If delivery failed, why?</label><input id="failedReason" name="failedReason" type="text" defaultValue={o.delivery?.failedReason ?? ""} /></div>
              </ActionForm>
            </section>
          )}

          {pay && (
            <section className="card" aria-labelledby="pay-h">
              <h2 id="pay-h">Payments</h2>
              {o.payments.length === 0 ? <p className="muted small">No payment attempts.</p> : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {o.payments.map((p) => (
                    <li key={p.id} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                      <code>{p.reference}</code> · {formatNaira(p.amount)} · <span className={`badge ${p.status === "success" ? "ok" : p.status === "initialized" ? "" : "bad"}`}>{p.status}</span> {p.provider === "manual" ? "(manual)" : ""} {p.testMode ? "(test)" : ""}
                      {p.gatewayResponse && <div className="hint">{p.gatewayResponse}</div>}
                      {p.provider === "paystack" && <ActionForm action={async () => { "use server"; return A.reverify(o.id, p.reference); }} submit="Re-check with Paystack" submitClass="link-btn" className="" />}
                    </li>
                  ))}
                </ul>
              )}
              {o.refunds.length > 0 && <p className="small" style={{ margin: 0 }}>Refunds: {o.refunds.map((r) => `${formatNaira(r.amount)} (${r.status})`).join(", ")}</p>}
              {can(s.role, "payments.manual") && o.status === "pending_payment" && (
                <ActionForm action={A.manualPayment.bind(null, o.id)} submit="Mark paid (bank transfer)" confirm="Only do this after the money is in the bank. Continue?">
                  <div className="f"><label htmlFor="mp-note">Bank reference / note</label><input id="mp-note" name="note" type="text" required /></div>
                </ActionForm>
              )}
              {can(s.role, "payments.refund") && paidTotal - refunded > 0 && (
                <ActionForm action={A.refund.bind(null, o.id)} submit="Refund" confirm="Issue this refund?">
                  <div className="fg2">
                    <div className="f"><label htmlFor="rf-amount">Amount (₦), up to {formatNaira(paidTotal - refunded)}</label><input id="rf-amount" name="amount" type="text" inputMode="decimal" required /></div>
                    <div className="f"><label htmlFor="rf-reason">Reason</label><input id="rf-reason" name="reason" type="text" required /></div>
                  </div>
                  <label className="check"><input type="checkbox" name="manual" /> Already refunded outside Paystack (record only)</label>
                </ActionForm>
              )}
            </section>
          )}

          {outbox.length > 0 && (
            <section className="card" aria-labelledby="ob-h">
              <h2 id="ob-h">Customer notifications</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {outbox.map((m) => <li key={m.id} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>{m.subject} · <span className="badge">{m.status}</span></li>)}
              </ul>
              <Link className="small" href="/admin/outbox">Open outbox</Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
