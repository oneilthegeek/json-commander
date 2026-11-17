"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart, type LetterDraft } from "@/components/cart";
import { track } from "@/components/track";
import { formatNaira } from "@/lib/money";

type Mode = "own_words" | "help_me";
const DRAFT_KEY = "llh-letter-draft-v1";

const RELATIONSHIPS = ["Partner", "Wife or husband", "Crush", "Best friend", "Mum or dad", "Sister or brother", "Friend", "Colleague", "Someone else"];
const OCCASIONS = ["Just because", "Birthday", "Anniversary", "Apology", "Long distance", "Valentine's", "Thank you", "Mother's Day", "Father's Day", "Something else"];
const TONES = ["Romantic", "Sweet", "Deep", "Funny", "I'm sorry", "Grateful"];

type Step = { id: string; title: string; fields: string[] };
const STEPS: Record<Mode, Step[]> = {
  own_words: [
    { id: "who", title: "Who it's for", fields: ["recipientName"] },
    { id: "words", title: "Your words", fields: ["message"] },
    { id: "review", title: "Review", fields: [] },
  ],
  help_me: [
    { id: "who", title: "Who it's for", fields: ["recipientName", "relationship"] },
    { id: "why", title: "The occasion", fields: ["occasion"] },
    { id: "feel", title: "What you feel", fields: ["feelings"] },
    { id: "details", title: "Your details", fields: [] },
    { id: "review", title: "Review", fields: [] },
  ],
};

const LABELS: Record<string, string> = {
  recipientName: "Their name", relationship: "They are your", occasion: "Occasion", tone: "How it should feel",
  feelings: "What you want them to feel", memories: "Memories and details", nicknames: "Names you call each other",
  avoid: "Anything to avoid", message: "Your message", signOff: "Sign it from", date: "Preferred delivery date",
};

function validate(d: LetterDraft, fields: string[]): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of fields) {
    const v = (d[f] ?? "").trim();
    if (f === "recipientName" && v.length < 1) e[f] = "Enter their name — first name is fine.";
    if (f === "relationship" && !v) e[f] = "Tell us who they are to you.";
    if (f === "occasion" && !v) e[f] = "Choose an occasion.";
    if (f === "feelings" && v.length < 10) e[f] = "Tell us, in a sentence or two, what you want them to feel.";
    if (f === "message" && v.length < 20) e[f] = "Write at least a few sentences. Rough is fine — we'll check it with you.";
    if (f === "message" && v.length > 6000) e[f] = "Keep your message under 6,000 characters.";
  }
  return e;
}

export function LetterFlow({ letter }: { letter: { variantId: string; price: number | null; name: string; variantName: string; image: string | null } | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const cart = useCart();
  const [d, setD] = useState<LetterDraft>({});
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);

  // Restore a saved draft (save-and-resume on this device)
  useEffect(() => {
    let saved: { d: LetterDraft; mode: Mode | null; step: number } | null = null;
    try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null"); } catch { saved = null; }
    const q = sp.get("mode");
    if (saved?.d && Object.keys(saved.d).length > 1) {
      setD(saved.d); setMode(saved.mode); setStep(saved.step ?? 0); setRestored(true);
    } else if (q === "help_me" || q === "own_words") {
      setMode(q); setD({ mode: q }); track("letter_start");
    }
  }, [sp]);

  useEffect(() => {
    if (!mode) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ d: { ...d, mode }, mode, step })); } catch { /* ignore */ }
  }, [d, mode, step]);

  const steps = mode ? STEPS[mode] : [];
  const current = steps[step];

  useEffect(() => { heading.current?.focus(); }, [step, mode]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setD((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((x) => { const n = { ...x }; delete n[k]; return n; });
  };

  function choose(m: Mode) {
    setMode(m); setStep(0); setErrors({}); setD((x) => ({ ...x, mode: m })); track("letter_start");
  }

  function next() {
    const e = validate(d, current.fields);
    setErrors(e);
    if (Object.keys(e).length) { setTimeout(() => summary.current?.focus(), 0); return; }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function startOver() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setD({}); setMode(null); setStep(0); setErrors({}); setRestored(false);
  }

  function addToBag(goTo: "/checkout" | "/shop") {
    if (!letter || !mode) return;
    const all = validate(d, steps.flatMap((s) => s.fields));
    if (Object.keys(all).length) { setErrors(all); setStep(0); return; }
    const clean: LetterDraft = { mode };
    for (const [k, v] of Object.entries(d)) if (typeof v === "string" && v.trim()) clean[k] = v.trim();
    cart.setLetter(clean);
    if (!cart.lines.some((l) => l.kind === "letter")) {
      cart.add({ variantId: letter.variantId, quantity: 1, productSlug: "handwritten-letter", productName: letter.name, variantName: letter.variantName, kind: "letter", image: letter.image, unitPrice: letter.price ?? 0 });
    }
    track("letter_complete");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    router.push(goTo);
  }

  const errList = Object.entries(errors);
  const field = (k: string, el: React.ReactNode, opts: { optional?: boolean; hint?: string } = {}) => (
    <div className="f">
      <label htmlFor={`l-${k}`}>{LABELS[k]}{opts.optional ? <span className="opt-l">optional</span> : <span className="req">required</span>}</label>
      {opts.hint && <span className="hint" id={`h-${k}`}>{opts.hint}</span>}
      {el}
      {errors[k] && <span className="err" id={`e-${k}`}>{errors[k]}</span>}
    </div>
  );
  const aria = (k: string, hint?: boolean) => ({
    id: `l-${k}`, "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": [hint ? `h-${k}` : "", errors[k] ? `e-${k}` : ""].filter(Boolean).join(" ") || undefined,
  });

  const review = useMemo(() => Object.entries(d).filter(([k, v]) => k !== "mode" && typeof v === "string" && v.trim()), [d]);

  if (!letter) return <p className="alert">Letters aren&apos;t available to order online right now. <Link href="/contact">Contact us</Link> and we&apos;ll help.</p>;

  if (!mode) {
    return (
      <div className="stack" style={{ gap: 20 }}>
        {restored && <p className="alert info">We found a letter you started on this device. <button className="link-btn" onClick={startOver}>Start over</button></p>}
        <h2 ref={heading} tabIndex={-1} style={{ fontSize: "clamp(24px,3vw,32px)" }}>How would you like to write it?</h2>
        <div className="fg2">
          <button type="button" className="panel" style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }} onClick={() => choose("own_words")}>
            <span className="lab">I know what to say</span>
            <h3 style={{ margin: "8px 0" }}>Write it in your own words</h3>
            <span className="muted small">Type your message — rough is fine. We handwrite it exactly, and send it to you to read first.</span>
          </button>
          <button type="button" className="panel" style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }} onClick={() => choose("help_me")}>
            <span className="lab">Help me find the words</span>
            <h3 style={{ margin: "8px 0" }}>Answer a few questions</h3>
            <span className="muted small">Tell us about them and your story. Our writers shape it into a letter, then you approve it.</span>
          </button>
        </div>
        <p className="hint">{letter.price != null ? `The Letter is ${formatNaira(letter.price)}, plus delivery.` : ""} You can add a candle, the Gold Card or flowers afterwards.</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <ol className="progress" aria-label="Letter progress">
        {steps.map((s, i) => <li key={s.id} className={i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>{i + 1}. {s.title}</li>)}
      </ol>
      <h2 ref={heading} tabIndex={-1} style={{ fontSize: "clamp(24px,3vw,32px)" }}>
        <span className="sr-only">Step {step + 1} of {steps.length}: </span>{current.title}
      </h2>
      {errList.length > 0 && (
        <div className="errsum" ref={summary} tabIndex={-1} role="alert">
          <strong>Please fix {errList.length === 1 ? "this" : `these ${errList.length} things`}:</strong>
          <ul>{errList.map(([k, m]) => <li key={k}><a href={`#l-${k}`}>{m}</a></li>)}</ul>
        </div>
      )}

      <form className="form panel" noValidate onSubmit={(e) => { e.preventDefault(); if (current.id !== "review") next(); }}>
        {current.id === "who" && (<>
          {field("recipientName", <input type="text" autoComplete="off" value={d.recipientName ?? ""} onChange={set("recipientName")} maxLength={80} {...aria("recipientName")} />)}
          {mode === "help_me" && field("relationship", (
            <select value={d.relationship ?? ""} onChange={set("relationship")} {...aria("relationship")}>
              <option value="">Choose one</option>{RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
            </select>
          ))}
          {mode === "own_words" && field("date", <input type="date" value={d.date ?? ""} onChange={set("date")} {...aria("date", true)} />, { optional: true, hint: "You'll confirm this at checkout. We'll show the earliest date we can make." })}
        </>)}

        {current.id === "words" && (<>
          {field("message", <textarea rows={10} value={d.message ?? ""} onChange={set("message")} maxLength={6000} placeholder={`Dear ${d.recipientName || "Ada"}, I don't say it enough, but…`} {...aria("message", true)} />,
            { hint: "Write it exactly as you want it. We'll handwrite it word for word and check anything unclear with you." })}
          <span className="hint" aria-live="polite">{(d.message ?? "").length} / 6000 characters</span>
          {field("signOff", <input type="text" value={d.signOff ?? ""} onChange={set("signOff")} maxLength={120} placeholder="Forever yours, Tolu" {...aria("signOff")} />, { optional: true })}
        </>)}

        {current.id === "why" && (<>
          {field("occasion", (
            <select value={d.occasion ?? ""} onChange={set("occasion")} {...aria("occasion")}>
              <option value="">Choose one</option>{OCCASIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
          <fieldset className="f">
            <legend>{LABELS.tone} <span className="opt-l">optional</span></legend>
            <div className="chips">
              {TONES.map((t) => <label key={t}><input type="radio" name="tone" value={t} checked={d.tone === t} onChange={set("tone")} /><span>{t}</span></label>)}
            </div>
          </fieldset>
          {field("date", <input type="date" value={d.date ?? ""} onChange={set("date")} {...aria("date", true)} />, { optional: true, hint: "You'll confirm this at checkout." })}
        </>)}

        {current.id === "feel" && field("feelings", <textarea rows={5} value={d.feelings ?? ""} onChange={set("feelings")} maxLength={2000} placeholder="I want her to know I see how hard she works, and that I'm proud of her." {...aria("feelings", true)} />,
          { hint: "In your own words. A sentence or two is enough." })}

        {current.id === "details" && (<>
          <p className="alert info" style={{ margin: 0 }}>We only write what you tell us. We never make up memories or details — so the more you share, the more it will sound like you.</p>
          {field("memories", <textarea rows={6} value={d.memories ?? ""} onChange={set("memories")} maxLength={4000} placeholder="Three things you love about them, a memory, an inside joke. Messy is fine." {...aria("memories", true)} />, { optional: true, hint: "Places, moments, things they say, why they matter to you." })}
          {field("nicknames", <input type="text" value={d.nicknames ?? ""} onChange={set("nicknames")} maxLength={300} {...aria("nicknames")} />, { optional: true })}
          {field("avoid", <textarea rows={3} value={d.avoid ?? ""} onChange={set("avoid")} maxLength={1000} placeholder="e.g. Don't mention her ex. Keep it clean — her mum might see it." {...aria("avoid", true)} />, { optional: true, hint: "Topics, words or names to leave out." })}
          {field("signOff", <input type="text" value={d.signOff ?? ""} onChange={set("signOff")} maxLength={120} placeholder="Your name, or how you sign off" {...aria("signOff")} />, { optional: true })}
        </>)}

        {current.id === "review" && (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>Here&apos;s what we&apos;ll work from. {mode === "help_me" ? "Our writers turn this into your letter and send it to you to approve." : "We'll handwrite your words and send them to you to check first."} Nothing is sealed until you say yes.</p>
            <dl style={{ margin: 0 }}>
              {review.map(([k, v]) => (
                <div key={k} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <dt className="hint">{LABELS[k] ?? k}</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{v as string}</dd>
                </div>
              ))}
            </dl>
            <div className="row">
              <button type="button" className="btn btn-dark" style={{ flex: "1 1 220px" }} onClick={() => addToBag("/checkout")}>Add letter &amp; check out</button>
              <button type="button" className="btn btn-ghost" style={{ flex: "1 1 220px" }} onClick={() => addToBag("/shop")}>Add letter &amp; choose gifts</button>
            </div>
          </div>
        )}

        {current.id !== "review" && (
          <div className="row between">
            {step > 0 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setErrors({}); setStep((s) => s - 1); }}>Back</button>
              : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>Change how I write it</button>}
            <button type="submit" className="btn btn-dark">Continue</button>
          </div>
        )}
        {current.id === "review" && <button type="button" className="link-btn" onClick={() => setStep(0)}>Edit my answers</button>}
      </form>
      <p className="hint">Your answers are saved on this device as you go, so you can come back later. <button className="link-btn" onClick={startOver}>Clear and start over</button></p>
    </div>
  );
}
