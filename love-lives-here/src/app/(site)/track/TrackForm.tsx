"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { lookup, type LookupState } from "./actions";

export function TrackForm() {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookup, {});
  const [mine, setMine] = useState<{ n: string; t: string }[]>([]);
  useEffect(() => { try { setMine(JSON.parse(localStorage.getItem("llh-my-orders") ?? "[]")); } catch { setMine([]); } }, []);
  return (
    <div className="stack" style={{ gap: 24 }}>
      {mine.length > 0 && (
        <div className="panel stack" style={{ gap: 8 }}>
          <h2 style={{ fontSize: 20 }}>Orders placed on this device</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{mine.map((m) => <li key={m.n}><Link href={`/orders/${m.n}?t=${encodeURIComponent(m.t)}`}>{m.n}</Link></li>)}</ul>
        </div>
      )}
      <form action={action} className="panel form" noValidate>
        <h2 style={{ fontSize: 20 }}>Look up an order</h2>
        <div className="fg2">
          <div className="f"><label htmlFor="t-number">Order number</label><input id="t-number" name="number" type="text" placeholder="LLH-AB3CD7E" autoCapitalize="characters" required /></div>
          <div className="f"><label htmlFor="t-phone">Your phone number</label><input id="t-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required /></div>
        </div>
        <button className="btn btn-dark" type="submit" disabled={pending}>{pending ? "Looking…" : "Find my order"}</button>
        <div aria-live="polite">
          {state.error && <p className="err" role="alert">{state.error}</p>}
          {state.result && (
            <div className="stack" style={{ gap: 8 }}>
              <p style={{ margin: 0 }}><strong>{state.result.number}</strong>: {state.result.status}. Delivery {state.result.date}.</p>
              <ol className="timeline">{state.result.updates.map((u, i) => <li key={i}><time>{u.at}</time>{u.text}</li>)}</ol>
              <p className="hint">To approve your letter or pay, use the private link in your confirmation email.</p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
