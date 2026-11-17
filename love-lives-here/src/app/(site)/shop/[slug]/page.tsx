import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, relatedProducts, fromPrice, bundleContents } from "@/lib/catalog";
import { toClient } from "@/lib/present";
import { getSetting } from "@/lib/settings";
import { appUrl } from "@/lib/config";
import { AddToBag } from "@/components/AddToBag";
import { Gallery } from "@/components/Gallery";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { TagArt } from "@/components/TagArt";
import { ViewTracker } from "@/components/ViewTracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { title: "Not found", robots: { index: false } };
  const img = p.images[0];
  return {
    title: p.seoTitle ?? p.name,
    description: p.seoDescription ?? p.tagline,
    alternates: { canonical: `/shop/${p.slug}` },
    openGraph: { type: "website", title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.tagline, url: `/shop/${p.slug}`, images: img ? [{ url: img.src, width: img.width, height: img.height, alt: img.alt }] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const [related, business, bundle] = await Promise.all([relatedProducts(p.id), getSetting("business"), p.kind === "bundle" ? bundleContents([p.id]).then((m) => m.get(p.id) ?? []) : Promise.resolve([])]);
  const cp = toClient(p);
  const low = fromPrice(p);
  const offers = p.variants.filter((v) => v.price != null && v.priceStatus !== "quote");

  return (
    <div className="box has-sticky">
      <ViewTracker product={p.slug} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description || p.tagline,
        image: p.images.map((i) => `${appUrl()}${i.src}`), sku: p.variants[0]?.sku, brand: { "@type": "Brand", name: "Love Lives Here" },
        url: `${appUrl()}/shop/${p.slug}`,
        // Offers only for real, payable prices. No ratings: none are verified.
        ...(offers.length ? {
          offers: offers.length === 1
            ? { "@type": "Offer", price: (offers[0].price! / 100).toFixed(2), priceCurrency: "NGN", availability: offers[0].stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: `${appUrl()}/shop/${p.slug}`, seller: { "@id": `${appUrl()}/#business` } }
            : { "@type": "AggregateOffer", lowPrice: (Math.min(...offers.map((o) => o.price!)) / 100).toFixed(2), highPrice: (Math.max(...offers.map((o) => o.price!)) / 100).toFixed(2), offerCount: offers.length, priceCurrency: "NGN" },
        } : {}),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Shop", item: `${appUrl()}/shop` },
          ...(p.category ? [{ "@type": "ListItem", position: 2, name: p.category.name, item: `${appUrl()}/shop?c=${p.category.slug}` }] : []),
          { "@type": "ListItem", position: p.category ? 3 : 2, name: p.name },
        ],
      }} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/shop">Shop</Link></li>
          {p.category && <li><Link href={`/shop?c=${p.category.slug}`}>{p.category.name}</Link></li>}
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>
      <div className="pdp">
        <div>
          {p.images.length ? <Gallery images={p.images.map((i) => ({ src: i.src, alt: i.alt, width: i.width, height: i.height }))} name={p.name} />
            : <div style={{ aspectRatio: "300 / 340" }}>{p.kind === "llh_tag" && <TagArt />}</div>}
        </div>
        <div className="pdp-info">
          {p.badge && <span className="lab">{p.badge}</span>}
          <h1 style={{ fontSize: "clamp(32px, 4.4vw, 52px)" }}>{p.name}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 17 }}>{p.tagline}</p>
          {low == null && <p className="alert info" style={{ margin: 0 }}>This is priced on request. Message us and we&apos;ll give you a price for the size you want.</p>}
          <div className="sticky-buy"><AddToBag product={cp} whatsapp={business.whatsapp} showQty={p.kind !== "letter"} /></div>
          <div>{p.description.split("\n").map((para, i) => <p key={i}>{para}</p>)}</div>
          {bundle.length > 0 && (
            <div><h2 style={{ fontSize: 20, marginBottom: 6 }}>In this bundle</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{bundle.map((b) => <li key={b.variantId}>{b.quantity > 1 ? `${b.quantity} × ` : ""}{b.productName}{b.variantName !== b.productName ? ` — ${b.variantName}` : ""}</li>)}</ul>
            </div>
          )}
          <div className="facts">
            <div><span aria-hidden="true">✦</span><span>Made to order in about {p.productionDays} working day{p.productionDays === 1 ? "" : "s"}, then delivered on the date you choose.</span></div>
            {p.requiresApproval && <div><span aria-hidden="true">✦</span><span>You read the words first. Nothing is sealed until you approve.</span></div>}
            {p.nfc === "gold_card" && <div><span aria-hidden="true">✦</span><span>After you order, add your note, photos, a voice message or a playlist from your order page. <Link href="/gold-card">How it works</Link>.</span></div>}
            {p.nfc === "llh_tag" && <div><span aria-hidden="true">✦</span><span>After you order, tell us the link it should open. You can change it later.</span></div>}
            <div><span aria-hidden="true">✦</span><span>Lagos delivery fee is fixed by area and shown before you pay. <Link href="/delivery">Delivery details</Link>.</span></div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="sec-tight" aria-labelledby="rel-h">
          <h2 id="rel-h" style={{ fontSize: "clamp(26px,3vw,36px)", marginBottom: 20 }}>Goes well with</h2>
          <div className="grid">{related.slice(0, 3).map((r) => <ProductCard key={r.id} p={toClient(r)} whatsapp={business.whatsapp} flower={r.kind === "flower"} />)}</div>
        </section>
      )}
    </div>
  );
}
