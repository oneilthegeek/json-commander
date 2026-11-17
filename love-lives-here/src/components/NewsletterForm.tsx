"use client";
import Link from "next/link";
import { useState } from "react";
import { track } from "./track";

type State = { kind: "idle" | "busy" | "ok" | "error"; msg: string };

export function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle", msg: "" });
  const [errs, setErrs] = useState<{ email?: string; consent?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    const next: typeof errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) next.email = "Enter an email address like ada@gmail.com.";
    if (!consent) next.consent = "Tick the box to confirm you'd like our emails.";
    setErrs(next);
    if (Object.keys(next).length) return;
    setState({ kind: "busy", msg: "" });
    try {
      const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: v, consent, source }) });
      const data = (await res.json()) as { status?: string; message?: string; url?: string; error?: string };
      if (!res.ok) { setState({ kind: "error", msg: data.error ?? data.message ?? "Something went wrong. Please try again." }); return; }
      if (data.status === "redirect" && data.url) {
        track("newsletter_signup_click");
        setState({ kind: "ok", msg: data.message ?? "" });
        window.location.assign(data.url);
        return;
      }
      setState({ kind: data.status === "error" ? "error" : "ok", msg: data.message ?? "" });
    } catch {
      setState({ kind: "error", msg: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-describedby="join-msg">
      <label htmlFor="join-email" className="hint" style={{ flexBasis: "100%" }}>Email address</label>
      <input id="join-email" type="email" placeholder="ada@gmail.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email} aria-describedby={errs.email ? "join-err" : undefined} />
      <button className="btn btn-dark" type="submit" disabled={state.kind === "busy"}>{state.kind === "busy" ? "Joining…" : "Join"}</button>
      {errs.email && <span className="err" id="join-err" style={{ flexBasis: "100%" }}>{errs.email}</span>}
      <label className="check" style={{ flexBasis: "100%" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errs.consent} />
        <span>I&apos;d like Dear Lovers emails from Love Lives Here. I can unsubscribe any time. See our <Link href="/privacy">privacy policy</Link>.</span>
      </label>
      {errs.consent && <span className="err" style={{ flexBasis: "100%" }}>{errs.consent}</span>}
      <span id="join-msg" role="status" aria-live="polite" className={state.kind === "error" ? "err" : "hint"} style={{ flexBasis: "100%" }}>{state.msg}</span>
    </form>
  );
}
