# Deployment and external services

## Recommended setup (low cost, one server)
**A small Linux VPS (2 GB RAM) running Docker Compose: the app + PostgreSQL 16 + Caddy (automatic HTTPS).**
This costs roughly a fixed US$6–12 a month, there's one thing to back up (the database holds orders, catalogue *and* Gold Card media), and nothing depends on a serverless provider's limits. A Lagos-adjacent region (e.g. Europe-West or Johannesburg) keeps latency reasonable.

Alternative: Vercel (Pro plan is required for commercial use) + Neon/Supabase Postgres. Both work. Set `DATABASE_SSL=require`, and note that Vercel's 4.5 MB request limit caps photo and voice uploads below the app's own limits.

## Steps (VPS)
1. Point `loveliveshere.ng` and `www` DNS A records at the server.
2. On the server: install Docker, clone the repo, `cd love-lives-here/deploy`.
3. `cp ../.env.example .env` and fill it in:
   - `APP_URL=https://loveliveshere.ng`
   - `APP_SECRET` = `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (changing it later invalidates existing private order links)
   - `POSTGRES_PASSWORD` = a long random string
   - Paystack, newsletter and email keys (below)
4. Edit `Caddyfile` if the domain differs. `docker compose up -d --build`.
5. Create the schema and data:
   ```
   docker compose run --rm ops tsx scripts/migrate.ts
   docker compose run --rm ops tsx scripts/seed.ts
   docker compose run --rm -it ops tsx scripts/create-staff.ts --email you@example.com --name "Your name" --role owner
   ```
6. Sign in at `/admin`. Owners and managers are asked to set up two-factor sign-in first.
7. **Before launch**, work through the admin warnings: confirm every “unverified” price, set chrysanthemum prices or leave them as quotes, check contacts, hours and delivery fees, and verify or keep hiding the claims (200+, 4.9★).
8. Schedule jobs (`crontab -e` as root):
   ```
   15 2 * * *  BACKUP_PASSPHRASE=... /opt/llh/love-lives-here/deploy/backup.sh
   40 2 * * *  cd /opt/llh/love-lives-here/deploy && docker compose run --rm ops tsx scripts/retention.ts
   ```

## Paystack (payments)
1. Paystack dashboard → Settings → API Keys & Webhooks.
2. **Test first:** put the `sk_test_…` secret key in `PAYSTACK_SECRET_KEY`. Orders paid with a test key are flagged as test orders and excluded from sales figures.
3. **Webhook URL:** `https://loveliveshere.ng/api/webhooks/paystack` (the app checks the `x-paystack-signature` HMAC; unsigned calls get 401).
4. The callback URL is set per transaction by the app; no dashboard setting is needed.
5. Do a real test-mode payment end to end, then a test refund from the order page.
6. Go live: complete Paystack business verification (CAC, bank account), then replace the key with `sk_live_…`. Leave `PAYSTACK_BASE_URL` unset.
7. Optional hardening: restrict the webhook route to Paystack's published IPs at the proxy.

**Credentials still needed from LLH:** Paystack test and live secret keys. They were not provided during development, so all payment tests ran against a local mock of Paystack's documented API. A real sandbox run is the first launch check.

## Newsletter (Dear Lovers)
Substack has **no official API for adding subscribers**, so pick one of these:
- **Substack (default):** set `NEWSLETTER_PROVIDER=substack` and `SUBSTACK_PUBLICATION_URL` to the exact publication address (e.g. `https://fromthelovers.substack.com`, which needs verifying: that subdomain redirected to `substack.com/@fromthelovers` during the build). The site's form sends visitors to Substack's own subscribe page to confirm. Unsubscribing uses Substack's email footer link.
- **Mailchimp:** set `NEWSLETTER_PROVIDER=mailchimp`, `MAILCHIMP_API_KEY` and `MAILCHIMP_AUDIENCE_ID`. Signups use double opt-in, duplicates are detected, and `/newsletter/unsubscribe` works through the API.

Then add the **real individual post URLs** to the Dear Lovers cards in Admin → Site content. Cards stay hidden until each has a URL.

## Transactional email (optional but recommended)
Set `RESEND_API_KEY` and `EMAIL_FROM` (verify the domain in Resend). Without it, every customer message (receipts, approval links, quotes, dispatch) waits in **Admin → Outbox** with a one-tap “Open in email” button, plus WhatsApp links on each order. Nothing is reported as sent unless it was.

## Monitoring and errors
- Docker restarts the app automatically, and there's a health check on `/robots.txt`.
- Use any uptime monitor (e.g. UptimeRobot, free) on `https://loveliveshere.ng/` and `/api/zones`.
- Server errors are logged to stdout: `docker compose logs -f app`. For alerting, add an error tracker such as Sentry (not included, to avoid an extra paid dependency).

## Backups and recovery
- `deploy/backup.sh` writes a nightly `pg_dump`, encrypts it with GPG, copies it off-site with rclone and keeps 30 days.
- **Restore test (done during development):** a dump of the test database was restored into a fresh database. Order, payment, brief and media row counts, media bytes and an MD5 checksum of every order's number/status/total matched exactly.
- To restore: `gpg -d file.dump.gpg > db.dump && docker compose exec -T db pg_restore -U llh_app -d llh --clean < db.dump`. Repeat a restore drill every quarter.

## Least-privilege database
The app connects as `llh_app`, which owns only the `llh` database. Don't use the `postgres` superuser in `DATABASE_URL`. On managed Postgres, create a dedicated role per environment.

## Search Console
After launch: verify `loveliveshere.ng` in Google Search Console (DNS TXT), submit `https://loveliveshere.ng/sitemap.xml`, and check the Product and LocalBusiness rich-result reports. Also set up a Google Business Profile for local search.
