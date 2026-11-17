import type { Metadata } from "next";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = { title: "Track your order", description: "Check the status of your Love Lives Here order.", alternates: { canonical: "/track" } };

export default function TrackPage() {
  return (
    <section className="sec" aria-labelledby="tr-h">
      <div className="box narrow" style={{ marginInline: "auto" }}>
        <div className="head"><span className="lab">Where is it?</span><h1 id="tr-h">Track your order</h1></div>
        <TrackForm />
      </div>
    </section>
  );
}
