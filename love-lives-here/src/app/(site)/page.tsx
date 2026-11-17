import Image from "next/image";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { listProducts } from "@/lib/catalog";
import { toClient } from "@/lib/present";
import { getSetting } from "@/lib/settings";
import { getDb, schema } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { appUrl } from "@/lib/config";
import { ProductCard } from "@/components/ProductCard";
import { Carousel } from "@/components/Carousel";
import { NewsletterForm } from "@/components/NewsletterForm";
import { JsonLd } from "@/components/JsonLd";
import { WhatsAppLink } from "@/components/WhatsApp";
import { FAQ } from "@/lib/faq";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = getDb();
  const [products, business, zones, posts] = await Promise.all([
    listProducts(),
    getSetting("business"),
    db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true)).orderBy(asc(schema.deliveryZones.sort)),
    db.select().from(schema.journalPosts).where(eq(schema.journalPosts.published, true)).orderBy(asc(schema.journalPosts.sort)),
  ]);
  const letter = products.find((p) => p.kind === "letter");
  const gifts = products.filter((p) => p.kind !== "letter" && p.kind !== "flower");
  const flowers = products.filter((p) => p.kind === "flower");
  const goldCard = products.find((p) => p.kind === "gold_card");
  const claims = business.claims.filter((c) => c.verified);
  const prices = products.flatMap((p) => p.variants.filter((v) => v.price != null && v.priceStatus !== "quote").map((v) => v.price!));
  const fixedZones = zones.filter((z) => z.mode === "fixed");
  const wa = business.whatsapp;

  const stats = [
    { num: "Est. 2025", lbl: "Made by hand in Lagos" },
    { num: "48 hrs", lbl: "Most orders ready" },
    { num: "Nationwide", lbl: "Delivery across Nigeria" },
    ...claims.map((c) => ({ num: c.value, lbl: c.label })),
  ];

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "LocalBusiness", "@id": `${appUrl()}/#business`,
        name: "Love Lives Here", url: appUrl(), image: `${appUrl()}/images/og-love-lives-here.jpg`,
        description: "Handwritten love letters and thoughtful gifts in Lagos, Nigeria. Sealed in wax, delivered across Lagos and nationwide.",
        telephone: `+${business.whatsapp}`, email: business.email,
        address: { "@type": "PostalAddress", addressLocality: "Lagos", addressRegion: "Lagos", addressCountry: "NG" },
        areaServed: [{ "@type": "City", name: "Lagos" }, { "@type": "Country", name: "Nigeria" }],
        sameAs: [business.instagram, business.tiktok, business.substackProfile],
        ...(prices.length ? { priceRange: `${formatNaira(Math.min(...prices))} – ${formatNaira(Math.max(...prices))}` } : {}),
        openingHours: ["Mo-Fr 08:00-16:00", "Sa 10:00-14:00", "Su 14:00-16:00"],
      }} />

      <section className="hero" aria-labelledby="hero-h">
        <div className="box hero-in">
          <div className="hero-txt">
            <span className="lab">Heartfelt letters, made for them</span>
            <h1 id="hero-h">Say it on <i>paper.</i></h1>
            <p>Handwritten love letters and thoughtful gifts, sealed in wax and delivered to their door — across Lagos and all of Nigeria.</p>
            <div className="hero-btns">
              <Link className="btn btn-light" href="/letter">Write a letter</Link>
              <Link className="btn btn-line" href="/shop">Shop gifts</Link>
            </div>
          </div>
          <div className="hero-art">
            <Image src="/images/hand-holding-wax-sealed-love-letters.jpg" alt="A hand holding two kraft envelopes sealed with burgundy LLH wax seals" fill priority fetchPriority="high" sizes="(min-width: 900px) 50vw, 100vw" />
          </div>
        </div>
      </section>

      <section className="stats" aria-label="About Love Lives Here">
        <div className="box" style={{ ["--n" as string]: stats.length }}>
          {stats.map((s) => <div className="stat-i" key={s.lbl}><span className="num">{s.num}</span><span className="lbl">{s.lbl}</span></div>)}
        </div>
      </section>

      {letter && (
        <section className="feature-band" aria-labelledby="letter-h">
          <div className="box feature">
            <div className="pic">
              {letter.images[0] && <Image src={letter.images[0].src} alt={letter.images[0].alt} fill sizes="(min-width: 900px) 45vw, 92vw" />}
              {letter.badge && <span className="tag">{letter.badge}</span>}
            </div>
            <div className="stack" style={{ gap: 18 }}>
              <span className="lab" style={{ color: "var(--gold)" }}>The heart of it</span>
              <h2 id="letter-h">The Letter</h2>
              <p style={{ margin: 0 }}>{letter.tagline}. Write it yourself, or tell us about them and we'll find the words. You read it before we seal it.</p>
              {letter.variants[0]?.price != null && <span className="price">{formatNaira(letter.variants[0].price)}</span>}
              <div className="row">
                <Link className="btn btn-gold" href="/letter">Start this letter</Link>
                <Link className="btn btn-line" href={`/shop/${letter.slug}`}>See details</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="sec" id="shop" aria-labelledby="shop-h">
        <div className="box">
          <div className="head"><span className="lab">The collection</span><h2 id="shop-h">Choose what to send</h2>
            <p className="muted" style={{ margin: 0, maxWidth: "60ch" }}>Send a gift on its own, or add it to a letter. Everything is made in Lagos.</p></div>
          <div className="grid">
            {gifts.map((p) => <ProductCard key={p.id} p={toClient(p)} whatsapp={wa} />)}
            <WhatsAppLink className="ask" number={wa} text="Hi LLH, I'm not sure what to send. Can you help me choose?">
              <strong>Not sure what to send?</strong><span>Tell us about them on WhatsApp. We'll help you choose.</span><em>Ask us</em>
            </WhatsAppLink>
          </div>
        </div>
      </section>

      {flowers.length > 0 && (
        <section className="sec" id="flowers" aria-labelledby="flowers-h" style={{ paddingTop: 0 }}>
          <div className="box">
            <Carousel id="fcar" label="Flowers" heading={<div className="head" style={{ margin: 0 }}><span className="lab">Add flowers</span><h2 id="flowers-h" style={{ fontSize: "clamp(28px,3.4vw,42px)" }}>Say it with <i>flowers too</i></h2></div>}>
              {flowers.map((p) => <ProductCard key={p.id} p={toClient(p)} whatsapp={wa} flower />)}
            </Carousel>
            <p className="hint" style={{ marginTop: 12 }}>Bigger bouquets on request — <WhatsAppLink number={wa} text="Hi LLH, I'd like a bigger bouquet.">ask us on WhatsApp</WhatsAppLink>.</p>
          </div>
        </section>
      )}

      <section className="sec dark" id="tag" aria-labelledby="gc-h">
        <div className="box tag-in">
          <figure className="tagshow">
            <Image src="/images/llh-gold-card-nfc.jpg" alt="The Love Lives Here Gold Card, printed “A letter is waiting for you”" width={1000} height={631} sizes="(min-width: 900px) 40vw, 90vw" />
          </figure>
          <div className="tag-txt">
            <span className="lab">The Gold Card</span>
            <h2 id="gc-h">A letter that keeps talking after it&apos;s <i>opened.</i></h2>
            <p>A gold card that comes with your gift. They tap it with their phone, and a note from you opens on screen. Each time they tap, it can show a different message, depending on the time of day.</p>
            <ol className="steps3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li className="st"><svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true"><rect width="80" height="80" fill="#4A1220" /><rect x="14" y="28" width="52" height="34" fill="#FFF8F1" /><rect x="22" y="22" width="36" height="22" rx="3" fill="#E2BE78" /></svg><div><h3>1. A gold card arrives</h3><span>Tucked in with your gift.</span></div></li>
              <li className="st"><svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true"><rect width="80" height="80" fill="#4A1220" /><rect x="12" y="34" width="38" height="24" rx="3" fill="#E2BE78" /><rect x="40" y="14" width="26" height="50" rx="5" fill="#0B0607" /></svg><div><h3>2. They tap it with their phone</h3><span>No app, no download. A printed QR code works too.</span></div></li>
              <li className="st"><svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true"><rect width="80" height="80" fill="#4A1220" /><rect x="26" y="8" width="28" height="64" rx="5" fill="#0B0607" /><rect x="30" y="16" width="20" height="44" rx="2" fill="#7E1426" /></svg><div><h3>3. A note from you opens</h3><span>Add your voice, photos or a song.</span></div></li>
            </ol>
            <div className="row">
              <Link className="btn btn-gold" href="/gold-card">How the Gold Card works</Link>
              {goldCard?.variants[0]?.price != null && <span style={{ color: "var(--on-dark-muted)" }}>{formatNaira(goldCard.variants[0].price)}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="how" aria-labelledby="how-h">
        <div className="box stack" style={{ gap: 22, maxWidth: 820, marginInline: "auto" }}>
          <span className="lab">How it works</span>
          <h2 id="how-h">One message. <i>48 to 72 hours.</i></h2>
          <p className="muted" style={{ margin: 0 }}>Tell us what you want to say. Every letter is written for one person, never copied. It arrives sealed in wax.</p>
          <ol className="flow" aria-label="From written to delivered">
            {["Written", "Sealed", "Packed", "Delivered"].map((s, i) => (
              <li className="fs" key={s}><span className="fi" style={i === 3 ? { background: "#E2BE78" } : undefined} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={i === 3 ? "#2A0C13" : "#FFF4EE"} strokeWidth="1.6"><circle cx="12" cy="12" r={4 + i} /></svg></span><span className="fl">{s}</span></li>
            ))}
          </ol>
          <div className="dlv">
            <span className="lab">How delivery works</span>
            <ol>
              <li><b>Pick your date.</b> Choose the day you want it to arrive when you order.</li>
              <li><b>Approve your letter.</b> We send you the words first. Nothing is sealed until you say yes.</li>
              <li><b>Sealed and packed.</b> Wax seal, then the box, then it goes out with a rider.</li>
              <li><b>Arrives on your date</b> in Lagos. The fee is fixed by area, so you know the full price before you pay.</li>
            </ol>
          </div>
          <Link className="btn btn-dark" href="/letter" style={{ alignSelf: "flex-start" }}>Send your first message</Link>
        </div>
      </section>

      <section className="sec blush" aria-labelledby="proof-h">
        <div className="box">
          <div className="head"><span className="lab">From the people who opened them</span><h2 id="proof-h">What happens when <i>they read it</i></h2></div>
          <p className="quote">&ldquo;She really really loved it o. Especially the note.&rdquo;</p>
          <div className="tms">
            <figure className="tm">
              <div className="tm-chat"><div className="tb in">Hey man, should have messaged you since, I just got back</div><div className="tb in">She really really loved it o<br />Especially the note<small>21:34</small></div></div>
              <figcaption>From a customer, after his letter was delivered</figcaption>
            </figure>
            <figure className="tm">
              <div className="tm-chat">
                <div className="tb in">I see your workings ohh 🥺</div><div className="tb out">What did I do this time?</div>
                <div className="tb in">The gifts are soo gorgeous</div><div className="tb in">My babe did his big one</div>
                <div className="tb in">And thank you for curating it 🥺</div><div className="tb out">So you love it?</div>
                <div className="tb in">Yup like mad</div><div className="tb in">My big Igbo boy ❤️<small>11:08</small></div>
              </div>
              <figcaption>From the person who received it</figcaption>
            </figure>
          </div>
          <p className="hint center" style={{ marginTop: 20 }}>Real messages, shared with permission. Names hidden.</p>
        </div>
      </section>

      <section className="sec" id="delivery" aria-labelledby="del-h">
        <div className="box">
          <div className="head"><span className="lab">Delivery and hours</span><h2 id="del-h">Where we deliver, <i>and when</i></h2>
            <p className="muted" style={{ margin: 0, maxWidth: "60ch" }}>One fixed fee per area, so you know the full price before you pay. No surprises at the door.</p></div>
          <div className="dz">
            <div>
              <h3 className="sr-only">Delivery fees by area</h3>
              {fixedZones.map((z) => <div className="zr2" key={z.id}><span>{z.name}</span><span className="fee">{formatNaira(z.fee)}</span></div>)}
              <div className="zr2 muted"><span>Not on the list, or another state?</span><span>We&apos;ll quote before you pay</span></div>
              <p className="hint" style={{ marginTop: 12 }}>See the <Link href="/delivery">delivery policy</Link> for timings, rider contact and what happens if no one is home.</p>
            </div>
            <aside className="hours" aria-labelledby="hours-h">
              <span className="lab">Working hours</span>
              <h3 id="hours-h" className="sr-only">Working hours</h3>
              {business.hours.map((h) => <div className="hr" key={h.days}><span>{h.days}</span><b>{h.time}</b></div>)}
              <p>Message us any time. Messages outside these hours are answered first thing the next working day.</p>
              <p>Every letter is made one at a time, so places for big days like Valentine&apos;s are limited. <b style={{ color: "var(--gold)" }}>Order early.</b></p>
            </aside>
          </div>
        </div>
      </section>

      <section className="sec blush" aria-labelledby="brief-h">
        <div className="box" style={{ display: "grid", gap: 24, alignItems: "center", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
          <div className="stack">
            <span className="lab">Need help with the words?</span>
            <h2 id="brief-h">Don&apos;t know what to say? <i>Talk to us.</i></h2>
            <p className="muted" style={{ margin: 0 }}>Answer a few questions about them and your story. We&apos;ll find the words and send you the letter to read before anything is sealed. We never invent memories — the details come from you.</p>
          </div>
          <div className="stack">
            <Link className="btn btn-dark" href="/letter?mode=help_me">Help me find the words</Link>
            <WhatsAppLink className="btn btn-ghost" number={wa} text="Hi LLH, I want to send a letter but I don't know what to say.">Or just chat with us on WhatsApp</WhatsAppLink>
          </div>
        </div>
      </section>

      <section className="sec" id="journal" aria-labelledby="journal-h">
        <div className="box">
          {posts.length > 0 ? (
            <Carousel id="ncar" label="Dear Lovers posts" heading={<div className="head" style={{ margin: 0 }}><span className="lab">From Dear Lovers</span><h2 id="journal-h">Notes on <i>saying it</i></h2></div>}>
              {posts.map((p, i) => (
                <div className="notes" key={p.id}>
                  <a href={p.url!} rel="noopener noreferrer" target="_blank" style={{ background: ["#F2DCD6", "#7E1426", "#F3E4C4", "#4A1220"][i % 4], color: i % 2 ? "#FFF4EE" : "#2A0C13" }}>
                    <small>{p.label}</small><span>{p.title}</span>
                  </a>
                </div>
              ))}
            </Carousel>
          ) : (
            <div className="stack" style={{ maxWidth: 640 }}>
              <span className="lab">From Dear Lovers</span>
              <h2 id="journal-h">Notes on <i>saying it</i></h2>
              <p className="muted" style={{ margin: 0 }}>Prompts, stories and guides to writing what you feel — on our Substack.</p>
              <a className="btn btn-ghost" style={{ alignSelf: "flex-start" }} href={business.substackProfile} rel="noopener noreferrer" target="_blank">Read Dear Lovers on Substack</a>
            </div>
          )}
        </div>
      </section>

      <section className="join" id="join" aria-labelledby="join-h">
        <div className="box">
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <h2 id="join-h" style={{ fontSize: "clamp(28px,3vw,40px)" }}>Letters from us, now and then.</h2>
            <p className="muted" style={{ margin: 0 }}>Join Dear Lovers for prompts, stories and first access to Valentine&apos;s slots.</p>
          </div>
          <NewsletterForm source="home" />
        </div>
      </section>

      <section className="sec faq" id="faq" aria-labelledby="faq-h">
        <div className="box">
          <div className="head"><span className="lab">Good to know</span><h2 id="faq-h">Questions, <i>answered</i></h2></div>
          {FAQ.slice(0, 6).map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          <p style={{ marginTop: 20 }}><Link href="/faq">All questions</Link> · <Link href="/contact">Contact us</Link></p>
        </div>
      </section>
    </>
  );
}
