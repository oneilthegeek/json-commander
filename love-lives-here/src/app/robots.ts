import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
import { appUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  // A preview/staging server must never be indexed.
  if (process.env.SITE_PREVIEW_NOTICE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/orders/", "/c/", "/checkout", "/cart", "/newsletter/"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
