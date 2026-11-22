# Neon Cost Runbook (DapurDekaka)

Keep Neon compute hours and connection churn low without breaking checkout transactions.

## Verdict (Nov 2026 audit)

**Keep Neon. Do not migrate to Supabase / Railway / PlanetScale for cost.**

| Signal | Value (as of 2026-11-22) |
|--------|--------------------------|
| Project | `dapurdekaka` (`lucky-night-99721498`) |
| Plan | Launch (`launch_v3`) |
| Region | `aws-ap-southeast-1` (matches Vercel `sin1`) |
| Active time (Nov 1–22) | ~180 h (~8 h/day) |
| Compute time | ~48.5 CU-hours ≈ **$5–8 MTD** at $0.106/CU-hr |
| Logical size | ~35 MB |
| Branches | 1 (`production`) |

The bill is **wake time**, not storage. Supabase Pro (~$25 always-on) is more expensive at this shape. Revisit migration only if Neon stays painful **after** wake fixes below.

### Other Neon projects in the same org

| Project | ID | Notes | Action |
|---------|-----|-------|--------|
| `dapurdekaka` | `lucky-night-99721498` | Production | Keep |
| `jastip` | `winter-mountain-39776566` | Separate app; ~3 h active this period | Keep if still used; delete from Neon console if abandoned |
| `asd` | `falling-firefly-58031376` | Idle since 2026-07; us-east-1 | **Delete in Neon console** (unused) |

Do not delete projects from automation — confirm in [Neon Console](https://console.neon.tech) first.

### Spend alerts

Turn on billing alerts in Neon + Vercel + Cloudinary + Google Maps. Suggested Neon soft cap: notify at **$15** and **$25**/mo.

---

## Connection strings (Vercel)

| Env var | Use | Host must contain |
|---------|-----|-------------------|
| `DATABASE_URL` | App runtime (`lib/db`) | `-pooler` (e.g. `ep-…-pooler.…neon.tech`) |
| `DATABASE_URL_UNPOOLED` | `drizzle-kit` / DDL scripts only | Direct endpoint (no `-pooler`) |

Mis-setting the app on the direct endpoint multiplies connections under serverless and raises the bill.

Pooled host for production: `ep-late-butterfly-ao1ltrql-pooler.c-2.ap-southeast-1.aws.neon.tech`

---

## Neon console (tuned)

- **Scale-to-zero:** enabled — Launch plan is fixed at **300s** idle (cannot set 60–120s; only Scale plan can). Disable only with `suspend_timeout_seconds: -1` if you accept always-on cost (~$19/mo at 0.25 CU).
- **Autoscaling:** min **0.25 CU**, max **1 CU** (raise max only for campaigns) — verified on endpoint `ep-late-butterfly-ao1ltrql`
- Delete unused branches (each branch can hold compute + storage)
- Prefer Singapore region to match Vercel `sin1`
- History retention on production: 6 h (`21600s`) — fine for Launch; raise only if PITR needs longer
- **Pooler host:** `ep-late-butterfly-ao1ltrql-pooler.c-2.ap-southeast-1.aws.neon.tech` — must be in Vercel `DATABASE_URL`

---

## App behavior that affects the bill

- **Pool** (`lib/db/index.ts`): WebSocket Pool `max: 3` for real transactions. Do not revert to `neon-http`-only.
- **Maintenance**: Edge middleware uses `MAINTENANCE_MODE` env only. Admin DB toggle is checked in `app/(store)/layout.tsx` (Node).
- **Crons** (`vercel.json`): **one** `/api/cron/hourly` at `:00` runs cancel-expired + reconcile-payments + retry-dispatch in a single wake. Other jobs stay daily/weekly.
- **Ghost Midtrans orders**: cancel/reconcile treat HTTP 404 / “Transaction doesn't exist” as unpaid and cancel — prevents forever hourly Midtrans+Neon wakes.
- **Admin dashboards**: poll every **3–5 minutes**; background tabs do not refetch.
- **Store**: homepage/catalog use ISR + `unstable_cache`; settings snapshot is Redis-backed when Upstash is configured; shipping quotes cache **15 min** in Redis.
- **Cache helpers**: `lib/cache/redis-cache.ts` (`cacheGet` / `cacheSet` / `withStampedeLock`).

---

## Health monitors

`/api/health` runs a real DB query and must stay uncached. Point uptime monitors at **≥5 minute** intervals (never 1 minute) so probes do not keep Neon awake all day.

---

## Ops habits

- Close unused admin / field dashboard tabs overnight.
- Prefer Vercel env `MAINTENANCE_MODE=true` for emergency kill-switch without waiting on cache.
- After large schema migrations, confirm the app still uses the pooled URL in production.

---

## Decision rule

- Neon **under ~$20/mo** after wake fixes → stay.
- Need zero cold starts → disable scale-to-zero on Neon (~$19 for 0.25 CU always-on) **before** paying Supabase $25.
- Reopen Supabase only if invoice still hurts after cron consolidation + cache shield + unused-project cleanup.
