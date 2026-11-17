"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="sec">
      <div className="box narrow stack" style={{ marginInline: "auto" }}>
        <span className="lab">Something went wrong</span>
        <h1>Sorry — that didn&apos;t <i>work.</i></h1>
        <p className="muted">Please try again. If it keeps happening, message us on WhatsApp and we&apos;ll help you finish your order.</p>
        <div className="row"><button className="btn btn-dark" onClick={reset}>Try again</button><Link className="btn btn-ghost" href="/">Go home</Link></div>
      </div>
    </main>
  );
}
