import { desc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Audit log" };

export default async function Audit() {
  await requireStaff("audit.view");
  const rows = await getDb().select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(300);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <h1 style={{ fontSize: 36 }}>Audit log</h1>
      <div className="table-wrap"><table className="t">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>On</th><th>IP</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{formatDateTime(r.createdAt)}</td><td>{r.actorEmail}</td><td>{r.action}</td><td>{r.entity} {r.entityId?.slice(0, 13)}</td><td>{r.ip}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
