"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/cart";
import { useQuote } from "@/components/useQuote";
import { attribution, track } from "@/components/track";
import { formatNaira } from "@/lib/money";

type Zone = { id: number; name: string; areas: string; mode: "fixed" | "quote" | "pickup"; fee: number | null; region: string };
type Errors = Record<string, string>;

const FIELD_ORDER = ["lines", "letter", "buyer.name", "buyer.phone", "buyer.email", "recipient.name", "recipient.phone", "delivery.zoneId", "delivery.address", "delivery.date", "giftNote", "consent"];

function newKey() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "");
}

export function CheckoutForm({ zones, privacyVersion }: { zones: Zone[]; privacyVersion: string }) {
  const router = useRouter();
  const cart = useCart();
  const [f, setF] = useState({
    buyerName: "", buyerPhone: "", buyerEmail: "", recipientName: "", recipientPhone: "",
    zoneId: "", address: "", instructions: "", date: "", window: "any", giftNote: "", photo: false, consent: false, marketing: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<false | "order" | "pay">(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkoutKey] = useState(newKey);
  const summaryRef = useRef<HTMLDivElement>(null);
  const zoneId = f.zoneId ? Number(f.zoneId) : null;
  const { quote, loading, error: quoteError } = useQuote(cart.lines, zoneId, cart.ready);
  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const hasCandle = cart.lines.some((l) => l.kind === "candle");
  const hasLetter = cart.lines.some((l) => l.kind === "letter");

  useEffect(() => { if (cart.ready && cart.lines.length) track("checkout_start"); }, [cart.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // Prefill from the letter flow
  useEffect(() => {
    if (!cart.letter) return;
    setF((x) => ({ ...x, recipientName: x.recipientName || cart.letter?.recipientName || "", date: x.date || cart.letter?.date || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);
  useEffect(() => { setF((x) => ({ ...x, giftNote: x.giftNote || cart.giftNote })); }, [cart.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  // Count abandonment (no personal data) if they leave with a full bag
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && cart.lines.length && !busy) track("checkout_abandon"); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [cart.lines.length, busy]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const t = e.target as HTMLInputElement;
    const v = t.type === "checkbox" ? t.checked : t.value;
    setF((x) => ({ ...x, [k]: v }));
    if (k === "zoneId") track("delivery_select");
    if (k === "giftNote") cart.setGiftNote(String(v));
    const map: Record<string, string> = { buyerName: "buyer.name", buyerPhone: "buyer.phone", buyerEmail: "buyer.email", recipientName: "recipient.name", recipientPhone: "recipient.phone", zoneId: "delivery.zoneId", address: "delivery.address", date: "delivery.date", consent: "consent" };
    const ek = map[k as string];
    if (ek && errors[ek]) setErrors((x) => { const n = { ...x }; delete n[ek]; return n; });
  };

  function clientValidate(): Errors {
    const e: Errors = {};
    if (f.buyerName.trim().length < 2) e["buyer.name"] = "Enter your name.";
    const digits = f.buyerPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) e["buyer.phone"] = "Enter your WhatsApp number, like 0801 234 5678.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.buyerEmail.trim())) e["buyer.email"] = "Enter a valid email address — your receipt goes here.";
    if (!f.recipientName.trim()) e["recipient.name"] = "Enter their name.";
    if (f.recipientPhone.trim() && f.recipientPhone.replace(/\D/g, "").length < 10) e["recipient.phone"] = "Check their number, or leave it blank.";
    if (!zoneId) e["delivery.zoneId"] = "Choose a delivery area.";
    if (zone && zone.mode !== "pickup" && f.address.trim().length < 8) e["delivery.address"] = "Enter the full delivery address, including street and area.";
    if (!f.date) e["delivery.date"] = "Pick a delivery date.";
    else if (quote?.earliestDate && f.date < quote.earliestDate) e["delivery.date"] = `The earliest we can deliver this order is ${quote.earliestDate}.`;
    if (!f.consent) e.consent = "Please confirm you've read how we handle your details.";
    if (hasLetter && !cart.letter) e.letter = "Tell us what your letter should say first.";
    return e;
  }

  const ordered = (e: Errors) => Object.entries(e).sort((a, b) => FIELD_ORDER.indexOf(a[0]) - FIELD_ORDER.indexOf(b[0]));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e = clientValidate();
    setErrors(e);
    if (Object.keys(e).length) { setTimeout(() => summaryRef.current?.focus(), 0); return; }
    if (quote?.errors.length) { setFormError(quote.errors[0].message); return; }
    setBusy("order");
    const L = cart.letter;
    const letter = !hasLetter || !L ? undefined : L.mode === "own_words"
      ? { mode: "own_words", message: L.message ?? "", signOff: L.signOff, tone: L.tone }
      : { mode: "help_me", relationship: L.relationship ?? "", occasion: L.occasion ?? "", feelings: L.feelings ?? "", memories: L.memories, nicknames: L.nicknames, tone: L.tone, avoid: L.avoid, signOff: L.signOff };
    const body = {
      checkoutKey,
      lines: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      buyer: { name: f.buyerName, phone: f.buyerPhone, email: f.buyerEmail },
      recipient: { name: f.recipientName, phone: f.recipientPhone },
      delivery: { zoneId: zoneId!, address: f.address, instructions: f.instructions, date: f.date, window: f.window },
      letter, giftNote: hasCandle ? f.giftNote : undefined,
      photoBeforeDispatch: f.photo, consent: f.consent, marketingOptIn: f.marketing, source: attribution(),
    };
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) {
          // map nested letter.* errors to one message
          const fe: Errors = {};
          for (const [k, v] of Object.entries(data.fields as Errors)) fe[k.startsWith("letter") ? "letter" : k.startsWith("lines") ? "lines" : k] = v;
          setErrors(fe); setTimeout(() => summaryRef.current?.focus(), 0);
        } else if (data.field) {
          setErrors({ [data.field]: data.error }); setTimeout(() => summaryRef.current?.focus(), 0);
        } else setFormError(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      // Remember the order on this device so they can find it again.
      try {
        const mine = JSON.parse(localStorage.getItem("llh-my-orders") ?? "[]") as { n: string; t: string }[];
        localStorage.setItem("llh-my-orders", JSON.stringify([{ n: data.orderNumber, t: data.token }, ...mine.filter((m) => m.n !== data.orderNumber)].slice(0, 10)));
      } catch { /* ignore */ }
      cart.clear();
      const orderUrl = `/orders/${data.orderNumber}?t=${encodeURIComponent(data.token)}`;
      if (data.next !== "pay") { router.push(orderUrl + "&new=1"); return; }
      setBusy("pay");
      const pay = await fetch(`/api/orders/${data.orderNumber}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: data.token }) });
      const pd = await pay.json();
      if (pay.ok && pd.authorizationUrl) { window.location.assign(pd.authorizationUrl); return; }
      router.push(`${orderUrl}&payerror=${encodeURIComponent(pd.error ?? "We couldn't start the payment.")}`);
    } catch {
      setFormError("We couldn't reach the server. Check your connection — your bag is still saved — and try again.");
      setBusy(false);
    }
  }

  const errList = ordered(errors);
  const err = (k: string) => errors[k] ? <span className="err" id={`err-${k}`}>{errors[k]}</span> : null;
  const a = (k: string, hint?: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": [hint, errors[k] ? `err-${k}` : ""].filter(Boolean).join(" ") || undefined });
  const payLabel = useMemo(() => {
    if (busy === "order") return "Saving your order…";
    if (busy === "pay") return "Opening secure payment…";
    if (zone?.mode === "quote") return "Send for a delivery quote";
    if (quote?.total != null) return `Pay ${formatNaira(quote.total)} securely`;
    return "Continue to payment";
  }, [busy, zone, quote]);

  if (!cart.ready) return <p className="muted">Loading your bag…</p>;
  if (!cart.lines.length) return <div className="stack"><p className="muted">Your bag is empty.</p><Link className="btn btn-dark" href="/shop" style={{ alignSelf: "flex-start" }}>Browse gifts</Link></div>;

  return (
    <form className="co" onSubmit={submit} noValidate>
      <div className="form">
        {errList.length > 0 && (
          <div className="errsum" ref={summaryRef} tabIndex={-1} role="alert">
            <strong>Please check {errList.length === 1 ? "this" : `these ${errList.length} things`}:</strong>
            <ul>{errList.map(([k, m]) => <li key={k}><a href={`#${k === "letter" ? "letter-box" : k === "lines" ? "sum-h" : "f-" + k}`}>{m}</a></li>)}</ul>
          </div>
        )}
        {formError && <div className="alert" role="alert">{formError}</div>}
        {hasLetter && (
          <div className="panel" id="letter-box" tabIndex={-1}>
            <h2 style={{ fontSize: 22 }}>Your letter</h2>
            {cart.letter ? (
              <p className="small muted" style={{ margin: "6px 0 0" }}>
                {cart.letter.mode === "own_words" ? "In your own words" : "We'll find the words"} · to {cart.letter.recipientName}. We&apos;ll send it to you to approve before sealing. <Link href="/letter">Edit</Link>
              </p>
            ) : <p className="err" style={{ margin: "6px 0 0" }}>Tell us what to write. <Link href="/letter">Start your letter</Link></p>}
          </div>
        )}

        <fieldset className="panel form">
          <legend className="sr-only">Your details</legend>
          <h2 style={{ fontSize: 22 }}>Your details</h2>
          <div className="fg2">
            <div className="f"><label htmlFor="f-buyer.name">Your name <span className="req">required</span></label><input id="f-buyer.name" type="text" autoComplete="name" value={f.buyerName} onChange={set("buyerName")} maxLength={80} {...a("buyer.name")} />{err("buyer.name")}</div>
            <div className="f"><label htmlFor="f-buyer.phone">Your WhatsApp number <span className="req">required</span></label><input id="f-buyer.phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0801 234 5678" value={f.buyerPhone} onChange={set("buyerPhone")} maxLength={30} {...a("buyer.phone", "h-phone")} /><span className="hint" id="h-phone">We send your letter here to approve. Abroad? Include your country code, e.g. +44.</span>{err("buyer.phone")}</div>
          </div>
          <div className="f"><label htmlFor="f-buyer.email">Email <span className="req">required</span></label><input id="f-buyer.email" type="email" autoComplete="email" value={f.buyerEmail} onChange={set("buyerEmail")} maxLength={160} {...a("buyer.email", "h-email")} /><span className="hint" id="h-email">For your receipt and order updates.</span>{err("buyer.email")}</div>
        </fieldset>

        <fieldset className="panel form">
          <legend className="sr-only">Who it&apos;s for</legend>
          <h2 style={{ fontSize: 22 }}>Who it&apos;s for</h2>
          <div className="fg2">
            <div className="f"><label htmlFor="f-recipient.name">Their name <span className="req">required</span></label><input id="f-recipient.name" type="text" autoComplete="off" value={f.recipientName} onChange={set("recipientName")} maxLength={80} {...a("recipient.name")} />{err("recipient.name")}</div>
            <div className="f"><label htmlFor="f-recipient.phone">Their phone number <span className="opt-l">optional</span></label><input id="f-recipient.phone" type="tel" inputMode="tel" autoComplete="off" placeholder="For the rider" value={f.recipientPhone} onChange={set("recipientPhone")} maxLength={30} {...a("recipient.phone", "h-rphone")} /><span className="hint" id="h-rphone">Only shared with the rider on the day.</span>{err("recipient.phone")}</div>
          </div>
        </fieldset>

        <fieldset className="panel form">
          <legend className="sr-only">Delivery</legend>
          <h2 style={{ fontSize: 22 }}>Delivery</h2>
          <div className="f">
            <label htmlFor="f-delivery.zoneId">Delivery area <span className="req">required</span></label>
            <select id="f-delivery.zoneId" value={f.zoneId} onChange={set("zoneId")} {...a("delivery.zoneId")}>
              <option value="">Choose an area</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name} {z.mode === "fixed" ? `(${formatNaira(z.fee)})` : z.mode === "pickup" ? "(free)" : "(we'll quote)"}</option>)}
            </select>
            {zone && <span className="hint">{zone.areas}</span>}
            {err("delivery.zoneId")}
          </div>
          {zone?.mode === "quote" && <p className="alert info" style={{ margin: 0 }}>We&apos;ll work out the fee for this address and send you the final total before you pay. Nothing is charged now.</p>}
          {zone?.mode !== "pickup" && (<>
            <div className="f"><label htmlFor="f-delivery.address">Delivery address <span className="req">required</span></label><textarea id="f-delivery.address" rows={3} autoComplete="street-address" value={f.address} onChange={set("address")} maxLength={400} style={{ minHeight: 80 }} {...a("delivery.address")} />{err("delivery.address")}</div>
            <div className="f"><label htmlFor="f-instr">Directions for the rider <span className="opt-l">optional</span></label><input id="f-instr" type="text" value={f.instructions} onChange={set("instructions")} maxLength={500} placeholder="Gate code, landmark, call on arrival…" /></div>
          </>)}
          <div className="fg2">
            <div className="f">
              <label htmlFor="f-delivery.date">Deliver on <span className="req">required</span></label>
              <input id="f-delivery.date" type="date" min={quote?.earliestDate} value={f.date} onChange={set("date")} {...a("delivery.date", "h-date")} />
              <span className="hint" id="h-date">{quote?.earliestDate ? `Earliest available: ${new Date(quote.earliestDate + "T12:00:00Z").toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}. Busy days can fill up.` : "We'll show the earliest date we can make."}</span>
              {err("delivery.date")}
            </div>
            <div className="f">
              <label htmlFor="f-window">Preferred time</label>
              <select id="f-window" value={f.window} onChange={set("window")}>
                <option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option>
              </select>
            </div>
          </div>
        </fieldset>

        {hasCandle && (
          <div className="panel form">
            <h2 style={{ fontSize: 22 }}>The Secret Candle</h2>
            <div className="f"><label htmlFor="f-giftNote">The message to hide inside <span className="opt-l">optional</span></label><textarea id="f-giftNote" rows={3} maxLength={500} value={f.giftNote} onChange={set("giftNote")} style={{ minHeight: 80 }} {...a("giftNote", "h-gn")} /><span className="hint" id="h-gn">Short works best — a line or two. Leave blank and we&apos;ll ask you on WhatsApp.</span>{err("giftNote")}</div>
          </div>
        )}

        <div className="panel form">
          <label className="check"><input type="checkbox" checked={f.photo} onChange={set("photo")} /><span>Send me a photo before it goes out</span></label>
          <label className="check" id="f-consent">
            <input type="checkbox" checked={f.consent} onChange={set("consent")} {...a("consent")} />
            <span>I&apos;ve read how Love Lives Here uses my and the recipient&apos;s details to make and deliver this order (<Link href="/privacy" target="_blank">privacy notice</Link>, version {privacyVersion}) and agree to the <Link href="/terms" target="_blank">terms</Link>. <span className="req">required</span></span>
          </label>
          {err("consent")}
          <label className="check"><input type="checkbox" checked={f.marketing} onChange={set("marketing")} /><span>Also send me Dear Lovers emails now and then (optional)</span></label>
        </div>
      </div>

      <aside className="panel stack" aria-labelledby="sum-h">
        <h2 id="sum-h" style={{ fontSize: 24 }}>Order summary</h2>
        <div className="sum" aria-live="polite" aria-busy={loading} data-testid="summary">
          {quote?.lines.map((l) => (
            <div className="sr" key={l.variantId}><span>{l.productName}{l.variantName && l.variantName !== l.productName ? `, ${l.variantName}` : ""}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span><span>{formatNaira(l.lineTotal)}</span></div>
          ))}
          <div className="sr"><span>Delivery{quote?.delivery ? ` · ${quote.delivery.zoneName}` : ""}</span>
            <span data-testid="sum-delivery">{!quote?.delivery ? "Choose an area" : quote.delivery.mode === "quote" ? "We'll quote" : quote.delivery.mode === "pickup" ? "Free" : formatNaira(quote.delivery.fee)}</span></div>
          <div className="sr tot"><span>Total</span><span data-testid="sum-total">{quote ? (quote.total != null ? formatNaira(quote.total) : `${formatNaira(quote.subtotal)} + delivery`) : "…"}</span></div>
        </div>
        {loading && <span className="hint">Updating…</span>}
        {quoteError && <p className="err" role="alert">{quoteError}</p>}
        {quote?.errors.map((e, i) => <p className="err" key={i} role="alert">{e.message}</p>)}
        <button className="btn btn-dark btn-block" type="submit" disabled={!!busy || loading || !!quote?.errors.length}>{payLabel}</button>
        <p className="hint" style={{ margin: 0 }}>
          {zone?.mode === "quote" ? "You'll pay once we've confirmed the delivery fee." : "You'll pay on Paystack's secure page. We never see or store your card details."}
        </p>
        <Link href="/cart" className="small">Edit bag</Link>
      </aside>
    </form>
  );
}
