import type { Metadata } from "next";
import Link from "next/link";
import { listProducts } from "@/lib/catalog";
import { toClient } from "@/lib/present";
import { getSetting } from "@/lib/settings";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop personalised gifts in Lagos",
  description: "Handwritten letters, Secret Candles with hidden messages, the NFC Gold Card, LLH Tags and flowers — personalised gifts made in Lagos and delivered across Nigeria.",
  alternates: { canonical: "/shop" },
};

const FILTERS = [
  { c: "", label: "All" },
  { c: "letters", label: "Letters" },
  { c: "candles", label: "Candles" },
  { c: "gold-card", label: "Gold Card" },
  { c: "llh-tag", label: "LLH Tag" },
  { c: "flowers", label: "Flowers" },
];

export default async function Shop({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c = "" } = await searchParams;
  const [all, business] = await Promise.all([listProducts(), getSetting("business")]);
  const products = c ? all.filter((p) => p.category?.slug === c) : all;
  const active = FILTERS.find((f) => f.c === c) ?? FILTERS[0];

  return (
    <section className="sec" aria-labelledby="shop-h">
      <div className="box">
        <div className="head"><span className="lab">The collection</span><h1 id="shop-h">{active.c ? active.label : <>Choose what <i>to send</i></>}</h1>
          <p className="muted" style={{ margin: 0, maxWidth: "60ch" }}>Every gift can be sent on its own or with a letter. Delivered across Lagos, and nationwide on request.</p></div>
        <nav className="pills" aria-label="Filter products">
          {FILTERS.map((f) => (
            <Link key={f.label} className="pill" href={f.c ? `/shop?c=${f.c}` : "/shop"} aria-current={f.c === active.c ? "page" : undefined} scroll={false}>{f.label}</Link>
          ))}
        </nav>
        {products.length === 0 ? (
          <p className="muted">Nothing here right now. <Link href="/shop">See everything</Link>.</p>
        ) : (
          <div className="grid">
            {products.map((p) => <ProductCard key={p.id} p={toClient(p)} whatsapp={business.whatsapp} flower={p.kind === "flower"} />)}
          </div>
        )}
      </div>
    </section>
  );
}
