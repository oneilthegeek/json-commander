import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { addBundleItem, addVariant, removeBundleItem, saveProduct } from "../../actions";
import { bundleContents, listProducts } from "@/lib/catalog";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.edit");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await getDb().query.products.findFirst({ where: eq(schema.products.id, id), with: { images: { orderBy: [asc(schema.productImages.sort)] } } });
  if (!p) notFound();
  const parts = p.kind === "bundle" ? (await bundleContents([p.id])).get(p.id) ?? [] : [];
  const options = p.kind === "bundle" ? (await listProducts()).filter((x) => x.kind !== "bundle").flatMap((x) => x.variants.map((v) => ({ id: v.id, label: `${x.name} — ${v.name}` }))) : [];
  return (
    <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
      <p><Link href="/admin/products">← Products</Link></p>
      <h1 style={{ fontSize: 34 }}>{p.name}</h1>
      <ActionForm action={saveProduct.bind(null, p.id)} submit="Save product" className="card form">
        <input type="hidden" name="updatedAtWas" value={p.updatedAt.toISOString()} />
        <div className="fg2">
          <div className="f"><label htmlFor="name">Name</label><input id="name" name="name" type="text" defaultValue={p.name} required /></div>
          <div className="f"><label htmlFor="badge">Badge</label><input id="badge" name="badge" type="text" defaultValue={p.badge ?? ""} placeholder="Most loved" /></div>
        </div>
        <div className="f"><label htmlFor="tagline">Short description</label><input id="tagline" name="tagline" type="text" defaultValue={p.tagline} /></div>
        <div className="f"><label htmlFor="description">Full description</label><textarea id="description" name="description" rows={6} defaultValue={p.description} /></div>
        <div className="fg2">
          <div className="f"><label htmlFor="productionDays">Working days to make</label><input id="productionDays" name="productionDays" type="number" min={0} max={60} defaultValue={p.productionDays} /></div>
          <div className="f"><label htmlFor="seoTitle">Search title</label><input id="seoTitle" name="seoTitle" type="text" defaultValue={p.seoTitle ?? ""} /></div>
        </div>
        <div className="f"><label htmlFor="seoDescription">Search description</label><input id="seoDescription" name="seoDescription" type="text" defaultValue={p.seoDescription ?? ""} /></div>
        <div className="row">
          <label className="check"><input type="checkbox" name="active" defaultChecked={p.active} /> Visible in the shop</label>
          <label className="check"><input type="checkbox" name="featured" defaultChecked={p.featured} /> Featured</label>
          <label className="check"><input type="checkbox" name="standalone" defaultChecked={p.standalone} /> Can be bought on its own</label>
          <label className="check"><input type="checkbox" name="requiresApproval" defaultChecked={p.requiresApproval} /> Buyer must approve before production</label>
        </div>
        {p.images.length > 0 && <fieldset className="f"><legend>Image descriptions (alt text)</legend>{p.images.map((im) => <div className="f" key={im.id}><label htmlFor={`alt-${im.id}`}>{im.src}</label><input id={`alt-${im.id}`} name={`alt-${im.id}`} type="text" defaultValue={im.alt} /></div>)}</fieldset>}
      </ActionForm>
      {p.kind === "bundle" && (
        <section className="card" aria-labelledby="bun-h">
          <h2 id="bun-h">What&apos;s in this bundle</h2>
          <p className="hint" style={{ margin: 0 }}>The bundle has its own price (its option above). Stock of these items is checked at checkout and reduced when a bundle is paid for.</p>
          {parts.length === 0 ? <p className="alert warn">Empty — customers can&apos;t buy this bundle until you add items.</p> : (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>{parts.map((x) => (
              <li key={x.variantId} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span>{x.quantity} × {x.productName} — {x.variantName}{x.stock != null ? ` (stock ${x.stock})` : ""}</span>
                <ActionForm action={async () => { "use server"; return removeBundleItem(p.id, x.variantId); }} submit="Remove" submitClass="link-btn" className="" />
              </li>))}</ul>
          )}
          <ActionForm action={addBundleItem.bind(null, p.id)} submit="Add to bundle" className="inline-form">
            <div className="f" style={{ flex: "3 1 220px" }}><label htmlFor="b-variant">Item</label><select id="b-variant" name="variantId">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
            <div className="f" style={{ flex: "0 1 90px" }}><label htmlFor="b-qty">Qty</label><input id="b-qty" name="quantity" type="number" min={1} max={20} defaultValue={1} /></div>
          </ActionForm>
        </section>
      )}
      <ActionForm action={addVariant.bind(null, p.id)} submit="Add option" className="card form">
        <h2>Add an option</h2>
        <div className="fg2">
          <div className="f"><label htmlFor="v-name">Option</label><input id="v-name" name="name" type="text" placeholder="30 stems" required /></div>
          <div className="f"><label htmlFor="v-price">Price (₦) — blank for “Request a quote”</label><input id="v-price" name="price" type="text" inputMode="decimal" /></div>
        </div>
      </ActionForm>
    </div>
  );
}
