# Love Lives Here — guide for independent review

This file lets another developer (or AI system) check the project's claims without trusting earlier reports. Every number below comes from a command you can rerun. Nothing here is a secret: credentials shown are throwaway local test values.

Last full review: **17–18 November 2026**. The exact commit is recorded in the final report and in `git log`.

---

## 1. Architecture overview
A single Next.js application (server-rendered React) with PostgreSQL. There is no separate API service.

```
Browser ──HTTPS──> Caddy (TLS, gzip/zstd) ──> Next.js app (Node 22, standalone build)
                                               ├─ PostgreSQL 16 (orders, catalogue, media bytes, sessions, rate limits, outbox)
                                               ├─ Paystack API (initialize / verify / refund)  ◄── Paystack webhooks
                                               ├─ Resend API (customer email, optional)
                                               ├─ Mailchimp API (newsletter, optional) / Substack hosted page (default)
                                               └─ ALERT_WEBHOOK_URL (Slack/Discord/Chat, optional)
Cron (host): nightly encrypted backup · nightly NDPA retention job · 5-minute email retry
```
- **Public site:** server components. Only small client islands run in the browser: the cart, add to bag, header menu, forms and the gallery.
- **Admin:** under `/admin`, authenticated server components, with mutations as server actions in `src/app/admin/(app)/actions.ts`.
- **Money:** always integer kobo. Only `src/lib/pricing.ts` computes totals. The browser never sends prices.

## 2. Frameworks and dependencies
**Runtime:** `next@15.5.29`, `react@19.3.1`, `react-dom@19.3.1`, `pg@8.23.1`, `drizzle-orm@0.45.4`, `zod@4.6.7`, `libphonenumber-js@1.13.16`, `qrcode@1.5.4` and `server-only`. Authentication, TOTP, rate limiting, analytics and the Paystack client are implemented in-house to keep third-party code small.

**Development:** TypeScript 5.9, Vitest 5.1, Playwright 1.63 with axe-core, drizzle-kit 0.31, tsx 4.21 and sharp (image extraction only).

**Overrides in `package.json`:**
- `sharp` and `postcss`: patched versions.
- `tsx → esbuild@0.28.2`: patched for GHSA-g7r4-m6w7-qqqr.

## 3. Important source directories
| Path | What's there |
|---|---|
| `src/app/(site)/` | Public pages: shop, product, letter flow, cart, checkout, order tracking, card editor, policies |
| `src/app/c/[token]/` | Page opened by a Gold Card / LLH Tag (secret-word unlock, private media) |
| `src/app/admin/` | Staff sign-in, two-step verification, all back-office pages, `actions.ts` |
| `src/app/api/` | JSON endpoints: cart quote, checkout, pay, letter approval, Paystack webhook, newsletter, support, events |
| `src/lib/` | Business logic. Key files: `pricing.ts`, `orders.ts`, `payments.ts`, `paystack.ts`, `order-status.ts`, `scheduling.ts`, `nfc*.ts`, `notifications.ts`, `retention.ts`, `auth/*` |
| `src/lib/db/schema.ts` | All tables, enums, CHECK constraints and indexes |
| `src/middleware.ts` | CSP with per-request nonce, security headers, cross-site POST block |
| `drizzle/` | SQL migrations, applied by `scripts/migrate.ts` |
| `scripts/` | migrate, seed, create-staff, retention, flush-outbox, extract-images |
| `tests/` | `unit/`, `integration/` (real Postgres plus a Paystack mock), `e2e/` (Playwright against the production build), `mocks/paystack-server.ts` |
| `deploy/` | `docker-compose.yml`, `Caddyfile`, `backup.sh`; `Dockerfile` at the project root |

## 4. Database schema overview (30 tables)
| Area | Tables |
|---|---|
| Catalogue | `categories`, `products`, `product_variants` (price in kobo, `confirmed / unverified / quote`, optional stock), `product_images`, `product_relations`, `bundle_items` |
| Delivery | `delivery_zones` (`fixed / quote / pickup`), `calendar_days` (blocked days, capacity), `settings` |
| Orders | `orders`, `order_items`, `letter_briefs`, `letter_drafts` (versioned), `order_events` (timeline), `deliveries` |
| Payments | `payments`, `refunds`, `webhook_events` (unique dedupe key) |
| Gold Card / Tag | `nfc_experiences` (128-bit public token, hashed secret word), `nfc_items`, `media_assets` (bytea, magic-byte checked) |
| Staff | `staff_users` (scrypt, TOTP, lockout), `staff_sessions` (hashed tokens), `audit_logs` |
| Comms and other | `notification_outbox`, `support_messages`, `newsletter_signups` (email hash only), `journal_posts`, `analytics_events` (no personal data), `rate_limits` |

**Integrity rules enforced by the database:**
- Money and quantities can't be negative.
- `line_total = unit × qty`.
- A variant's price must match its status (a quote item has no price).
- Order numbers, checkout keys, payment references and webhook dedupe keys are unique.

## 5. Authentication and authorisation
**Staff sign-in:**
- Passwords are hashed with scrypt.
- Five wrong passwords lock the account for 15 minutes. The counter is updated atomically.
- Sign-in attempts are also rate-limited per IP.
- Owners and managers must use TOTP (RFC 6238, ±1 step). A code can't be reused (`totp_last_step`).
- Sessions: a 32-byte random token is stored as a SHA-256 hash. The cookie is `__Host-`, HttpOnly, Secure and SameSite=Lax, and expires after 12 hours.
- Sessions are revoked on password change, deactivation and two-step reset.

**Roles** (`src/lib/auth/permissions.ts`). Every admin page calls `requireStaff(permission)`, and every server action calls `guard(permission)`.

| | owner | manager | writer | fulfilment |
|---|---|---|---|---|
| Letter brief and drafts | ✓ | ✓ | ✓ | ✗ |
| Customer phone, email, address (incl. contact on support messages) | ✓ | ✓ | ✗ | ✓ |
| Payments, refunds, manual payments | ✓ | ✓ | ✗ | ✗ |
| Gold Card content | ✓ | ✓ | ✓ | ✗ (can only write and test the tag) |
| Products and prices / stock | ✓ / ✓ | ✓ / ✓ | ✗ | ✗ / ✓ |
| Staff management | ✓ | ✗ | ✗ | ✗ |

**Customers** have no accounts. Each order has a private link: `t = HMAC-SHA256(APP_SECRET, "track:"+orderId)`, truncated to 32 characters, stored hashed and compared in constant time. A wrong token gives a plain 404. Gold Card pages use a 128-bit random token plus an optional secret word (scrypt). Secret-word guesses are rate-limited per IP and per card.

## 6. Payment lifecycle (Paystack)
1. **Checkout:** `/api/checkout` → `createOrder`. Prices come from the database through `priceCart`. A `checkoutKey` makes the order idempotent. A per-date advisory lock enforces daily capacity.
2. **Start payment:** `startPayment` checks the order token, that the order is unpaid, that its total is final and that the delivery date is still valid. It inserts a `payments` row with a unique reference (`LLH-…`, using only letters, digits, `-`, `.` and `=`, as the API spec requires). It then calls `POST /transaction/initialize` with `amount` (kobo), `currency: NGN`, `email`, `reference` and `callback_url`.
3. **Customer returns:** `/checkout/complete?reference=` → `verifyAndApply`. Nothing is shown as paid before the server checks.
4. **Webhook:** `/api/webhooks/paystack` verifies HMAC-SHA512 of the raw body with the secret key (`x-paystack-signature`) and stores a dedupe row. It then **re-verifies the transaction with the API** rather than trusting the body.
5. **`verifyAndApply`** runs under `SELECT … FOR UPDATE` on the order:
   - Paid only if `status = success`, the reference matches, the amount equals the payment row, the currency is NGN, **and the amount equals the order's current total**.
   - Mismatch → recorded as failed, event and alert, not paid.
   - A second successful payment on a paid order → `duplicate_payment_flag` and an alert to refund.
   - Paid after cancellation → flagged.
   - Stock is reduced in the same transaction (bundles expand). Gold Card / Tag experiences are created. The receipt email is queued.
6. **Refunds** (`refundOrder`):
   - Under an order row lock, it checks the refundable balance and **reserves** a refund row before calling `POST /refund`.
   - If Paystack refuses, the reservation becomes `failed`, so the refund can be retried.
   - `refund.processed / failed / pending` webhooks update the matching row (matched by Paystack refund id, else the open one).
   - A refund started in the Paystack dashboard is recorded from the webhook.
7. **Manual (bank transfer):** owners and managers only, audited, under the same lock. It reduces stock the same way.

The API calls were checked against Paystack's official OpenAPI specification (github.com/PaystackOSS/openapi, commit `07c5abc`, June 2026). paystack.com was unreachable from the build environment, so the webhook and IP-allowlist guidance pages were not re-read during this review.

## 7. Order lifecycle
`pending_payment` → `paid` → `drafting` → `awaiting_approval` → `in_production` → `packed` → `dispatched` → `delivered`

**Side branches:**
- `awaiting_quote`: delivery outside fixed zones. Payable only after staff set the fee.
- `cancelled`: only before payment.
- `delivery_failed`
- `refunded`

**Rules** (`src/lib/order-status.ts`):
- Production needs an approved letter draft when approval is required.
- Each role can move orders only to certain statuses.
- Every transition is a compare-and-set (`where status = previous`), so two staff members can't both move an order.
- Every transition writes a timeline event. Customer-visible ones queue an email.

## 8. External services
| Service | Used for | Configured by | Status |
|---|---|---|---|
| Paystack | Payments, refunds, webhooks | `PAYSTACK_SECRET_KEY` | **Not yet connected.** Tested only against `tests/mocks/paystack-server.ts` |
| Resend | Customer email | `RESEND_API_KEY`, `EMAIL_FROM` | Not connected. Without it, messages wait in Admin → Outbox |
| Substack / Mailchimp | Newsletter | `NEWSLETTER_PROVIDER`, `SUBSTACK_PUBLICATION_URL` or `MAILCHIMP_*` | Not connected. Mailchimp tested against an API mock; Substack is a link to its hosted page |
| Alert webhook | Errors and payment anomalies | `ALERT_WEBHOOK_URL` | Optional, not connected |
| Google Search Console | Indexing | DNS TXT or `GOOGLE_SITE_VERIFICATION` | Needs the domain owner |

## 9. Security controls (where to look)
- **Content Security Policy:** per-request nonce; `default-src 'self'`; no `unsafe-inline` scripts. Plus HSTS, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy` and `Permissions-Policy` (`src/middleware.ts`).
- **CSRF:**
  - API POSTs need a same-origin `Origin` header.
  - Server actions use Next's origin check.
  - Cookies are SameSite=Lax.
- **XSS:** React escaping. The only raw HTML is QR SVGs generated by the server and JSON-LD with `<` escaped.
- **SQL injection:** all queries are parameterised (Drizzle). There's no `sql.raw` on user input.
- **Uploads:** JPEG, PNG and WebP photos; MP3, M4A/MP4, OGG, WAV and WebM audio, checked by magic bytes, with size caps. SVG, HTML and HEIC are rejected. Files are served with `Content-Security-Policy: sandbox` and `nosniff`.
- **Rate limits:** stored in Postgres, keyed by the client IP taken from the proxy-appended `X-Forwarded-For` entry (`TRUSTED_PROXY_HOPS`), so a spoofed header can't bypass them.
- **Logs and alerts:**
  - Errors are logged as type, code and message only; database `detail` fields, which can hold customer values, are dropped.
  - Alerts carry order numbers only.
  - Analytics events contain no personal data.
- **Secrets:** read only on the server. `paystack.ts` and `payments.ts` import `server-only`. Client bundles were grepped for `sk_`, `APP_SECRET` and the other key names: 0 hits.
- **Database:** the app connects as `llh_app`, which owns only its database.
- **Backups:** `deploy/backup.sh` writes `pg_dump`, encrypts it with GPG and copies it off-site. A restore drill was done on 17 Nov with matching checksums.
- **Data retention (NDPA):** `scripts/retention.ts` anonymises old orders and deletes old support messages and analytics events.

## 10. Test commands (reproducible, sanitised setup)
Needs Node 22 and PostgreSQL 16. Use local throwaway databases only.
```bash
cd love-lives-here
createuser llh_app --pwprompt            # e.g. llh_dev_pw (local only)
createdb -O llh_app llh && createdb -O llh_app llh_test && createdb -O llh_app llh_e2e
cp .env.example .env                     # DATABASE_URL=postgres://llh_app:llh_dev_pw@127.0.0.1:5432/llh, APP_SECRET=<random>
npm ci
npm run typecheck                        # TypeScript
npm test                                 # unit + integration: wipes and re-seeds llh_test (TEST_DATABASE_URL to override)
npm run build && npm run test:e2e        # Playwright: starts a Paystack mock on :4010 and the production server on :3100 against llh_e2e
npm audit --omit=dev                     # production dependency audit
npx drizzle-kit check && npx drizzle-kit generate --name drift_check   # schema vs migrations ("nothing to migrate")
```
The e2e run creates its own test staff (`tests/e2e/seed-staff.ts`) with fixed local passwords and a fixed TOTP secret. They exist only in `llh_e2e` and must never be used in production.

## 11. Tests actually executed (this review, 17–18 Nov 2026)
| Command | Result |
|---|---|
| `npm run typecheck` | No errors |
| `npm test` | **70 / 70 passed:** 36 unit, 24 orders-payments, 4 audit-fixes, 6 review-fixes |
| `npm run test:e2e` (production build, Chromium) | **73 / 73 passed:** 3 sign-in setups plus 70 tests; 0 flaky |
| Public and admin crawl (inside e2e) | 29 public pages and 55 admin pages; 0 broken links or images |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` (all) | 9 in dev tools only: `picomatch` via vitest (no fixed release exists) and `esbuild@0.18` via drizzle-kit's deprecated loader (dev-server flaw, not used) |
| `drizzle-kit check` and `generate` | "Everything's fine" and "No schema changes" |
| Docker image build and run | First attempt failed in `next build` (log suppressed; most likely a transient Google Fonts download, which `next/font` does at build time). Second attempt built. In the container: migrate and seed OK; `/`, product, `/api/zones`, `/admin/login` → 200; wrong order link → 404; process runs as non-root user `llh` |
| Lighthouse 13 (mobile), simulated throttling, 3 runs before / 5 after | See section 12 and `docs/QA-AUDIT.md` |
| Lighthouse 13, applied (DevTools) throttling, old and new builds interleaved, 3 runs each | Home LCP: old 1.63–1.70 s, new 1.63–1.81 s. Product LCP: old 2.56–2.74 s, new 2.25–2.27 s |

**Regression tests added in this review**, each shown to fail on the previous code:
- `tests/integration/review-fixes.test.ts`:
  - concurrent double refund;
  - dashboard refund recorded as ₦0;
  - a refund refused by Paystack blocks retries;
  - payment accepted against a changed total;
  - spoofed `X-Forwarded-For`.
- `tests/e2e/concurrency.spec.ts`: lost updates on stock, price, product details and delivery fee.
- `tests/e2e/review-authz.spec.ts`: writer could see customer contact details in Messages.

## 12. Known limitations
- **Home page lab LCP:** fails under Lighthouse's default simulated throttling (median 2.87 s, against a 2.5 s target). It passes under applied throttling (1.6–1.8 s).
  - The simulated figure is driven by the framework JavaScript (about 100 KB) and fonts (about 80 KB) downloading alongside the 9 KB hero photo.
  - Field p75 is collected (web-vitals beacon → Admin dashboard) but needs real traffic.
- **Paystack:** never exercised against the real API from this environment.
- **Physical NFC tags, real screen readers and real low-end Android devices:** not tested.
- **AI letter drafting:** optional; not built. It needs a provider key, a consent wording decision and a content policy.
- **The floating WhatsApp button:** can briefly cover part of a link while scrolling on small phones (e.g. the empty-bag suggestions at first load); scrolling clears it.
- **Stock is consumed at payment, not reserved at checkout.** Two customers paying for the last item within seconds can oversell by one; this is flagged to staff (`stock_short` event and alert).
- **Customer-written support messages are shown to roles with `messages.view` as written.** If a customer types their phone number into the message body, a writer can see it.
- **Building the Docker image downloads Google Fonts.** A network hiccup fails the build; rerun it.
- **An unknown Gold Card link shows a friendly "This card isn't set up" page (HTTP 200, `noindex`)**, so a recipient tapping an unprogrammed card isn't confused. Links are 128-bit random, so this reveals nothing guessable.
- **`next start` warns** when used with `output: standalone`. It is used only by the e2e harness; Docker runs `node server.js` as intended.

## 13. Pending credentials (configure as environment variables on the server, never in code or chat)
- `PAYSTACK_SECRET_KEY` (`sk_test_…` first, then `sk_live_…`) and the dashboard webhook URL `https://<domain>/api/webhooks/paystack`.
- `RESEND_API_KEY` and `EMAIL_FROM` (verify the domain in Resend).
- `NEWSLETTER_PROVIDER` plus `SUBSTACK_PUBLICATION_URL`, or `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID`.
- Optional: `ALERT_WEBHOOK_URL`, `GOOGLE_SITE_VERIFICATION`, `TRUSTED_PROXY_HOPS`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.

## 14. Deployment instructions
See `docs/DEPLOYMENT.md`. The short version, on a Linux VPS with Docker:
```bash
git clone <repo> && cd <repo>/love-lives-here/deploy
cp ../.env.example .env          # APP_URL, APP_SECRET (32 random bytes, base64), POSTGRES_PASSWORD, keys above
$EDITOR Caddyfile                # your domain
docker compose up -d --build
docker compose run --rm ops tsx scripts/migrate.ts
docker compose run --rm ops tsx scripts/seed.ts
docker compose run --rm -it ops tsx scripts/create-staff.ts --email you@example.com --name "You" --role owner
# crontab: backup.sh nightly, retention nightly, flush-outbox every 5 min (see DEPLOYMENT.md)
```
**Hosting requirement:** the app needs a long-running Node.js 20.18+ process and PostgreSQL 16. Typical shared cPanel/PHP hosting can't run it. A VPS (Docker), or a Node platform with managed Postgres, is required.

## 15. Production-launch checklist
- [ ] Server meets the hosting requirement. DNS points at it. HTTPS works (Caddy issues the certificate).
- [ ] `.env` filled. `APP_SECRET` is random and kept safe; changing it breaks existing order links.
- [ ] Migrations and seed run. An owner account is created and two-step sign-in set up.
- [ ] **Paystack test mode:** one real payment, one failed payment, one refund, webhook delivered (check Admin → Payments). Then switch to `sk_live_…`.
- [ ] LLH confirms every price marked "unverified", the chrysanthemum prices (or keeps them as quotes), delivery fees, hours, contacts and claims (200+ and 4.9★ stay hidden until verified).
- [ ] Real Dear Lovers post URLs entered (Admin → Site content). Newsletter provider configured and a test signup confirmed.
- [ ] Resend domain verified, and a test email received.
- [ ] Program and tap-test one Gold Card and one LLH Tag on an iPhone and an Android phone (`docs/NFC-TAG-WRITING.md`).
- [ ] One VoiceOver (iOS) and one TalkBack or NVDA pass through shop → checkout.
- [ ] A lawyer reviews the Privacy, Terms, Refunds and Delivery policies. Check NDPC registration duties and cross-border transfer wording (Paystack, Resend, Substack or Mailchimp process data outside Nigeria). Mark the policies reviewed in Admin.
- [ ] Cron jobs installed (backup, retention, outbox). First backup restored once as a drill.
- [ ] Uptime monitor on `/` and `/api/zones`. `ALERT_WEBHOOK_URL` set.
- [ ] Search Console verified and sitemap submitted.
- [ ] After two weeks of traffic, check the field p75 LCP / INP / CLS on the Admin dashboard.
