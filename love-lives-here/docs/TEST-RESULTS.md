# Test results (17 November 2026)

> Superseded by `QA-AUDIT.md` (final audit, 17 Nov 2026), which has current counts and statuses.

| Suite | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | ✅ no errors |
| Unit (36) | `npm test` (with integration) | ✅ 36 passed |
| Integration (24) — real PostgreSQL, Paystack & Mailchimp API mocks | `npm test` | ✅ 24 passed |
| End-to-end (57) — production build, Chromium, local Paystack mock | `npm run test:e2e` | ✅ 57 passed, 0 flaky (79 s) |
| Production build | `npm run build` | ✅ |
| Docker image | `docker build` + run | ✅ migrations + seed in container; `/`, product, API and admin login return 200; non-root user |
| Dependency audit (production) | `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| Dependency audit (all) | `npm audit` | 4 moderate, dev-only (drizzle-kit → esbuild dev server) |
| Backup / restore | `pg_dump -Fc` → `pg_restore` into a new DB | ✅ identical row counts, media bytes and order checksum |

## What the end-to-end tests cover
- **Shopping:** product page, variant, quantity, add, cart update, remove; quote-only flowers can't be bought; a gift without a letter.
- **Letter:** guided flow with per-step validation, save-and-resume after reload, review, prefilled checkout.
- **Flowers & totals:** total changes immediately on adding a bouquet, changing the area (₦3,000 → ₦8,500), switching to a quoted area, and removing the bouquet.
- **Checkout:** too-short phone (browser check), invalid phone (server check), sandbox payment success, data saved (brief, candle note, E.164 phone, test flag), bag cleared.
- **Payment failure:** decline → honest failure page → retry → paid; the replayed webhook is ignored (one “paid” event); a badly signed webhook gets 401.
- **Awaiting quote:** nothing charged; no Pay button.
- **Admin:** unauthenticated redirect, export 403, wrong password, two-factor required; writer sees the brief but not the address or payments; packer sees the address but not the brief; draft → send → buyer approves → production → delivered; price, stock and delivery-fee edits reach the shop.
- **Gold Card:** buyer adds notes (morning and any time), playlist, photo; `javascript:` link and fake JPEG rejected; preview by time of day; staff set a secret word and go live; QR SVG; tag written; wrong/right code; guessed token; anonymous media 404; view counter; 375px layout. **LLH Tag** redirect.
- **Newsletter:** invalid email, missing consent, hand-off to Substack's hosted subscribe URL; unsubscribe instructions.
- **Quality:** no overflow on 16 pages × 7 widths (320–1440); axe WCAG 2.2 AA on 16 pages; skip link; keyboard menu with Escape; one h1; announced, linked errors; security headers; cross-site POST blocked; no console/CSP errors; JSON-LD correctness (no fake ratings, no Offer for quote items); sitemap/robots; unverified claims hidden; clickable contacts.

## Lighthouse 13 (mobile, simulated slow 4G, production build) — 3 runs each
| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 95–96 | 100 | 100 | 100 | 2.7–2.8 s | 0.004 | 60–90 ms |
| `/shop/handwritten-letter` | 91–99 | 100 | 100 | 100 | 1.8–3.5 s | 0 | 50–90 ms |
| `/letter` | 96–97 | 100 | 100 | 100 | 2.5 s | 0.004 | 100–130 ms |
| `/checkout` | 94–98 | 100 | 100 | 63* | 1.9–2.5 s | ≤ 0.056 | 100–200 ms |

\* Checkout is deliberately `noindex`.

**Honest reading:** CLS and blocking time are well inside target. Lab LCP sits around the 2.5 s line and varies between runs; the home page is slightly over in this simulation. The targets are 75th-percentile **field** metrics, which need real visitors: the site now collects LCP/INP/CLS from real users and shows p75 on the admin dashboard. INP can only be measured in the field.

## Not tested here
- A real Paystack sandbox transaction (no test key was provided; the mock follows Paystack's documented API).
- Real email delivery (no Resend key) and a real Substack/Mailchimp account.
- Physical NFC tags.
- Manual screen-reader pass (NVDA/VoiceOver) and real low-end Android devices on a real 3G/4G network.
