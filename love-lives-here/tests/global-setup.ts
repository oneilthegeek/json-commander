import { Client } from "pg";
import { execSync } from "node:child_process";

/** Fresh schema in the test database for every run: migrate + seed (the same scripts used in production). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://llh_app:llh_dev_pw@127.0.0.1:5432/llh_test";
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await c.end();
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });
}
