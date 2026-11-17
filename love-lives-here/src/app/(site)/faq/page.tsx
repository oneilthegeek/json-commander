import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/lib/faq";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = { title: "Questions, answered", description: "Answers about handwritten letters, delivery in Lagos and Nigeria, the Gold Card, cancellations and privacy.", alternates: { canonical: "/faq" } };

export default function FaqPage() {
  return (
    <section className="sec faq" aria-labelledby="faq-h">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
      <div className="box">
        <div className="head"><span className="lab">Good to know</span><h1 id="faq-h">Questions, <i>answered</i></h1></div>
        {FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        <p style={{ marginTop: 24 }}>Still wondering? <Link href="/contact">Contact us</Link>.</p>
      </div>
    </section>
  );
}
