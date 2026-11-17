import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

/** 128-bit+ URL-safe random token. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // no 0/O/1/I/L/U
export function orderNumber(): string {
  const b = randomBytes(7);
  let s = "";
  for (let i = 0; i < 7; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `LLH-${s}`;
}

export function paymentReference(orderNo: string): string {
  return `${orderNo}-${randomBytes(5).toString("hex")}`;
}

function appSecret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set (32+ chars)");
    return "development-only-secret-do-not-use-in-production!!";
  }
  return s;
}

/** Signs a short payload: value.expiry.sig */
export function sign(value: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = `${value}.${exp}`;
  const sig = createHmac("sha256", appSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySigned(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expect = createHmac("sha256", appSecret()).update(body).digest("base64url");
  if (!safeEqual(sig, expect)) return null;
  const j = body.lastIndexOf(".");
  const exp = Number(body.slice(j + 1));
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  return body.slice(0, j);
}
