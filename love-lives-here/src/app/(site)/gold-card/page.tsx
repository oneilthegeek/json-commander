import type { Metadata } from "next";
import Image from "next/image";
import { getProduct } from "@/lib/catalog";
import { toClient } from "@/lib/present";
import { getSetting } from "@/lib/settings";
import { AddToBag } from "@/components/AddToBag";
import { TagArt } from "@/components/TagArt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Gold Card and LLH Tag — NFC gifts that open your message",
  description: "Tap-to-open NFC gifts from Love Lives Here. The Gold Card opens a private page with your note, photos, voice and playlist. The LLH Tag opens one link you choose.",
  alternates: { canonical: "/gold-card" },
};

export default async function GoldCard() {
  const [card, tag, b] = await Promise.all([getProduct("gold-card"), getProduct("llh-tag"), getSetting("business")]);
  return (
    <>
      <section className="sec dark" aria-labelledby="gc-h">
        <div className="box tag-in">
          <figure className="tagshow"><Image src="/images/llh-gold-card-nfc.jpg" alt="The Love Lives Here Gold Card, printed “A letter is waiting for you”" width={1000} height={631} priority sizes="(min-width: 900px) 40vw, 90vw" /></figure>
          <div className="tag-txt">
            <span className="lab">Only at LLH</span>
            <h1 id="gc-h" style={{ fontSize: "clamp(34px,5vw,56px)" }}>A letter that keeps talking after it&apos;s <i>opened.</i></h1>
            <p>They tap the card with their phone and a private page opens with your words. Add your voice, your photos, your songs — and different notes for morning and night.</p>
            {card && <div style={{ maxWidth: 420 }} className="panel"><AddToBag product={toClient(card)} whatsapp={b.whatsapp} /></div>}
          </div>
        </div>
      </section>
      <section className="sec" aria-labelledby="diff-h">
        <div className="box stack" style={{ gap: 28 }}>
          <h2 id="diff-h">Gold Card or LLH Tag?</h2>
          <div className="fg2">
            <div className="panel stack">
              <h3>The Gold Card</h3>
              <ul>
                <li>A gold card that arrives with your gift.</li>
                <li>Opens a private LLH page made for them: notes, photos, a voice note, a playlist.</li>
                <li>Can show a different note in the morning, afternoon, evening or at night (Lagos time).</li>
                <li>Optional secret word, start date or end date.</li>
                <li>You add or change the content from your order page.</li>
              </ul>
            </div>
            <div className="panel stack">
              <div style={{ width: 120 }}><TagArt /></div>
              <h3>The LLH Tag</h3>
              <ul>
                <li>A round sticker they can put anywhere.</li>
                <li>Opens one link you choose — a playlist, a video, a shared album.</li>
                <li>We can change where it points later, without replacing the tag.</li>
              </ul>
              {tag && <AddToBag product={toClient(tag)} whatsapp={b.whatsapp} compact />}
            </div>
          </div>
          <div className="stack">
            <h2 style={{ fontSize: "clamp(26px,3vw,36px)" }}>How it works</h2>
            <ol className="dlv" aria-label="Steps">
              <li><b>Order the card.</b> After you pay, your order page shows a “Gold Card” section.</li>
              <li><b>Add what you want them to see.</b> Type your notes, upload photos or a voice note, paste a playlist link. Preview it any time.</li>
              <li><b>We check it and switch it on.</b> Each card gets its own long, private link that can&apos;t be guessed.</li>
              <li><b>They tap it.</b> Most phones open it with a tap: iPhone XR and newer, and Android phones with NFC switched on. Every card also comes with a QR code for phones that can&apos;t tap.</li>
            </ol>
            <p className="hint">The card needs an internet connection to open its page. Nothing to install.</p>
          </div>
        </div>
      </section>
    </>
  );
}
