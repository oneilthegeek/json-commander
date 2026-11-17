import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { paystackConfigured, isTestKey } from "@/lib/paystack";

export const metadata = { title: "Payments" };

/** Reconciliation view: every attempt, with anything needing a human highlighted. */
export default async function Payments() {
  await requireStaff("payments.view");
  const rows = await getDb().select({ p: schema.payments, o: { id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, dup: schema.orders.duplicatePaymentFlag } })
    .from(schema.payments).innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId)).orderBy(desc(schema.payments.createdAt)).limit(300);
  const issues = rows.filter((r) => r.o.dup || (r.p.gatewayResponse ?? "").startsWith("Mismatch"));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 style={{ fontSize: 36 }}>Payments</h1>
      <p className={`alert ${paystackConfigured() ? (isTestKey() ? "warn" : "ok") : ""}`}>
        Paystack: {paystackConfigured() ? (isTestKey() ? "TEST mode — payments are not real money." : "live.") : "not configured. Customers can't pay online; record bank transfers on each order."}
      </p>
      {issues.length > 0 && <div className="alert"><strong>Needs attention:</strong> <ul>{issues.map((r) => <li key={r.p.id}><Link href={`/admin/orders/${r.o.id}`}>{r.o.number}</Link>: {r.o.dup ? "duplicate payment — refund one" : r.p.gatewayResponse}</li>)}</ul></div>}
      <p className="hint">Compare this list against your Paystack dashboard (Transactions) and bank settlements. “Re-check with Paystack” is on each order page.</p>
      <div className="table-wrap"><table className="t">
        <thead><tr><th>When</th><th>Order</th><th>Reference</th><th>Via</th><th className="num">Amount</th><th>Status</th><th>Channel</th></tr></thead>
        <tbody>{rows.map(({ p, o }) => <tr key={p.id}><td>{formatDateTime(p.createdAt)}</td><td><Link href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td><code>{p.reference}</code></td><td>{p.provider}{p.testMode ? " (test)" : ""}</td><td className="num">{formatNaira(p.amount)}</td><td><span className={`badge ${p.status === "success" ? "ok" : p.status === "initialized" ? "" : "bad"}`}>{p.status}</span></td><td>{p.channel ?? ""}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
