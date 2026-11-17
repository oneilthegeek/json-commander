import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buyerCard } from "./access";
import { buyerOp } from "./actions";
import { CardEditor } from "@/components/CardEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your card", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function BuyerCardPage({ params, searchParams }: { params: Promise<{ number: string; id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { number, id } = await params;
  const { t = "" } = await searchParams;
  const ctx = await buyerCard(number, id, t);
  if (!ctx) notFound();
  const { e } = ctx;
  const bind = (op: Parameters<typeof buyerOp>[3]) => buyerOp.bind(null, number, id, t, op);
  const q = `?t=${encodeURIComponent(t)}`;
  return (
    <section className="sec" aria-labelledby="bc-h">
      <div className="box narrow" style={{ marginInline: "auto" }}>
        <p><Link href={`/orders/${number}${q}`}>← Back to order {number}</Link></p>
        <div className="head">
          <span className="lab">{e.kind === "gold_card" ? "Your Gold Card" : "Your LLH Tag"}</span>
          <h1 id="bc-h">{e.kind === "gold_card" ? <>What opens when <i>they tap it</i></> : <>Where the tag <i>takes them</i></>}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {e.status === "active" ? "This card is live. Changes show the next time it's tapped." : "We'll check everything and switch it on before delivery."} Only you (with this private link) and our team can see this page.
          </p>
        </div>
        {!e.buyerCanEdit ? <p className="alert">Editing is closed for this card. Message us if you need a change.</p> : (
          <CardEditor e={e} items={e.items} mediaUrl={(a) => `/orders/${number}/card/${id}/media/${a}${q}`}
            ops={{ details: bind("details"), note: bind("note"), link: bind("link"), photo: bind("photo"), audio: bind("audio"), remove: bind("remove"), redirect: bind("redirect") }} />
        )}
        {e.kind === "gold_card" && <p style={{ marginTop: 24 }}><Link className="btn btn-ghost" href={`/orders/${number}/card/${id}/preview${q}`}>Preview what they&apos;ll see</Link></p>}
      </div>
    </section>
  );
}
