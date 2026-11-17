import type { Metadata } from "next";
import { Suspense } from "react";
import { getProduct, isPurchasable } from "@/lib/catalog";
import { getSetting } from "@/lib/settings";
import { WhatsAppLink } from "@/components/WhatsApp";
import { LetterFlow } from "./LetterFlow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Write a handwritten letter",
  description: "Write your letter in your own words, or answer a few questions and let us find the words. Handwritten, sealed in wax and delivered in Lagos — you approve it first.",
  alternates: { canonical: "/letter" },
};

export default async function LetterPage() {
  const [p, business] = await Promise.all([getProduct("handwritten-letter"), getSetting("business")]);
  const v = p?.variants.find(isPurchasable);
  return (
    <section className="sec blush" aria-labelledby="letter-h">
      <div className="box narrow" style={{ marginInline: "auto" }}>
        <div className="head">
          <span className="lab">Your letter</span>
          <h1 id="letter-h">Say it on <i>paper.</i></h1>
          <p className="muted" style={{ margin: 0 }}>Tell us what you want to say. We write it by hand, send it to you to read, and seal it only when you say yes.</p>
        </div>
        <Suspense>
          <LetterFlow letter={v && p ? { variantId: v.id, price: v.price, name: p.name, variantName: v.name, image: p.images[0]?.src ?? null } : null} />
        </Suspense>
        <p className="hint" style={{ marginTop: 24 }}>Prefer to talk it through? <WhatsAppLink number={business.whatsapp} text="Hi LLH, I want to send a letter but I'd like to talk it through.">Chat with us on WhatsApp</WhatsAppLink>.</p>
      </div>
    </section>
  );
}
