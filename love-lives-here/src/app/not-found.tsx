import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="sec">
      <div className="box narrow stack" style={{ marginInline: "auto" }}>
        <span className="lab">Not found</span>
        <h1>This page isn&apos;t <i>here.</i></h1>
        <p className="muted">If you followed a private order or card link, check you copied all of it.</p>
        <div className="row"><Link className="btn btn-dark" href="/">Go home</Link><Link className="btn btn-ghost" href="/track">Track an order</Link></div>
      </div>
    </main>
  );
}
