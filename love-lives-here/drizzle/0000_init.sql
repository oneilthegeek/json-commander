CREATE TYPE "public"."draft_status" AS ENUM('draft', 'sent', 'approved', 'changes_requested', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."letter_mode" AS ENUM('own_words', 'help_me');--> statement-breakpoint
CREATE TYPE "public"."nfc_item_kind" AS ENUM('note', 'photo', 'audio', 'playlist', 'link');--> statement-breakpoint
CREATE TYPE "public"."nfc_kind" AS ENUM('gold_card', 'llh_tag');--> statement-breakpoint
CREATE TYPE "public"."nfc_status" AS ENUM('draft', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('awaiting_quote', 'pending_payment', 'paid', 'drafting', 'awaiting_approval', 'approved', 'in_production', 'packed', 'dispatched', 'delivered', 'on_hold', 'delivery_failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('queued', 'sent', 'failed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'pending', 'paid', 'partially_refunded', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."price_status" AS ENUM('confirmed', 'unverified', 'quote');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('letter', 'candle', 'gold_card', 'llh_tag', 'flower', 'bundle', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'manager', 'writer', 'fulfilment');--> statement-breakpoint
CREATE TYPE "public"."time_window" AS ENUM('any', 'morning', 'afternoon', 'evening', 'night');--> statement-breakpoint
CREATE TYPE "public"."tx_status" AS ENUM('initialized', 'success', 'failed', 'abandoned', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."zone_mode" AS ENUM('fixed', 'quote', 'pickup');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"session_id" text,
	"path" text,
	"product" text,
	"value" integer,
	"order_number" text,
	"source" text,
	"medium" text,
	"campaign" text,
	"test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle_items" (
	"bundle_product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bundle_items_bundle_product_id_variant_id_pk" PRIMARY KEY("bundle_product_id","variant_id"),
	CONSTRAINT "bundle_qty_pos" CHECK ("bundle_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "calendar_days" (
	"day" date PRIMARY KEY NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"rider_name" text,
	"rider_phone" text,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"failed_reason" text,
	"notes" text,
	CONSTRAINT "deliveries_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"areas" text DEFAULT '' NOT NULL,
	"mode" "zone_mode" DEFAULT 'fixed' NOT NULL,
	"fee" integer,
	"region" text DEFAULT 'lagos' NOT NULL,
	"transit_days" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "zone_fee_matches_mode" CHECK (("delivery_zones"."mode" = 'fixed') = ("delivery_zones"."fee" is not null))
);
--> statement-breakpoint
CREATE TABLE "journal_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"published" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid,
	"mode" "letter_mode" NOT NULL,
	"message" text,
	"relationship" text,
	"occasion" text,
	"feelings" text,
	"memories" text,
	"tone" text,
	"avoid" text,
	"nicknames" text,
	"sign_off" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"status" "draft_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"customer_feedback" text,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_hash" text NOT NULL,
	"provider" text NOT NULL,
	"result" text NOT NULL,
	"source" text,
	"consent_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nfc_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"kind" "nfc_kind" NOT NULL,
	"public_token" text NOT NULL,
	"status" "nfc_status" DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"recipient_name" text,
	"from_name" text,
	"redirect_url" text,
	"access_code_hash" text,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"buyer_can_edit" boolean DEFAULT true NOT NULL,
	"tag_written_at" timestamp with time zone,
	"tag_written_by" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nfc_experiences_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "nfc_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"kind" "nfc_item_kind" NOT NULL,
	"title" text,
	"body" text,
	"url" text,
	"asset_id" uuid,
	"window" time_window DEFAULT 'any' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"message" text,
	"visible_to_customer" boolean DEFAULT false NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"variant_name" text NOT NULL,
	"kind" "product_kind" NOT NULL,
	"unit_price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" integer NOT NULL,
	CONSTRAINT "order_item_qty_pos" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_item_line_ok" CHECK ("order_items"."line_total" = "order_items"."unit_price" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"checkout_key" text,
	"status" "order_status" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_phone" text NOT NULL,
	"buyer_email" text,
	"recipient_name" text NOT NULL,
	"recipient_phone" text,
	"zone_id" integer,
	"zone_name" text NOT NULL,
	"delivery_mode" "zone_mode" NOT NULL,
	"delivery_address" text,
	"delivery_instructions" text,
	"gift_note" text,
	"delivery_date" date NOT NULL,
	"delivery_window" text,
	"delivery_fee" integer,
	"subtotal" integer NOT NULL,
	"total" integer,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"approval_required" boolean DEFAULT false NOT NULL,
	"photo_before_dispatch" boolean DEFAULT false NOT NULL,
	"tracking_token_hash" text NOT NULL,
	"assigned_to" uuid,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"privacy_notice_version" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"test_mode" boolean DEFAULT false NOT NULL,
	"duplicate_payment_flag" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"retain_until" date,
	"anonymised_at" timestamp with time zone,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_checkout_key_unique" UNIQUE("checkout_key"),
	CONSTRAINT "orders_amounts_nonneg" CHECK ("orders"."subtotal" >= 0 and ("orders"."total" is null or "orders"."total" >= 0))
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "outbox_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"reference" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" "tx_status" DEFAULT 'initialized' NOT NULL,
	"channel" text,
	"provider_transaction_id" text,
	"gateway_response" text,
	"test_mode" boolean,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"src" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_relations" (
	"product_id" uuid NOT NULL,
	"related_id" uuid NOT NULL,
	CONSTRAINT "product_relations_product_id_related_id_pk" PRIMARY KEY("product_id","related_id")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"price" integer,
	"price_status" "price_status" DEFAULT 'confirmed' NOT NULL,
	"stock" integer,
	"active" boolean DEFAULT true NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "variant_price_nonneg" CHECK ("product_variants"."price" is null or "product_variants"."price" >= 0),
	CONSTRAINT "variant_stock_nonneg" CHECK ("product_variants"."stock" is null or "product_variants"."stock" >= 0),
	CONSTRAINT "variant_price_matches_status" CHECK (("product_variants"."price_status" = 'quote') = ("product_variants"."price" is null))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "product_kind" NOT NULL,
	"category_id" integer,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"badge" text,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"production_days" integer DEFAULT 2 NOT NULL,
	"delivery_eligible" boolean DEFAULT true NOT NULL,
	"standalone" boolean DEFAULT true NOT NULL,
	"requires_letter_brief" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"nfc" "nfc_kind",
	"option_label" text DEFAULT 'Option' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "production_days_nonneg" CHECK ("products"."production_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"provider_refund_id" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_amount_pos" CHECK ("refunds"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"mfa_passed" boolean DEFAULT false NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_last_step" integer,
	"active" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"event" text NOT NULL,
	"reference" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"result" text
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_staff_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_product_id_products_id_fk" FOREIGN KEY ("bundle_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_briefs" ADD CONSTRAINT "letter_briefs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_briefs" ADD CONSTRAINT "letter_briefs_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_drafts" ADD CONSTRAINT "letter_drafts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_drafts" ADD CONSTRAINT "letter_drafts_created_by_staff_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_experiences" ADD CONSTRAINT "nfc_experiences_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_experiences" ADD CONSTRAINT "nfc_experiences_tag_written_by_staff_users_id_fk" FOREIGN KEY ("tag_written_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_items" ADD CONSTRAINT "nfc_items_experience_id_nfc_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."nfc_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_items" ADD CONSTRAINT "nfc_items_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_staff_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_zone_id_delivery_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_to_staff_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_related_id_products_id_fk" FOREIGN KEY ("related_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_staff_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_user_id_staff_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_handled_by_staff_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_name_time_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "audit_time_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "letter_briefs_order_idx" ON "letter_briefs" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "letter_draft_version_uq" ON "letter_drafts" USING btree ("order_id","version");--> statement-breakpoint
CREATE INDEX "media_exp_idx" ON "media_assets" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "newsletter_hash_idx" ON "newsletter_signups" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "nfc_order_idx" ON "nfc_experiences" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "nfc_items_exp_idx" ON "nfc_items" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_delivery_date_idx" ON "orders" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "orders_buyer_phone_idx" ON "orders" USING btree ("buyer_phone");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "notification_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uq" ON "staff_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "staff_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_uq" ON "staff_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "support_status_idx" ON "support_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_dedupe_uq" ON "webhook_events" USING btree ("provider","dedupe_key");