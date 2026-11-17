/** Serializable product shapes passed to client components. Prices are display-only. */
import type { Product } from "./catalog";
import { isPurchasable } from "./catalog";

export type ClientVariant = { id: string; name: string; price: number | null; priceStatus: string; purchasable: boolean; stockNote: string | null };
export type ClientProduct = {
  id: string; slug: string; name: string; kind: string; optionLabel: string; tagline: string; badge: string | null;
  image: { src: string; alt: string; width: number; height: number } | null; variants: ClientVariant[];
};

export function toClient(p: Product): ClientProduct {
  return {
    id: p.id, slug: p.slug, name: p.name, kind: p.kind, optionLabel: p.optionLabel, tagline: p.tagline, badge: p.badge,
    image: p.images[0] ? { src: p.images[0].src, alt: p.images[0].alt, width: p.images[0].width, height: p.images[0].height } : null,
    variants: p.variants.map((v) => ({
      id: v.id, name: v.name, price: v.price, priceStatus: v.priceStatus, purchasable: isPurchasable(v),
      stockNote: v.stock == null ? null : v.stock === 0 ? "Sold out" : v.stock <= 3 ? `Only ${v.stock} left` : null,
    })),
  };
}
