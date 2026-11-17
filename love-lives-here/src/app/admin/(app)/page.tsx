import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { attention, dashboard } from "@/lib/reports";
import { addDays, isIsoDate, lagosToday } from "@/lib/dates";
import { formatNaira } from "@/lib/money";

export const metadata = { title: "Dashboard" };

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; test?: string }> }) {
  const s = await requireStaff("orders.view");
  const sp = await searchParams;
  const to = isIsoDate(sp.to) ? sp.to : lagosToday();
  const from = isIsoDate(sp.from) ? sp.from : addDays(to, -29);
  const includeTest = sp.test === "1";
  const att = await attention();
  const showMoney = can(s.role, "analytics.view");
  const d = showMoney ? await dashboard({ from, to, includeTest }) : null;

  const todo = [
    { n: att.quotes, label: "orders need a delivery quote", href: "/admin/orders?status=awaiting_quote" },
    { n: att.to_draft, label: "paid letters to draft", href: "/admin/orders?status=drafting" },
    { n: att.approvals, label: "waiting on the buyer's approval", href: "/admin/orders?status=awaiting_approval" },
    { n: att.cards, label: "Gold Cards / Tags to set up", href: "/admin/orders?nfc=1" },
    { n: att.duplicates, label: "orders with a duplicate payment to refund", href: "/admin/orders?flag=duplicate", bad: true },
    { n: att.unverified_prices, label: "prices still unverified (from the old site)", href: "/admin/products", bad: true },
    { n: att.low_stock, label: "items low on stock", href: "/admin/products" },
    { n: att.messages, label: "open customer messages", href: "/admin/messages" },
    { n: att.outbox, label: "customer notifications not yet sent", href: "/admin/outbox" },
  ].filter((t) => t.n > 0);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1 style={{ fontSize: 36 }}>Dashboard</h1>
      <section className="card" aria-labelledby="todo-h">
        <h2 id="todo-h">Needs attention</h2>
        {todo.length === 0 ? <p className="muted">Nothing waiting. 🎉</p> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>{todo.map((t) => <li key={t.label}><Link href={t.href}><strong className={t.bad ? "err" : ""}>{t.n}</strong> {t.label}</Link></li>)}</ul>
        )}
      </section>

      {d && (<>
        <form className="inline-form" method="get" aria-label="Date range">
          <div className="f"><label htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={from} /></div>
          <div className="f"><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={to} /></div>
          <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="test" value="1" defaultChecked={includeTest} /> Include test orders</label>
          <button className="btn btn-ghost btn-sm" type="submit">Update</button>
        </form>
        {includeTest && <p className="alert warn">Showing test orders too. These are not real sales.</p>}
        {d.ordersCreated === 0 && d.visitors === 0 && <p className="alert info">No orders or visits recorded in this period yet. Figures appear here as real customers use the site.</p>}
        <div className="kpis">
          <div className="kpi"><b>{d.paidOrders}</b><span>Paid orders ({d.ordersCreated} placed)</span></div>
          <div className="kpi"><b>{formatNaira(d.revenue)}</b><span>Paid revenue, net of refunds</span></div>
          <div className="kpi"><b>{d.aov == null ? "—" : formatNaira(d.aov)}</b><span>Average order value</span></div>
          <div className="kpi"><b>{pct(d.conversion)}</b><span>Conversion ({d.visitors} visitors)</span></div>
          <div className="kpi"><b>{d.abandonedCheckouts}</b><span>Abandoned checkouts</span></div>
          <div className="kpi"><b>{pct(d.paymentFailureRate)}</b><span>Payment failure rate</span></div>
          <div className="kpi"><b>{d.refunds.count}</b><span>Refunds ({formatNaira(d.refunds.amount)})</span></div>
          <div className="kpi"><b>{d.fulfilment.delivered ? pct(d.fulfilment.onTime / d.fulfilment.delivered) : "—"}</b><span>Delivered on time ({d.fulfilment.delivered} delivered{d.fulfilment.overdue ? `, ${d.fulfilment.overdue} overdue` : ""})</span></div>
          <div className="kpi"><b>{d.fulfilment.avgHours == null ? "—" : `${d.fulfilment.avgHours} h`}</b><span>Average paid → delivered</span></div>
          <div className="kpi"><b>{d.newsletter}</b><span>Newsletter sign-ups</span></div>
          <div className="kpi"><b>{d.whatsapp}</b><span>WhatsApp clicks</span></div>
        </div>
        <div className="cols">
          <section className="card" aria-labelledby="best-h">
            <h2 id="best-h">Best sellers</h2>
            {d.best.length === 0 ? <p className="muted">No paid orders in this period.</p> : (
              <div className="table-wrap"><table className="t"><thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Revenue</th></tr></thead>
                <tbody>{d.best.map((b) => <tr key={b.name}><td>{b.name}</td><td className="num">{b.qty}</td><td className="num">{formatNaira(b.revenue)}</td></tr>)}</tbody></table></div>
            )}
            <h2 style={{ marginTop: 12 }}>Product interest</h2>
            {d.funnel.length === 0 ? <p className="muted">No product views recorded yet.</p> : (
              <div className="table-wrap"><table className="t"><thead><tr><th>Product</th><th className="num">Views</th><th className="num">Added to bag</th><th className="num">Add rate</th></tr></thead>
                <tbody>{d.funnel.map((f) => <tr key={f.product}><td>{f.product}</td><td className="num">{f.views}</td><td className="num">{f.adds}</td><td className="num">{f.views ? pct(f.adds / f.views) : "—"}</td></tr>)}</tbody></table></div>
            )}
          </section>
          <section className="card" aria-labelledby="src-h">
            <h2 id="src-h">Where orders came from</h2>
            {d.sources.length === 0 ? <p className="muted">No orders yet.</p> : (
              <div className="table-wrap"><table className="t"><thead><tr><th>Source</th><th className="num">Orders</th><th className="num">Paid</th></tr></thead>
                <tbody>{d.sources.map((x) => <tr key={x.source}><td>{x.source}</td><td className="num">{x.orders}</td><td className="num">{formatNaira(x.revenue)}</td></tr>)}</tbody></table></div>
            )}
            <p className="hint">From UTM tags or the referring site. Add <code>?utm_source=instagram</code> to links you share.</p>
          </section>
        </div>
      </>)}
    </div>
  );
}
