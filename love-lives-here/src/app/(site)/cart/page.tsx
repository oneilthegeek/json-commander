"use client";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart";
import { useQuote } from "@/components/useQuote";
import { formatNaira } from "@/lib/money";

export default function CartPage() {
  const cart = useCart();
  const { quote, loading, error } = useQuote(cart.lines, null, cart.ready);
  const priced = new Map(quote?.lines.map((l) => [l.variantId, l]) ?? []);
  const problems = quote?.errors ?? [];
  const hasLetter = cart.lines.some((l) => l.kind === "letter");

  return (
    <section className="sec" aria-labelledby="cart-h">
      <div className="box">
        <div className="head"><span className="lab">Your bag</span><h1 id="cart-h">Your <i>bag</i></h1></div>
        {!cart.ready ? <p className="muted">Loading your bag…</p> : cart.lines.length === 0 ? (
          <div className="stack" style={{ maxWidth: 520 }}>
            <p className="muted">Your bag is empty.</p>
            <div className="row"><Link className="btn btn-dark" href="/letter">Write a letter</Link><Link className="btn btn-ghost" href="/shop">Browse gifts</Link></div>
          </div>
        ) : (
          <div className="co">
            <div>
              {problems.length > 0 && <div className="alert" role="alert">{problems.map((p, i) => <p key={i} style={{ margin: 0 }}>{p.message}</p>)}</div>}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Items in your bag">
                {cart.lines.map((l) => {
                  const p = priced.get(l.variantId);
                  const bad = problems.some((e) => e.variantId === l.variantId);
                  return (
                    <li className="line" key={l.variantId}>
                      <div className="thumb">{l.image && <Image src={l.image} alt="" fill sizes="72px" />}</div>
                      <div className="stack" style={{ gap: 6 }}>
                        <Link href={`/shop/${l.productSlug}`} style={{ fontWeight: 500 }}>{l.productName}</Link>
                        <span className="hint">{l.variantName}{p ? ` · ${formatNaira(p.unitPrice)} each` : ""}</span>
                        {l.kind === "letter" ? (
                          <span className="hint">{cart.letter ? <>Your letter details are saved. <Link href="/letter">Edit</Link></> : <><strong className="err">Tell us what to write.</strong> <Link href="/letter">Start your letter</Link></>}</span>
                        ) : (
                          <div className="qty" role="group" aria-label={`Quantity of ${l.productName}`}>
                            <button type="button" aria-label="Decrease quantity" disabled={l.quantity <= 1} onClick={() => cart.setQty(l.variantId, l.quantity - 1)}>−</button>
                            <output aria-live="polite">{l.quantity}</output>
                            <button type="button" aria-label="Increase quantity" disabled={l.quantity >= 20} onClick={() => cart.setQty(l.variantId, l.quantity + 1)}>+</button>
                          </div>
                        )}
                        <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => cart.remove(l.variantId)} aria-label={`Remove ${l.productName}, ${l.variantName}`}>Remove</button>
                      </div>
                      <div className="price">{bad ? <span className="err">Unavailable</span> : p ? formatNaira(p.lineTotal) : "…"}</div>
                    </li>
                  );
                })}
              </ul>
              {!hasLetter && <p className="alert info" style={{ marginTop: 20 }}>Want to say something with it? <Link href="/letter">Add a handwritten letter</Link>.</p>}
            </div>
            <aside className="panel stack" aria-labelledby="sum-h">
              <h2 id="sum-h" style={{ fontSize: 24 }}>Summary</h2>
              <div className="sum" aria-live="polite" aria-busy={loading}>
                <div className="sr"><span>Items</span><span data-testid="cart-subtotal">{quote ? formatNaira(quote.subtotal) : "…"}</span></div>
                <div className="sr muted"><span>Delivery</span><span>Chosen at checkout</span></div>
              </div>
              {error && <p className="err" role="alert">{error}</p>}
              <Link className="btn btn-dark btn-block" href="/checkout" aria-disabled={problems.length > 0 || (hasLetter && !cart.letter)}
                onClick={(e) => { if (problems.length > 0 || (hasLetter && !cart.letter)) e.preventDefault(); }}>
                Check out
              </Link>
              {hasLetter && !cart.letter && <p className="hint">Finish your letter details before checking out.</p>}
              <Link href="/shop" className="small">Continue shopping</Link>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
