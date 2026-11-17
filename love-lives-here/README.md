# Love Lives Here — shop, orders and Gold Cards

The Love Lives Here website (handwritten letters, Secret Candles, Gold Cards, LLH Tags and flowers, made in Lagos), rebuilt from the single-file `love-lives-here.html` into a working shop:

- **Customers** browse and buy gifts (with or without a letter), write their letter in their own words or with guided questions, choose a delivery area and date, pay with Paystack, track the order, approve their letter before it's sealed, and add notes, photos, voice and songs to a Gold Card.
- **Staff** manage orders, letter drafts and approvals, delivery quotes, riders, stock, prices, delivery fees and blocked dates, Gold Cards and NFC tags, refunds, customer messages, staff roles, analytics and an audit log.

| Read next | |
|---|---|
| `docs/AUDIT.md` | What the original site had, every defect found, and what changed |
| `docs/CHECKLIST.md` | Each requirement with its status, including what is still blocked |
| `docs/TEST-RESULTS.md` | Test, Lighthouse, audit and backup results |
| `docs/DEPLOYMENT.md` | Going live: server, Paystack, newsletter, email, backups, Search Console |
| `docs/NFC-TAG-WRITING.md` | How staff program and test physical cards |

## Stack
Next.js 15 (App Router, TypeScript, React 19), PostgreSQL 16 with Drizzle ORM and SQL migrations, Paystack (server-side), Vitest and Playwright. Only five runtime libraries beyond Next and React: `pg`, `drizzle-orm`, `zod`, `libphonenumber-js` and `qrcode`. Auth, TOTP, rate limiting and analytics are implemented in-house to keep the operating surface small.

## Run it locally
Requirements: Node 20.18+, PostgreSQL 16.
```bash
cp .env.example .env            # set DATABASE_URL, APP_SECRET
npm install
npm run db:migrate && npm run db:seed
npm run staff:create -- --email you@example.com --name "You" --role owner
npm run dev                     # http://localhost:3000  · admin at /admin
```
Without `PAYSTACK_SECRET_KEY` the shop works but can't take online payments. Customers see “Online payment isn't switched on yet” and their order is still saved. Nothing pretends to be paid.

## Scripts
| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit + integration tests (needs a `llh_test` database; see `tests/setup-env.ts`) |
| `npm run test:e2e` | Builds must exist (`npm run build`); starts a Paystack mock + the production server on :3100 against `llh_e2e` |
| `npm run db:generate` | Create a new migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations / load the catalogue and delivery zones from the original site (idempotent) |
| `npm run staff:create` | Create or reset a staff account (password is prompted for, never passed as an argument) |
| `npm run retention` | Data-retention job (add `-- --dry-run` to preview) |
| `npm run images` | Re-extract images from the original HTML |

## Project structure
```
src/
  app/
    (site)/                 public shop: home, shop, shop/[slug], letter, cart, checkout(+complete),
                            orders/[number] (private tracking, approval, card editor), track, gold-card,
                            faq, delivery, privacy, terms, refunds, contact, newsletter/unsubscribe
    c/[token]/              the page a Gold Card / LLH Tag opens (+ secret-word unlock, private media)
    admin/(auth)/           sign-in and two-factor
    admin/(app)/            dashboard, orders, order detail + receipt, products, delivery, nfc/[id],
                            messages, outbox, payments, content, staff, security, audit; actions.ts
    api/                    cart/quote, checkout, orders/[number]/pay|letter, webhooks/paystack,
                            newsletter, support, events, zones, delivery/dates
    sitemap.ts robots.ts layout.tsx globals.css
  components/               UI (cart context, AddToBag, Gallery, CardEditor, GoldCardView, …)
  lib/
    db/schema.ts            all tables, enums, constraints, relations
    pricing.ts              the only place prices and totals are calculated
    orders.ts payments.ts paystack.ts order-status.ts scheduling.ts dates.ts
    nfc.ts nfc-edit.ts media.ts newsletter.ts notifications.ts analytics.ts reports.ts
    auth/                   password (scrypt), totp, session, permissions (roles)
  middleware.ts             CSP with nonces, security headers, cross-site API block
drizzle/                    SQL migrations
scripts/                    migrate, seed, create-staff, retention, extract-images
tests/                      unit/, integration/, e2e/, mocks/paystack-server.ts
deploy/                     docker-compose.yml, Caddyfile, backup.sh   (+ Dockerfile at root)
docs/                       audit, checklist, test results, deployment, NFC guide, original HTML
public/images/              photos extracted from the original file, with descriptive names
```

## Data model (summary)
`products` → `product_variants` (price in kobo, `confirmed | unverified | quote`, optional stock) → `product_images`, `product_relations`, `bundle_items`; `delivery_zones` (`fixed | quote | pickup`), `calendar_days` (blackouts and capacity), `settings`; `orders` → `order_items`, `letter_briefs`, `letter_drafts` (versioned), `payments`, `refunds`, `order_events` (timeline), `deliveries`, `nfc_experiences` → `nfc_items`, `media_assets`; `webhook_events` (idempotency), `staff_users`, `staff_sessions`, `audit_logs`, `support_messages`, `newsletter_signups` (hashed emails only), `journal_posts`, `notification_outbox`, `analytics_events` (no personal data), `rate_limits`.

## Key rules
- Money is integer kobo everywhere. Totals come only from `priceCart()` on the server.
- An order is **paid** only after the server verifies the transaction with Paystack (amount, currency and reference must all match). Callback, webhook and staff re-checks are idempotent.
- Letters that need approval can't move to production until the buyer approves a version, on the website or as recorded by staff with a note.
- All dates use the Africa/Lagos calendar. The earliest delivery date accounts for production days, cut-off hour, transit, closed weekdays, blocked dates and daily capacity.
- Private links (order pages, Gold Cards) use long random or HMAC tokens, and wrong tokens get a plain 404.
