import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { otpauthUrl } from "@/lib/auth/totp";
import { mfaRequired } from "@/lib/auth/permissions";
import { ActionForm } from "@/components/ActionForm";
import { changePassword, confirmMfa, startMfa } from "../actions";

export const metadata = { title: "Security" };

export default async function Security({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const s = await requireStaff(undefined, { allowUnenrolled: true });
  const { setup } = await searchParams;
  const u = (await getDb().query.staffUsers.findFirst({ where: eq(schema.staffUsers.id, s.id) }))!;
  const pending = !u.totpEnabled && u.totpSecret;
  const qr = pending ? await QRCode.toString(otpauthUrl(u.totpSecret!, u.email), { type: "svg", margin: 1 }) : null;
  return (
    <div className="stack" style={{ gap: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 36 }}>Security</h1>
      {setup && !u.totpEnabled && mfaRequired(s.role) && <p className="alert warn">Your role needs two-factor sign-in. Set it up below to continue.</p>}
      <section className="card">
        <h2>Two-factor sign-in</h2>
        {u.totpEnabled ? <p className="alert ok">On. You&apos;ll be asked for a code from your authenticator app each time you sign in.</p> : pending ? (
          <>
            <p>Scan this with Google Authenticator, Microsoft Authenticator, Authy or 1Password, then enter the 6-digit code.</p>
            <div style={{ width: 200, background: "#fff", padding: 8 }} dangerouslySetInnerHTML={{ __html: qr! }} aria-label="QR code for your authenticator app" role="img" />
            <p className="small">Can&apos;t scan? Enter this key: <code style={{ userSelect: "all", wordBreak: "break-all" }}>{u.totpSecret}</code></p>
            <ActionForm action={confirmMfa} submit="Turn on">
              <div className="f"><label htmlFor="code">Code</label><input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required /></div>
            </ActionForm>
          </>
        ) : (
          <ActionForm action={async () => { "use server"; return startMfa(); }} submit="Set up two-factor sign-in"><p style={{ margin: 0 }}>Protects the shop if your password is ever leaked.</p></ActionForm>
        )}
      </section>
      <section className="card">
        <h2>Change password</h2>
        <ActionForm action={changePassword} submit="Change password" resetOnSuccess>
          <div className="f"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
          <div className="f"><label htmlFor="next">New password (12+ characters)</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required /></div>
        </ActionForm>
      </section>
    </div>
  );
}
