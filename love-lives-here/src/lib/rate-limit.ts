/**
 * Fixed-window rate limiter stored in Postgres, so limits hold across
 * multiple server instances and restarts.
 */
import { sql } from "drizzle-orm";
import { getDb } from "./db";

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; remaining: number }> {
  if (process.env.RATE_LIMIT_DISABLED === "1" && process.env.NODE_ENV !== "production") return { ok: true, remaining: limit };
  const res = await getDb().execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count`);
  const count = Number(res.rows[0]?.count ?? 1);
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}
