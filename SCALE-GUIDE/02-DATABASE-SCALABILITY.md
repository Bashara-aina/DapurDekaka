# 02 — Database Scalability (Neon + Drizzle)

> **Scope:** How the data layer behaves under load, where it will fall over, and
> exactly what to change. This is the layer most likely to be your bottleneck
> because **the app is 100% dynamic** (doc 03) — every request hits Postgres.

**Facts on the ground:**
- ORM: **Drizzle** (`drizzle-orm ^0.39`), schema in `lib/db/schema.ts`
  (**894 lines, ~67 exported tables/relations, 46 `index(...)` definitions**).
- Driver: `drizzle-orm/neon-http` over `@neondatabase/serverless` — **HTTP/fetch**,
  not TCP pooled (`lib/db/index.ts`).
- Singleton `db` per module instance (fine for serverless).

---

## 1. The HTTP driver: understand its trade-off

`neon-http` sends **one HTTPS request per SQL statement**. Consequences:

| Property | Effect | Under high traffic |
|----------|--------|--------------------|
| No persistent socket | Great cold-start, no pool exhaustion from idle sockets | ✅ scales wide |
| 1 round-trip per query | Latency = network RTT × number of queries in a request | ❌ N+1 is brutal |
| No interactive multi-statement transactions | `db.transaction()` maps to a single batched HTTP request, **not** a long-lived BEGIN/COMMIT you can branch inside | ⚠️ correctness risk for checkout/stock |
| Per-invocation | Hundreds of concurrent fns each open many HTTP calls | ❌ can hit Neon's pooled connection ceiling |

**Rule of thumb:** with the HTTP driver, *the number of queries per request is your
latency budget.* A checkout that fires 12 sequential queries at 40 ms each = ~500 ms
of pure DB round-trips before any compute.

### Actions
1. **Batch reads.** Replace loops-of-queries with single queries using
   `inArray()`, joins, or `WITH` CTEs. Audit every `for (...) await db...` — those are
   N+1 landmines (the loyalty/reconcile audits already flagged several).
2. **Use `db.batch([...])`** (Neon HTTP supports batched statements in one round trip)
   for independent writes/reads that must go together.
3. **For true atomicity** (stock decrement, points, order+items), prefer:
   - A **single SQL statement** that does the work atomically
     (`UPDATE ... WHERE stock >= qty RETURNING`), *or*
   - Move the critical checkout transaction to the **`pg`/WebSocket pooled driver**
     (`drizzle-orm/neon-serverless` with a `Pool`) which supports real interactive
     transactions. You already depend on `pg ^8.20`. Use HTTP for reads, pooled for
     the checkout write path.

---

## 2. Concurrency correctness (money-critical)

The audits repeatedly flag **stock and points races**: absolute overwrites, TOCTOU,
double-deduction, negative balances. Under high traffic these go from "rare" to
"every flash sale." Non-negotiable patterns:

### Stock
```sql
-- Atomic decrement that cannot oversell:
UPDATE product_variants
SET stock = stock - $qty
WHERE id = $id AND stock >= $qty
RETURNING stock;
-- 0 rows affected  ⇒  out of stock, reject the line.
```
Never `SELECT stock` → compare in JS → `UPDATE stock = value`. That is the oversell bug.

### Points / wallet
- Guard with `WHERE balance >= amount` and `RETURNING`, or use `SELECT ... FOR UPDATE`
  inside a real transaction (pooled driver).
- The known **"orderId null at checkout"** and **"B2B 4× points"** bugs (memory index)
  are correctness issues that *also* create reconcile load — fix at the source.

### Order numbers / sequences
- `lib/utils/generate-order-number.ts` must use a DB sequence or an atomic
  `INSERT ... RETURNING` counter, never `SELECT max()+1` (collides under concurrency).
- `cleanup-counters` cron implies a counters table — ensure increments are atomic
  (`UPDATE ... SET n = n + 1 RETURNING n`).

### Idempotency
- Guest checkout has **no idempotency** (double-click = 2 orders). Add a unique
  constraint on an idempotency key (client-generated UUID) or a Redis SETNX lock.
  This matters more under load, not less.

---

## 3. Indexing (46 indexes today — verify they match the queries)

46 `index()` calls is a healthy start, but *count ≠ coverage*. Do this audit:

1. **Enable `pg_stat_statements`** on Neon and capture the top 25 queries by total
   time after a day of realistic traffic.
2. For each, run `EXPLAIN (ANALYZE, BUFFERS)` and confirm **no seq scans on hot
   tables** (orders, order_items, product_variants, points_ledger, audit_logs).
3. Ensure composite indexes match query **shape and order**, e.g.:
   - `orders (status, created_at)` — for admin queues & cron scans.
   - `orders (user_id, created_at desc)` — account order history.
   - `points_ledger (user_id, expires_at)` — expiry crons + balance.
   - `order_items (order_id)` — the classic N+1 join.
   - Partial index for cron scans: `orders (status) WHERE status = 'pending_payment'`.
4. **Foreign keys should be indexed** — Postgres does *not* auto-index the child side.
5. Add indexes to support the **cron `WHERE` clauses** (see §4) so scheduled scans
   don't table-scan while customers are checking out.

> Deliverable: a short `db-index-report.md` from `pg_stat_statements` before launch.

---

## 4. Cron query load (the hidden multiplier)

9 crons (doc 05 §4), several every 10–15 min: `reconcile-payments` (*/10),
`cancel-expired-orders` (*/15), `retry-dispatch` (*/30). Audit findings say some do
**N+1 loops** and **full scans**. Under load this is worst-case timing — the reconcile
runs *while* checkout traffic peaks.

Actions:
- Make every cron query **indexed + bounded**: `WHERE status = ? AND created_at < ?
  LIMIT 500`, process in pages, never "load all then loop."
- Replace per-row updates with **set-based updates** (one `UPDATE ... WHERE id IN (...)`).
- Add a **`LIMIT` + cursor** so a backlog can't produce a 10-minute cron that overlaps
  the next run.
- Ensure crons are **idempotent and re-entrant** (overlapping invocations must be safe).

---

## 5. Schema hygiene for scale

- **Audit logs & counters grow unbounded** — you already have `cleanup-audit-logs`
  (weekly) and `cleanup-counters` (daily). Confirm they actually delete in batches and
  that `audit_logs` has an index on `created_at` so the delete is cheap. Consider
  **table partitioning by month** for `audit_logs` / `order_status_history` if volume
  grows (drop old partitions instead of `DELETE`).
- **Avoid `SELECT *`** on wide tables in hot paths — fetch only needed columns
  (Drizzle: pass explicit column objects). Less data = less network per HTTP round trip.
- **`text`/`jsonb` blobs** (product descriptions, snapshots) should not be pulled into
  list endpoints. Keep list queries lean; hydrate detail on demand.

---

## 6. Connection & pool ceiling plan

Even HTTP requests terminate at Neon's pooled endpoint. During a spike:

1. Use the **pooled `DATABASE_URL`** (PgBouncer) for the app.
2. Keep **`DATABASE_URL_UNPOOLED`** strictly for `drizzle-kit` migrations and any
   session-level operations (advisory locks, `SET`), which PgBouncer transaction mode
   doesn't support.
3. Cap query fan-out per request (§1) so N concurrent requests don't each open M
   connections.
4. If you adopt the pooled `pg` driver for checkout, set a **small `max`** per
   instance (e.g. 1–3) — serverless multiplies instances, so per-instance pools must be
   tiny to avoid `too many connections`.

---

## 7. Migrations under load

- `drizzle-kit push` (in `scripts/push-schema.mjs`, `db:push`) is convenient but
  **not safe for production** — it can drop/alter without review. For prod use
  `db:generate` → review SQL → `db:migrate`.
- **Never run a blocking migration during peak.** Adding an index? Use
  `CREATE INDEX CONCURRENTLY`. Adding a NOT NULL column? Add nullable → backfill →
  set NOT NULL, in steps.
- Keep a **migration freeze** window around campaigns.

---

## 8. Database go/no-go checklist

- [ ] Neon co-located in Singapore, autoscaling ceiling raised, scale-to-zero off
- [ ] App uses pooled `DATABASE_URL`; migrations use unpooled
- [ ] Checkout write path is atomic (single-statement or pooled interactive txn)
- [ ] Stock decrement uses `WHERE stock >= qty RETURNING` (no oversell)
- [ ] Guest checkout idempotency key enforced (unique constraint / Redis lock)
- [ ] `pg_stat_statements` reviewed; no seq scans on hot tables; FKs indexed
- [ ] Every cron query indexed, `LIMIT`-bounded, set-based, idempotent
- [ ] `audit_logs`/counters cleanup verified batched; consider partitioning
- [ ] Prod migrations via `generate`+`migrate`, `CREATE INDEX CONCURRENTLY`, freeze at peak

**Related:** why every request hits the DB → `03`; cron scheduling & webhook
idempotency → `05`.
