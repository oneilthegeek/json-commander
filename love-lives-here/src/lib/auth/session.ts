import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import { randomToken, sha256 } from "../tokens";
import { can, mfaRequired, type Permission, type Role } from "./permissions";
import { DUMMY_HASH, verifyPassword } from "./password";
import { verifyTotp } from "./totp";
import { audit } from "../audit";
import { rateLimit } from "../rate-limit";

const SESSION_HOURS = 12;
export const COOKIE = process.env.NODE_ENV === "production" ? "__Host-llh_staff" : "llh_staff";

export type Staff = { id: string; email: string; name: string; role: Role; totpEnabled: boolean; sessionId: string; mfaPassed: boolean };

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Behind a single trusted proxy (Vercel, nginx, Fly). Configure the proxy to set this header.
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

async function setCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600,
  });
}

export type LoginResult = { ok: true; needsMfa: boolean } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const rl = await rateLimit(`login:${ip}`, 20, 15 * 60);
  if (!rl.ok) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  const db = getDb();
  const user = await db.query.staffUsers.findFirst({ where: sql`lower(${schema.staffUsers.email}) = ${email.trim().toLowerCase()}` });
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  const generic = { ok: false as const, error: "Email or password is incorrect." };
  if (!user || !user.active) return generic;
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, error: "This account is temporarily locked after too many attempts. Try again later." };
  if (!valid) {
    const fails = user.failedLogins + 1;
    await db.update(schema.staffUsers).set({ failedLogins: fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null }).where(eq(schema.staffUsers.id, user.id));
    await audit({ actorId: user.id, actorEmail: user.email, action: "login_failed", entity: "staff", entityId: user.id, ip });
    return generic;
  }
  await db.update(schema.staffUsers).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.staffUsers.id, user.id));
  const token = randomToken(32);
  const h = await headers();
  await db.insert(schema.staffSessions).values({
    tokenHash: sha256(token), userId: user.id, mfaPassed: !user.totpEnabled,
    ip, userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000),
  });
  await setCookie(token);
  await audit({ actorId: user.id, actorEmail: user.email, action: "login", entity: "staff", entityId: user.id, ip });
  return { ok: true, needsMfa: user.totpEnabled };
}

export async function getStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length < 30) return null;
  const db = getDb();
  const row = await db
    .select({ s: schema.staffSessions, u: schema.staffUsers })
    .from(schema.staffSessions)
    .innerJoin(schema.staffUsers, eq(schema.staffSessions.userId, schema.staffUsers.id))
    .where(and(eq(schema.staffSessions.tokenHash, sha256(token)), gt(schema.staffSessions.expiresAt, new Date())))
    .limit(1);
  const r = row[0];
  if (!r || !r.u.active) return null;
  return { id: r.u.id, email: r.u.email, name: r.u.name, role: r.u.role, totpEnabled: r.u.totpEnabled, sessionId: r.s.id, mfaPassed: r.s.mfaPassed };
}

/**
 * Use at the top of every admin page and server action.
 * Redirects to sign-in, to the 2FA step, or to 2FA enrolment as needed,
 * and throws if the role lacks the permission.
 */
export async function requireStaff(permission?: Permission, opts: { allowUnenrolled?: boolean } = {}): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  if (s.totpEnabled && !s.mfaPassed) redirect("/admin/login/verify");
  if (!s.totpEnabled && mfaRequired(s.role) && !opts.allowUnenrolled && process.env.LLH_ALLOW_NO_MFA !== "1") redirect("/admin/security?setup=1");
  if (permission && !can(s.role, permission)) redirect(`/admin/denied?need=${encodeURIComponent(permission)}`);
  return s;
}

export class ForbiddenError extends Error {
  constructor(public permission: string) { super(`Your role doesn't allow this (${permission}).`); }
}

export async function verifyMfa(code: string): Promise<boolean> {
  const s = await getStaff();
  if (!s) return false;
  const ip = await clientIp();
  const rl = await rateLimit(`mfa:${s.id}`, 10, 15 * 60);
  if (!rl.ok) return false;
  const db = getDb();
  const u = await db.query.staffUsers.findFirst({ where: eq(schema.staffUsers.id, s.id) });
  if (!u?.totpSecret || !u.totpEnabled) return false;
  const step = verifyTotp(u.totpSecret, code);
  if (step == null || (u.totpLastStep != null && step <= u.totpLastStep)) {
    await audit({ actorId: u.id, actorEmail: u.email, action: "mfa_failed", entity: "staff", entityId: u.id, ip });
    return false;
  }
  await db.update(schema.staffUsers).set({ totpLastStep: step }).where(eq(schema.staffUsers.id, u.id));
  await db.update(schema.staffSessions).set({ mfaPassed: true }).where(eq(schema.staffSessions.id, s.sessionId));
  return true;
}

export async function logout() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await getDb().delete(schema.staffSessions).where(eq(schema.staffSessions.tokenHash, sha256(token)));
  (await cookies()).delete(COOKIE);
}
