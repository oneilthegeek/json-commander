import type { Metadata } from "next";
import { UnsubscribeForm } from "./UnsubscribeForm";
import { provider } from "@/lib/newsletter";

export const metadata: Metadata = { title: "Unsubscribe from Dear Lovers", robots: { index: false } };

export default function Unsub() {
  return (
    <section className="sec" aria-labelledby="u-h">
      <div className="box narrow" style={{ marginInline: "auto" }}>
        <div className="head"><span className="lab">Dear Lovers</span><h1 id="u-h">Unsubscribe</h1></div>
        {provider() === "substack"
          ? <p>Dear Lovers is sent through Substack. Use the “Unsubscribe” link at the bottom of any Dear Lovers email, or manage your subscriptions in your Substack account settings.</p>
          : <UnsubscribeForm />}
      </div>
    </section>
  );
}
