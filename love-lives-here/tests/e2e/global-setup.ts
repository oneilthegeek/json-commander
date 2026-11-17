import { Client } from "pg";
import { execSync } from "node:child_process";
import { E2E_DB } from "../../playwright.config";
import { STAFF } from "./fixtures";

export default async function setup() {
  const c = new Client({ connectionString: E2E_DB });
  await c.connect();
  await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await c.end();
  const env = { ...process.env, DATABASE_URL: E2E_DB };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });
  execSync("npx tsx tests/e2e/seed-staff.ts", { env: { ...env, STAFF_JSON: JSON.stringify(STAFF) }, stdio: "inherit" });
}
