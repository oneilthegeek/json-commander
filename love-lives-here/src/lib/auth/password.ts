import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const MIN_PASSWORD = 12;

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(pw) || /^(password|lovelives|123456)/i.test(pw)) return "Choose a less predictable password.";
  return null;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, saltB, keyB] = stored.split("$");
  if (alg !== "scrypt" || !keyB) return false;
  const key = Buffer.from(keyB, "base64");
  const got = await scrypt(pw.normalize("NFKC"), Buffer.from(saltB, "base64"), key.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return got.length === key.length && timingSafeEqual(got, key);
}

/** A real hash of a random password, used to keep timing equal for unknown emails. */
export const DUMMY_HASH = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");
