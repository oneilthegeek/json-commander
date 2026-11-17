import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __llhPool?: Pool; __llhDb?: DB };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : undefined,
  });
}

export function getDb(): DB {
  if (!globalForDb.__llhDb) {
    globalForDb.__llhPool = createPool();
    globalForDb.__llhDb = drizzle(globalForDb.__llhPool, { schema });
  }
  return globalForDb.__llhDb;
}

export async function closeDb() {
  await globalForDb.__llhPool?.end();
  globalForDb.__llhPool = undefined;
  globalForDb.__llhDb = undefined;
}

/** A transaction handle or the db itself. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export { schema };
