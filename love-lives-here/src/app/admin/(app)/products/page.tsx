import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listProducts } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { ActionForm } from "@/components/ActionForm";
import { createProduct, saveVariant } from "../actions";

export const metadata = { title: "Products" };

export default async function Products() {
  const s = await requireStaff("orders.view");
  const products = await listProducts({ includeInactive: true });
  const canPrice = can(s.role, "products.edit"), canStock = can(s.role, "inventory.edit");
  const unverified = products.flatMap((p) => p.variants).filter((v) => v.priceStatus === "unverified" && v.active).length;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 style={{ fontSize: 36 }}>Products &amp; stock</h1>
      {unverified > 0 && <p className="alert warn"><strong>{unverified} prices came from the old website and haven&apos;t been confirmed.</strong> They&apos;re shown to customers and can be paid. Check each one and set it to “Confirmed”, change it, or switch it to “Request a quote”.</p>}
      <p className="hint">Stock: leave blank for made-to-order items (no limit). Customers can&apos;t buy more than the stock number, and stock goes down when a payment is confirmed.</p>
      {products.map((p) => (
        <section key={p.id} className="card" aria-labelledby={`p-${p.id}`}>
          <div className="row between">
            <h2 id={`p-${p.id}`}>{p.name} {!p.active && <span className="badge bad">hidden</span>}</h2>
            <div className="row">{canPrice && <Link href={`/admin/products/${p.id}`}>Edit details</Link>}<Link href={`/shop/${p.slug}`} target="_blank">View</Link></div>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Option</th><th>Price (₦)</th><th>Price status</th><th>Stock</th><th>On sale</th><th></th></tr></thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.id}>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <ActionForm action={saveVariant.bind(null, v.id)} submit="Save" className="inline-form" submitClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="stockWas" value={v.stock ?? ""} /><input type="hidden" name="priceWas" value={v.price ?? ""} />
                        <div className="f" style={{ flex: "2 1 140px" }}><label htmlFor={`n-${v.id}`} className="sr-only">Option name</label><input id={`n-${v.id}`} name="name" type="text" defaultValue={v.name} disabled={!canPrice} /></div>
                        <div className="f"><label htmlFor={`pr-${v.id}`} className="sr-only">Price</label><input id={`pr-${v.id}`} name="price" type="text" inputMode="decimal" defaultValue={v.price != null ? String(v.price / 100) : ""} placeholder={typeof v.attributes?.sourcePlaceholder === "number" ? `old placeholder ${formatNaira(Number(v.attributes.sourcePlaceholder) * 100)}` : "—"} disabled={!canPrice} /></div>
                        <div className="f"><label htmlFor={`ps-${v.id}`} className="sr-only">Price status</label>
                          <select id={`ps-${v.id}`} name="priceStatus" defaultValue={v.priceStatus} disabled={!canPrice}><option value="confirmed">Confirmed</option><option value="unverified">Unverified (from old site)</option><option value="quote">Request a quote</option></select></div>
                        <div className="f" style={{ flex: "0 1 90px" }}><label htmlFor={`st-${v.id}`} className="sr-only">Stock</label><input id={`st-${v.id}`} name="stock" type="text" inputMode="numeric" defaultValue={v.stock ?? ""} placeholder="no limit" disabled={!canStock} /></div>
                        <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="active" defaultChecked={v.active} disabled={!canPrice} /> On sale</label>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {canPrice && (
        <section className="card" aria-labelledby="new-h">
          <h2 id="new-h">Add a product</h2>
          <ActionForm action={createProduct} submit="Create (hidden until you switch it on)">
            <div className="fg2">
              <div className="f"><label htmlFor="np-name">Name</label><input id="np-name" name="name" type="text" required /></div>
              <div className="f"><label htmlFor="np-kind">Type</label><select id="np-kind" name="kind"><option value="other">Other gift</option><option value="bundle">Curated bundle</option><option value="flower">Flowers</option><option value="candle">Candle</option><option value="letter">Letter</option><option value="gold_card">Gold Card</option><option value="llh_tag">LLH Tag</option></select></div>
            </div>
            <div className="fg2">
              <div className="f"><label htmlFor="np-tag">Short description</label><input id="np-tag" name="tagline" type="text" /></div>
              <div className="f"><label htmlFor="np-price">Price (₦) — blank for “Request a quote”</label><input id="np-price" name="price" type="text" inputMode="decimal" /></div>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
