import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { addVariant, saveProduct } from "../../actions";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.edit");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await getDb().query.products.findFirst({ where: eq(schema.products.id, id), with: { images: { orderBy: [asc(schema.productImages.sort)] } } });
  if (!p) notFound();
  return (
    <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
      <p><Link href="/admin/products">← Products</Link></p>
      <h1 style={{ fontSize: 34 }}>{p.name}</h1>
      <ActionForm action={saveProduct.bind(null, p.id)} submit="Save product" className="card form">
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
