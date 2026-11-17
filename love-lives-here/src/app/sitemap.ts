import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/catalog";
import { appUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const staticPages = ["", "/shop", "/letter", "/gold-card", "/delivery", "/faq", "/contact", "/track", "/privacy", "/terms", "/refunds"];
  const products = await listProducts();
  return [
    ...staticPages.map((p) => ({ url: base + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...products.map((p) => ({ url: `${base}/shop/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
