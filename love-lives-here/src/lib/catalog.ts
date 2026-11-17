import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema, type Tx } from "./db";

export type Variant = typeof schema.productVariants.$inferSelect;
export type Product = typeof schema.products.$inferSelect & {
  variants: Variant[];
  images: (typeof schema.productImages.$inferSelect)[];
  category: (typeof schema.categories.$inferSelect) | null;
};

export function isPurchasable(v: Variant): boolean {
  return v.active && v.price != null && v.priceStatus !== "quote" && (v.stock == null || v.stock > 0);
}

/** Lowest purchasable price, for "from ₦…" labels. */
export function fromPrice(p: Product): number | null {
  const prices = p.variants.filter(isPurchasable).map((v) => v.price!);
  return prices.length ? Math.min(...prices) : null;
}

export async function listProducts(opts: { includeInactive?: boolean } = {}, tx: Tx = getDb()): Promise<Product[]> {
  const rows = await tx.query.products.findMany({
    where: opts.includeInactive ? undefined : eq(schema.products.active, true),
    orderBy: [asc(schema.products.sort), asc(schema.products.name)],
    with: {
      variants: { orderBy: [asc(schema.productVariants.sort)], where: opts.includeInactive ? undefined : eq(schema.productVariants.active, true) },
      images: { orderBy: [asc(schema.productImages.sort)] },
      category: true,
    },
  });
  return rows as Product[];
}

export async function getProduct(slug: string, tx: Tx = getDb()): Promise<Product | null> {
  const row = await tx.query.products.findFirst({
    where: and(eq(schema.products.slug, slug), eq(schema.products.active, true)),
    with: {
      variants: { orderBy: [asc(schema.productVariants.sort)], where: eq(schema.productVariants.active, true) },
      images: { orderBy: [asc(schema.productImages.sort)] },
      category: true,
    },
  });
  return (row as Product) ?? null;
}

export async function relatedProducts(productId: string, tx: Tx = getDb()): Promise<Product[]> {
  const rel = await tx.select().from(schema.productRelations).where(eq(schema.productRelations.productId, productId));
  if (!rel.length) return [];
  const all = await listProducts({}, tx);
  const ids = new Set(rel.map((r) => r.relatedId));
  return all.filter((p) => ids.has(p.id));
}

export async function variantsByIds(ids: string[], tx: Tx = getDb()) {
  if (!ids.length) return [];
  return tx.query.productVariants.findMany({
    where: inArray(schema.productVariants.id, ids),
    with: { product: true },
  });
}
