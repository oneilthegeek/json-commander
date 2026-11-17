"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";

export type ActionResult = { ok?: boolean; error?: string; message?: string };
type Act = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** A form bound to a server action, with accessible success/error feedback. */
export function ActionForm({ action, children, submit, className = "form", confirm, resetOnSuccess, submitClass = "btn btn-dark btn-sm" }: {
  action: Act; children?: React.ReactNode; submit: string; className?: string; confirm?: string; resetOnSuccess?: boolean; submitClass?: string;
}) {
  const [state, run, pending] = useActionState<ActionResult, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    // Submitting manually (not via the action prop) keeps what the person typed if the server rejects it.
    <form ref={ref} className={className} onSubmit={(e) => {
      e.preventDefault();
      if (confirm && !window.confirm(confirm)) return;
      const fd = new FormData(e.currentTarget);
      startTransition(() => run(fd));
    }}>
      {children}
      <div className="row">
        <button className={submitClass} type="submit" disabled={pending}>{pending ? "Saving…" : submit}</button>
        <span role="status" aria-live="polite" className={state.error ? "err" : "hint"}>{state.error ?? state.message ?? ""}</span>
      </div>
    </form>
  );
}
