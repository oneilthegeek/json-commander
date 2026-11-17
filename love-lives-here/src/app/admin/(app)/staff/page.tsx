import { asc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { ROLES, ROLE_LABEL, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/dates";
import { ActionForm } from "@/components/ActionForm";
import { createStaff, updateStaff } from "../actions";

export const metadata = { title: "Staff" };

export default async function Staff() {
  await requireStaff("staff.manage");
  const users = await getDb().select().from(schema.staffUsers).orderBy(asc(schema.staffUsers.name));
  return (
    <div className="stack" style={{ gap: 20 }}>
      <h1 style={{ fontSize: 36 }}>Staff</h1>
      <details className="card"><summary>What each role can do</summary>
        <ul>{ROLES.map((r) => <li key={r}><strong>{ROLE_LABEL[r]}:</strong> {ROLE_PERMISSIONS[r].join(", ")}</li>)}</ul></details>
      {users.map((u) => (
        <ActionForm key={u.id} action={updateStaff.bind(null, u.id)} submit="Save" className="card inline-form">
          <div style={{ flex: "2 1 200px" }}><strong>{u.name}</strong><div className="hint">{u.email} · 2FA {u.totpEnabled ? "on" : "off"} · last sign-in {formatDateTime(u.lastLoginAt)}</div></div>
          <div className="f"><label htmlFor={`r-${u.id}`}>Role</label><select id={`r-${u.id}`} name="role" defaultValue={u.role}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
          <label className="check" style={{ alignSelf: "center" }}><input type="checkbox" name="resetMfa" /> Reset 2FA</label>
        </ActionForm>
      ))}
      <section className="card" aria-labelledby="ns-h">
        <h2 id="ns-h">Add a team member</h2>
        <ActionForm action={createStaff} submit="Create account" resetOnSuccess>
          <div className="fg2">
            <div className="f"><label htmlFor="ns-name">Name</label><input id="ns-name" name="name" type="text" required /></div>
            <div className="f"><label htmlFor="ns-email">Email</label><input id="ns-email" name="email" type="email" required /></div>
            <div className="f"><label htmlFor="ns-role">Role</label><select id="ns-role" name="role" defaultValue="writer">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            <div className="f"><label htmlFor="ns-pw">Temporary password (12+ characters)</label><input id="ns-pw" name="password" type="text" autoComplete="off" minLength={12} required /></div>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
