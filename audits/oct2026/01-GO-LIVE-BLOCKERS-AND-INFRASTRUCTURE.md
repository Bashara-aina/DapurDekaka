# 01 — Go-Live Blockers & Infrastructure

**Audit date:** 2026-10-19 · **Commit audited:** `d646f56` (main, PR #11 merged)
**Method:** line-by-line read of money/ops code, `tsc` + `vitest` run, live probes of `https://www.dapurdekaka.com`, Vercel deployment logs and runtime errors, read-only schema queries against the Neon DB in `.env`.

> **Bottom line:** the codebase is far more mature than the old audits suggest (type-check clean, 131/131 tests pass, money paths use transactions and guarded updates). But **production is not usable today**, and none of the blockers are in the code you'd normally look at — they're in deploy state, DB state and env config. Fix this file first; everything else is second.

---

## Baseline health

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `vitest run` | ✅ 24 files, 131 tests pass |
| Latest production deploy (`d646f56`, PR #11) | ❌ **BUILD FAILED** |
| Live site (older deploy `e7b0afa`) | ⚠️ up, but several pages 500 |
| Real customer orders in DB | **0** (4 rows, all `DDK-E2E-*` test orders) |
| Users in DB | 5 |

---

## BLOCKER 1 — Production DB is missing the 2FA columns → build fails, and login + payments are very likely broken live

**Evidence**
- Vercel build log for `dpl_8HeL334aPaeBhQ2EbsqaPjBRwkG2`:
  `error: column blogPosts_author.two_factor_secret does not exist` while prerendering `/blog/[slug]` → `npm run build exited with 1`.
- Read-only `information_schema` query: `users` has no `two_factor_secret`, `two_factor_enabled`, `two_factor_backup_codes`, `two_factor_enabled_at`. This is the **only** schema drift (every other table matches `lib/db/schema.ts`).
- Migration `drizzle/0052_add_two_factor_columns.sql` exists but was never applied. `drizzle.__drizzle_migrations` holds 9 rows while `drizzle/` has 50+ files — the DB has been maintained by `db:push`/ad-hoc SQL, not migrations.
- There are **two files numbered 0052** (`0052_add_two_factor_columns.sql`, `0052_widen_points_fifo_index.sql`).

**Why it's worse than a failed build.** The *currently live* deploy (`e7b0afa`) is built on `783401c` "ship admin CMS, 2FA…", so it already selects those columns. Every query that loads a full `users` row will throw:
- `lib/auth/config.ts:79` — Credentials `authorize()` → `db.query.users.findFirst` (all columns) → **email/password login fails**.
- DrizzleAdapter (Google login) reads `users` → **Google login likely fails**.
- `app/api/webhooks/midtrans/route.ts:246-251` — `findWebhookOrder` uses `with: { items: true, user: true }` → **every Midtrans notification 500s → no order ever becomes `paid`** (reconcile cron also loads `with: { user: true }` at `reconcile-payments/route.ts:43`).
- Blog post pages, `/trust` → 500.

Runtime error clusters didn't show this yet only because nobody has logged in or paid in 7 days.

**Fix (today, ~15 min)**
1. Apply the missing columns to prod (review first):
   ```bash
   psql "$DATABASE_URL" -f drizzle/0052_add_two_factor_columns.sql
   ```
2. Re-run the Vercel production deployment of `d646f56`.
3. Then fix the process: renumber the duplicate `0052`, baseline the journal (`npm run db:baseline` exists), and from now on deploy schema changes **before** code. Add `npm run db:check` to CI.

---

## BLOCKER 2 — `NEXT_PUBLIC_APP_URL` is `http://localhost:3000` in production

**Evidence:** live homepage HTML contains `localhost:3000` 20 times (Organization / WebSite / LocalBusiness JSON-LD, logo URL, SearchAction). `https://www.dapurdekaka.com/sitemap.xml` lists every URL as `http://localhost:3000/...`; `robots.txt` says `Sitemap: http://localhost:3000/sitemap.xml`.

`NEXT_PUBLIC_*` is inlined at build time, so the Vercel env var itself is wrong. Consequences:

| Where it's used | Effect |
|---|---|
| `lib/midtrans/create-transaction.ts:53-57` Snap `callbacks.finish/error/pending` | After paying via redirect methods (GoPay/ShopeePay deeplink, some banks), **the customer is sent to localhost** |
| `app/api/auth/forgot-password/route.ts:76` | **Password-reset emails link to localhost** → nobody can reset |
| `lib/shipping/dispatch.ts:111` | Shipping email/WA tracking link → localhost |
| `app/sitemap.ts`, `app/robots.ts`, JSON-LD | Google gets an unusable sitemap; structured data points to localhost |

**Fix:** In Vercel → Project → Settings → Environment Variables (Production): `NEXT_PUBLIC_APP_URL=https://www.dapurdekaka.com` (the apex 307-redirects to `www`, so `www` is canonical). Redeploy. Also make `lib/config/validate-env.ts` **fail the build** when `NODE_ENV=production` and the URL contains `localhost`.

---

## BLOCKER 3 — Legal pages and blog posts return 500 in production

**Evidence:** `curl` → `/terms` 500, `/privacy-policy` 500, `/refund-policy` 500, `/trust` 500, `/blog/cara-menyimpan-dimsum-frozen` 500. Vercel runtime errors (7d): 118 occurrences, 29 users:
`ERR_REQUIRE_ESM: require() of ES Module @exodus/bytes/encoding-lite.js from html-encoding-sniffer` — from `isomorphic-dompurify` → `jsdom` used in `lib/utils/sanitize-html.ts`.

**Why it's a blocker:** Midtrans production activation and Indonesian e-commerce compliance require reachable Terms / Privacy / Refund pages. Customers can't read the refund policy you'll rely on in disputes.

**Status:** PR #11 added `"overrides": { "jsdom": "^26.1.0" }` (locally resolves `html-encoding-sniffer@4.0.0`, which is CJS — should fix it), but that deploy failed (Blocker 1), so it's not live.

**Fix:** after Blocker 1, verify these 5 URLs return 200. Longer term, sanitize on **write** (admin save) and render stored HTML without jsdom on the request path — or switch to `sanitize-html` (no jsdom) for server rendering.

---

## BLOCKER 4 — Required runtime settings/env are missing or unverifiable

| Item | Evidence | Impact |
|---|---|---|
| `biteship_origin_lat`, `biteship_origin_lng`, `biteship_origin_address` | Not present in `system_settings` (read-only query) | Rates fall back to env/constant `-6.958,107.636`; **`dispatchOrder()` books Biteship with `originAddress: ''`** (`lib/shipping/dispatch.ts:64`) → booking likely rejected or courier can't find the pickup |
| `FONNTE_API_KEY` | Not in local `.env`; couldn't read Vercel env (403) | All WhatsApp (customer pickup/dispatch messages **and ops alerts for oversell / dispatch failure**) silently dropped (`lib/services/fonnte.ts:22-24` only logs a warning) |
| `UPSTASH_REDIS_*` | In `.env`; unverified in Vercel | `lib/utils/rate-limit.ts:41` **throws in production** if missing → every rate-limited route (checkout, webhooks, auth) 500s |
| `CRON_SECRET` | Unverified | Without it every cron returns 401 (`lib/utils/cron-auth.ts:16`) → expired orders never cancel, missed payments never reconcile |
| `MIDTRANS_IS_PRODUCTION` | `.env` = `"false"` | Make sure Vercel Production has `true` + production keys before launch |
| `BITESHIP_WEBHOOK_SECRET` | In `.env` | See ops file — verification scheme may not match Biteship's |

**Fix:** run through this table in the Vercel dashboard. Add a superadmin-only `/api/admin/health/config` that reports *presence* (never values) of every required env var and setting, and show it on the dashboard.

---

## HIGH — Platform/config issues

1. **Cron `maxDuration` never applies.** `vercel.json` `"app/api/cron/*.ts"` doesn't match `app/api/cron/<name>/route.ts`. Use `"app/api/cron/**/route.ts"`. Crons fall back to the default limit — the reconcile/cancel loops call Midtrans per order sequentially and can time out on a backlog.
2. **`/api/health` is statically cached.** Live response timestamp was `2026-09-15` (a month old) and showed DB "ok". It has no `export const dynamic = 'force-dynamic'` → any uptime monitor is lying. Add it.
3. **Canonical points at a redirect.** `<link rel="canonical" href="https://dapurdekaka.com">` and `og:url` use the apex, which 307s to `www`. Pick one host (recommend `www`) and use it everywhere; make the apex redirect 308.
4. **Two robots sources.** `public/robots.txt` (with AI-crawler rules, correct host) and `app/robots.ts` (localhost via env) and also `next-sitemap.config.js` with `generateRobotsTxt: true`. Production serves the `app/robots.ts` version. Keep one (recommend `app/robots.ts` with the AI rules moved in) and delete `next-sitemap` entirely — `app/sitemap.ts` already exists.
5. **Soft-launch banner is on live** while the site can't take payments. Fine — but keep `softLaunch` (noindex) on until Blockers 1-4 are done, then turn off deliberately.
6. **Test data in the production DB.** 4 `DDK-E2E-*` orders (2 stuck `paid`, 2 `shipped`) will appear in the warehouse packing queue, KPI dashboard and phase-gate metrics (`computePhaseMetrics` counts them as real delivery orders). Delete or flag them before launch; use a separate Neon branch for E2E.
7. **Single DB for every environment.** `.env` and `.env.local` point to the same Neon endpoint; previews and local dev write to production data. Create a Neon dev branch for local/preview.

---

## Go-live checklist (in order)

- [ ] Apply `0052_add_two_factor_columns.sql` to prod; redeploy; build green
- [ ] Set `NEXT_PUBLIC_APP_URL=https://www.dapurdekaka.com`; redeploy; grep live HTML for `localhost` = 0
- [ ] `/terms`, `/privacy-policy`, `/refund-policy`, `/trust`, a blog post → 200
- [ ] Verify in Vercel: `CRON_SECRET`, `UPSTASH_*`, `FONNTE_API_KEY`, `RESEND_*`, `MIDTRANS_*` (production), `BITESHIP_*`, `AUTH_SECRET`, `AUTH_URL`
- [ ] Insert `biteship_origin_lat/lng/address`, `store_address`, `store_opening_hours` in `system_settings`
- [ ] Fix the CRITICAL money bugs in file 02 (at least C1 discount trust and C2 COD)
- [ ] Remove E2E orders from prod DB
- [ ] Real end-to-end test in production with a Rp 10k product: pickup order paid by QRIS + VA, webhook flips to `paid`, warehouse processes it, emails arrive
- [ ] Log in as each role (customer, warehouse, owner, superadmin) on production
- [ ] Turn off soft-launch noindex; submit `https://www.dapurdekaka.com/sitemap.xml` to Google Search Console
