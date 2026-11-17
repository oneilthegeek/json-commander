"use client";
import { useState } from "react";

export function SupportForm({ order }: { order?: string }) {
  const [f, setF] = useState({ name: "", contact: "", orderNumber: order ?? "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy"); setErrors({});
    try {
      const r = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) { setErrors(d.fields ?? {}); setMsg(d.error ?? "Please check the form."); setState("error"); return; }
      setState("sent"); setMsg("Thank you — we've got your message and will reply within one working day.");
    } catch { setState("error"); setMsg("We couldn't send that. Check your connection, or message us on WhatsApp."); }
  }
  if (state === "sent") return <p className="alert ok" role="status">{msg}</p>;
  const a = (k: string) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `se-${k}` : undefined });
  const err = (k: string) => errors[k] ? <span className="err" id={`se-${k}`}>{errors[k]}</span> : null;
  return (
    <form className="panel form" onSubmit={submit} noValidate>
      <div className="fg2">
        <div className="f"><label htmlFor="s-name">Your name</label><input id="s-name" type="text" autoComplete="name" value={f.name} onChange={set("name")} {...a("name")} />{err("name")}</div>
        <div className="f"><label htmlFor="s-contact">Phone or email</label><input id="s-contact" type="text" autoComplete="email" value={f.contact} onChange={set("contact")} {...a("contact")} />{err("contact")}</div>
      </div>
      <div className="f"><label htmlFor="s-order">Order number <span className="opt-l">optional</span></label><input id="s-order" type="text" placeholder="LLH-AB3CD7E" value={f.orderNumber} onChange={set("orderNumber")} {...a("orderNumber")} />{err("orderNumber")}</div>
      <div className="f"><label htmlFor="s-msg">How can we help?</label><textarea id="s-msg" rows={5} value={f.message} onChange={set("message")} maxLength={3000} {...a("message")} />{err("message")}</div>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}><label>Leave this empty<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label></div>
      {state === "error" && <p className="err" role="alert">{msg}</p>}
      <button className="btn btn-dark" type="submit" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send message"}</button>
      <p className="hint" style={{ margin: 0 }}>We use your details only to reply. Please don&apos;t include card numbers.</p>
    </form>
  );
}
