import { desc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { closeMessage } from "../actions";

export const metadata = { title: "Messages" };

export default async function Messages() {
  await requireStaff("messages.view");
  const rows = await getDb().select().from(schema.supportMessages).orderBy(desc(schema.supportMessages.createdAt)).limit(200);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 style={{ fontSize: 36 }}>Customer messages</h1>
      {rows.length === 0 && <p className="muted">No messages yet.</p>}
      {rows.map((m) => (
        <article key={m.id} className="card">
          <div className="row between"><strong>{m.name} · {m.contact}</strong><span className={`badge ${m.status === "open" ? "warn" : "ok"}`}>{m.status}</span></div>
          <span className="hint">{formatDateTime(m.createdAt)}{m.orderNumber ? ` · ${m.orderNumber}` : ""}</span>
          <pre className="brief">{m.message}</pre>
          {m.status === "open" && <ActionForm action={async () => { "use server"; return closeMessage(m.id); }} submit="Mark handled" submitClass="btn btn-ghost btn-sm" />}
        </article>
      ))}
    </div>
  );
}
