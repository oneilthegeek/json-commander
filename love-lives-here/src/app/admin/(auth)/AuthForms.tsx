"use client";
import { startTransition, useActionState } from "react";

const submitKeeping = (act: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); };
import { loginAction, verifyAction } from "./actions";

export function LoginForm() {
  const [s, act, pending] = useActionState(loginAction, {});
  return (
    <form onSubmit={submitKeeping(act)} className="panel form" style={{ maxWidth: 420 }}>
      <div className="f"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
      <div className="f"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {s.error && <p className="err" role="alert">{s.error}</p>}
      <button className="btn btn-dark" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function VerifyForm() {
  const [s, act, pending] = useActionState(verifyAction, {});
  return (
    <form onSubmit={submitKeeping(act)} className="panel form" style={{ maxWidth: 420 }}>
      <div className="f"><label htmlFor="code">6-digit code from your authenticator app</label><input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus /></div>
      {s.error && <p className="err" role="alert">{s.error}</p>}
      <button className="btn btn-dark" type="submit" disabled={pending}>{pending ? "Checking…" : "Verify"}</button>
    </form>
  );
}
