# Audit of the original `love-lives-here.html` and what changed

Source: `docs/original/love-lives-here.html` (947 lines, 1,427,954 bytes, of which ~1.35 MB is 10 embedded base64 JPEGs). It is preserved unchanged for reference.

## 1. Inventory of the original

### Sections (top to bottom)
| # | Section | Contents | Kept? |
|---|---|---|---|
| 1 | Announcement bar | “Handcrafted in Lagos · Delivered across Nigeria · Order on WhatsApp” | Yes (wording updated: ordering is now on-site) |
| 2 | Hero + nav | Logo, links (Shop, Flowers, Start a letter, Gold Card, How it works, Dear Lovers), burger < 900px, “Say it on *paper.*”, two CTAs, hero photo | Yes — same copy and photo; nav adds Track order and a bag |
| 3 | Stats strip | Est. 2025 · 48 hrs · Nationwide · **200+** letters · **4.9★** rating | Yes, but 200+ and 4.9★ are hidden until verified in admin |
| 4 | Shop | Filter pills; The Letter (feature, 2-photo slider, ₦10,000); Secret Candle (Chocolate/Tropical, ₦8,500); Gold Card (₦12,500); LLH Tag (SVG, ₦4,500); “Not sure what to send?” WhatsApp card | Yes — now database-driven with real product pages |
| 5 | Flowers carousel | Roses full (5/10/15/20 stems: ₦55k/105k/155k/210k), Roses just roses (₦50k/95k/145k/190k), Chrysanthemums ×2 (**placeholder prices**, disclosed on page) | Yes — roses as “unverified” prices, chrysanthemums as “Request a quote” |
| 6 | Gold Card | 3 steps, “₦12,500”, CTA added it to a letter | Yes + dedicated `/gold-card` page and a working digital system |
| 7 | How it works | Written → Sealed → Packed → Delivered; 4 delivery steps incl. “Approve your letter” | Yes — approval is now real |
| 8 | Hidden order box `#write` | Message, names, WhatsApp, their phone, extras, flower, area (fees), date, address, summary, “Pay ₦X” → **demo message** | Replaced by `/letter` + bag + `/checkout` with Paystack |
| 9 | Proof | Quote + two WhatsApp-style testimonials, “Real messages, shared with permission” | Kept verbatim (flagged for LLH to confirm permission) |
| 10 | Delivery & hours | 8 fixed-fee zones + “Not on the list?”, hours aside, Valentine’s note | Yes — zones/fees/hours now editable |
| 11 | “Don’t know what to say?” brief form | Builds a WhatsApp message (names, relationship, occasion, tone, about them, extras incl. “Flowers · ask for price”, date, area incl. **“I’ll pick it up”**) + Copy | Merged into the guided letter flow; pickup kept as a zone; WhatsApp kept as an alternative |
| 12 | Dear Lovers | 4 cards — **all link to the same Substack profile** | Cards hidden until real post URLs are entered; one honest link to the profile instead |
| 13 | Newsletter | Email form → “This demo is not connected yet” | Real provider integration |
| 14 | Trust strip | Hours, “Most orders ready in under 48 hours”, Lagos & nationwide | Content folded into delivery/FAQ |
| 15 | FAQ | 10 Q&As + FAQPage JSON-LD | Kept, answers updated to match the new flow, +3 questions; full list on `/faq` |
| 16 | Footer | Shop/Help/Follow links; phone and **email as non-clickable text** | Kept; email/WhatsApp clickable; policy links added |
| 17 | Floating buttons | Back-to-top; WhatsApp | WhatsApp kept; back-to-top dropped (sticky header + skip link instead) |

### Head / SEO / integrations
- Title “Love Lives Here”; description; canonical `https://loveliveshere.ng/`; OG/Twitter tags **without an image**; geo meta; LocalBusiness JSON-LD (phone, email, sameAs, `priceRange ₦4,500 – ₦210,000`, opening hours); FAQPage JSON-LD; SVG data-URI favicons.
- External: Google Fonts (Bodoni Moda, Karla, Caveat), wa.me, Instagram, TikTok, Substack profile. **No analytics, no payments, no backend.**
- Contact values (kept, pending LLH verification): `loveliveshere.ng`, WhatsApp `2348107134258` (0810 713 4258), `always@loveliveshereng.com`.

### Working features preserved
Filter pills, image slider with dots, carousel arrows, scent selector, flower stem selector, burger menu, reduced-motion handling, WhatsApp deep links with prefilled text, copy-to-clipboard brief, FAQ accordion, focus-visible styles, `aria-pressed` pills, alt text on photos.

## 2. Defects

### The 17 known problems — root cause and fix
| # | Problem | Root cause | Fix |
|---|---|---|---|
| 1 | Demo Paystack message | No backend | `src/lib/payments.ts` + `paystack.ts`: server-side initialize, verify, signed webhooks, refunds |
| 2 | Newsletter placeholder | No provider | `src/lib/newsletter.ts`: Substack hosted signup or Mailchimp API (double opt-in) |
| 3 | Orders not persisted | No backend | PostgreSQL schema (`src/lib/db/schema.ts`), `createOrder()` in a transaction |
| 4 | Phone accepts anything | Only `!value.trim()` checked | `libphonenumber-js` (full metadata) on the server; E.164 storage; rider phone must be Nigerian |
| 5 | Flower total not refreshing | The `[data-open]` click handler (which calls `total()`) was registered *before* the flower “add” handler, so `total()` ran before `flower` was set; `showFlower()` never recomputed | Totals now come from the server (`/api/cart/quote`) and are re-requested on every bag or zone change; tested |
| 6 | Client-side calculation | Prices in `data-price` attributes | `priceCart()` on the server is the only source; the browser sends IDs only |
| 7 | Inconsistent delivery pricing | Fees duplicated in 3 places (order select, brief select, zones table) | One `delivery_zones` table, editable in admin |
| 8 | Two ordering experiences | Order box vs. WhatsApp brief, with different options | One flow: letter → bag → checkout; WhatsApp remains as help |
| 9 | Everything tied to a letter | Product buttons were “Add to a letter” | Every product has its own page and Add to bag; tested buying a tag alone |
| 10 | Chrysanthemum placeholders | Hard-coded with a disclaimer | Seeded as “Request a quote”; admin can set a confirmed price |
| 11 | 1.35 MB base64 | Images inlined | Extracted to `/public/images` with descriptive names; served as AVIF/WebP at responsive sizes; hero preloaded; others lazy |
| 12 | No order management | — | `/admin`: orders, statuses, drafts, payments, refunds, delivery, stock, roles, audit log |
| 13 | Incomplete SEO | Single page; no OG image | Product URLs, per-page metadata, OG image, Product/Offer + Breadcrumb + LocalBusiness + FAQPage JSON-LD, sitemap, robots, canonicals |
| 14 | No policies | — | Privacy (NDPA 2023), Terms, Refunds, Delivery — drafts flagged for legal review |
| 15 | No analytics | — | Cookieless first-party events + admin dashboard + real-user Core Web Vitals |
| 16 | Gold Card not operational | — | `nfc_experiences` / `nfc_items` / `media_assets`, buyer & staff editors, time-of-day notes, access codes, expiry, QR, view counts |
| 17 | No tracking/verification | — | Private order page (HMAC token), status timeline, letter approval, number+phone lookup |

### Additional defects found
| # | Defect | Fix |
|---|---|---|
| A1 | Minimum delivery date used `new Date().toISOString()` (UTC): between 00:00 and 01:00 Lagos time, “today” was yesterday; the check was client-side only | `src/lib/dates.ts` works in Africa/Lagos; the server enforces lead time, cut-off hour, blackouts and capacity |
| A2 | Button said “Pay ₦X” even when delivery was “we’ll quote” | Awaiting-quote orders show “Send for a delivery quote” and can’t be paid until staff set the fee |
| A3 | Email and phone not clickable | `mailto:` and `wa.me` links |
| A4 | Gold Card in the shop had no add action | Add to bag on card, product page and `/gold-card` |
| A5 | Scent state was global (`querySelectorAll('.scent')`) — would break with a second candle | Variants are per product |
| A6 | No `<main>` landmark or skip link; trust strip `h4` without parent levels; conflicting duplicate `.stats` and `.faq` CSS | Landmarks, skip link, one `h1` per page, ordered headings, deduplicated CSS |
| A7 | Burger menu: no Escape, focus not returned | Escape closes and returns focus; `aria-expanded` kept in sync (tested) |
| A8 | Form errors not linked to fields | `aria-invalid`, `aria-describedby`, focused error summary with links (tested) |
| A9 | Summary rows built with `innerHTML` | React rendering only; JSON-LD escaped |
| A10 | `/#write` deep link showed nothing (the box was `hidden` until a click) | Real `/letter` route |
| A11 | FAQ contradicted the page (“send us a DM for our price list”, “Shop highlight”) | Answers updated |
| A12 | Kraft-box photo declared 540×612 but is 900×1200 (distorted aspect) | Real dimensions recorded |
| A13 | The Gold Card photo was embedded twice (2 × 34 KB) | De-duplicated on extraction |
| A14 | Timing statements disagreed (“48 hrs”, “48 to 72 hours”, “at least 2 days”) | Production time and delivery date are now separate concepts; checkout shows the earliest real date |
| A15 | With JavaScript off, “Start a letter” led to a hidden form | Real `/letter` route. Pages are server-rendered, so product information, delivery fees and policies are readable without JS; the bag, checkout and forms still need JavaScript |
| A16 | Unused CSS (`.video`, `.shot`, `.ph-note`, `.demo-note`) | Removed |

## 3. What changed visually
Colours, type (Bodoni Moda / Karla / Caveat), spacing, copy and photography are carried over. The look is the same; it now spans several pages instead of one, with a sticky header, product pages, a bag and an admin. No stock imagery was added. The LLH Tag still uses the original SVG illustration because no photograph exists.
