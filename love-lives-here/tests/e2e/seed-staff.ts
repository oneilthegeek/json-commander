import { getDb, closeDb, schema } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/auth/password";

async function main() {
  const staff = JSON.parse(process.env.STAFF_JSON!) as Record<string, { email: string; password: string; role: "owner" | "writer" | "fulfilment"; totp?: string }>;
  for (const s of Object.values(staff)) {
    await getDb().insert(schema.staffUsers).values({ email: s.email, name: s.role[0].toUpperCase() + s.role.slice(1), role: s.role, passwordHash: await hashPassword(s.password), totpSecret: s.totp ?? null, totpEnabled: !!s.totp });
  }
  await closeDb();
}
main();
