"use client";
import { useState } from "react";

export function UnsubscribeForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/newsletter/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json();
    setMsg({ ok: r.ok, text: d.message ?? d.error });
  }
  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <div className="f"><label htmlFor="u-email">Email address</label><input id="u-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <button className="btn btn-dark" type="submit">Unsubscribe</button>
      {msg && <p className={msg.ok ? "alert ok" : "err"} role="status">{msg.text}</p>}
    </form>
  );
}
