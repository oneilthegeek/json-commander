"use client";
import { useActionState } from "react";
import { unlockCard } from "./actions";

export function UnlockForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unlockCard, { error: "" });
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="token" value={token} />
      <label htmlFor="code" style={{ color: "var(--on-dark-muted)" }}>The sender added a secret word to this card. Enter it to open your message.</label>
      <input id="code" name="code" type="text" autoComplete="off" autoCapitalize="none" className="input" aria-invalid={!!state.error || undefined} aria-describedby={state.error ? "code-err" : undefined} />
      {state.error && <p id="code-err" role="alert" style={{ color: "var(--gold)", margin: 0 }}>{state.error}</p>}
      <button className="btn btn-gold" type="submit" disabled={pending}>{pending ? "Opening…" : "Open my message"}</button>
    </form>
  );
}
