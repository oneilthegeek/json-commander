/**
 * Seeds the catalogue and delivery zones with the values published on the
 * original love-lives-here.html. Nothing here is invented:
 *  - Prices from the source are seeded as "unverified" (shown and payable,
 *    but flagged in the admin until LLH confirms them).
 *  - Chrysanthemum prices were marked as placeholders on the source page, so
 *    they are seeded as "Request a quote" (not payable). The placeholder
 *    numbers are kept in `attributes.sourcePlaceholder` for reference only.
 *  - Business claims (200+ letters, 4.9★) are stored as unverified and hidden.
 *
 * Idempotent: re-running updates by slug/sku and never deletes orders.
 */
import { eq, sql } from "drizzle-orm";
import { getDb, closeDb, schema } from "../src/lib/db";
import { naira } from "../src/lib/money";

type Seed = {
  slug: string; name: string; kind: (typeof schema.productKind.enumValues)[number]; category: string;
  tagline: string; description: string; badge?: string; featured?: boolean; productionDays?: number;
  requiresLetterBrief?: boolean; requiresApproval?: boolean; nfc?: "gold_card" | "llh_tag"; optionLabel?: string;
  seoTitle?: string; seoDescription?: string;
  images: { src: string; alt: string; width: number; height: number }[];
  variants: { name: string; sku: string; price: number | null; status: "confirmed" | "unverified" | "quote"; attributes?: Record<string, string | number> }[];
};

const CATEGORIES = [
  { slug: "letters", name: "Letters", sort: 1 },
  { slug: "candles", name: "Candles", sort: 2 },
  { slug: "gold-card", name: "Gold Card", sort: 3 },
  { slug: "llh-tag", name: "LLH Tag", sort: 4 },
  { slug: "flowers", name: "Flowers", sort: 5 },
];

const PRODUCTS: Seed[] = [
  {
    slug: "handwritten-letter", name: "The Letter", kind: "letter", category: "letters", badge: "Most loved", featured: true,
    tagline: "Your feelings, our words, sealed in wax and boxed for them",
    description: "Tell us what you want to say — in your own words, or with our help. Every letter is written by hand for one person, never copied. We send you the words to read first; nothing is sealed until you say yes. Then it's sealed in wax, boxed, and delivered to their door.",
    productionDays: 2, requiresLetterBrief: true, requiresApproval: true, optionLabel: "Letter",
    seoTitle: "Handwritten Love Letters in Lagos, Sealed in Wax",
    seoDescription: "A handwritten letter in your words (or ours), sealed in wax, boxed and delivered across Lagos and Nigeria. Read it before we seal it.",
    images: [
      { src: "/images/handwritten-love-letter-dear-voke.jpg", alt: "An open Love Lives Here letter in a kraft box, beginning “Dear Voke”", width: 1000, height: 1333 },
      { src: "/images/llh-kraft-gift-box-dried-flowers.jpg", alt: "The kraft Love Lives Here gift box with a printed band and dried flowers", width: 900, height: 1200 },
    ],
    variants: [{ name: "Handwritten letter", sku: "LLH-LETTER", price: naira(10000), status: "unverified" }],
  },
  {
    slug: "secret-candle", name: "The Secret Candle", kind: "candle", category: "candles", badge: "Most loved",
    tagline: "Scented, with a message hidden inside. Burn it down to read it.",
    description: "A scented candle in a deep red tin with a wood-look lid, and a message from you hidden inside. Burn it down to find it. Choose chocolate or tropical.",
    productionDays: 2, optionLabel: "Scent",
    seoTitle: "The Secret Candle — a scented candle with a hidden message",
    seoDescription: "A scented candle with your message hidden inside. Chocolate or tropical. Made in Lagos by Love Lives Here.",
    images: [{ src: "/images/secret-candle-red-tin.jpg", alt: "The Secret Candle in a deep red tin with a wood-look lid", width: 540, height: 612 }],
    variants: [
      { name: "Chocolate", sku: "LLH-CANDLE-CHOC", price: naira(8500), status: "unverified", attributes: { scent: "Chocolate" } },
      { name: "Tropical", sku: "LLH-CANDLE-TROP", price: naira(8500), status: "unverified", attributes: { scent: "Tropical" } },
    ],
  },
  {
    slug: "gold-card", name: "The Gold Card", kind: "gold_card", category: "gold-card", badge: "Only at LLH", nfc: "gold_card",
    tagline: "A note from you they open with a tap",
    description: "A gold card that comes with your gift. They tap it with their phone — no app, no download — and a note from you opens on screen. Add your voice, photos or a song. It can even show a different message depending on the time of day.",
    productionDays: 2, optionLabel: "Card",
    seoTitle: "The Gold Card — an NFC gift card that opens your message",
    seoDescription: "A gold NFC card: they tap it with their phone and your personal note, voice message, photos or playlist opens. No app needed.",
    images: [{ src: "/images/llh-gold-card-nfc.jpg", alt: "The Love Lives Here Gold Card, printed “A letter is waiting for you”", width: 1000, height: 631 }],
    variants: [{ name: "Gold Card", sku: "LLH-GOLDCARD", price: naira(12500), status: "unverified" }],
  },
  {
    slug: "llh-tag", name: "The LLH Tag", kind: "llh_tag", category: "llh-tag", badge: "New", nfc: "llh_tag",
    tagline: "Tap it and it opens any link you choose: a playlist, a video, your photos",
    description: "A round NFC sticker. Tap it with a phone and it opens the link you choose — a playlist, a video, a photo album. We can change where it points later, without replacing the tag.",
    productionDays: 2, optionLabel: "Tag",
    seoTitle: "The LLH Tag — an NFC sticker that opens your link",
    seoDescription: "A tap-to-open NFC sticker that sends them to the playlist, video or photos you choose.",
    images: [],
    variants: [{ name: "LLH Tag", sku: "LLH-TAG", price: naira(4500), status: "unverified" }],
  },
  {
    slug: "roses-full-bouquet", name: "Roses, full bouquet", kind: "flower", category: "flowers", optionLabel: "Stems",
    tagline: "Red roses with fillers, wrapped in black", description: "Red roses with fillers, wrapped in black. Bigger bouquets on request.",
    seoTitle: "Red Rose Bouquet Delivery in Lagos", seoDescription: "Red roses with fillers in a black wrap, delivered in Lagos. 5 to 20 stems.",
    images: [{ src: "/images/red-roses-full-bouquet-black-wrap.jpg", alt: "A full bouquet of red roses with fillers in a black wrap", width: 560, height: 700 }],
    variants: [5, 10, 15, 20].map((n, i) => ({ name: `${n} stems`, sku: `LLH-ROSE-FULL-${n}`, price: naira([55000, 105000, 155000, 210000][i]), status: "unverified" as const, attributes: { stems: n } })),
  },
  {
    slug: "roses-just-roses", name: "Roses, just roses", kind: "flower", category: "flowers", optionLabel: "Stems",
    tagline: "Red roses on their own in a white wrap", description: "Red roses on their own, in a white wrap. Bigger bouquets on request.",
    seoTitle: "Red Roses in a White Wrap, Lagos Delivery", seoDescription: "Red roses on their own in a white wrap, delivered in Lagos. 5 to 20 stems.",
    images: [{ src: "/images/red-roses-white-wrap.jpg", alt: "Red roses on their own in a white wrap", width: 560, height: 700 }],
    variants: [5, 10, 15, 20].map((n, i) => ({ name: `${n} stems`, sku: `LLH-ROSE-JUST-${n}`, price: naira([50000, 95000, 145000, 190000][i]), status: "unverified" as const, attributes: { stems: n } })),
  },
  {
    slug: "chrysanthemums-full-bouquet", name: "Chrysanthemums, full bouquet", kind: "flower", category: "flowers", optionLabel: "Stems",
    tagline: "Bright yellow blooms with fillers in a cream wrap", description: "Bright yellow chrysanthemums with fillers in a cream wrap. Priced on request — ask us on WhatsApp.",
    images: [{ src: "/images/yellow-chrysanthemums-full-bouquet.jpg", alt: "Yellow chrysanthemums in a cream wrap", width: 560, height: 700 }],
    variants: [6, 12, 24].map((n, i) => ({ name: `${n} stems`, sku: `LLH-CHRYS-FULL-${n}`, price: null, status: "quote" as const, attributes: { stems: n, sourcePlaceholder: [20000, 35000, 65000][i] } })),
  },
  {
    slug: "chrysanthemums-just-blooms", name: "Chrysanthemums, just blooms", kind: "flower", category: "flowers", optionLabel: "Stems",
    tagline: "Pink and purple chrysanthemums on their own", description: "Pink and purple chrysanthemums on their own, in a white wrap with a black edge. Priced on request — ask us on WhatsApp.",
    images: [{ src: "/images/pink-purple-chrysanthemums.jpg", alt: "Pink and purple chrysanthemums in a white wrap with a black edge", width: 560, height: 700 }],
    variants: [6, 12, 24].map((n, i) => ({ name: `${n} stems`, sku: `LLH-CHRYS-JUST-${n}`, price: null, status: "quote" as const, attributes: { stems: n, sourcePlaceholder: [15000, 28000, 52000][i] } })),
  },
];

const RELATED: [string, string[]][] = [
  ["handwritten-letter", ["secret-candle", "gold-card", "roses-full-bouquet", "llh-tag"]],
  ["secret-candle", ["handwritten-letter", "gold-card", "roses-just-roses"]],
  ["gold-card", ["handwritten-letter", "llh-tag", "secret-candle"]],
  ["llh-tag", ["gold-card", "handwritten-letter"]],
  ["roses-full-bouquet", ["handwritten-letter", "secret-candle", "roses-just-roses"]],
  ["roses-just-roses", ["handwritten-letter", "roses-full-bouquet"]],
  ["chrysanthemums-full-bouquet", ["handwritten-letter", "roses-full-bouquet"]],
  ["chrysanthemums-just-blooms", ["handwritten-letter", "roses-just-roses"]],
];

// From the original delivery table. "Another Lagos area" / "Another state" are quoted per order.
const ZONES = [
  { name: "Yaba, Mushin, Ilupeju", fee: 3000 },
  { name: "Bariga, Surulere, Shomolu", fee: 3500 },
  { name: "Ikeja, Gbagada, Apapa", fee: 4500 },
  { name: "Victoria Island", fee: 5500 },
  { name: "Ikoyi, Abule Egba", fee: 6000 },
  { name: "Lekki Phase 1", fee: 7000 },
  { name: "Lekki Phase 2", fee: 7500 },
  { name: "Ajah", fee: 8500 },
];

const JOURNAL = [
  { label: "Prompts", title: "Five first lines for when you don't know where to start" },
  { label: "Essay", title: "Why a letter lands harder than a text" },
  { label: "Guide", title: "How to write to someone who lives far away" },
  { label: "Story", title: "Love in Lagos: notes from the people who send them" },
];

export async function seed() {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const c of CATEGORIES) await tx.insert(schema.categories).values(c).onConflictDoUpdate({ target: schema.categories.slug, set: { name: c.name, sort: c.sort } });
    const cats = new Map((await tx.select().from(schema.categories)).map((c) => [c.slug, c.id]));

    for (const [i, p] of PRODUCTS.entries()) {
      const values = {
        slug: p.slug, name: p.name, kind: p.kind, categoryId: cats.get(p.category)!, tagline: p.tagline, description: p.description,
        badge: p.badge ?? null, featured: p.featured ?? false, productionDays: p.productionDays ?? 2,
        requiresLetterBrief: p.requiresLetterBrief ?? false, requiresApproval: p.requiresApproval ?? false, nfc: p.nfc ?? null,
        optionLabel: p.optionLabel ?? "Option", seoTitle: p.seoTitle ?? null, seoDescription: p.seoDescription ?? null, sort: i,
      };
      const existing = await tx.query.products.findFirst({ where: eq(schema.products.slug, p.slug) });
      // On re-seed, keep staff edits to prices/stock/descriptions; only fill in new things.
      const [prod] = existing ? [existing] : await tx.insert(schema.products).values(values).returning();
      if (!existing) {
        for (const [j, im] of p.images.entries()) await tx.insert(schema.productImages).values({ productId: prod.id, ...im, sort: j });
      }
      for (const [j, v] of p.variants.entries()) {
        await tx.insert(schema.productVariants).values({
          productId: prod.id, name: v.name, sku: v.sku, price: v.price, priceStatus: v.status, attributes: v.attributes ?? {}, sort: j,
        }).onConflictDoNothing({ target: schema.productVariants.sku });
      }
    }
    const ids = new Map((await tx.select({ id: schema.products.id, slug: schema.products.slug }).from(schema.products)).map((r) => [r.slug, r.id]));
    for (const [from, tos] of RELATED) for (const to of tos)
      await tx.insert(schema.productRelations).values({ productId: ids.get(from)!, relatedId: ids.get(to)! }).onConflictDoNothing();

    const zoneCount = await tx.$count(schema.deliveryZones);
    if (zoneCount === 0) {
      let sort = 0;
      for (const z of ZONES) await tx.insert(schema.deliveryZones).values({ name: z.name, areas: z.name, mode: "fixed", fee: naira(z.fee), region: "lagos", sort: sort++ });
      await tx.insert(schema.deliveryZones).values({ name: "Another Lagos area", areas: "Anywhere in Lagos not listed above", mode: "quote", region: "lagos", sort: sort++ });
      await tx.insert(schema.deliveryZones).values({ name: "Another state", areas: "Nationwide — we'll quote the fee and delivery time", mode: "quote", region: "nationwide", sort: sort++ });
      await tx.insert(schema.deliveryZones).values({ name: "I'll pick it up", areas: "Collect in Lagos — we'll confirm the pickup point on WhatsApp", mode: "pickup", region: "pickup", sort: sort++ });
    }

    const jc = await tx.$count(schema.journalPosts);
    if (jc === 0) for (const [i, j] of JOURNAL.entries()) await tx.insert(schema.journalPosts).values({ ...j, url: null, published: false, sort: i });
  });
  const counts = await db.execute(sql`select (select count(*) from products) products, (select count(*) from product_variants) variants, (select count(*) from delivery_zones) zones`);
  console.log("seeded", counts.rows[0]);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().then(closeDb).catch((e) => { console.error(e); process.exit(1); });
}
