# Requirements checklist

Status key: ✅ done and tested · 🟡 done, needs an external account, credentials or a human check · ⛔ blocked/not done (reason given).
“Tested” means an automated test in `tests/` exercises it unless noted. Test counts: 36 unit, 24 integration, 57 end-to-end (all passing — see `TEST-RESULTS.md`).

## 1–2. Brand & audit
| Requirement | Status | Notes |
|---|---|---|
| Keep colours, Bodoni/Karla/Caveat, “Say it on paper.”, voice, photos | ✅ | Tokens carried over from the original CSS; all 9 unique original photos reused; no stock images |
| Inventory + defect list | ✅ | `docs/AUDIT.md` — 17 known + 16 additional defects with root causes |

## 3. E-commerce
| Requirement | Status | Notes |
|---|---|---|
| Browse, product pages, variants, quantities, add/remove, cart | ✅ | e2e “Shopping” |
| Standalone gifts without a letter | ✅ | e2e buys an LLH Tag alone |
| Editable catalogue, no prices hard-coded in components | ✅ | `products`/`product_variants`; admin price edit reflected in shop (e2e) |
| Unverified prices flagged; chrysanthemums as “Request a quote” | ✅ | Admin banner; quote items can't be bought (integration + e2e) |
| Related products, availability, production time, delivery eligibility | ✅ | Product page “Goes well with”; stock and sold-out handling tested |
| Bundles / custom combinations | 🟡 | Custom combinations via bag ✅. Curated bundles: product type + `bundle_items` table exist and admins can create a “bundle” product with its own price; there's no admin UI yet to list a bundle's contents, and none are seeded (no real bundle data was supplied) |
| Inventory updates by staff | ✅ | Stock field; decremented on verified payment; oversell blocked (integration + e2e) |

## 4. Letter personalisation
| Requirement | Status | Notes |
|---|---|---|
| Own-words path and guided “help me” path with all listed questions | ✅ | e2e both paths |
| Progress, validation, error summary, save & resume, review before submit | ✅ | Resume tested by page reload |
| No invented memories; optional AI clearly separated | ✅ / ⛔ | Copy and admin reminders say so. **AI drafting not built** — optional in the brief, and it needs an LLM API key and a content policy decision |
| Secure hand-off to writers | ✅ | Brief stored server-side; only writer/manager/owner roles see it |
| Draft → share → feedback → approve, revision history, no production before approval | ✅ | e2e full loop; integration gate test; versions kept |
| WhatsApp option preserved | ✅ | Floating button, “not sure” card, approval link via WhatsApp, record approval received on WhatsApp |

## 5. Payments (Paystack)
| Requirement | Status | Notes |
|---|---|---|
| Server-side initialise, server-side pricing, unique references | ✅ | |
| Signed webhooks, verification, idempotency, duplicate protection | ✅ | HMAC-SHA512; replayed webhooks ignored; second payment flagged for refund; amount mismatch never marks paid |
| Failed payment, retry, accurate status, confirmation only after verification | ✅ | e2e decline → retry → paid |
| Refunds and reconciliation | ✅ | Paystack refund + `refund.processed` webhook; manual refund record; Payments reconciliation page |
| Secrets server-only; no card data stored | ✅ | Hosted Paystack checkout |
| Awaiting-quote orders paid only after the fee is set | ✅ | integration + e2e |
| **Real Paystack sandbox** | 🟡 | Tested against a local mock of Paystack's documented API. A test key was declined during the session, so no call reached api.paystack.co. **Needed:** `sk_test_…` to run one live sandbox payment, then `sk_live_…` |

## 6. Order management
| Requirement | Status | Notes |
|---|---|---|
| All listed order fields, statuses incl. exceptions, timeline | ✅ | |
| Search/filter, assign, status updates, notes, messages, stock, products, fees, receipts, CSV export, sales stats | ✅ | |
| Role-based permissions; no public access | ✅ | owner/manager/writer/fulfilment; e2e checks address and brief separation, export 403, admin redirect |

## 7. Gold Card & LLH Tag
| Requirement | Status | Notes |
|---|---|---|
| Notes, photos, voice, playlists, multiple messages, time-of-day, expiry, secret word | ✅ | |
| Unique unguessable links, mobile view, preview, buyer/staff editing, privacy | ✅ | 128-bit tokens; media served only with access |
| QR fallback; tag-writing instructions; separate from hardware | ✅ | `docs/NFC-TAG-WRITING.md` |
| **Physical NFC tap test** | 🟡 | Needs a person with a phone and blank NTAG tags |

## 8. Delivery & scheduling
| Requirement | Status | Notes |
|---|---|---|
| Editable zones and fees, nationwide quotes, pickup | ✅ | |
| Address validation, date rules in Africa/Lagos, production vs transit, blackout dates, capacity, cut-off | ✅ | Unit + integration tests |
| Final charges before payment; progress notifications | ✅ / 🟡 | Notifications are queued; automatic email needs `RESEND_API_KEY`, otherwise staff send them from the Outbox |
| Rider details, protecting personal data | ✅ | Rider phone shared only via admin; recipient phone only visible to fulfilment roles |

## 9. Newsletter
| Requirement | Status | Notes |
|---|---|---|
| Real provider, validation, consent, duplicates, unsubscribe, privacy link, analytics | ✅ / 🟡 | Mailchimp path fully tested against its API contract. Substack path uses Substack's official hosted page (tested hand-off). **Needed:** the exact Substack publication URL, or Mailchimp keys |
| Article cards link to real posts | 🟡 | No post URLs could be verified (substack.com unreachable from the build environment). Cards are hidden until staff add real URLs; nothing invented |

## 10. Performance
| Requirement | Status | Notes |
|---|---|---|
| Extract base64, responsive AVIF/WebP, lazy loading, hero priority, self-hosted fonts, cache headers, reserved space | ✅ | |
| Measured with Lighthouse (mobile, simulated slow 4G) | ✅ | Perf 94–99, CLS ≤ 0.056, TBT ≤ 200 ms. **LCP 1.8–3.5 s across runs; the home page is 2.7–2.8 s, just over the 2.5 s target in lab conditions** |
| p75 field LCP/INP/CLS | 🟡 | Real-user Core Web Vitals collection + p75 dashboard built; needs live traffic to report |

## 11. Security & data protection
| Requirement | Status | Notes |
|---|---|---|
| Server validation, authorisation on every action, scrypt passwords, TOTP 2FA (required for owner/manager), lockout, rate limits | ✅ | |
| XSS/SQLi/CSRF: React escaping, parameterised SQL, Origin checks, SameSite cookies, CSP with nonces, HSTS, no-sniff, frame-deny | ✅ | Header + cross-site tests |
| Upload validation by magic bytes; no SVG/HTML | ✅ | |
| Dependency audit | ✅ | Production deps: 0 vulnerabilities. 4 moderate dev-only (drizzle-kit's bundled esbuild) |
| Audit log, least-privilege DB role, secrets in env only | ✅ | |
| Backups + recovery test | ✅ | Restore verified by checksums; nightly script provided |
| NDPA: notices, consent + version recorded, minimisation, retention job, role-restricted access | ✅ | Retention job tested |
| Error monitoring | 🟡 | Logs + health check; an external tracker (e.g. Sentry) is optional and not configured |
| Legal review of policies | 🟡 | Drafts only; a “being finalised” notice shows until marked reviewed in admin |

## 12–13. Mobile UX & accessibility
| Requirement | Status | Notes |
|---|---|---|
| No horizontal overflow at 320/360/390/428/768/1024/1440 on 16 pages | ✅ | e2e |
| axe WCAG 2.2 AA rules: no serious/critical issues on 16 pages | ✅ | Lighthouse accessibility 100 |
| Skip link, landmarks, one h1, labelled controls, error summary, `aria-invalid`, keyboard menu, reduced motion | ✅ | e2e keyboard tests |
| Manual screen-reader pass (NVDA/VoiceOver) | 🟡 | Not done (no screen reader in this environment); automated role/name checks only |

## 14–15. SEO & trust
| Requirement | Status | Notes |
|---|---|---|
| Product URLs, titles, canonicals, OG/Twitter image, Product/Offer, LocalBusiness, FAQPage, breadcrumbs, sitemap, robots, noindex on private pages | ✅ | |
| No fabricated reviews/ratings; quote items have no Offer | ✅ | e2e asserts no `aggregateRating` |
| Clickable email/WhatsApp; policy, FAQ and contact pages; on-site support form | ✅ | |
| Business claims verified | 🟡 | 200+ and 4.9★ hidden until LLH verifies them; hours, contacts, timelines and prices kept as source values to confirm |
| Search Console | 🟡 | Ready (sitemap, verification by DNS); needs the domain owner |

## 16. Analytics
| Requirement | Status | Notes |
|---|---|---|
| All listed events; no personal data in events; test data excluded | ✅ | |
| Dashboard: orders, revenue, conversion, AOV, best sellers, product funnel, abandonment, payment failures, fulfilment, refunds, sources | ✅ | e2e checks test-data separation |

## 17–21. Architecture, QA, delivery
| Requirement | Status | Notes |
|---|---|---|
| Next.js App Router, TypeScript, PostgreSQL, migrations, constraints, indexes | ✅ | Drizzle ORM; CHECK constraints on money, stock and quantities |
| Unit, integration and e2e tests | ✅ | 117 tests |
| Docker image | ✅ | Built and run in this environment: migrations, seed, pages 200, runs as non-root |
| Deployed to production | ⛔ | Not deployed: needs the LLH domain/DNS, a server and keys |
