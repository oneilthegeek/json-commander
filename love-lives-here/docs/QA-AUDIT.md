# Final QA and completion audit — 17 November 2026

> Updated by the independent review of 18 Nov 2026: see `../INDEPENDENT_REVIEW.md` for current test counts, new defects found and fixed, and performance results.

An independent pass over the actual code and the running production build, measured against the master specification. Earlier documents (`CHECKLIST.md`, `TEST-RESULTS.md`) are superseded where they differ from this one.

## Requirements traceability matrix

| # | Requirement | Implementation location | Status | Test performed | Evidence or result | Remaining action |
|---|---|---|---|---|---|---|
| 1 | 1.1 Preserve colours, Bodoni/Karla/Caveat, spacing | `src/app/globals.css, src/app/layout.tsx` | **Passed** | Visual review of screenshots; Lighthouse; e2e pages | Tokens identical to original :root; fonts self-hosted via next/font | — |
| 2 | 1.2 Keep “Say it on paper.” and brand voice | `src/app/(site)/page.tsx` | **Passed** | Page review; e2e loads home | Hero copy kept verbatim | — |
| 3 | 1.3 Keep original photography, no stock images | `public/images/*, scripts/extract-images.ts` | **Passed** | Crawl: 0 broken images across 29 public pages | 9 unique originals reused; duplicate removed | — |
| 4 | 2.1 Inventory sections/products/prices/forms/links | `docs/AUDIT.md §1` | **Passed** | Manual comparison with docs/original/love-lives-here.html | 17 sections inventoried | — |
| 5 | 2.2 Known 17 defects root-caused and fixed | `docs/AUDIT.md §2` | **Passed** | Per-defect tests (see rows below) | All 17 mapped to code + tests | — |
| 6 | 2.3 Discover additional defects | `docs/AUDIT.md §2 + this audit` | **Passed** | Code review + test runs | 16 found at build time; 12 more found and fixed in this audit (listed in QA-AUDIT.md) | — |
| 7 | 3.1 Browse products, product pages | `src/app/(site)/shop/**` | **Passed** | e2e | Crawl visited every product page (200) | — |
| 8 | 3.2 Variants and quantities | `src/components/AddToBag.tsx` | **Passed** | e2e | Candle scent + quantity → ₦17,000 asserted | — |
| 9 | 3.3 Add / change / remove in cart | `src/components/cart.tsx, cart/page.tsx` | **Passed** | e2e | Subtotal 17,000→25,500→17,000→empty | — |
| 10 | 3.4 Standalone purchase without letter | `src/lib/pricing.ts` | **Passed** | integration+e2e | LLH Tag bought alone; Gold Card order paid alone | — |
| 11 | 3.5 Editable catalogue; no hard-coded prices in components | `products/product_variants tables; admin/products` | **Passed** | e2e | Admin price change reflected in shop and checkout | — |
| 12 | 3.6 Unconfirmed prices flagged / Request a quote | `seed.ts, admin/products` | **Passed** | integration+e2e | Chrysanthemums not purchasable; admin banner for 13 unverified prices | LLH to confirm prices |
| 13 | 3.7 Product fields: availability, production time, delivery eligibility, related | `schema.ts products; shop/[slug]` | **Passed** | e2e | Facts list, “Goes well with”, sold-out state tested | — |
| 14 | 3.8 Curated bundles | `catalog.bundleContents, pricing.ts, admin/products/[id]` | **Passed** | integration | Empty bundle refused; component stock checked and consumed on payment | No bundles defined yet (business data) |
| 15 | 3.9 Inventory updates by staff | `saveVariant action; payments.consumeStock` | **Passed** | integration+e2e | Stock 2→0 after paid order; oversell blocked; bank-transfer path now consumes stock | — |
| 16 | 4.1 Own-words path | `letter/LetterFlow.tsx` | **Passed** | e2e | Used by addLetter fixture in 8 tests | — |
| 17 | 4.2 Guided path with all listed questions | `LetterFlow.tsx, validation.letterBriefSchema` | **Passed** | e2e | Who/relationship/occasion/feelings/memories/tone/avoid/date covered | — |
| 18 | 4.3 Progress, validation, errors, save-and-resume, preview, confirm | `LetterFlow.tsx` | **Passed** | e2e | Error summary asserted; reload restores answers; review step | — |
| 19 | 4.4 No invented memories; AI optional and labelled | `copy + admin reminder` | **Passed** | Review | Stated to customer and writer; no AI generation exists | — |
| 20 | 4.5 Optional AI-assisted drafting | — | **Blocked** | — | Not built: optional in spec; needs an LLM API key and a content-policy decision | Decide whether wanted |
| 21 | 4.6 Draft → share → feedback → approve, revision history | `admin actions saveDraft/sendDraft/recordApproval; api/orders/[n]/letter` | **Passed** | e2e | Full loop to Delivered; versions kept | — |
| 22 | 4.7 No production before approval | `order-status.canTransition` | **Passed** | unit+integration+e2e | in_production refused until approved draft | — |
| 23 | 4.8 WhatsApp option preserved | `WhatsApp.tsx, order page links` | **Passed** | Crawl | wa.me links present (external, not fetched) | — |
| 24 | 5.1 Server-side initialization + pricing + references | `payments.startPayment, paystack.ts` | **Passed** | integration+e2e | Amount from DB; unique reference per attempt | — |
| 25 | 5.2 Authenticated webhooks | `api/webhooks/paystack` | **Passed** | unit+e2e | Bad signature → 401; HMAC-SHA512 verified | — |
| 26 | 5.3 Verification before paid; no fake success | `payments.verifyAndApply; checkout/complete` | **Passed** | integration+e2e | Unpaid until verify; decline shows failure page; grep: no demo strings | — |
| 27 | 5.4 Duplicate-order and duplicate-webhook protection | `checkoutKey unique; webhook_events; row lock` | **Passed** | integration+e2e | Replay ignored; one ‘paid’ event; second payment flagged | — |
| 28 | 5.5 Failed payment + retry | `PayButton, checkout/complete` | **Passed** | e2e | Decline → Try again → paid | — |
| 29 | 5.6 Amount/currency mismatch never paid | `verifyAndApply` | **Passed** | integration | Tampered amount → mismatch, order unpaid, alert raised | — |
| 30 | 5.7 Refunds and reconciliation | `payments.refundOrder; admin/payments` | **Passed** | integration | Refund → refund.processed webhook → refunded | — |
| 31 | 5.8 Secret keys server-only; no card data | `paystack.ts; hosted checkout` | **Passed** | Code review + build output grep | PAYSTACK_SECRET_KEY only read server-side | — |
| 32 | 5.9 Awaiting-quote state before payment | `orders.setDeliveryQuote` | **Passed** | integration+e2e | Quote order not payable; payable after fee set; manual shortcut removed | — |
| 33 | 5.10 Real Paystack sandbox transaction | — | **Blocked** | — | No test key provided (declined); tested against local mock of documented API | Provide sk_test_ key; run one sandbox payment + refund |
| 34 | 6.1 Order record fields and timeline | `schema.ts orders/order_events` | **Passed** | integration+e2e | Brief, items, fees, payment, events asserted in DB | — |
| 35 | 6.2 Statuses incl. exceptions | `order-status.ts` | **Passed** | unit+e2e | Paid→…→Delivered driven in e2e; cancel/refund/failed rules unit-tested | — |
| 36 | 6.3 Search/filter, assign, notes, messages | `admin/orders, actions` | **Passed** | Crawl + e2e | 53 admin pages load; assignment/notes forms present | — |
| 37 | 6.4 Stock, products, delivery fees | `admin/products, admin/delivery` | **Passed** | e2e | Price, stock, Ajah fee edits reflected | — |
| 38 | 6.5 Receipts and CSV export | `orders/[id]/receipt, admin/export` | **Passed** | e2e | CSV 200 for owner, 403 anonymous; formula-injection guard | — |
| 39 | 6.6 Sales statistics | `lib/reports.ts, admin page` | **Passed** | e2e | Test data excluded by default, included on request | — |
| 40 | 6.7 Role-based permissions on pages | `auth/permissions.ts, requireStaff` | **Passed** | e2e | Writer/packer denied 5 admin areas each | — |
| 41 | 6.8 Role checks on server actions (not just UI) | `admin/(app)/actions.ts guard()` | **Passed** | e2e | Direct action calls by ID refused for writer/packer/anonymous; cross-site rejected | — |
| 42 | 7.1 Explain Gold Card vs LLH Tag | `gold-card/page.tsx` | **Passed** | Review + crawl | Comparison section | — |
| 43 | 7.2 Notes, photos, voice, playlists, multiple messages, time-of-day | `nfc.ts, CardEditor, GoldCardView` | **Passed** | unit+e2e | Morning vs any-time note asserted; photo, playlist | Voice note playback not e2e-asserted |
| 44 | 7.3 Expiry and access controls | `nfc.availability, secret word` | **Passed** | unit+e2e | Wrong/right word; expired unit test | — |
| 45 | 7.4 Unique unguessable links; media private | `publicToken 128-bit; media routes` | **Passed** | e2e | Guessed token → not set up; anonymous media 404 | — |
| 46 | 7.5 Preview before activation; editing | `buyer + admin preview` | **Passed** | e2e | Preview by time of day; ‘Almost ready’ before live | — |
| 47 | 7.6 QR fallback | `admin/nfc/[id]/qr` | **Passed** | e2e | SVG returned | — |
| 48 | 7.7 NFC writing instructions; hardware separated | `docs/NFC-TAG-WRITING.md` | **Passed** | Review | Written guide; staff ‘written & tested’ record | — |
| 49 | 7.8 Physical NFC tap test | — | **Blocked** | — | Requires phone + NTAG tags | Test on one iPhone and one Android |
| 50 | 7.9 Unsafe uploads/links rejected | `media.sniff, nfc.safeExternalUrl` | **Passed** | unit+e2e | Fake JPEG, SVG, HTML, HEIC, javascript: rejected | — |
| 51 | 8.1 Editable zones/fees; nationwide quotes; pickup | `delivery_zones; admin/delivery` | **Passed** | integration+e2e | Zone edit reflected; quote flow | LLH to confirm fees |
| 52 | 8.2 Address/date validation in Africa/Lagos | `dates.ts, scheduling.ts` | **Passed** | unit+integration | UTC midnight edge, cutoff, transit, closed days | — |
| 53 | 8.3 Blackout dates and capacity | `calendar_days; advisory lock` | **Passed** | integration | Blocked day + capacity 1 → second order refused | — |
| 54 | 8.4 Production vs delivery time distinguished | `products.productionDays; zones.transitDays` | **Passed** | unit | earliestDate tests | — |
| 55 | 8.5 Final charges shown before payment | `CheckoutForm summary` | **Passed** | e2e | Totals asserted per zone | — |
| 56 | 8.6 Customer progress notifications | `notifications.ts + timeline` | **Passed** | integration | Queued; auto-sent; retried; no double-send under concurrency | Needs RESEND_API_KEY for real email |
| 57 | 8.7 Rider details; personal-data protection | `deliveries; customers.pii` | **Passed** | e2e | Writer can’t see address; packer can | — |
| 58 | 9.1 Real provider integration | `newsletter.ts` | **Passed** | integration+e2e | Mailchimp double opt-in, duplicates, errors, unsubscribe (API contract mock); Substack hosted hand-off | Real account keys or Substack URL |
| 59 | 9.2 Validation, consent, privacy link, analytics | `NewsletterForm, api/newsletter` | **Passed** | e2e | Invalid email + missing consent errors | — |
| 60 | 9.3 Real Substack/Mailchimp account connected | — | **Blocked** | — | substack.com unreachable from build environment; no keys | Provide publication URL or Mailchimp key |
| 61 | 9.4 Article cards link to genuine posts | `journal_posts; admin/content` | **Blocked** | — | No verified post URLs; cards hidden, nothing invented | Enter real /p/ URLs in admin |
| 62 | 10.1 Base64 extracted; responsive AVIF/WebP; lazy; hero priority | `public/images, next/image` | **Passed** | Lighthouse network audit | Hero 9 KB AVIF; others lazy | — |
| 63 | 10.2 Fonts, code splitting, reserved space (CLS) | `layout.tsx` | **Passed** | Lighthouse | CLS 0–0.056 on all pages | — |
| 64 | 10.3 LCP ≤ 2.5 s (lab, slow 4G) | — | **Failed** | Lighthouse ×2 | Home 2.8–3.1 s; product 2.4–2.8 s; checkout 2.0 s | Reduce home HTML/RSC payload; confirm with field data |
| 65 | 10.4 INP ≤ 200 ms / field p75 | `PageView web-vitals → dashboard` | **Not tested** | — | Collection built; INP and p75 need real traffic (lab TBT 30–70 ms) | Review dashboard after launch |
| 66 | 10.5 Slow-connection image loading | `zz-crawl slow 3G test` | **Passed** | e2e | First image decoded 0.9–5.1 s on 500 kbps/400 ms; no overflow | — |
| 67 | 11.1 Server-side validation | `validation.ts (zod), API routes` | **Passed** | unit+e2e | Invalid phone rejected server-side | — |
| 68 | 11.2 Admin auth: scrypt, lockout, MFA required for owner/manager | `auth/*` | **Passed** | unit+e2e | Password-only blocked at /verify; RFC 6238 vector | — |
| 69 | 11.3 MFA bypass impossible in normal production | `session.requireStaff` | **Passed** | Code review | LLH_ALLOW_NO_MFA ignored unless dev or e2e mode (fixed in audit) | — |
| 70 | 11.4 Rate limiting | `rate-limit.ts` | **Passed** | integration | 4th call in window refused | — |
| 71 | 11.5 XSS/output encoding; SQL injection | `React escaping; Drizzle parameters` | **Passed** | Code review + e2e | No dangerouslySetInnerHTML with user data (JSON-LD escaped; QR SVG generated) | — |
| 72 | 11.6 CSRF | `middleware Origin check; Server Action origin check` | **Passed** | e2e | Cross-site API POST 403; cross-site action rejected | — |
| 73 | 11.7 Secure cookies/sessions | `session.ts` | **Passed** | Code review | httpOnly, SameSite=Lax, Secure + __Host- in production, 12 h | — |
| 74 | 11.8 Headers: CSP nonce, HSTS, nosniff, frame-deny | `middleware.ts` | **Passed** | e2e | Headers asserted; no CSP console errors | — |
| 75 | 11.9 Order tampering / IDOR | `tracking HMAC token; server actions re-auth` | **Passed** | e2e | Wrong token 404 (fixed regression); buyer edits re-verify token | — |
| 76 | 11.10 Dependency audit | `package.json overrides` | **Passed** | npm audit | Production: 0. Dev-only: 5 high + 4 moderate (picomatch ReDoS, esbuild dev server) | Track Vitest/drizzle-kit releases |
| 77 | 11.11 Monitoring / error reporting | `alert.ts, instrumentation.ts` | **Passed** | Code review + integration (email-failure alert path) | Structured alert logs + optional webhook for 7 alert types | Set ALERT_WEBHOOK_URL |
| 78 | 11.12 Backups and restore test | `deploy/backup.sh` | **Passed** | pg_dump → pg_restore | Row counts, media bytes, checksum identical | Schedule + quarterly drill |
| 79 | 11.13 Least-privilege DB; secrets not in repo/bundles | `llh_app role; .gitignore` | **Passed** | git ls-files; review | No .env tracked; app role owns only its DB | — |
| 80 | 11.14 NDPA: notice, consent recorded, minimisation, retention, deletion | `privacy page; orders.consentAt/version; retention.ts` | **Passed** | integration | Retention test removes brief/address, keeps finances | Legal review; NDPC registration check |
| 81 | 12.1 Mobile-first layouts 320–1440 px, no overflow | `globals.css` | **Passed** | e2e | 16 pages × 7 widths | — |
| 82 | 12.2 Mobile nav, sticky buy bar, touch targets | `Header.tsx, .sticky-buy` | **Passed** | e2e + Lighthouse | Lighthouse target-size passes | — |
| 83 | 12.3 Reduced motion | `globals.css` | **Passed** | Code review | prefers-reduced-motion disables animations/scroll | — |
| 84 | 13.1 WCAG 2.2 AA automated | `all pages` | **Passed** | e2e | axe: 0 serious/critical on 16 pages; Lighthouse a11y 100 | — |
| 85 | 13.2 Keyboard navigation, focus, skip link, menu | `Header, layout` | **Passed** | e2e | Skip link focus; Escape closes menu | — |
| 86 | 13.3 Accessible errors and announcements | `ErrSum, aria-live` | **Passed** | e2e | Error summary focused with role=alert | — |
| 87 | 13.4 Manual screen-reader pass | — | **Not tested** | — | No NVDA/VoiceOver available here | One VoiceOver + one NVDA pass |
| 88 | 14.1 Titles, descriptions, canonicals, product URLs | `metadata in each page` | **Passed** | e2e | Canonical + OG image asserted | — |
| 89 | 14.2 Product/Offer, LocalBusiness, FAQ, Breadcrumb schema; no fake ratings | `JsonLd usages` | **Passed** | e2e | No aggregateRating; no Offer for quote items; opening hours from settings | — |
| 90 | 14.3 Sitemap, robots, noindex private pages | `sitemap.ts, robots.ts, middleware` | **Passed** | e2e | Asserted | — |
| 91 | 14.4 Search Console | — | **Blocked** | — | Needs domain ownership | Verify domain, submit sitemap |
| 92 | 15.1 Claims (200+, 4.9★) hidden until verified | `settings.publicClaims` | **Passed** | integration+e2e | Hidden; operational facts shown but flagged | LLH to verify |
| 93 | 15.2 Prices, timelines, hours, contacts marked awaiting verification | `admin Products/Site content` | **Passed** | Review | Unverified badges; editable | LLH to confirm |
| 94 | 15.3 Clickable email/WhatsApp; policy, FAQ, contact pages | `Footer, pages` | **Passed** | e2e | Links asserted; crawl 200 | — |
| 95 | 15.4 Legal drafts complete enough for review | `privacy/terms/refunds/delivery` | **Passed** | Review against NDPA checklist | Added cookies/storage and governing-law sections in audit | Lawyer review |
| 96 | 15.5 On-site support | `contact/SupportForm, admin/messages` | **Passed** | e2e | Message saved and visible to staff | — |
| 97 | 16.1 Events tracked without personal data | `analytics.ts, track.ts` | **Passed** | Code review | Whitelist of events; query strings stripped | — |
| 98 | 16.2 Admin analytics metrics | `reports.ts` | **Passed** | e2e | Dashboard with/without test data | Abandonment metric is an estimate |
| 99 | 16.3 Test vs production data separated | `orders.testMode` | **Passed** | e2e | Excluded by default | — |
| 100 | 17.1 Next.js/TypeScript/PostgreSQL architecture | `package.json` | **Passed** | Build + typecheck | Pass | — |
| 101 | 17.2 Migrations, constraints, indexes in sync | `drizzle/0000_init.sql` | **Passed** | drizzle-kit generate | “No schema changes” | — |
| 102 | 17.3 Error boundaries, empty states | `error.tsx, global-error.tsx, admin error.tsx` | **Passed** | Code review + e2e | Empty bag/no orders states tested | — |
| 103 | 17.4 Loading states | `forms’ pending states` | **Passed** | e2e | Route-level loading.tsx removed (caused 200 on not-found); per-action pending text | — |
| 104 | 18.1 Automated unit/integration/e2e tests pass | `tests/**` | **Passed** | vitest + playwright | 64 + 69 passed, 0 flaky | — |
| 105 | 18.2 Flower bug fixed in every sequence | `useQuote + priceCart` | **Passed** | e2e | 7 sequences (A–F + the original totals test) incl. cross-tab, back/forward, staff price change | — |
| 106 | 18.3 No demo/fake/placeholder functionality in production UI | `src/**` | **Passed** | grep + e2e | No demo strings; mock Paystack only reachable with LLH_E2E + sk_test_ | — |
| 107 | 19.1 Docker image builds and runs | `Dockerfile` | **Passed** | docker build + run | Migrate/seed/outbox in container; pages 200; non-root | Registry/network differs in this sandbox (CA injected only for the test build) |
| 108 | 20.1 Deployment docs and env template | `docs/DEPLOYMENT.md, .env.example` | **Passed** | Review + Docker run | Steps exercised in container | — |
| 109 | 21.1 Deployed to production | — | **Blocked** | — | No domain/server/keys | See prerequisites |

**Totals:** 109 requirements checked · **99 Passed** · **1 Failed** · **7 Blocked** · **2 Not tested**.

## Tests executed (final run, on the final code)
| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ no errors |
| Vitest: 36 unit + 28 integration (real PostgreSQL; Paystack & Mailchimp API-contract mocks) | ✅ 64 / 64 |
| Playwright e2e on the production build (Chromium), 69 tests incl. 3 sign-in setups | ✅ 69 / 69, 0 flaky (2.6 min) |
| Crawl: 29 public + 53 admin pages, every internal link and image | ✅ 0 broken |
| Direct server-action authorisation probes | ✅ refused for writer / packer / anonymous / cross-site |
| `next build` | ✅ |
| `drizzle-kit generate` (schema vs migrations) | ✅ no drift |
| Docker image build + run (migrate, seed, outbox job, pages, 404 on bad token) | ✅ |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| `npm audit` (incl. dev tools) | ⚠️ 5 high + 4 moderate, all dev-only (picomatch ReDoS in test globbing; esbuild dev server in drizzle-kit) |
| Lighthouse 13, mobile, simulated slow 4G, ×2 | Home perf 93–95, LCP 2.8–3.1 s ❌; product 95–97, LCP 2.4–2.8 s; checkout 98–99, LCP 2.0 s; a11y / best practices 100; CLS ≤ 0.056 |
| Slow-3G real browser (500 kbps, 400 ms RTT) | ✅ first image decoded in 0.9–5.1 s; no overflow |
| Backup / restore | ✅ identical counts and checksum (earlier run, unchanged code path) |

## Defects found and corrected in this audit
| # | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|
| 1 | Customer emails were never sent automatically, even with an email key | Outbox only flushed from an admin button | `kickOutbox()` after each order/quote/status/payment/draft; cron retry; `FOR UPDATE SKIP LOCKED` prevents double-sends | integration: concurrency + retry |
| 2 | Bank-transfer (manual) payments didn't reduce stock | Stock logic lived only in the Paystack path | Shared `consumeStock()` used by both | integration (bundle test) |
| 3 | Curated bundles couldn't hold contents; component stock ignored | Table existed with no logic/UI | Admin contents editor, product-page list, stock check and consumption | integration |
| 4 | HEIC photos accepted but unviewable in Chrome/Firefox/Android | Sniffer allowed HEIC | Rejected with guidance; accept list narrowed | unit |
| 5 | `LLH_ALLOW_NO_MFA` would bypass 2FA in a normal production start | Env flag honoured everywhere | Only in development or e2e mode | code review |
| 6 | Stats strip and opening-hours schema hard-coded and unverifiable | Literals in page | Settings-driven, with verification state shown in admin | integration + e2e |
| 7 | No alerting on errors or payment anomalies | — | `alert.ts` + `instrumentation.ts`, optional webhook | code review |
| 8 | “Checkout abandoned” counted on every tab switch | visibilitychange fired repeatedly | Once per session, never after submission | code review |
| 9 | No root-level error page | — | `global-error.tsx`, admin `error.tsx` | build |
| 10 | Privacy notice silent on browser storage | Omission | “Cookies and browser storage” section | review |
| 11 | Terms lacked governing law | Omission | Nigerian law / Lagos courts clause | review |
| 12 | *(Introduced and fixed during the audit)* `loading.tsx` boundaries made wrong-token order pages return 200 and dropped admin form state | Streaming starts before `notFound()` / Suspense remount on refresh | Removed route-level loading boundaries | e2e (404 + admin loop) |

Earlier in the build (already committed): writer could open the buyer page (address leak); low-contrast badges; 320 px overflow; forms lost input after server errors; awaiting-quote orders could be moved to “pending payment” without a fee.

## External integrations requiring credentials
| Service | Needed | Current state |
|---|---|---|
| Paystack | `PAYSTACK_SECRET_KEY` (test, then live), webhook URL in dashboard, business verification for live | Implemented; tested only against a local mock of the documented API |
| Newsletter | `SUBSTACK_PUBLICATION_URL` (exact) **or** `MAILCHIMP_API_KEY` + `MAILCHIMP_AUDIENCE_ID` | Implemented; no account connected |
| Email (Resend) | `RESEND_API_KEY`, verified sending domain, `EMAIL_FROM` | Implemented; without it messages wait in the admin Outbox |
| Alerts (optional) | `ALERT_WEBHOOK_URL` | Logs only until set |
| Google Search Console / Business Profile | Domain ownership | Sitemap and structured data ready |

## Remaining production prerequisites
1. Server + domain + DNS; `APP_URL`, `APP_SECRET`, `POSTGRES_PASSWORD`.
2. One real Paystack **sandbox** payment and refund, then live keys.
3. LLH confirms every unverified price, delivery fee, hour, contact and stat; sets or keeps quote-only chrysanthemums; enters real Dear Lovers post URLs.
4. Lawyer reviews the four policies; check whether NDPC registration applies; mark “reviewed” in admin.
5. Physical NFC test on iPhone and Android; one manual screen-reader pass.
6. Schedule backup, retention and outbox cron jobs; first restore drill.
7. Optional: reduce the home-page first response to bring lab LCP under 2.5 s; watch field p75 on the dashboard.

## Startup and deployment
Local (Node 20.18+, PostgreSQL 16):
```bash
cd love-lives-here
cp .env.example .env          # set DATABASE_URL, APP_SECRET (32+ chars)
npm ci
npm run db:migrate && npm run db:seed
npm run staff:create -- --email you@example.com --name "You" --role owner
npm run build && npm start    # or: npm run dev
# tests: createdb llh_test llh_e2e; npm test; npm run test:e2e
```
Production (one server, Docker): follow `docs/DEPLOYMENT.md` — `cd deploy && cp ../.env.example .env` (fill in), `docker compose up -d --build`, then `docker compose run --rm ops tsx scripts/migrate.ts`, `… seed.ts`, `docker compose run --rm -it ops tsx scripts/create-staff.ts --email … --role owner`, set Paystack webhook to `https://<domain>/api/webhooks/paystack`, and install the three cron jobs.

## Assessment: **sandbox-ready, not production-ready**
- **Why not production-ready:** no real Paystack transaction has ever been made (the only key was declined); no email, newsletter or alert account is connected; prices, fees and claims are unconfirmed by the business; policies are unreviewed drafts; physical NFC and screen-reader checks are outstanding; home-page lab LCP misses the 2.5 s target.
- **Why sandbox-ready:** every customer and staff journey in the spec runs end to end against a real database and the production build, with 133 automated tests passing, direct authorisation probes refusing privilege escalation, no demo or fake-success paths in the shipped UI, a verified Docker image and a verified backup restore. Adding a Paystack test key is the next step; nothing else in the code blocks a full sandbox trial.
