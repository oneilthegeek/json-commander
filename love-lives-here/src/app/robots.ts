import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/orders/", "/c/", "/checkout", "/cart", "/newsletter/"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
