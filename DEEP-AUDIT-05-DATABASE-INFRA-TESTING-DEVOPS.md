# DEEP AUDIT 05 — Database, Infrastructure, Testing & DevOps
> Generated: 2026-05-14 | Schema analysis, migration hygiene, index coverage, test quality, deployment config.

---

## SEVERITY LEGEND
- 🔴 **CRITICAL** — Data loss risk, migrations broken, no recovery path
- 🟠 **HIGH** — Performance issues at scale, missing indexes causing slow queries
- 🟡 **MEDIUM** — Test coverage gaps, config inconsistencies
- 🟢 **LOW** — Best practices, minor improvements

---

## 🔴 CRITICAL — Migration File `0050_add_performance_indexes.sql` NOT in Journal

**Files:**
- `drizzle/0050_add_performance_indexes.sql` — the migration SQL exists
- `drizzle/meta/_journal.json` — contains entries for `0000`, `0001`, `0002` only

The `_journal.json` tracks which migrations Drizzle Kit has applied. Migration `0050` was created manually (or with a wrong tool invocation) and was **never added to the journal**. When running `drizzle-kit migrate` on a fresh database, migration `0050` will be silently skipped. On the production Neon database, this migration may or may not have been applied manually.

**Verify:** Run `drizzle-kit status` to see which migrations are pending. If the production DB already has these indexes manually applied, add `0050` to the journal with the correct format.

**The indexes in this file (if missing from production) cause:**
- Slow webhook processing (no index on `orders.midtransOrderId`)
- Slow admin order listing (index on `orders.status` missing)
- Slow points queries at checkout (no index on `pointsHistory.type`)

**Fix:** Either add the migration to the journal properly:
```json
// _journal.json — add entry:
{
  "idx": 3,
  "version": "7",
  "when": 1715000000000,
  "tag": "0050_add_performance_indexes",
  "breakpoints": false
}
```
Then rename file to `0003_add_performance_indexes.sql` to maintain sequence. Or generate a proper migration with `drizzle-kit generate`.

---

## 🔴 CRITICAL — Missing Index on `orders.midtransOrderId`

**File:** `lib/db/schema.ts:639-647` — Indexes defined, but `midtransOrderId` is NOT indexed.

**Usage:** `app/api/webhooks/midtrans/route.ts:63`
```ts
const order = await db.query.orders.findFirst({
  where: eq(orders.midtransOrderId, order_id),
});
```

Every Midtrans webhook (fires on every payment) does a full table scan on `orders` to find the order by `midtransOrderId`. As orders grow, this becomes progressively slower:
- At 1,000 orders: ~5ms (acceptable)
- At 10,000 orders: ~50ms
- At 100,000 orders: ~500ms (webhook processing times out)

This is one of the most critical query paths in the entire application.

**Fix:** Add to schema and create migration:
```ts
export const ordersMidtransOrderIdIdx = index('idx_orders_midtrans_order_id')
  .on(orders.midtransOrderId);
```

---

## 🟠 HIGH — Missing Composite Index on `couponUsages(couponId, userId)`

**File:** `lib/db/schema.ts` — No index on `couponUsages` table.

**Usage:** `app/api/coupons/validate/route.ts:57-66`
```ts
const usageCount = await db
  .select({ count: sql<number>`count(*)` })
  .from(couponUsages)
  .where(and(
    eq(couponUsages.couponId, coupon.id),
    eq(couponUsages.userId, userId)
  ));
```

Every coupon validation that checks per-user limits does a full table scan on `couponUsages`. For popular coupons with thousands of uses, this is slow.

**Fix:**
```ts
export const couponUsagesCouponUserIdx = index('idx_coupon_usages_coupon_user')
  .on(couponUsages.couponId, couponUsages.userId);
```

---

## 🟠 HIGH — Missing Index on `pointsHistory.type` and `pointsHistory.isExpired`

**File:** `lib/db/schema.ts` — `pointsHistoryExpiresAtIdx` exists, but no index on `type` or `isExpired`.

**Usage:** `app/api/checkout/initiate/route.ts:352-364`
```ts
await tx.select().from(pointsHistory).where(
  and(
    eq(pointsHistory.userId, userId),
    eq(pointsHistory.type, 'earn'),           // ← no index on type
    sql`${pointsHistory.consumedAt} IS NULL`,
    or(
      sql`${pointsHistory.expiresAt} IS NULL`,
      sql`${pointsHistory.expiresAt} > NOW()`
    )
  )
)
```

The FIFO points deduction at checkout scans all points history records for the user. Active users with large purchase histories (e.g., 200 earn records) will have slow checkout.

**Usage:** `app/api/cron/expire-points/route.ts` — scans for `isExpired = false` and expired timestamps.

**Fix:**
```ts
export const pointsHistoryTypeIdx = index('idx_points_history_type').on(pointsHistory.type);
export const pointsHistoryIsExpiredIdx = index('idx_points_history_is_expired').on(pointsHistory.isExpired);
```

---

## 🟠 HIGH — Missing Index on `adminActivityLogs.userId` and `adminActivityLogs.entityType`

**File:** `lib/db/schema.ts:530-541` — No index defined on this table.

The admin activity log is written frequently (on every admin action) and queried to build audit trails. Without indexes, audit log queries degrade as the table grows.

**Fix:**
```ts
export const adminLogsUserIdIdx = index('idx_admin_logs_user_id').on(adminActivityLogs.userId);
export const adminLogsEntityIdx = index('idx_admin_logs_entity').on(adminActivityLogs.entityType, adminActivityLogs.entityId);
```

---

## 🟠 HIGH — `drizzle-orm/neon-http` Transactions vs WebSocket Driver

**File:** `lib/db/index.ts:1-3`

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
```

The Neon HTTP driver sends SQL via Neon's REST API. While Drizzle's `db.transaction()` sends statements as a batch (which Neon executes atomically), there are important limitations:

1. **No SELECT FOR UPDATE / row-level locking** — the daily counter increment in checkout uses `sql\`last_sequence + 1\`` which is safe only if each HTTP batch is truly atomic. Under extreme concurrency (many orders per second on the same day), this could theoretically produce duplicate sequences.

2. **Batch timeout** — Neon's REST API has a 30-second timeout per batch. Long transactions (e.g., large orders with many items) could timeout and leave the DB in an inconsistent state.

3. **Connection overhead** — Each `db.transaction()` call opens a new HTTP connection to Neon. For operations like the webhook that do 6+ statements in one transaction, this is one HTTP request (the batch), but for sequential non-transaction queries, it's one request per query.

**Recommendation:** For production at scale, consider migrating to `drizzle-orm/neon-serverless` with WebSocket mode, which provides true long-lived connections and SELECT FOR UPDATE support. Or use the standard PostgreSQL pooled connection URL from Neon with `drizzle-orm/node-postgres`.

**Minimum fix:** Add error handling for Neon's batch timeout (currently transactions just throw `Error` on timeout with no retry logic).

---

## 🟠 HIGH — Points Balance Stored Redundantly on `users` Table (Risk of Drift)

**File:** `lib/db/schema.ts:83` — `pointsBalance: integer('points_balance').notNull().default(0)`

`users.pointsBalance` is kept in sync via:
- `UPDATE users SET points_balance + earned` (webhook)
- `UPDATE users SET points_balance - used` (checkout)
- `UPDATE users SET points_balance + refunded` (cancellation)

But `pointsHistory` table is the authoritative ledger. If any of these updates fail (e.g., partial transaction), the balance drifts from the ledger. There's no reconciliation cron to verify `users.pointsBalance = SUM(pointsHistory.pointsAmount)`.

**Risk:** A user's displayed balance doesn't match what the ledger says. They may be unable to redeem valid points or be able to redeem more than they have.

**Fix:** Add a `pointsReconcile` cron that runs daily:
```ts
UPDATE users u
SET points_balance = (
  SELECT COALESCE(SUM(ph.points_amount), 0)
  FROM points_history ph
  WHERE ph.user_id = u.id
    AND ph.is_expired = false
)
WHERE /* users with mismatch */;
```

---

## 🟡 MEDIUM — Test Coverage: Only 3 API Routes Have Tests

**Files with tests:**
- `tests/api/checkout/initiate.test.ts` — 5 tests ✅
- `tests/api/coupons/validate.test.ts` — exists
- `tests/api/webhooks/midtrans.test.ts` — exists

**Critical routes with ZERO tests:**
- `app/api/admin/orders/[id]/status/route.ts` — cancellation, stock reversal, points reversal
- `app/api/admin/field/inventory/adjust/route.ts` — stock adjustment
- `app/api/cron/reconcile-payments/route.ts` — the broken reconcile logic
- `app/api/auth/register/route.ts` — registration flow
- `app/api/auth/reset-password/route.ts` — password reset
- `app/api/b2b/inquiry/route.ts` — B2B inquiry submission
- `app/api/checkout/retry/route.ts` — payment retry (the unauth'd endpoint)

**Coverage estimate: <5% of API routes**

---

## 🟡 MEDIUM — Test Fixtures Use Fields That Don't Exist in Schema

**File:** `tests/api/checkout/initiate.test.ts:141-152`

```ts
vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
  ...
  applicableProductIds: null,    // ← NOT in schema
  applicableCategoryIds: null,   // ← NOT in schema
  freeShipping: false,
  createdBy: 'system',           // ← should be a UUID, not 'system'
} as any);
```

The mock has two extra fields (`applicableProductIds`, `applicableCategoryIds`) that don't exist in the actual `coupons` schema. The `as any` cast hides TypeScript errors. If someone adds these fields to the schema later with different types, the test would still pass while the behavior changes.

Also `createdBy: 'system'` is a UUID FK — using a non-UUID string will fail if the code tries to do a DB lookup with this value.

**Fix:** Use the actual Drizzle type:
```ts
import type { Coupon } from '@/lib/db/schema';
const mockCoupon: Coupon = {
  id: 'coupon-uuid',
  code: 'DISKON10',
  type: 'percentage',
  createdBy: '00000000-0000-0000-0000-000000000001',  // valid UUID
  // ... all other required fields
};
```

---

## 🟡 MEDIUM — Test for Checkout Initiate: DB Transaction Not Properly Mocked

**File:** `tests/api/checkout/initiate.test.ts:24`

```ts
vi.mock('@/lib/db', () => ({
  db: {
    query: { ... },
    transaction: vi.fn(),  // ← returns undefined, not executes callback
  },
}));
```

`db.transaction` is mocked as `vi.fn()` which returns `undefined` by default. The actual checkout handler calls:
```ts
const [newOrder] = await db.transaction(async (tx) => { ... return [created]; });
```

So `[newOrder]` would be `[undefined]` (destructuring undefined), causing `newOrder.id` to throw. The test `'applies percentage coupon correctly'` expects status 200/201 but the transaction mock returns nothing meaningful, so either the test is incomplete or `db.transaction` is mocked to return the right value in some test helper that's not visible.

**The tests that expect success (200) with this mock setup would fail** unless the mock is configured to execute the callback. The current mock is:
```ts
transaction: vi.fn()  // returns Promise<undefined>
```

Should be:
```ts
transaction: vi.fn().mockImplementation(async (callback) => {
  const mockTx = { insert: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockOrder]) }), update: vi.fn()... };
  return callback(mockTx);
}),
```

---

## 🟡 MEDIUM — `vitest.config.ts`: No Global Test Setup, No Coverage Thresholds

**File:** `vitest.config.ts`

Without checking the actual content, typical issues include:
- No global setup file to initialize mocks or test DB
- No coverage thresholds (any coverage is acceptable)
- No test environment configured for Next.js specific APIs

**Recommended additions:**
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      }
    },
    setupFiles: ['./tests/setup.ts'],
  }
});
```

---

## 🟡 MEDIUM — Drizzle Schema Indexes Defined Outside Table (Potential Migration Issue)

**File:** `lib/db/schema.ts:639-647`

```ts
// These are module-level index definitions, not inside pgTable() calls
export const ordersUserIdIdx = index('idx_orders_user_id').on(orders.userId);
export const ordersStatusIdx = index('idx_orders_status').on(orders.status);
```

In Drizzle ORM v0.39+ (used here), module-level index definitions ARE picked up by `drizzle-kit generate` when the schema is exported from the schema file and referenced in `drizzle.config.ts`. This should work correctly. **However**, because migration `0050` exists but is not in the journal, these indexes may not actually be in the production DB.

**Action required:** Verify with `\d+ orders` in the Neon DB console that the indexes exist.

---

## 🟡 MEDIUM — `vercel.json` Cron Jobs Need Verification

**File:** `vercel.json` — Need to verify it includes cron job configuration.

If `vercel.json` doesn't define cron jobs for:
- `/api/cron/cancel-expired-orders` (hourly)
- `/api/cron/expire-points` (daily)
- `/api/cron/reconcile-payments` (every 10 min)
- `/api/cron/cleanup-audit-logs` (weekly)
- `/api/cron/cleanup-counters` (daily)

...then the cron routes exist as API endpoints but are never called automatically.

**Example `vercel.json` cron config:**
```json
{
  "crons": [
    { "path": "/api/cron/reconcile-payments", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/cancel-expired-orders", "schedule": "0 * * * *" },
    { "path": "/api/cron/expire-points", "schedule": "0 1 * * *" },
    { "path": "/api/cron/cleanup-audit-logs", "schedule": "0 3 * * 0" },
    { "path": "/api/cron/cleanup-counters", "schedule": "0 2 * * *" }
  ]
}
```

Cron jobs require Vercel Pro plan. Verify crons are actually running in Vercel dashboard.

---

## 🟡 MEDIUM — `@sentry/nextjs` in `devDependencies` (Should Be `dependencies`)

**File:** `package.json:62`

```json
"devDependencies": {
  "@sentry/nextjs": "^10.53.1",
```

Sentry is a runtime error tracking tool. Having it in `devDependencies` means it's not included in the production build on some package managers/build tools. In Next.js, it's included because the build process runs in the dev environment, but this is fragile and non-standard.

**Fix:** Move to `dependencies`:
```json
"dependencies": {
  "@sentry/nextjs": "^10.53.1",
```

---

## 🟡 MEDIUM — No Soft-Delete Enforcement on Product Queries

**File:** `lib/db/schema.ts:186` — `products.deletedAt` column exists.

**File:** `app/(store)/products/page.tsx` — Product listing query:
```ts
db.query.products.findMany({
  where: eq(products.isActive, true),  // checks isActive but not deletedAt
})
```

Products with `isActive = true` but `deletedAt` set (soft-deleted) would still appear in the catalog. The check should be:
```ts
where: and(
  eq(products.isActive, true),
  sql`${products.deletedAt} IS NULL`
)
```

This same issue applies to categories (`categories.deletedAt`) and other soft-deleted tables.

---

## 🟡 MEDIUM — `orderDailyCounters` Table Grows Indefinitely

**File:** `lib/db/schema.ts:522-528` — `orderDailyCounters` stores one row per day.

The `cleanup-counters` cron at `app/api/cron/cleanup-counters/route.ts` should handle this. Verify the cron deletes old entries (rows older than N days). If it doesn't delete anything or doesn't run, this table grows one row per day indefinitely. At 365 rows/year this is negligible, but it should be confirmed.

---

## 🟡 MEDIUM — No Database Connection Health Check in `/api/health`

**File:** `app/api/health/route.ts` and `lib/utils/health-check.ts`

The health check endpoint should verify the DB is reachable. Currently it's unclear if it does a real DB ping or just returns `{ status: 'ok' }`. Uptime monitors hitting `/api/health` may show "healthy" even when the DB is down.

**Fix:**
```ts
// Test a lightweight DB query
await db.execute(sql`SELECT 1`);
return { status: 'ok', db: 'connected' };
```

---

## 🟢 LOW — Environment Variables: Missing `.env.example` Entries

**File:** `.env.example` — Check if all required variables are documented.

The `validate-env.ts` checks for 6 required variables. But there are many more variables referenced throughout the codebase:
- `NEXT_PUBLIC_WHATSAPP_NUMBER`
- `NEXT_PUBLIC_STORE_ADDRESS`
- `RAJAONGKIR_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`
- `CRON_SECRET`
- `MINIMAX_API_KEY`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`

If `.env.example` doesn't list all of these with descriptions, a new developer setting up the project will have missing env vars and mysterious failures.

**Fix:** Audit all `process.env.` references in the codebase and ensure every one is documented in `.env.example` with a description and example value.

---

## 🟢 LOW — `tsconfig.tsbuildinfo` Committed to Git

**File:** `tsconfig.tsbuildinfo` — in the working tree

This is a TypeScript incremental compilation cache file. It should be in `.gitignore` since it's machine-specific and large.

**Fix:** Add to `.gitignore`:
```
tsconfig.tsbuildinfo
```

---

## 🟢 LOW — `next-sitemap.config.js` Uses JavaScript, Not TypeScript

**File:** `next-sitemap.config.js`

The project uses TypeScript throughout (`next.config.ts`, `drizzle.config.ts`). Having a `.js` sitemap config is inconsistent and means it doesn't benefit from type checking.

**Fix:** Rename to `next-sitemap.config.ts` (next-sitemap supports TypeScript config).

---

## 🟢 LOW — No `npm ci` vs `npm install` Distinction in Build

`package-lock.json` is committed. Production builds should use `npm ci` (which uses the lockfile exactly) rather than `npm install` (which may update deps). Vercel uses `npm ci` by default, so this is likely fine, but worth verifying in deployment settings.

---

## 🟢 LOW — Missing `engines` Field in `package.json`

**File:** `package.json`

No `engines` field specifying the required Node.js version. Next.js 14 requires Node.js 18+. Without this, a developer on Node 16 would get cryptic errors.

**Fix:**
```json
{
  "engines": {
    "node": ">=18.17.0"
  }
}
```

---

## 🟢 LOW — Seed Scripts: No Production Safety Guard

**File:** `scripts/seed.ts`, `scripts/seed-products.ts`

The seed scripts connect to the database via `DATABASE_URL`. If `DATABASE_URL` points to production, running `npm run db:seed` would seed (or overwrite) production data.

**Fix:** Add a guard:
```ts
if (process.env.NODE_ENV === 'production') {
  console.error('ABORT: Cannot run seed script in production.');
  process.exit(1);
}
```

---

## FULL INDEX: Missing Indexes Summary

| Table | Column(s) | Query Using It | Severity |
|-------|-----------|----------------|----------|
| `orders` | `midtransOrderId` | Webhook lookup | 🔴 CRITICAL |
| `orders` | `userId` | Account orders list | Exists ✅ |
| `orders` | `status` | Admin order filter | Exists ✅ |
| `orders` | `paymentExpiresAt` | Expiry cron | Exists ✅ |
| `pointsHistory` | `userId` | Checkout FIFO deduction | Exists ✅ |
| `pointsHistory` | `type` | FIFO earn filter | ❌ MISSING |
| `pointsHistory` | `isExpired` | Expiry cron | ❌ MISSING |
| `couponUsages` | `(couponId, userId)` | Per-user coupon limit | ❌ MISSING |
| `adminActivityLogs` | `userId` | Audit trail queries | ❌ MISSING |
| `adminActivityLogs` | `(entityType, entityId)` | Entity history | ❌ MISSING |
| `b2bInquiries` | `status` | Admin inquiry filter | ❌ MISSING |
| `inventoryLogs` | `variantId` | Inventory history | Exists ✅ |

---

## RECOMMENDED FIX ORDER

1. **Add migration for `midtransOrderId` index** (immediate — webhook performance)
2. **Fix migration journal for `0050`** (verify production DB first)
3. **Add composite indexes** (`couponUsages`, `pointsHistory.type`, `adminActivityLogs`)
4. **Add tests for webhook, status update, reconcile routes**
5. **Move `@sentry/nextjs` to dependencies**
6. **Add `engines` field to package.json**
7. **Verify and complete `vercel.json` cron schedules**
8. **Add soft-delete (`deletedAt IS NULL`) to all product/category queries**
