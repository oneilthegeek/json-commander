import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listOrders, type OrderFilters } from "@/lib/admin-orders";
import { ORDER_STATUSES, STATUS_LABEL } from "@/lib/order-status";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { StatusBadge, PayBadge } from "@/components/admin/Badges";

export const metadata = { title: "Orders" };

export default async function Orders({ searchParams }: { searchParams: Promise<OrderFilters & { page?: string }> }) {
  const s = await requireStaff("orders.view");
  const f = await searchParams;
  const page = Math.max(0, Number(f.page ?? 0) || 0);
  const rows = await listOrders({ ...f, staffId: s.id }, 50, page * 50);
  const pii = can(s.role, "customers.pii");
  const qs = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row between"><h1 style={{ fontSize: 36 }}>Orders</h1>
        {can(s.role, "orders.export") && <a className="btn btn-ghost btn-sm" href={`/admin/export?${qs}`}>Export CSV</a>}</div>
      <form className="inline-form" method="get" role="search" aria-label="Filter orders">
        <div className="f"><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={f.q} placeholder="Order no, name, phone, email" /></div>
        <div className="f"><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={f.status ?? ""}><option value="">Any</option><option value="open">All open</option>{ORDER_STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select></div>
        <div className="f"><label htmlFor="payment">Payment</label><select id="payment" name="payment" defaultValue={f.payment ?? ""}><option value="">Any</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="partially_refunded">Part refunded</option><option value="refunded">Refunded</option></select></div>
        <div className="f"><label htmlFor="from">Delivery from</label><input id="from" name="from" type="date" defaultValue={f.from} /></div>
        <div className="f"><label htmlFor="to">to</label><input id="to" name="to" type="date" defaultValue={f.to} /></div>
        <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="mine" value="1" defaultChecked={!!f.mine} /> Assigned to me</label>
        <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="test" value="1" defaultChecked={f.test === "1"} /> Include test</label>
        <button className="btn btn-dark btn-sm" type="submit">Filter</button>
      </form>
      <div className="table-wrap">
        <table className="t">
          <caption className="sr-only">Orders</caption>
          <thead><tr><th>Order</th><th>Status</th><th>Payment</th><th>Deliver</th><th>For</th>{pii && <th>Buyer</th>}<th className="num">Total</th><th>Placed</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={8} className="muted">No orders match.</td></tr> : rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`}>{o.number}</Link>{o.testMode && <> <span className="badge warn">test</span></>}{o.duplicatePaymentFlag && <> <span className="badge bad">duplicate pay</span></>}</td>
                <td><StatusBadge s={o.status} /></td><td><PayBadge s={o.paymentStatus} /></td>
                <td>{o.deliveryDate}<div className="hint">{o.zoneName}</div></td>
                <td>{o.recipientName}</td>{pii && <td>{o.buyerName}<div className="hint">{o.buyerPhone}</div></td>}
                <td className="num">{o.total == null ? "quote" : formatNaira(o.total)}</td>
                <td>{formatDateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">{page > 0 && <a href={`?${qs}&page=${page - 1}`}>← Newer</a>}{rows.length === 50 && <a href={`?${qs}&page=${page + 1}`}>Older →</a>}</div>
    </div>
  );
}
