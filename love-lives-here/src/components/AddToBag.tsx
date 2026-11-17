"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";
import { track } from "./track";
import { formatNaira } from "@/lib/money";
import { waLink } from "@/lib/wa";
import type { ClientProduct } from "@/lib/present";

type Props = { product: ClientProduct; whatsapp: string; compact?: boolean; showQty?: boolean };

export function AddToBag({ product, whatsapp, compact, showQty }: Props) {
  const { add } = useCart();
  const first = product.variants.find((v) => v.purchasable) ?? product.variants[0];
  const [vid, setVid] = useState(first?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = product.variants.find((x) => x.id === vid) ?? first;
  if (!v) return null;
  const isLetter = product.kind === "letter";
  const multi = product.variants.length > 1;
  const quote = v.priceStatus === "quote" || v.price == null;

  const choose = (id: string) => { setVid(id); setAdded(false); track("variant_select", { product: product.slug }); };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {multi && (compact ? (
        <label className="f">
          <span className="hint">{product.optionLabel}</span>
          <select className="input" value={vid} onChange={(e) => choose(e.target.value)} aria-label={`${product.optionLabel} for ${product.name}`}>
            {product.variants.map((x) => (
              <option key={x.id} value={x.id}>{x.name}{x.price != null && x.priceStatus !== "quote" ? ` · ${formatNaira(x.price)}` : " · price on request"}</option>
            ))}
          </select>
        </label>
      ) : (
        <fieldset className="opts">
          <legend>{product.optionLabel}</legend>
          {product.variants.map((x) => (
            <label className="opt" key={x.id}>
              <input type="radio" name={`v-${product.id}`} value={x.id} checked={x.id === vid} onChange={() => choose(x.id)} />
              <span><b>{x.name}</b><small>{x.price != null && x.priceStatus !== "quote" ? formatNaira(x.price) : "Price on request"}{x.stockNote ? ` · ${x.stockNote}` : ""}</small></span>
            </label>
          ))}
        </fieldset>
      ))}

      <div className="row between">
        <span className="price" aria-live="polite">{quote ? "Price on request" : formatNaira(v.price! * qty)}{qty > 1 && !quote ? <span className="price-note"> ({qty} × {formatNaira(v.price)})</span> : null}</span>
        {v.stockNote && <span className="badge warn">{v.stockNote}</span>}
      </div>

      {quote ? (
        <a className="btn btn-ghost" href={waLink(whatsapp, `Hi LLH, could I get a price for ${product.name} (${v.name})?`)} rel="noopener noreferrer" target="_blank" onClick={() => track("whatsapp_click", { product: product.slug })}>
          Ask for a price on WhatsApp
        </a>
      ) : isLetter ? (
        <Link className="btn btn-dark" href="/letter">Start this letter</Link>
      ) : (
        <div className="row" style={{ gap: 10 }}>
          {showQty && (
            <div className="qty" role="group" aria-label="Quantity">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">−</button>
              <output aria-live="polite">{qty}</output>
              <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} disabled={qty >= 20} aria-label="Increase quantity">+</button>
            </div>
          )}
          <button className={`btn ${compact ? "btn-ghost btn-sm" : "btn-dark"}`} style={{ flex: 1 }} type="button" disabled={!v.purchasable}
            onClick={() => {
              add({ variantId: v.id, quantity: qty, productSlug: product.slug, productName: product.name, variantName: v.name, kind: product.kind, image: product.image?.src ?? null, unitPrice: v.price! });
              setAdded(true);
            }}>
            {v.purchasable ? (added ? "Added — add another" : "Add to bag") : "Sold out"}
          </button>
        </div>
      )}
      {added && <p className="small" role="status"><Link href="/cart">View your bag</Link> or keep browsing.</p>}
    </div>
  );
}
