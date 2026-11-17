/**
 * Love Lives Here — database schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions
 *  - All money is stored as integer kobo (₦1 = 100 kobo). Never floats.
 *  - Calendar dates for delivery are stored as DATE strings (YYYY-MM-DD)
 *    interpreted in the business timezone Africa/Lagos.
 *  - Secrets/tokens handed to customers are stored only as SHA-256 hashes.
 */
import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, jsonb, serial,
  uniqueIndex, index, check, primaryKey, customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts("created_at").notNull().defaultNow();

// ---------------------------------------------------------------- enums
export const staffRole = pgEnum("staff_role", ["owner", "manager", "writer", "fulfilment"]);
export const productKind = pgEnum("product_kind", ["letter", "candle", "gold_card", "llh_tag", "flower", "bundle", "other"]);
export const priceStatus = pgEnum("price_status", ["confirmed", "unverified", "quote"]);
export const zoneMode = pgEnum("zone_mode", ["fixed", "quote", "pickup"]);
export const orderStatus = pgEnum("order_status", [
  "awaiting_quote", "pending_payment", "paid", "drafting", "awaiting_approval", "approved",
  "in_production", "packed", "dispatched", "delivered",
  "on_hold", "delivery_failed", "cancelled", "refunded",
]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "pending", "paid", "partially_refunded", "refunded", "failed"]);
export const txStatus = pgEnum("tx_status", ["initialized", "success", "failed", "abandoned", "reversed"]);
export const letterMode = pgEnum("letter_mode", ["own_words", "help_me"]);
export const draftStatus = pgEnum("draft_status", ["draft", "sent", "approved", "changes_requested", "superseded"]);
export const nfcKind = pgEnum("nfc_kind", ["gold_card", "llh_tag"]);
export const nfcStatus = pgEnum("nfc_status", ["draft", "active", "disabled"]);
export const nfcItemKind = pgEnum("nfc_item_kind", ["note", "photo", "audio", "playlist", "link"]);
export const timeWindow = pgEnum("time_window", ["any", "morning", "afternoon", "evening", "night"]);
export const refundStatus = pgEnum("refund_status", ["pending", "processing", "processed", "failed", "manual"]);
export const outboxStatus = pgEnum("outbox_status", ["queued", "sent", "failed", "manual"]);

// ---------------------------------------------------------------- staff & auth
export const staffUsers = pgTable("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: staffRole("role").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  /** Last accepted TOTP time-step, so a code can't be replayed */
  totpLastStep: integer("totp_last_step"),
  active: boolean("active").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  lastLoginAt: ts("last_login_at"),
  createdAt: created(),
}, (t) => [uniqueIndex("staff_email_uq").on(sql`lower(${t.email})`)]);

export const staffSessions = pgTable("staff_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull(),
  userId: uuid("user_id").notNull().references(() => staffUsers.id, { onDelete: "cascade" }),
  mfaPassed: boolean("mfa_passed").notNull().default(false),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: created(),
  expiresAt: ts("expires_at").notNull(),
}, (t) => [uniqueIndex("session_token_uq").on(t.tokenHash), index("session_user_idx").on(t.userId)]);

// ---------------------------------------------------------------- catalogue
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: productKind("kind").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  badge: text("badge"),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  /** Working days LLH needs to make it (excludes delivery). */
  productionDays: integer("production_days").notNull().default(2),
  deliveryEligible: boolean("delivery_eligible").notNull().default(true),
  /** False = can only be added alongside another item (e.g. an add-on). */
  standalone: boolean("standalone").notNull().default(true),
  requiresLetterBrief: boolean("requires_letter_brief").notNull().default(false),
  /** Letter words must be approved by the buyer before production. */
  requiresApproval: boolean("requires_approval").notNull().default(false),
  nfc: nfcKind("nfc"),
  optionLabel: text("option_label").notNull().default("Option"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [check("production_days_nonneg", sql`${t.productionDays} >= 0`)]);

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  src: text("src").notNull(),
  alt: text("alt").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sort: integer("sort").notNull().default(0),
}, (t) => [index("product_images_product_idx").on(t.productId)]);

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  /** kobo; null when the price must be quoted */
  price: integer("price"),
  priceStatus: priceStatus("price_status").notNull().default("confirmed"),
  /** null = not stock-tracked (made to order) */
  stock: integer("stock"),
  active: boolean("active").notNull().default(true),
  attributes: jsonb("attributes").$type<Record<string, string | number>>().notNull().default({}),
  sort: integer("sort").notNull().default(0),
}, (t) => [
  index("variants_product_idx").on(t.productId),
  check("variant_price_nonneg", sql`${t.price} is null or ${t.price} >= 0`),
  check("variant_stock_nonneg", sql`${t.stock} is null or ${t.stock} >= 0`),
  check("variant_price_matches_status", sql`(${t.priceStatus} = 'quote') = (${t.price} is null)`),
]);

export const productRelations = pgTable("product_relations", {
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  relatedId: uuid("related_id").notNull().references(() => products.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.productId, t.relatedId] })]);

/** Contents of a curated bundle (a product of kind "bundle"). */
export const bundleItems = pgTable("bundle_items", {
  bundleProductId: uuid("bundle_product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
}, (t) => [primaryKey({ columns: [t.bundleProductId, t.variantId] }), check("bundle_qty_pos", sql`${t.quantity} > 0`)]);

// ---------------------------------------------------------------- delivery
export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  areas: text("areas").notNull().default(""),
  mode: zoneMode("mode").notNull().default("fixed"),
  /** kobo; required when mode = fixed */
  fee: integer("fee"),
  region: text("region").notNull().default("lagos"),
  /** Extra transit days on top of production time (e.g. interstate) */
  transitDays: integer("transit_days").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
}, (t) => [check("zone_fee_matches_mode", sql`(${t.mode} = 'fixed') = (${t.fee} is not null)`)]);

/** Per-day overrides: blackouts and capacity (Africa/Lagos calendar dates). */
export const calendarDays = pgTable("calendar_days", {
  day: date("day").primaryKey(),
  blocked: boolean("blocked").notNull().default(false),
  capacity: integer("capacity"),
  note: text("note"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------- orders
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  /** Client-generated key so a double-submitted checkout can't create two orders */
  checkoutKey: text("checkout_key").unique(),
  status: orderStatus("status").notNull(),
  paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  buyerEmail: text("buyer_email"),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone"),
  zoneId: integer("zone_id").references(() => deliveryZones.id),
  zoneName: text("zone_name").notNull(),
  deliveryMode: zoneMode("delivery_mode").notNull(),
  deliveryAddress: text("delivery_address"),
  deliveryInstructions: text("delivery_instructions"),
  /** e.g. the message hidden inside a Secret Candle */
  giftNote: text("gift_note"),
  deliveryDate: date("delivery_date").notNull(),
  deliveryWindow: text("delivery_window"),
  /** kobo; null while awaiting a quote */
  deliveryFee: integer("delivery_fee"),
  subtotal: integer("subtotal").notNull(),
  total: integer("total"),
  currency: text("currency").notNull().default("NGN"),
  approvalRequired: boolean("approval_required").notNull().default(false),
  photoBeforeDispatch: boolean("photo_before_dispatch").notNull().default(false),
  trackingTokenHash: text("tracking_token_hash").notNull(),
  assignedTo: uuid("assigned_to").references(() => staffUsers.id, { onDelete: "set null" }),
  source: jsonb("source").$type<{ source?: string; medium?: string; campaign?: string; referrer?: string }>().notNull().default({}),
  privacyNoticeVersion: text("privacy_notice_version").notNull(),
  consentAt: ts("consent_at").notNull(),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  /** Orders paid with Paystack test keys are flagged and excluded from business stats */
  testMode: boolean("test_mode").notNull().default(false),
  duplicatePaymentFlag: boolean("duplicate_payment_flag").notNull().default(false),
  createdAt: created(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  paidAt: ts("paid_at"),
  deliveredAt: ts("delivered_at"),
  /** After this date personal content may be purged (see retention policy) */
  retainUntil: date("retain_until"),
  anonymisedAt: ts("anonymised_at"),
}, (t) => [
  index("orders_status_idx").on(t.status),
  index("orders_created_idx").on(t.createdAt),
  index("orders_delivery_date_idx").on(t.deliveryDate),
  index("orders_buyer_phone_idx").on(t.buyerPhone),
  check("orders_amounts_nonneg", sql`${t.subtotal} >= 0 and (${t.total} is null or ${t.total} >= 0)`),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull(),
  kind: productKind("kind").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: integer("line_total").notNull(),
}, (t) => [
  index("order_items_order_idx").on(t.orderId),
  check("order_item_qty_pos", sql`${t.quantity} > 0`),
  check("order_item_line_ok", sql`${t.lineTotal} = ${t.unitPrice} * ${t.quantity}`),
]);

/** The private letter brief. Visible only to roles with letter access. */
export const letterBriefs = pgTable("letter_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }),
  mode: letterMode("mode").notNull(),
  message: text("message"),
  relationship: text("relationship"),
  occasion: text("occasion"),
  feelings: text("feelings"),
  memories: text("memories"),
  tone: text("tone"),
  avoid: text("avoid"),
  nicknames: text("nicknames"),
  signOff: text("sign_off"),
  createdAt: created(),
}, (t) => [index("letter_briefs_order_idx").on(t.orderId)]);

export const letterDrafts = pgTable("letter_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  status: draftStatus("status").notNull().default("draft"),
  createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
  customerFeedback: text("customer_feedback"),
  sentAt: ts("sent_at"),
  respondedAt: ts("responded_at"),
  createdAt: created(),
}, (t) => [uniqueIndex("letter_draft_version_uq").on(t.orderId, t.version)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("paystack"),
  reference: text("reference").notNull().unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("NGN"),
  status: txStatus("status").notNull().default("initialized"),
  channel: text("channel"),
  providerTransactionId: text("provider_transaction_id"),
  gatewayResponse: text("gateway_response"),
  testMode: boolean("test_mode"),
  verifiedAt: ts("verified_at"),
  createdAt: created(),
}, (t) => [index("payments_order_idx").on(t.orderId)]);

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").references(() => payments.id),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: refundStatus("status").notNull().default("pending"),
  providerRefundId: text("provider_refund_id"),
  createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [check("refund_amount_pos", sql`${t.amount} > 0`)]);

/** Every verified webhook delivery, de-duplicated — makes processing idempotent. */
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  event: text("event").notNull(),
  reference: text("reference"),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  result: text("result"),
}, (t) => [uniqueIndex("webhook_dedupe_uq").on(t.provider, t.dedupeKey)]);

/** Order timeline: status changes, notes, customer actions. */
export const orderEvents = pgTable("order_events", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  message: text("message"),
  visibleToCustomer: boolean("visible_to_customer").notNull().default(false),
  actorId: uuid("actor_id").references(() => staffUsers.id, { onDelete: "set null" }),
  actorLabel: text("actor_label").notNull(),
  createdAt: created(),
}, (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)]);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }).unique(),
  riderName: text("rider_name"),
  riderPhone: text("rider_phone"),
  dispatchedAt: ts("dispatched_at"),
  deliveredAt: ts("delivered_at"),
  failedReason: text("failed_reason"),
  notes: text("notes"),
});

// ---------------------------------------------------------------- Gold Card / LLH Tag
export const nfcExperiences = pgTable("nfc_experiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  kind: nfcKind("kind").notNull(),
  /** 22-char random URL token (128 bits). Not guessable, not sequential. */
  publicToken: text("public_token").notNull().unique(),
  status: nfcStatus("status").notNull().default("draft"),
  title: text("title").notNull().default(""),
  recipientName: text("recipient_name"),
  fromName: text("from_name"),
  /** LLH Tag: where the tag sends people. Changeable without rewriting the tag. */
  redirectUrl: text("redirect_url"),
  accessCodeHash: text("access_code_hash"),
  startsAt: ts("starts_at"),
  expiresAt: ts("expires_at"),
  buyerCanEdit: boolean("buyer_can_edit").notNull().default(true),
  tagWrittenAt: ts("tag_written_at"),
  tagWrittenBy: uuid("tag_written_by").references(() => staffUsers.id, { onDelete: "set null" }),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: ts("last_viewed_at"),
  createdAt: created(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("nfc_order_idx").on(t.orderId)]);

export const nfcItems = pgTable("nfc_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  experienceId: uuid("experience_id").notNull().references(() => nfcExperiences.id, { onDelete: "cascade" }),
  kind: nfcItemKind("kind").notNull(),
  title: text("title"),
  body: text("body"),
  url: text("url"),
  assetId: uuid("asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  window: timeWindow("window").notNull().default("any"),
  sort: integer("sort").notNull().default(0),
  createdAt: created(),
}, (t) => [index("nfc_items_exp_idx").on(t.experienceId)]);

/** Private media (photos, voice notes). Stored in the DB so one backup covers everything. */
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  experienceId: uuid("experience_id"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  data: bytea("data").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: created(),
}, (t) => [index("media_exp_idx").on(t.experienceId)]);

// ---------------------------------------------------------------- support, newsletter, content
export const supportMessages = pgTable("support_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: text("order_number"),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  handledBy: uuid("handled_by").references(() => staffUsers.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [index("support_status_idx").on(t.status, t.createdAt)]);

/** Minimal signup log: hashed email only (the provider holds the address). */
export const newsletterSignups = pgTable("newsletter_signups", {
  id: serial("id").primaryKey(),
  emailHash: text("email_hash").notNull(),
  provider: text("provider").notNull(),
  result: text("result").notNull(),
  source: text("source"),
  consentText: text("consent_text").notNull(),
  createdAt: created(),
}, (t) => [index("newsletter_hash_idx").on(t.emailHash)]);

export const journalPosts = pgTable("journal_posts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  title: text("title").notNull(),
  /** Must be the real individual post URL. Cards without one are not shown. */
  url: text("url"),
  published: boolean("published").notNull().default(false),
  sort: integer("sort").notNull().default(0),
});

export const outbox = pgTable("notification_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: outboxStatus("status").notNull().default("queued"),
  error: text("error"),
  createdAt: created(),
  sentAt: ts("sent_at"),
}, (t) => [index("outbox_status_idx").on(t.status)]);

/** First-party analytics. Never contains names, phones, emails, addresses or messages. */
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sessionId: text("session_id"),
  path: text("path"),
  product: text("product"),
  value: integer("value"),
  orderNumber: text("order_number"),
  source: text("source"),
  medium: text("medium"),
  campaign: text("campaign"),
  test: boolean("test").notNull().default(false),
  createdAt: created(),
}, (t) => [index("analytics_name_time_idx").on(t.name, t.createdAt)]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: uuid("actor_id").references(() => staffUsers.id, { onDelete: "set null" }),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip"),
  createdAt: created(),
}, (t) => [index("audit_time_idx").on(t.createdAt)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull(),
});

// ---------------------------------------------------------------- relations (for relational queries)
import { relations } from "drizzle-orm";

export const productsRel = relations(products, ({ many, one }) => ({
  variants: many(productVariants),
  images: many(productImages),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));
export const variantsRel = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));
export const imagesRel = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
export const ordersRel = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  briefs: many(letterBriefs),
  drafts: many(letterDrafts),
  payments: many(payments),
  refunds: many(refunds),
  events: many(orderEvents),
  delivery: one(deliveries, { fields: [orders.id], references: [deliveries.orderId] }),
  assignee: one(staffUsers, { fields: [orders.assignedTo], references: [staffUsers.id] }),
  experiences: many(nfcExperiences),
}));
export const orderItemsRel = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const briefsRel = relations(letterBriefs, ({ one }) => ({ order: one(orders, { fields: [letterBriefs.orderId], references: [orders.id] }) }));
export const draftsRel = relations(letterDrafts, ({ one }) => ({ order: one(orders, { fields: [letterDrafts.orderId], references: [orders.id] }) }));
export const paymentsRel = relations(payments, ({ one }) => ({ order: one(orders, { fields: [payments.orderId], references: [orders.id] }) }));
export const refundsRel = relations(refunds, ({ one }) => ({ order: one(orders, { fields: [refunds.orderId], references: [orders.id] }) }));
export const eventsRel = relations(orderEvents, ({ one }) => ({ order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }) }));
export const deliveriesRel = relations(deliveries, ({ one }) => ({ order: one(orders, { fields: [deliveries.orderId], references: [orders.id] }) }));
export const nfcRel = relations(nfcExperiences, ({ one, many }) => ({
  order: one(orders, { fields: [nfcExperiences.orderId], references: [orders.id] }),
  items: many(nfcItems),
}));
export const nfcItemsRel = relations(nfcItems, ({ one }) => ({
  experience: one(nfcExperiences, { fields: [nfcItems.experienceId], references: [nfcExperiences.id] }),
}));
