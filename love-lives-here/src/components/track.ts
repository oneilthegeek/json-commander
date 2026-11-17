"use client";
/** Cookieless first-party analytics. Never send names, phones, emails, addresses or messages here. */

function sid(): string {
  try {
    let s = sessionStorage.getItem("llh-sid");
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem("llh-sid", s); }
    return s;
  } catch { return "na"; }
}

export type Attribution = { source?: string; medium?: string; campaign?: string; referrer?: string };

/** Remembers where this visit came from (UTM or referrer) for order attribution. */
export function attribution(): Attribution {
  try {
    const saved = sessionStorage.getItem("llh-src");
    if (saved) return JSON.parse(saved);
    const u = new URL(location.href);
    let ref: string | undefined;
    try { ref = document.referrer ? new URL(document.referrer).hostname : undefined; } catch { ref = undefined; }
    const a: Attribution = {
      source: u.searchParams.get("utm_source") ?? (ref && ref !== location.hostname ? ref : "direct"),
      medium: u.searchParams.get("utm_medium") ?? undefined,
      campaign: u.searchParams.get("utm_campaign") ?? undefined,
      referrer: ref && ref !== location.hostname ? ref : undefined,
    };
    sessionStorage.setItem("llh-src", JSON.stringify(a));
    return a;
  } catch { return {}; }
}

export function track(name: string, props: { product?: string; value?: number; orderNumber?: string } = {}) {
  if (typeof window === "undefined") return;
  const a = attribution();
  const body = JSON.stringify({ name, sessionId: sid(), path: location.pathname, ...props, source: a.source, medium: a.medium, campaign: a.campaign });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "text/plain" }));
    else fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch { /* never break the page for analytics */ }
}
