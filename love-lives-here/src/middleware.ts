import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers + a per-request nonce-based Content Security Policy.
 * Also rejects cross-site state-changing API requests (CSRF defence for the
 * JSON endpoints; Server Actions have Next's own Origin check).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !pathname.startsWith("/api/webhooks/")) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let ok = false;
    try { ok = !!origin && !!host && new URL(origin).host === host; } catch { ok = false; }
    if (!ok) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? " https://plausible.io" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}${plausible}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${plausible}${dev ? " ws:" : ""}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=(), usb=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (!dev) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  // Private pages: never cache, never index
  if (/^\/(admin|orders|c|checkout|cart|api)(\/|$)/.test(pathname)) {
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|images/|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)" }],
};
