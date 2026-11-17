/**
 * Business analytics for the admin dashboard. Computed only from real orders,
 * payments and events. Test-mode orders (paid with Paystack test keys) are
 * excluded unless explicitly requested. No sample data is ever shown.
 */
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { lagosToday } from "./dates";

export type Range = { from: string; to: string; includeTest: boolean };

const n = (v: unknown) => Number(v ?? 0);

export async function dashboard(r: Range) {
  const db = getDb();
  const test = r.includeTest ? sql`true` : sql`o.test_mode = false`;
  const evTest = r.includeTest ? sql`true` : sql`e.test = false`;
  const inRange = sql`o.created_at >= (${r.from}::date at time zone 'Africa/Lagos') and o.created_at < ((${r.to}::date + 1) at time zone 'Africa/Lagos')`;
  const evRange = sql`e.created_at >= (${r.from}::date at time zone 'Africa/Lagos') and e.created_at < ((${r.to}::date + 1) at time zone 'Africa/Lagos')`;

  const [orders] = (await db.execute(sql`
    select count(*) as created,
      count(*) filter (where o.payment_status in ('paid','partially_refunded','refunded')) as paid,
      count(*) filter (where o.status = 'pending_payment' and o.created_at < now() - interval '2 hours') as abandoned_unpaid,
      count(*) filter (where o.status = 'awaiting_quote') as awaiting_quote
    from orders o where ${inRange} and ${test}`)).rows;

  const [money] = (await db.execute(sql`
    select coalesce(sum(p.amount) filter (where p.status = 'success'),0) as gross,
      count(*) filter (where p.status = 'success') as ok,
      count(*) filter (where p.status in ('failed','abandoned')) as failed
    from payments p join orders o on o.id = p.order_id where ${inRange} and ${test}`)).rows;

  const [refunds] = (await db.execute(sql`
    select count(*) as count, coalesce(sum(rf.amount),0) as amount
    from refunds rf join orders o on o.id = rf.order_id
    where rf.status in ('processed','manual') and ${inRange} and ${test}`)).rows;

  const [sessions] = (await db.execute(sql`
    select count(distinct e.session_id) filter (where e.name = 'page_view') as visitors,
      count(distinct e.session_id) filter (where e.name = 'checkout_start') as checkout_sessions,
      count(*) filter (where e.name = 'newsletter_signup' or e.name = 'newsletter_signup_click') as newsletter,
      count(*) filter (where e.name = 'whatsapp_click') as whatsapp
    from analytics_events e where ${evRange} and ${evTest}`)).rows;

  const best = (await db.execute(sql`
    select oi.product_name as name, sum(oi.quantity)::int as qty, sum(oi.line_total)::bigint as revenue
    from order_items oi join orders o on o.id = oi.order_id
    where o.payment_status in ('paid','partially_refunded') and ${inRange} and ${test}
    group by oi.product_name order by revenue desc limit 10`)).rows as { name: string; qty: number; revenue: string }[];

  const funnel = (await db.execute(sql`
    select coalesce(e.product, '—') as product,
      count(*) filter (where e.name = 'product_view') as views,
      count(*) filter (where e.name = 'add_to_cart') as adds
    from analytics_events e where e.product is not null and ${evRange} and ${evTest}
    group by e.product order by views desc limit 12`)).rows as { product: string; views: string; adds: string }[];

  const sources = (await db.execute(sql`
    select coalesce(nullif(o.source->>'source',''), 'unknown') as source, count(*) as orders,
      coalesce(sum(o.total) filter (where o.payment_status = 'paid'),0) as revenue
    from orders o where ${inRange} and ${test}
    group by 1 order by orders desc limit 10`)).rows as { source: string; orders: string; revenue: string }[];

  const [fulfil] = (await db.execute(sql`
    select count(*) filter (where o.status = 'delivered') as delivered,
      count(*) filter (where o.status = 'delivered' and (o.delivered_at at time zone 'Africa/Lagos')::date <= o.delivery_date) as on_time,
      count(*) filter (where o.status not in ('delivered','cancelled','refunded','awaiting_quote','pending_payment') and o.delivery_date < ${lagosToday()}::date) as overdue,
      avg(extract(epoch from (o.delivered_at - o.paid_at)) / 3600) filter (where o.status = 'delivered') as avg_hours
    from orders o where ${inRange} and ${test}`)).rows;

  const gross = n(money.gross);
  const refunded = n(refunds.amount);
  const paid = n(orders.paid);
  const visitors = n(sessions.visitors);
  const payAttempts = n(money.ok) + n(money.failed);
  return {
    ordersCreated: n(orders.created),
    paidOrders: paid,
    revenue: gross - refunded,
    grossRevenue: gross,
    aov: paid ? Math.round(gross / paid) : null,
    conversion: visitors ? paid / visitors : null,
    visitors,
    checkoutSessions: n(sessions.checkout_sessions),
    abandonedCheckouts: Math.max(0, n(sessions.checkout_sessions) - n(orders.created)) + n(orders.abandoned_unpaid),
    abandonedUnpaid: n(orders.abandoned_unpaid),
    awaitingQuote: n(orders.awaiting_quote),
    paymentFailureRate: payAttempts ? n(money.failed) / payAttempts : null,
    refunds: { count: n(refunds.count), amount: refunded },
    newsletter: n(sessions.newsletter),
    whatsapp: n(sessions.whatsapp),
    best: best.map((b) => ({ name: b.name, qty: b.qty, revenue: n(b.revenue) })),
    funnel: funnel.map((f) => ({ product: f.product, views: n(f.views), adds: n(f.adds) })),
    sources: sources.map((s) => ({ source: s.source, orders: n(s.orders), revenue: n(s.revenue) })),
    fulfilment: { delivered: n(fulfil.delivered), onTime: n(fulfil.on_time), overdue: n(fulfil.overdue), avgHours: fulfil.avg_hours == null ? null : Math.round(n(fulfil.avg_hours)) },
  };
}

/** Things that need someone's attention now (not date-ranged). */
export async function attention() {
  const [r] = (await getDb().execute(sql`
    select
      (select count(*) from orders where status = 'awaiting_quote') as quotes,
      (select count(*) from orders where status = 'awaiting_approval') as approvals,
      (select count(*) from orders where status in ('paid','drafting')) as to_draft,
      (select count(*) from orders where duplicate_payment_flag) as duplicates,
      (select count(*) from product_variants where price_status = 'unverified' and active) as unverified_prices,
      (select count(*) from product_variants where stock is not null and stock <= 3 and active) as low_stock,
      (select count(*) from support_messages where status = 'open') as messages,
      (select count(*) from notification_outbox where status in ('queued','failed')) as outbox,
      (select count(*) from nfc_experiences e join orders o on o.id = e.order_id where e.status = 'draft' and o.payment_status = 'paid') as cards
  `)).rows;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v)])) as Record<string, number>;
}
