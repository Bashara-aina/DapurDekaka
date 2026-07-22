# 05 — Load, Resilience, Observability & Runbook

> **Scope:** Making the system *survive* the spike, *know* when it's struggling,
> and *recover* fast. Rate limiting, crons, webhook idempotency, load testing,
> monitoring, and an incident runbook. This is the operational half of the guide.

---

## 1. Rate limiting (currently one global limiter — not enough)

`lib/utils/rate-limit.ts` uses Upstash sliding window **10 requests / 1 min**,
globally. Problems at scale:
- **Too tight** for legitimate browsing (10/min blocks a normal shopper).
- **Too loose** for abuse-prone endpoints (login, register, checkout, coupon,
  forgot-password, OTP).
- Correctly **fails hard in prod if Upstash unset** — keep that.

### Design per-tier limits (key by IP for anon, by user id when authed)
| Tier | Endpoints | Suggested limit |
|------|-----------|-----------------|
| Auth-sensitive | login, register, forgot/reset-password | 5–10 / 15 min per IP+identifier |
| Money/mutation | checkout/initiate, coupon validate, points redeem | 5–20 / min per user |
| Public read | catalog, product, blog (should be **cached**, doc 03) | 60–120 / min per IP or none (CDN absorbs) |
| Webhooks | midtrans, biteship | no user limit; verify signature instead |
| Crons | `/api/cron/*` | not public; `CRON_SECRET` gate |

### Actions
- Refactor to a `rateLimit(key, tier)` helper with a limiter per tier.
- Add **bot/abuse protection** on auth + checkout (Vercel Firewall / WAF rules,
  challenge on anomaly).
- Return `429` + `Retry-After`; make the UI handle it gracefully.

---

## 2. Middleware & circuit breaker

- `app/middleware.ts` — keep it **lean** (it runs on every matched request). Avoid DB
  calls in middleware; it's Edge and adds latency to everything.
- Wire **`MAINTENANCE_MODE`** into middleware: when `true`, short-circuit to a static
  "we'll be right back" page for storefront (allow admin + webhooks). This is your
  **load-shed switch** during an incident — test it before you need it.
- Use **feature flags** (`lib/config/feature-flags.ts`) to disable expensive/optional
  features under stress (e.g. turn off AI, non-critical widgets).

---

## 3. Webhook & checkout idempotency (correctness under retries)

External systems **retry**. Under load, duplicate deliveries are normal, not rare.
- **Midtrans webhook:** verify signature → dedupe on `order_id + transaction_status`
  (or `transaction_id`) via a unique row or Redis SETNX → process once → 200 fast.
  Never double-credit points/stock. (Audits flagged double-deduct/4× points — this is
  where they bite.)
- **Biteship webhook:** verify `BITESHIP_WEBHOOK_SECRET`, dedupe on event id.
- **Guest checkout:** enforce idempotency key (doc 02 §2) so double-click ≠ 2 orders.
- **Rule:** every state-changing external callback must be **idempotent + signature-
  verified + fast**. Offload slow work (email/WA) to a queue, return 200 immediately.

---

## 4. Cron reliability (9 jobs)

| Cron | Schedule | Risk | Action |
|------|----------|------|--------|
| cancel-expired-orders | */15 | must restore stock atomically | set-based, idempotent |
| reconcile-payments | */10 | **must update DB, not just log** (known bug) | fix + bound with LIMIT |
| retry-dispatch | */30 | retries external calls | backoff + max attempts |
| expire-points | daily | non-atomic history (audit) | transactional, batched |
| points-expiry-warning | daily 09:00 | send blast | queue, throttle Fonnte/Resend |
| reconcile-points | daily 03:00 | N+1 / inflation bugs (audit) | set-based, verify math |
| pickup-release | daily 10:00 | — | idempotent |
| cleanup-counters | daily 02:00 | growth control | batched delete |
| cleanup-audit-logs | weekly | growth control | batched delete, indexed |

**Every cron must:**
1. **Verify `CRON_SECRET`** (`Authorization` header) — reject public callers.
2. Be **idempotent + re-entrant** (overlapping runs safe).
3. **Bound work** with `LIMIT` + paging so a backlog can't run past its interval.
4. Emit a **success/failure metric** to Sentry so a silently-failing cron is visible.
5. Have a **`maxDuration`** appropriate to its work (add to `vercel.json` if needed).

---

## 5. Load testing (know your ceiling before customers find it)

Do this **before** any marketing push, in a **preview/staging** environment with a
separate DB (never load-test production's Neon primary).

### Scenarios (use k6 / Artillery)
1. **Browse:** home → catalog → product detail (measures cache effectiveness, doc 03).
2. **Checkout funnel:** add to cart → shipping quote → initiate → (mock) webhook.
3. **Auth burst:** concurrent logins/registers (bcrypt CPU, rate limits).
4. **Cron overlap:** run reconcile crons *while* the browse+checkout load runs.

### Targets to record
- Sustain **3× expected peak RPS** with p95 < 800 ms and error rate < 1%.
- Watch: Vercel function concurrency, Neon CPU + connections, Upstash command rate,
  vendor 429s (Midtrans/Biteship).
- Find the **knee** (where p95 explodes) and set alerts at 60% of it.

> Output: a `load-test-baseline.md` with the knee, headroom, and the limiting resource
> (almost certainly DB before caching, function-concurrency or a vendor after).

---

## 6. Observability (you're partly blind today)

- **Sentry**: DSN must be set in prod (blank in `.env.example`). Prod dependency ✅.
  - Set `tracesSampleRate` ~0.1 in prod; capture checkout/webhook/cron spans.
  - Alert on error-rate spikes and on new error signatures.
- **Vercel**: enable Analytics + Speed Insights (web vitals) and function/log drains.
- **Neon**: dashboard for CPU, connections, slow queries (`pg_stat_statements`).
- **Upstash**: command rate + throttle metrics.
- **Uptime**: external monitor (e.g. hitting `/api/health`, which exists) every 1 min;
  page on failure.
- **Business SLOs to watch live during a spike:**
  - Checkout success rate (initiate → paid).
  - Webhook processing lag & failure count.
  - Cron success/duration.
  - Vendor error rates (Midtrans/Biteship/Fonnte/Resend 4xx/5xx).

### Minimum alert set
- [ ] Error rate > 2% (5-min window)
- [ ] p95 latency > 1.5s on checkout
- [ ] Neon connections > 80% ceiling
- [ ] Any cron failure or run > interval
- [ ] Webhook failure rate > 1%
- [ ] Vendor 429/5xx surge
- [ ] Upstash throttling

---

## 7. Incident runbook (print this)

**Symptom → first move:**

| Symptom | Likely cause | Immediate action |
|---------|--------------|------------------|
| Site slow, 5xx climbing | DB saturated (no cache) | Flip on caching/ISR if staged; scale Neon up a step; enable `MAINTENANCE_MODE` for non-critical if needed |
| `too many connections` | Connection ceiling | Reduce per-instance pool `max`; scale Neon; shed load via maintenance mode |
| Checkout failing | Midtrans/Biteship down or throttled | Show graceful fallback; rely on `reconcile-payments`; post status banner |
| Orders stuck "pending" | Webhook not processing | Check signature verify + idempotency; manually trigger reconcile cron |
| Points/stock wrong | Race / double-processing | Freeze affected promo (feature flag); reconcile; audit ledger |
| WhatsApp not sending | Fonnte device down / cap | Fallback to email; queue backlog; don't block checkout |
| Runaway bill | Uncached traffic / leaked Maps key | Enable caching; rotate + restrict Maps key; Vercel spend alert |

**Escalation order:** 1) enable caching / scale DB, 2) rate-limit tighter on the hot
endpoint, 3) disable non-critical features via flags, 4) `MAINTENANCE_MODE` as last
resort (storefront only, keep webhooks + admin alive).

**Recovery:** confirm reconcile crons cleared the backlog, verify ledger/stock
integrity, write a short post-incident note (what broke, the knee, the fix).

---

## 8. The one-page pre-launch scale gate

Do **not** run a big campaign until all are green (details in docs 01–04):
- [ ] Vercel Pro + `sin1`; Neon + Upstash in Singapore
- [ ] Public/catalog pages cached (ISR + Redis) — DB load decoupled from traffic
- [ ] Checkout write path atomic; guest idempotency enforced
- [ ] Per-tier rate limits + WAF on auth/checkout
- [ ] All crons: `CRON_SECRET`-gated, idempotent, LIMIT-bounded, monitored
- [ ] Midtrans/Biteship webhooks: signature-verified, idempotent, fast
- [ ] Vendors: quotas known, sends queued, graceful degradation
- [ ] Sentry + Vercel Analytics + uptime + alerts live
- [ ] Load test at 3× peak passed; knee & headroom documented
- [ ] `MAINTENANCE_MODE` circuit breaker tested end-to-end
- [ ] Secrets only in Vercel; rotated; no secrets in `NEXT_PUBLIC_*`

---

### How to use these 5 docs
1. **01** — fix the environment (regions, plans, secrets). *Foundation.*
2. **02** — make the DB atomic and lean. *Correctness + the real bottleneck.*
3. **03** — add caching. *The biggest single scalability win.*
4. **04** — harden every vendor dependency. *The parts you don't control.*
5. **05** — rate-limit, monitor, load-test, and know how to recover. *Operations.*

Work top-to-bottom; re-run the checklists before every major traffic event.
