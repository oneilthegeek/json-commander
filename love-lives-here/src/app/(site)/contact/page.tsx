import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { WhatsAppLink } from "@/components/WhatsApp";
import { SupportForm } from "./SupportForm";

export const metadata: Metadata = { title: "Contact and support", description: "Talk to Love Lives Here on WhatsApp, by email, or send us a message.", alternates: { canonical: "/contact" } };

export default async function Contact({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [b, { order }] = await Promise.all([getSetting("business"), searchParams]);
  return (
    <section className="sec" aria-labelledby="c-h">
      <div className="box co">
        <div className="stack">
          <div className="head"><span className="lab">We&apos;re here</span><h1 id="c-h">Contact <i>us</i></h1></div>
          <SupportForm order={order && /^LLH-[A-Z0-9]{7}$/.test(order) ? order : undefined} />
        </div>
        <aside className="hours" aria-labelledby="c-hours">
          <h2 id="c-hours" style={{ fontSize: 24 }}>Other ways to reach us</h2>
          <WhatsAppLink className="btn btn-gold" number={b.whatsapp} text="Hi LLH, I have a question.">WhatsApp {b.phoneDisplay}</WhatsAppLink>
          <a className="btn btn-line" href={`mailto:${b.email}`}>{b.email}</a>
          {b.hours.map((h) => <div className="hr" key={h.days}><span>{h.days}</span><b>{h.time}</b></div>)}
          <p>Messages outside these hours are answered first thing the next working day.</p>
        </aside>
      </div>
    </section>
  );
}
