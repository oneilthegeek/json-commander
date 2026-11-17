import { desc, eq, inArray } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { emailConfigured } from "@/lib/notifications";
import { ActionForm } from "@/components/ActionForm";
import { outboxFlush, outboxManual } from "../actions";

export const metadata = { title: "Outbox" };

export default async function Outbox() {
  await requireStaff("orders.notes");
  const rows = await getDb().select({ m: schema.outbox, number: schema.orders.number }).from(schema.outbox)
    .leftJoin(schema.orders, eq(schema.orders.id, schema.outbox.orderId))
    .where(inArray(schema.outbox.status, ["queued", "failed"])).orderBy(desc(schema.outbox.createdAt)).limit(100);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 style={{ fontSize: 36 }}>Customer notifications</h1>
      {emailConfigured() ? <ActionForm action={async () => { "use server"; return outboxFlush(); }} submit="Send queued emails now" />
        : <p className="alert warn">Automatic email isn&apos;t configured (RESEND_API_KEY). Send each message by hand — tap “Open in email” — then mark it sent.</p>}
      {rows.length === 0 && <p className="muted">Nothing waiting.</p>}
      {rows.map(({ m, number }) => (
        <article key={m.id} className="card">
          <div className="row between"><strong>{m.subject}</strong><span className="badge warn">{m.status}</span></div>
          <span className="hint">{formatDateTime(m.createdAt)} · to {m.to}{number ? ` · ${number}` : ""}{m.error ? ` · ${m.error}` : ""}</span>
          <pre className="brief">{m.body}</pre>
          <div className="row">
            <a className="btn btn-ghost btn-sm" href={`mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>Open in email</a>
            <ActionForm action={async () => { "use server"; return outboxManual(m.id); }} submit="Mark sent by hand" submitClass="btn btn-ghost btn-sm" className="" />
          </div>
        </article>
      ))}
    </div>
  );
}
