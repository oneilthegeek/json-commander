"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LetterApproval({ number, token, draftId, version, body }: { number: string; token: string; draftId: string; version: number; body: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "changes">("view");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function send(action: "approve" | "changes") {
    if (action === "changes" && feedback.trim().length < 5) { setMsg({ ok: false, text: "Tell us what you'd like changed." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/orders/${number}/letter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, draftId, action, feedback }) });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Something went wrong." }); setBusy(false); return; }
      setMsg({ ok: true, text: action === "approve" ? "Thank you — you've approved your letter. We'll handwrite and seal it next." : "Thanks — we've got your notes and will send a new version." });
      router.refresh();
    } catch { setMsg({ ok: false, text: "We couldn't reach the server. Try again." }); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <p className="hand" style={{ margin: 0 }}>Your letter, version {version}</p>
      <pre className="brief" style={{ background: "#FFF8F1", fontSize: 17 }}>{body}</pre>
      {msg && <p className={msg.ok ? "alert ok" : "alert"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      {mode === "view" ? (
        <div className="row">
          {!confirm ? <button className="btn btn-dark" type="button" onClick={() => setConfirm(true)} disabled={busy}>I approve this letter</button> : (
            <div className="stack panel" style={{ gap: 10 }}>
              <p style={{ margin: 0 }}>Once you approve, we&apos;ll handwrite and seal it exactly as shown. You won&apos;t be able to change the words after that.</p>
              <div className="row">
                <button className="btn btn-dark" type="button" onClick={() => send("approve")} disabled={busy}>{busy ? "Saving…" : "Yes, approve and seal it"}</button>
                <button className="btn btn-ghost" type="button" onClick={() => setConfirm(false)}>Not yet</button>
              </div>
            </div>
          )}
          {!confirm && <button className="btn btn-ghost" type="button" onClick={() => setMode("changes")}>Request changes</button>}
        </div>
      ) : (
        <div className="f">
          <label htmlFor="fb">What should we change?</label>
          <textarea id="fb" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={3000} />
          <div className="row">
            <button className="btn btn-dark" type="button" onClick={() => send("changes")} disabled={busy}>{busy ? "Sending…" : "Send my changes"}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setMode("view")}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
