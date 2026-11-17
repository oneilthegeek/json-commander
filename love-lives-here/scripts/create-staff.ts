/**
 * Creates (or resets) a staff account from the command line. The password is
 * read from the STAFF_PASSWORD env var or prompted for — it is never passed
 * as an argument (which would leak into shell history).
 *
 *   npm run staff:create -- --email you@example.com --name "Ada" --role owner
 */
import { createInterface } from "node:readline/promises";
import { sql } from "drizzle-orm";
import { getDb, closeDb, schema } from "../src/lib/db";
import { hashPassword, passwordProblem } from "../src/lib/auth/password";
import { ROLES, type Role } from "../src/lib/auth/permissions";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.toLowerCase();
  const name = arg("name") ?? email;
  const role = (arg("role") ?? "owner") as Role;
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("--email is required");
  if (!ROLES.includes(role)) throw new Error(`--role must be one of ${ROLES.join(", ")}`);
  let pw = process.env.STAFF_PASSWORD;
  if (!pw) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    pw = await rl.question("Password (12+ characters): ");
    rl.close();
  }
  const problem = passwordProblem(pw);
  if (problem) throw new Error(problem);
  const db = getDb();
  const hash = await hashPassword(pw);
  const existing = await db.query.staffUsers.findFirst({ where: sql`lower(${schema.staffUsers.email}) = ${email}` });
  if (existing) {
    await db.update(schema.staffUsers).set({ passwordHash: hash, role, name: name!, active: true, failedLogins: 0, lockedUntil: null }).where(sql`id = ${existing.id}`);
    console.log(`Updated ${email} (${role}).`);
  } else {
    await db.insert(schema.staffUsers).values({ email, name: name!, role, passwordHash: hash });
    console.log(`Created ${email} (${role}). Owners and managers will be asked to set up two-factor sign-in on first login.`);
  }
  await closeDb();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
