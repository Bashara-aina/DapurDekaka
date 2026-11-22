# DapurDekaka — Production Readiness Audit (post PR #14)

**Date:** 2026-10-19 · **Commit audited:** `5c59f82` (main = live production deploy `dpl_7hd3ChRE…`, state READY)
**Supersedes the "what is broken" parts of:** `audits/oct2026/01–05` (written against `d646f56`, before PR #14 landed). Older audit files in `audits/` are historical.

## How this was checked (and its limits)

| Method | Done |
|---|---|
| `tsc --noEmit`, `next lint --max-warnings 0`, `vitest run` | ✅ all clean — 0 type errors, 0 lint warnings, 137/137 tests |
| Live probes of `https://www.dapurdekaka.com` | ✅ 12 URLs, sitemap, robots, health |
| Vercel deployments + 7-day runtime errors | ✅ latest prod deploy READY on HEAD, **0 runtime errors** |
| Read-only queries on the DB in local `.env` | ✅ counts/keys only, no secrets or customer data printed |
| Re-reading the code behind every Oct audit finding | ✅ for checkout, webhook, cancel, dispatch, points, auth, middleware, config |
| Vercel env vars | ❌ **403 — could not read.** Everything marked "UNVERIFIED" below needs you to check the dashboard |
| Real payment / real courier booking | ❌ not possible from here — must be done by you |
| Line-by-line read of all ~985 files | ❌ I did not. Admin CMS, B2B portal, blog and UI components were sampled by grep, not read fully |

---

## 1. Verdict

**The code is close to launch-ready. The remaining distance is mostly proof, configuration, content and operations — not features.**

The morning's blockers are gone: the site is up, legal pages and blog return 200, the sitemap/robots/JSON-LD point at `https://www.dapurdekaka.com` (0 `localhost` hits), the 2FA columns exist in the DB, E2E test orders were removed, and `biteship_origin_*` settings are filled. PR #14 fixed almost every CRITICAL/HIGH money bug I could find in the earlier audit.

What still separates you from "take real customers' money":

1. **No real end-to-end payment has ever completed.** DB has exactly 1 order, `DDK-20261019-0001`, `pending_payment`. Webhook → paid → pack → courier → delivered has never run in production.
2. **Production secrets/config are unverifiable** from the repo (Midtrans live keys, Fonnte, cron, Upstash, Sentry).
3. **Nobody is protected by 2FA**, even though it's built (all 4 admin accounts: `two_factor_enabled = false`).
4. **Business content is thin/unreviewed** (0 coupons, 0 testimonials, legal text is seed text, "content fill" checklist unchecked).
5. **No safety net:** no integration tests of the money path, no uptime/alert monitoring, backup/restore never rehearsed, local dev shares the production database.

---

## 2. Verified fixed since the morning audit (do not re-do)

| Old ID | Item | Evidence |
|---|---|---|
| Blocker 1 | 2FA columns missing / build failing | `information_schema` shows all 4 columns; latest deploy READY |
| Blocker 2 | `NEXT_PUBLIC_APP_URL` = localhost | live HTML 0× `localhost:3000`; sitemap uses `www`; build now throws if prod URL is localhost/http (`next.config.mjs`) |
| Blocker 3 | Legal/blog 500 | `/terms /privacy-policy /refund-policy /trust /blog` all 200 |
| Blocker 4 | `biteship_origin_*` | present in `system_settings`; dispatch refuses empty origin (`lib/shipping/dispatch.ts`) |
| C1 | Client-trusted `discountAmount` | `let discountAmount = 0`, server-only; guard `discountAmount > subtotal` |
| C2 | COD double charge | server stores `cashOnDelivery: false` |
| C3 | Old VA after retry lost | webhook resolves `-retry-N` ids (`webhooks/midtrans/route.ts:333`) |
| C4 | Cannot cancel VA-paid order | refund row created in tx; Midtrans refund is best-effort **after** commit |
| H1 | Inactive products purchasable | `isActive` / `deletedAt` checks in initiate |
| H3 | Oversell leaves paid order stuck | `handleOversellAtSettlement` → paid + needsAttention + refund obligation |
| H8 | Fire-and-forget notifications | `lib/utils/background.ts` uses `waitUntil` |
| M3/K4/M4 | Coupon usage drift, Midtrans cancel on admin-cancel | fixed in status route |
| P1 | Points reversal without ledger | one `reverseRedeemedPointsTx` used by all 5 cancel paths; ledger drift query = **0 rows** |
| P2 | FIFO partial consumption | `points_remaining` column + index |
| W1–W4, W9 | Dispatch origin, double-booking race, real dims, Biteship signature (HMAC **and** static key), pickup-code check | seen in code |
| S1/S2 | `tokenVersion`/role/isActive never re-checked | periodic DB refresh in `jwt` callback (`lib/auth/config.ts:180+`) |
| S9, HIGH-2/3/4 | CSP/XFO mismatch, static `/api/health`, canonical host, cron glob, robots | `frame-ancestors 'self'`, `force-dynamic`, apex→www 308, `app/cron/**/route.ts` |
| — | Owner "new order" alert | `webhooks/midtrans/route.ts:659+` (email + WA) — *depends on config below* |

---

## 3. Launch gates — must be true before real customers

### G1. Prove the money path with a real payment  ·  **BLOCKER**
Never done in production. Steps:
1. Vercel Production: `MIDTRANS_IS_PRODUCTION=true`, production `MIDTRANS_SERVER_KEY` (no `SB-`), `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`. **Local `.env` still has `MIDTRANS_IS_PRODUCTION=false`** — check what Vercel has.
2. Midtrans dashboard → Payment Notification URL `https://www.dapurdekaka.com/api/webhooks/midtrans`; Finish/Error/Unfinish URLs.
3. Create a Rp 10.000 test product (inactive afterwards). Run: delivery order paid by **QRIS**, pickup order paid by **BCA VA**, one **retry** (close Snap, "bayar lagi", pay the *first* VA).
4. Confirm: order → `paid`, stock decremented, points awarded, customer email + WA arrived, owner alert arrived, order shows in packing queue.
5. Cancel one paid order from admin; confirm a `refunds` row appears and the refund can be completed.
6. Verify `select … points_balance <> sum(ledger)` still returns 0 rows (query in `audits/oct2026/03`).

### G2. Verify every production env var (UNVERIFIED — Vercel returned 403 to me)
Use the new superadmin endpoint **`/api/admin/health/config`** (presence only) and the dashboard `ConfigHealthCard`. Minimum list:

| Var | Why it matters if missing |
|---|---|
| `AUTH_SECRET` (≥32), `AUTH_URL`/`trustHost` | auth fails to boot |
| `TOTP_ENCRYPTION_KEY` | without it, rotating `AUTH_SECRET` locks every 2FA user out |
| `UPSTASH_REDIS_REST_URL/TOKEN` | `rate-limit.ts` throws in prod → checkout/auth/webhooks 500 |
| `CRON_SECRET` | all 9 crons 401 → no expiry, no reconciliation |
| `MIDTRANS_*` (prod) | see G1 |
| `BITESHIP_API_KEY` (`biteship_live.`), **`BITESHIP_WEBHOOK_SECRET`** | if the secret is unset the code silently falls back to the **API key** as webhook secret — set a dedicated one |
| `FONNTE_API_KEY` (+ device) | all WhatsApp (customer + ops alerts) silently dropped |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` + **domain verified in Resend (SPF/DKIM/DMARC)** | emails land in spam or are rejected |
| **`NEXT_PUBLIC_WHATSAPP_NUMBER`** | server alerts read this env, **not** the `store_whatsapp_number` DB setting (see C-07) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | no error visibility |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (referrer-restricted), Cloudinary keys, `AUTH_GOOGLE_*` | map picker, uploads, Google login |

### G3. Courier path with a real shipment  ·  **BLOCKER for delivery orders**
Biteship wallet topped up, webhook registered at `/api/webhooks/biteship`, one real GoSend/Grab booking through "Book courier", watch status flow to `delivered` via webhook. The signature scheme now accepts both HMAC and static-key mode, but it has **never received a real Biteship call**.

### G4. Turn on 2FA for every admin and shorten admin sessions
DB: superadmin ×2, owner, warehouse — all `two_factor_enabled = false`. These accounts can see customer PII, issue refunds and change prices. Enroll all four, store backup codes offline, then enforce 2FA for roles `superadmin|owner|warehouse` at login (code change, ~1 h). JWT `maxAge` is 30 days for everyone, including admins — use ≤12 h for admin roles.

### G5. Database safety
- **Backups/PITR:** confirm Neon plan retention; do **one** restore drill into a branch. (Docs mention backups; nothing proves it was rehearsed.)
- **Separate dev from prod:** `.env` / `.env.local` point at a database that holds the same data the live site serves. Create a Neon branch for local + previews. Today a bad local script hits production.
- **Migration hygiene:** `drizzle.__drizzle_migrations` has 9 rows vs 14 SQL files; two files are numbered `0001_*`; a second `drizzle/migrations/` folder exists; `/drizzle/meta/` is gitignored while CI runs `drizzle-kit check` (it cannot meaningfully check without the journal). Run `npm run db:baseline`, renumber, un-ignore `meta/`, and apply migrations *before* deploy in CI.

### G6. Content & business settings (placeholder status)
| Item | State | Action |
|---|---|---|
| Coupons | **0 rows** | Create the launch promo; `promo_code` setting must match a real active coupon (check `promo_active`) |
| Testimonials | **0** | Add real ones or hide the section; never ship invented reviews |
| Legal pages (CMS `privacy`, `refund`, `terms`, `trust`) | seeded text | Have a lawyer review for UU PDP, e-commerce (PP 80/2019), frozen-food claim/return terms |
| `admin_email` = `admin@dapurdekaka.com` | looks like a default | Confirm that mailbox exists — it receives new-order alerts |
| `store_whatsapp_number` | `6289673737886` | confirm it's the real business line; align with env var (C-07) |
| Product data | 21 products / 48 variants, dims present | Spot-check prices, stock, halal claim, images, EN/ID copy |
| `CONTENT_FILL_CHECKLIST.md` | unchecked | Work through it |
| Soft-launch banner/noindex | still on | Turn off deliberately after G1–G3; then submit sitemap to Search Console |
| Stale settings | `rajaongkir_origin_city_id`, duplicate upper-case `PROMO_*`, `CAROUSEL_SPEED_MS` | run `npm run db:migrate:settings`, delete leftovers |

---

## 4. Code & design findings still open

Severity: **H** fix before launch/first week · **M** within first month · **L** backlog.

| ID | Sev | Finding | Where | Fix |
|---|---|---|---|---|
| C-01 | H | **No admin 2FA enforcement** (feature exists, is optional) | `lib/auth/config.ts` authorize | Require enrolled 2FA for admin roles; force enrolment on first login |
| C-02 | M | **No stock reservation.** Oversell is now *handled* (paid + refund obligation) but still costs you a refund + angry customer | `checkout/initiate` | Short term: per-variant safety stock + hide "add to cart" below it. Later: `reserved` counter released by cancel-expired |
| C-03 | M | **Pickup code = order number** — printed on receipts/emails, so it proves nothing | `lib/finance/settle-order.ts:86` | Random 6-char code, shown only on the customer's order page/email |
| C-04 | M | **B2B points multiplier is 2×** in DB (`b2b_points_multiplier=2`) and constant, while financial rule L2-10 says no 2×. B2B is flag-off, so latent | `lib/constants/points.ts`, settings | Decide; set to 1 or update the rule |
| C-05 | M | **CSP allows `'unsafe-inline'` scripts**; no nonce, no `report-uri` | `next.config.mjs` | Acceptable for launch; add nonce-based CSP + report endpoint later |
| C-06 | M | **PII in logs:** forgot-password logs the plain email; client pages log emails | `api/auth/forgot-password/route.ts:91`, `(auth)/forgot-password/page.tsx:37` | Hash or drop; scrub in Sentry `beforeSend` |
| C-07 | M | **Two sources of truth for the store WhatsApp number:** server alerts/webhooks use `NEXT_PUBLIC_WHATSAPP_NUMBER` env; dispatch uses the `store_whatsapp_number` setting. If env is unset, ops alerts are skipped quietly (`lib/ops/needs-attention.ts:40`) | webhooks, cron, `needs-attention.ts` | One helper reading the setting with env fallback; log loudly if empty |
| C-08 | M | **Biteship webhook falls back to `BITESHIP_API_KEY` as its secret** and accepts a static header-equals-secret mode | `providers/biteship/webhook.ts` | Require `BITESHIP_WEBHOOK_SECRET`; refuse to start without it in prod |
| C-09 | M | **Unrate-limited routes:** `GET /api/orders/[orderNumber]/receipt` and authenticated account/B2B/AI/upload routes have no `withRateLimit`. Order numbers are sequential (`DDK-YYYYMMDD-0001`) | grep of `app/api` | Rate-limit receipt/track; consider random suffix |
| C-10 | M | **No data-subject features** (UU PDP): no account deletion or personal-data export route exists in the API list | `app/api/account/*` | Add delete-account (anonymise orders, keep financial records) and export |
| C-11 | M | **Admin mutations rely on a same-origin header check in middleware only** (13 routes also use explicit CSRF). Fine with SameSite=Lax, but webhook-style bypass paths must stay out of `/api/admin` | `middleware.ts` | Keep; add a test that a cross-origin POST to `/api/admin/*` is 403 |
| C-12 | L | Cron bearer comparison is not constant-time; dev bypass keyed on `NODE_ENV==='development'` | `lib/utils/cron-auth.ts` | `timingSafeEqual` |
| C-13 | L | `scripts/seed.ts` falls back to password `adminpassword123` if env missing — dangerous if ever pointed at prod | `scripts/seed.ts:20` | Throw if `SEED_ADMIN_PASSWORD` unset; refuse on prod host |
| C-14 | L | Cloudinary signed uploads: confirm the signature pins folder, allowed formats and max size | `lib/cloudinary/upload.ts` (not read in full) | Verify; add `allowed_formats`, `max_file_size` |
| C-15 | L | Dead legacy: RajaOngkir constants, `next-sitemap` remnants, `X-XSS-Protection` header, `englishComingSoon` string in profile page | `lib/constants/couriers.ts`, profile page | Delete / finish EN |
| C-16 | L | `/api/admin/export/*` exposes customer PII; confirm owner-only and audit-logged | `app/api/admin/export/*` | Verify role list; write audit-log row per export |
| C-17 | L | COD toggle: server ignores it, but verify the UI no longer shows it (`CheckoutShippingStep`, `use-checkout.ts:427` still sends the field) | checkout UI | Remove toggle + field |

---

## 5. Flow-by-flow readiness

| Flow | Code | Proven live? | Remaining |
|---|---|---|---|
| Browse / PDP / cart validation | ✅ | ✅ pages 200 | delivery-area hint on PDP (Phase 0 = Bandung instant + pickup only) |
| Register / login / reset | ✅ | ⚠️ not exercised | test reset email link host + Resend domain |
| Checkout → Snap → webhook → paid | ✅ hardened | ❌ never | **G1** |
| Retry / expiry / cancel crons | ✅ | ❌ | cron secret + 1 live expiry observed |
| Points earn / redeem / expire | ✅ ledger-consistent | n/a | run drift query weekly (cron `reconcile-points` also overwrites balance from ledger — keep ledger honest) |
| Pickup handover | ✅ code check | ❌ | C-03 |
| Delivery dispatch (Biteship) | ✅ | ❌ | **G3** |
| Delivered email / review prompt | ✅ | ❌ | depends on G3 webhook |
| Refund / dispute | ✅ queue + manual path | ❌ | rehearse once (G1 step 5) |
| Owner alerts | ✅ coded | ❌ | Fonnte + email config (G2) |
| B2B portal / blog CMS / AI content / vouchers | feature-flagged **off** | — | leave off for launch; `b2b-profiles` admin page is still reachable while portal is off |

---

## 6. Security posture summary

**Good:** bcrypt + TOTP + backup codes; JWT with periodic server-side re-validation (deactivation/role/tokenVersion); rate limiting on auth/checkout/webhooks; Midtrans signature + gross-amount check; server-computed prices/discounts; role checks on admin APIs; reset tokens hashed; HSTS preload, CSP, nosniff, frame-ancestors; signed uploads restricted to owner/superadmin; sanitised CMS HTML; no secrets tracked in git (`.env*` ignored, only `.env.example` tracked — checked).

**Gaps:** C-01, C-05, C-06, C-08, C-09, C-10 above; admin sessions 30 days; five different `.env*` files with live credentials sit on the laptop beside the repo (rotate Neon/Midtrans/Resend/Biteship keys if the machine or any backup is ever shared); Vercel env not auditable by me.

---

## 7. Engineering & operations hygiene

| Area | Finding | Action |
|---|---|---|
| Tests | 137 unit tests, all mocked; **no DB integration or browser E2E in CI** (E2E scripts are manual `scripts/e2e-*.mjs`) | Neon-branch integration tests: initiate→webhook→cancel, retry-old-VA, oversell, cancel-keeps-ledger-balanced |
| CI | Runs on Node **20** while `engines` says **24.x**; does not run `next build`; jscpd step is `\|\| true` | Match Node, add build step, make `db:check` real |
| Monitoring | Sentry configured but DSN unverified; no uptime check; no alert on cron failures or `needsAttention` backlog | UptimeRobot/BetterStack on `/api/health`; Sentry alert on webhook 5xx; WA/email when `needs_attention` > 0 for 1 h |
| Crons | 9 jobs, some `*/30`/hourly — requires Vercel Pro (deploys pass, so presumably OK) | Check Vercel cron dashboard shows successful runs |
| Runbooks | `SCALE-GUIDE/05`, `strategy/L4` exist | Write a 1-page "payment received but order not paid" and "courier booking failed" runbook using Ops page |
| Repo clutter | 15+ root-level `.md` (CURSOR_RULES 53 KB, AI_SLOP_PATTERNS 53 KB…), 90 files in `audits/`, `trigger.txt`, empty `masterprompt.md`, stale July `GO-LIVE-CHECKLIST.md` (still says `drizzle-kit push`) | Move to `docs/archive/`; keep PRD, SCHEMA, DEPLOYMENT, this file |
| Dependencies | next 14.2.35, next-auth **5 beta**, React 18, drizzle 0.39 | Run `npm audit`; plan Next 15 upgrade after launch; pin next-auth |
| Data protection | Orders hold name/phone/address | Retention policy (e.g., anonymise guest data after N years); cron `cleanup-audit-logs` exists |

---

## 8. Action plan

### Phase A — Prove it (1–2 days, mostly you, little code)
1. Check Vercel env vs G2 table; hit `/api/admin/health/config`. 
2. Midtrans production keys + notification URL; Biteship live key, wallet, webhook, secret.
3. Run G1 test matrix (QRIS, VA, retry, cancel+refund, pickup).
4. Run G3 real courier shipment.
5. Enroll 2FA on all 4 admin accounts.
6. Fix `admin_email`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, create launch coupon, add testimonials or hide.
7. Delete test order `DDK-20261019-0001` (or finish it) and any test products.

### Phase B — Small code changes (≈1 day)
C-01 (enforce admin 2FA + 12 h admin session), C-03 (random pickup code), C-07 (single WA helper + loud failure), C-08 (require webhook secret), C-17 (remove COD UI), C-13 (seed guard), C-06 (PII logs), C-09 (rate-limit receipt), C-12.

### Phase C — Safety net (week 1 after launch)
Neon branch for dev/preview; backup restore drill; baseline migrations + CI migrate; uptime + Sentry alerts; integration tests; safety-stock rule (C-02); archive docs; legal review.

### Phase D — Growth/compliance (weeks 2–6)
C-10 account deletion/export; B2B points decision (C-04); nonce CSP (C-05); delivery-area checker + WhatsApp fallback CTAs; Google Business Profile + Search Console; Next 15 upgrade; turn on B2B/blog CMS flags one at a time with their own QA.

---

## 9. Definition of "production ready"

- [ ] G1–G6 all ticked, with screenshots/log of the real payment and real shipment
- [ ] 0 rows from the points-drift query; `needs_attention` queue empty
- [ ] All admin accounts on 2FA; local dev no longer touches the production DB
- [ ] A restore from backup has been done once
- [ ] An outage or failed webhook reaches your phone within 15 minutes
- [ ] You can run the SOP in `audits/oct2026/04` (pack → book courier / pickup code → refund) without opening the code
