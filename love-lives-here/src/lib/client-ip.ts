/**
 * The visitor's IP for rate limiting. Proxies *append* to X-Forwarded-For, so the left-most entries
 * are whatever the client sent and can be forged. We count TRUSTED_PROXY_HOPS (default 1: one reverse
 * proxy such as Caddy, nginx or Vercel) from the right, which is the address our own proxy saw.
 */
export function ipFromHeaders(h: Pick<Headers, "get">): string {
  const hops = Math.max(1, Math.min(5, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1));
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = parts.length ? parts[Math.max(0, parts.length - hops)] : h.get("x-real-ip")?.trim();
  return (ip || "unknown").slice(0, 64);
}
