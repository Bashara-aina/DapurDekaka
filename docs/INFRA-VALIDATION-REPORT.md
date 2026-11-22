# Infra validation report — cheap + capable (2026-11-22)

End-to-end validation of Neon cost controls and store capability after the keep-Neon wake fixes.

## Scorecard

| Check | Result | Evidence |
|-------|--------|----------|
| Neon region | PASS | `aws-ap-southeast-1` matches Vercel `sin1` |
| CU caps | PASS | min 0.25 / max 1 on `ep-late-butterfly-ao1ltrql` |
| Scale-to-zero | PASS | Launch fixed 300s (cannot shorten) |
| Pooler URL (local) | PASS | `.env` / `.env.local` `DATABASE_URL` uses `-pooler` host |
| Branches | PASS | 1 production branch only (~35 MB / 11 MB DB size) |
| Unused `asd` endpoints | PASS | All 3 endpoints set `disabled: true` (idle since Jul) |
| Cron consolidation | PASS | `vercel.json` → single `/api/cron/hourly`; unit + live run OK |
| Stuck pending order | FIXED | `DDK-20261019-0001` cancelled (Midtrans 404 ghost) |
| Midtrans 404 loop | FIXED | `isMidtransTransactionMissing` → cancel instead of forever-skip |
| Redis cache | PASS | Upstash hit for settings + stampede lock |
| DB transactions | PASS | `smoke:db-transaction` TX-PROOF PASS |
| Shipping tests | PASS | 46/46 |
| Hourly tests | PASS | 2/2 |
| Type-check | PASS | `tsc --noEmit` clean after test fix |
| Prod health | PASS | `https://www.dapurdekaka.com/api/health` healthy, ~20–98 ms, `sin1` |
| Prod store | PASS | `/products` HTTP 200 on `sin1` |
| Prod runtime errors (7d) | PASS | none |
| Cost changes on prod | **PENDING DEPLOY** | Latest prod commit is Midtrans trust copy — wake fixes not live yet |

## Cost posture (current Neon period)

- `dapurdekaka`: ~180 active hours / ~48.5 CU-hrs ≈ **$5–8 MTD** @ $0.106/CU-hr
- After deploy + ghost-order fix: expect fewer Midtrans calls and more sleep windows between hourly wakes
- `jastip`: separate project with light activity — keep only if still used
- `asd`: endpoints disabled; **delete project in Neon console** when convenient (storage/history hygiene)

## Capability still intact

- Interactive Pool transactions work (checkout/webhook path)
- Hourly job still runs cancel → reconcile → retry-dispatch sequentially
- Catalog/settings/shipping cache layers present without removing live money paths
- Indexes for cancel cron: `idx_orders_status_expires` exists

## Blockers / follow-ups (you)

1. **Deploy** this branch to Vercel production so `/api/cron/hourly` replaces the 3 old crons.
2. Confirm Vercel **Production** `DATABASE_URL` contains `-pooler` (MCP env list was 403; local is correct).
3. Set Neon/Vercel spend alerts at **$15 / $25**.
4. Optionally **delete** Neon project `asd` (endpoints already disabled).
5. Do **not** migrate to Supabase for cost — see `docs/STACK-KEEP-NEON.md`.
