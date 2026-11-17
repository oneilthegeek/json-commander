"use client";
import { useState } from "react";

export function PayButton({ number, token, label }: { number: string; token: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/orders/${number}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json();
      if (r.ok && d.authorizationUrl) { window.location.assign(d.authorizationUrl); return; }
      setErr(d.error ?? "We couldn't start the payment. Please try again.");
    } catch { setErr("We couldn't reach the server. Check your connection and try again."); }
    setBusy(false);
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button type="button" className="btn btn-dark" onClick={go} disabled={busy}>{busy ? "Opening secure payment…" : label}</button>
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
