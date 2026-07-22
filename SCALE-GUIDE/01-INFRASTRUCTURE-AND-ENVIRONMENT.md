# 01 — Infrastructure & Environment (Ultimate Scale Guide)

> **Scope:** Every piece of hosting/runtime that DapurDekaka depends on, its
> current limits, and what to change so it survives a 10×–100× traffic spike
> (viral post, TV feature, Ramadan/Lebaran rush, flash promo).
>
> **Stack of record:** Next.js 14.2 (App Router) on **Vercel**, **Neon**
> PostgreSQL (serverless HTTP driver), **Upstash** Redis, NextAuth v5 (JWT
> sessions), Midtrans, Biteship, Resend, Cloudinary, Fonnte, Sentry.

---

## 0. TL;DR — the 6 things that will break first

| # | Weak point | Why it fails under load | Fix priority |
|---|-----------|------------------------|--------------|
| 1 | **169 `export const dynamic`** routes/pages — nothing cached | Every request = cold DB round trips; no CDN shielding | 🔴 P0 |
| 2 | **Neon HTTP driver** (`neon-http`) | 1 HTTP round-trip *per query*; no pooled interactive transactions | 🔴 P0 |
| 3 | **Single global rate limiter** (10/min sliding) | Not scoped per-route; either too tight (checkout) or too loose (public) | 🟠 P1 |
| 4 | **9 Vercel crons** doing reconcile with N+1 queries | Cron fan-out multiplies DB load exactly when traffic is high | 🟠 P1 |
| 5 | **Third-party API ceilings** (Midtrans/Biteship/Fonnte/Resend) | Rate limits & timeouts you don't control; no queue/backpressure | 🟠 P1 |
| 6 | **No load test / capacity baseline** | You don't know your ceiling until it's on fire | 🟡 P2 |

Everything below expands these.

---

## 1. Vercel (compute + edge)

### Current setup (from `vercel.json` + `next.config.mjs`)
- Framework: `nextjs` (auto-detected serverless + edge functions).
- Custom `maxDuration: 30s` on `webhooks/midtrans` and `checkout/initiate`.
- 9 cron jobs (see §4 of doc 05).
- Security headers + CSP defined globally — good, keep.
- No `regions` pinned, no `memory` overrides, no ISR config.

### Scale actions
1. **Pin the region to Singapore (`sin1`).** Your users and Neon/Midtrans/Biteship
   are all in/near Indonesia. Cross-region latency compounds because the Neon HTTP
   driver does a round trip *per query*. Add to `vercel.json`:
   ```json
   { "regions": ["sin1"] }
   ```
   And create the **Neon project in the closest region (Singapore)** — co-location
   is the single biggest latency win.
2. **Set function memory deliberately.** Checkout/webhook do crypto + multiple DB
   calls; bump those to 1024 MB (faster CPU allotment on Vercel scales with memory).
   Leave read-only public routes at default.
3. **Know the plan limits.** Confirm which Vercel plan you're on:
   - Hobby: **no SLA, function concurrency is throttled, 100 GB-hrs**, crons limited.
     *Not acceptable for a real store.*
   - **Pro (minimum for production):** higher concurrency, 1 TB bandwidth, generous
     function execution, cron support. **Recommend Pro before any marketing push.**
   - Watch **concurrent execution limits** — a spike of dynamic requests each holding
     a 200–800 ms DB call will saturate concurrency fast. Caching (doc 03) is the
     real relief valve.
4. **Bandwidth:** Images are the bulk. They should be served by Cloudinary's CDN
   (see doc 04), *not* proxied through Vercel's `/_next/image` for already-optimized
   remote assets. Audit `next/image` usage on remote Cloudinary URLs.
5. **Budgets & alerts:** Turn on Vercel spend alerts. A traffic spike with no caching
   can produce a surprise bill from function-seconds.

### Environment separation
You have `.env`, `.env.local`, `.env.preview.local`, `.env.production`,
`.env.production.local`. **This is a footgun.** Consolidate:
- Real secrets live **only in Vercel Project → Settings → Environment Variables**,
  scoped to Production / Preview / Development.
- Keep only `.env.example` in the repo (already present — good).
- **Verify** `.env`, `.env.local`, `.env.production*` are all git-ignored (they are
  per `.gitignore`, but confirm none were ever committed: `git log --all --full-history -- .env`).
- Rotate any secret that has ever touched a committed file.

---

## 2. Neon PostgreSQL

> Deep-dived in **doc 02**. Environment-level notes only here.

- Driver in use: `@neondatabase/serverless` via `drizzle-orm/neon-http`
  (`lib/db/index.ts`). This is the **HTTP/fetch** driver — great for cold starts,
  but **every `.select()`/`.insert()` is its own HTTPS request**.
- You have both `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`. The HTTP driver
  talks to Neon's serverless endpoint and doesn't hold a socket pool, so the
  "pooler vs direct" distinction matters mainly for the WebSocket/`pg` paths and for
  migrations.

### Scale actions
1. **Enable Neon autoscaling** and set a sane **compute size ceiling** (e.g. autoscale
   0.25 → 2 CU for launch; raise before a campaign). Confirm **min CU ≥ 0.25** so
   the DB doesn't cold-start under bursty traffic; consider disabling scale-to-zero
   for production.
2. **Watch Neon connection limits.** Even with the HTTP driver, the pooled endpoint
   has a max. During a spike, hundreds of concurrent serverless invocations each
   firing several queries can exhaust it → `too many connections`. Use the **pooled**
   `DATABASE_URL` (PgBouncer) for the app, `DATABASE_URL_UNPOOLED` only for
   migrations/`drizzle-kit`.
3. **Set statement/idle timeouts** at the Neon role level to kill runaway queries.
4. **Read replicas:** Neon supports read replicas. When public traffic dominates,
   route product/catalog reads to a replica and keep the primary for checkout/writes.
   (Only worth it after caching is exhausted — see doc 03.)
5. **Backups/PITR:** Confirm point-in-time restore window is enabled and you know the
   restore runbook (doc 05 §7).

---

## 3. Upstash Redis

- Used for rate limiting (`lib/utils/rate-limit.ts`) via `@upstash/ratelimit`
  sliding window. **Correctly fails hard in production if unset** — good.
- Currently **only** rate limiting. It is also your best lever for:
  - **Caching** hot read data (settings, product catalog, shipping rate quotes).
  - **Idempotency keys** for webhooks & checkout (doc 05 §3).
  - **Cross-request counters** (stock reservations, promo caps).

### Scale actions
1. Confirm the Upstash plan's **command/sec and daily request ceilings**. The
   free/pay-as-you-go tier throttles; a REST call per request for rate-limiting +
   caching can hit limits during a spike. Size the plan to expected RPS × (rate-limit
   check + cache read).
2. Co-locate the Upstash DB in the **same region (Singapore)** as Vercel + Neon.
3. Add a **circuit breaker**: if Upstash is unreachable, fail *open* for reads
   (serve stale/uncached) but decide policy for rate-limiting (currently fails closed
   in prod because config is required — acceptable, but add health signal).

---

## 4. Environment variable inventory (from `.env.example`)

| Group | Vars | Scale/ops note |
|-------|------|----------------|
| DB | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Use pooled for app, unpooled for migrations |
| Redis | `UPSTASH_REDIS_REST_URL/TOKEN` | Required in prod; sized for RPS |
| Auth | `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET` | Set `AUTH_URL`/`NEXTAUTH_URL` in prod (was flagged in auth audit) |
| Payments | `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` | Flip `IS_PRODUCTION=true` at go-live; verify webhook signature |
| Shipping | `BITESHIP_API_KEY`, `BITESHIP_BASE_URL`, `BITESHIP_WEBHOOK_SECRET` | Set webhook secret (currently blank in example) |
| Maps | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **Restrict by HTTP referrer + set billing quota alerts** — public key = abuse risk |
| WhatsApp | `FONNTE_API_KEY`, `FONNTE_DEVICE_ID` | Single-device = single point of failure (doc 04) |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Verify domain + DKIM/SPF; watch send quota |
| Images | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY/SECRET` | Enable auto-format/quality; CDN does the heavy lifting |
| AI | `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID` | Gated behind `aiContent` flag (off) |
| Observability | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | **Blank in example — must be set in prod** (doc 05) |
| Ops | `CRON_SECRET`, `MAINTENANCE_MODE` | Cron auth + circuit breaker |
| Flags | `NEXT_PUBLIC_FLAG_*` | L4 kill list; keeps surface area small = good for scale |

### Critical env hardening
- **`CRON_SECRET`** must be set and every cron route must verify it (doc 05 §4).
- **`MAINTENANCE_MODE`** is your global circuit breaker — wire it into middleware so
  you can shed load instantly during an incident.
- `SENTRY_DSN` empty in the example → **make sure it's populated in prod** or you're
  blind during a spike.
- Any `NEXT_PUBLIC_*` var is shipped to the browser — confirm none are secrets
  (Google Maps key must be referrer-restricted).

---

## 5. Regions & data locality (do this once, benefit forever)

```
User (Indonesia) ── Vercel Edge (sin1) ── Serverless fn (sin1)
                                              │
                        ┌─────────────────────┼─────────────────────┐
                     Neon (Singapore)   Upstash (Singapore)   Midtrans/Biteship (ID)
```
Every hop that crosses an ocean adds 150–250 ms **and multiplies** because the HTTP
DB driver is chatty. Getting Vercel + Neon + Upstash all in Singapore is the highest
ROI infra change in this document.

---

## 6. Go/no-go infra checklist before a marketing push

- [ ] Vercel plan = Pro (or higher), spend alerts on
- [ ] `regions: ["sin1"]` set; Neon + Upstash in Singapore
- [ ] Neon autoscaling ceiling raised; scale-to-zero off; connection limit checked
- [ ] Upstash plan sized for expected RPS
- [ ] Public/catalog pages cached (doc 03) — **this is what saves you**
- [ ] Rate limits per-route configured (doc 05 §1)
- [ ] Sentry DSN live; dashboards + alerts wired (doc 05 §6)
- [ ] Load test run at 3× expected peak (doc 05 §5)
- [ ] `MAINTENANCE_MODE` circuit breaker tested end-to-end
- [ ] Secrets only in Vercel dashboard; local `.env*` confirmed git-ignored & rotated

**Related:** DB internals → `02`; caching → `03`; stack/vendors → `04`; load &
runbook → `05`.
