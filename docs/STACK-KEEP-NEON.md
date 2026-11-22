# Stack verdict — Keep Neon (Nov 2026)

## Decision

**Do not migrate** the DapurDekaka database to Supabase, Railway, or PlanetScale for cost reasons right now.

| Alternative | Why not now |
|-------------|-------------|
| Supabase Pro | ~$25/mo always-on floor; Auth/Storage unused; NextAuth rewrite risk |
| Railway Postgres | Similar/higher always-on cost + pooler ops on serverless |
| PlanetScale PG | Extra vendor lock; not cheaper at this size |
| DO / RDS / Hetzner | Ops burden for a solo founder |

Neon Launch at current wake-optimized usage should land roughly **$7–20/mo**. Always-on Neon 0.25 CU (~$19) still beats Supabase Pro if cold starts become a checkout UX issue.

## What we did instead

1. Documented invoice/usage + unused org projects (`docs/NEON-COST.md`)
2. Consolidated 3 hourly crons → `/api/cron/hourly` (one wake)
3. Redis cache for shipping quotes + settings snapshot; `unstable_cache` for catalog
4. Admin dashboard polls floored at 3–5 minutes
5. Confirmed CU caps 0.25–1; Launch suspend stays 300s

## Revisit migration when

- Neon invoice still **>$25/mo** after the wake fixes have been live ≥2 billing weeks, **or**
- You deliberately want a flat $25 all-in Postgres host and accept the migration soak test on money paths (checkout, Midtrans webhook, stock).
