import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await getDb().query.orders.findFirst({ where: eq(schema.orders.id, id), with: { items: true, payments: true, refunds: true } });
  if (!o) notFound();
  const b = await getSetting("business");
  const pii = can(s.role, "customers.pii");
  const paid = o.payments.filter((p) => p.status === "success");
  return (
    <article className="panel stack" style={{ maxWidth: 640, margin: "24px auto" }}>
      <div className="row between"><h1 style={{ fontSize: 30 }}>Love Lives Here</h1><PrintButton /></div>
      <p className="small" style={{ margin: 0 }}>Lagos, Nigeria · {b.email} · +{b.whatsapp}</p>
      <h2 style={{ fontSize: 22 }}>{o.paymentStatus === "unpaid" ? "Order summary (unpaid)" : "Receipt"} · {o.number}</h2>
      {o.testMode && <p className="alert warn">TEST ORDER — not a real sale.</p>}
      <p className="small" style={{ margin: 0 }}>Placed {formatDateTime(o.createdAt)}{pii ? ` · Billed to ${o.buyerName}` : ""} · Delivery {formatLongDate(o.deliveryDate)}</p>
      <div className="sum">
        {o.items.map((i) => <div className="sr" key={i.id}><span>{i.productName}{i.variantName !== i.productName ? `, ${i.variantName}` : ""} × {i.quantity} @ {formatNaira(i.unitPrice)}</span><span>{formatNaira(i.lineTotal)}</span></div>)}
        <div className="sr"><span>Delivery · {o.zoneName}</span><span>{o.deliveryFee == null ? "—" : formatNaira(o.deliveryFee)}</span></div>
        <div className="sr tot"><span>Total</span><span>{o.total == null ? "—" : formatNaira(o.total)}</span></div>
        {paid.map((p) => <div className="sr small" key={p.id}><span>Paid {formatDateTime(p.verifiedAt)} · {p.provider} {p.reference}</span><span>{formatNaira(p.amount)}</span></div>)}
        {o.refunds.filter((r) => ["processed", "manual"].includes(r.status)).map((r) => <div className="sr small" key={r.id}><span>Refunded</span><span>−{formatNaira(r.amount)}</span></div>)}
      </div>
    </article>
  );
}
