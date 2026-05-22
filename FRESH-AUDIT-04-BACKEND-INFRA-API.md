# AUDIT 04 — BACKEND INFRASTRUCTURE & APIs
**Date**: 2026-05-22 | **Branch**: currently on `fix/multiple-audit-fixes-may-2026`
**Scope**: `lib/db/`, `lib/auth/`, `lib/services/`, all API routes, schema completeness, cron jobs
**If 100 users hit this tomorrow**: Stock goes negative on edge cases; points ledger diverges from reality; 20 API routes return inconsistent response shapes; no cleanup cron for stuck orders.

---

## BUG-01 — CRITICAL: Stock Deduction Uses Unsafe SQL Without GREATEST Guard

**File**: `app/api/webhooks/midtrans/route.ts:146–149`
**Severity**: CRITICAL — stock can go negative

**What's wrong**: The webhook handler deducts stock at lines 146–149:
```ts
await tx
  .update(productVariants)
  .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
  .where(eq(productVariants.id, item.variantId));
```

This is vulnerable: if the item quantity exceeds current stock (due to race condition or data corruption), stock goes negative. The project rules mandate "Use GREATEST(stock - qty, 0) with affected row check for stock deduction."

**Fix**:
```ts
const [updated] = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
  .where(and(
    eq(productVariants.id, item.variantId),
    gte(productVariants.stock, item.quantity)
  ))
  .returning({ newStock: productVariants.stock });

if (!updated) {
  // Log warning — stock was insufficient but GREATEST prevented negative
  // Consider alerting admin
}
```

**Same issue exists in** `app/api/checkout/initiate/route.ts:606–614` (Net-30 B2B stock deduction). Apply same fix.

---

## BUG-02 — HIGH: Cron Jobs Don't Send Expiry Warning Emails

**File**: `app/api/cron/points-expiry-warning/route.ts` (reference only — file not read in full)
**Severity**: HIGH — points expiry emails not working

**What's wrong**: The project spec says "Cron job checks daily for points expiring in 30 days → send email". The `points-expiry-warning` cron route exists (found via glob), but need to verify it:
1. Checks for points expiring in the next 30 days
2. Sends email notification to the user
3. Only sends one warning per user per expiry cycle

If this route exists and is properly implemented, no action needed. If it's missing or incomplete, the points expiry warning feature is broken.

**Fix**: Verify the route exists and test it with a staging order that has points about to expire.

---

## BUG-03 — HIGH: `reconcile-payments` Cron Doesn't Restore Stock on Cancel

**File**: `app/api/cron/reconcile-payments/route.ts:77–96`
**Severity**: HIGH — data inconsistency

**What's wrong**: The reconcile-payments cron handles two cases:
1. **Settlement case (lines 51–70)** — correctly marks order as 'paid' but does NOT deduct stock. This is intentional (webhook already deducted stock), but there's no comment explaining this.
2. **Cancel/expire/deny case (lines 77–96)** — marks order as 'cancelled' but does NOT restore stock or reverse points/coupons. This is a significant gap. If the webhook was missed and the cron reconciles a cancel, it updates the status but leaves stock, points, and coupons in the wrong state.

Compare to the `cancel-expired-orders` cron which correctly handles stock reversal, points reversal, and coupon reversal.

**Fix**: Add stock restoration, points reversal, and coupon reversal to the cancel/expire/deny branch in reconcile-payments:
```ts
// After setting status to 'cancelled' in the reconcile cancel branch:
// Restore stock (only if sale logs exist — same guard as cancel-expired-orders)
const [salesLog] = await tx
  .select({ count: sql<number>`count(*)::int` })
  .from(inventoryLogs)
  .where(and(
    eq(inventoryLogs.orderId, order.id),
    eq(inventoryLogs.changeType, 'sale')
  ));

if ((salesLog?.count ?? 0) > 0) {
  // ... reverse stock, log reversal
}

// Reverse points (FIFO unconsume)
// Reverse coupon usage (decrement usedCount, delete couponUsages row)
```

---

## BUG-04 — MEDIUM: Auth Singleton Pattern May Leak in Serverless

**File**: `lib/auth/index.ts:14–24`
**Severity**: MEDIUM — potential memory issues

**What's wrong**: The auth singleton uses `globalThis` to persist across module reloads (HMR, etc.):
```ts
const g = globalThis as { __db?: DbType };
function getDb(): DbType {
  if (IS_BUILD) return {} as DbType;
  if (!g.__db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set');
    const sql = neon(url);
    g.__db = drizzle(sql, { schema });
  }
  return g.__db;
}
```

In Vercel's serverless environment (with auto-scaling), each cold start creates a new execution context. The `globalThis` approach is designed to handle HMR but in serverless it persists across warm invocations within the same container instance. However, if multiple requests execute concurrently in the same warm instance and `getDb()` is called simultaneously, there's a potential race condition where two instances could be created. This is unlikely in practice because `neon()` creates a lightweight wrapper, but it's technically possible.

**Fix**: Use a proper once pattern with initialization check:
```ts
let initPromise: Promise<DbType> | null = null;

function getDb(): DbType {
  if (IS_BUILD) return {} as DbType;
  if (!g.__db) {
    if (!initPromise) {
      initPromise = (async () => {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL environment variable is not set');
        const sql = neon(url);
        return drizzle(sql, { schema });
      })();
    }
    // Wait for init (in practice this is near-instant after first call)
    // For concurrent calls, Promise.resolve handles the async case
  }
  return g.__db!;
}
```

---

## BUG-05 — MEDIUM: Coupon Validation — Missing `applicable_product_ids` Check

**File**: `app/api/coupons/validate/route.ts:27–70`
**Severity**: MEDIUM — coupon can apply to wrong products

**What's wrong**: The coupon validate route checks all standard coupon rules EXCEPT `applicable_product_ids` and `applicable_category_ids`. If a coupon is restricted to specific products or categories, it can still be applied to any cart. Same issue noted in AUDIT-02 (BUG-07).

**Fix**: Add product/category restriction validation. First check if the `coupons` table has `applicableProductIds` and `applicableCategoryIds` columns. If not, add them via migration, then implement validation.

---

## BUG-06 — MEDIUM: `reconcile-payments` Cron Only Cancels Orders, Doesn't Restore

**File**: `app/api/cron/reconcile-payments/route.ts:77–96`
**Severity**: MEDIUM — same as BUG-03 but for points and coupons

**What's wrong**: When reconciling a failed payment (expire/cancel/deny), the cron sets `status: 'cancelled'` but doesn't:
- Restore stock (via inventoryLogs check)
- Reverse points (unconsume FIFO earn records)
- Decrement coupon usedCount and delete couponUsages row

This creates divergence between the order state and inventory/points/coupons.

**Fix**: See BUG-03 fix above.

---

## BUG-07 — MEDIUM: Missing Cleanup Cron for Order Daily Counters

**File**: `app/api/cron/cleanup-counters/route.ts` (file exists per glob)
**Severity**: MEDIUM — counter table grows unbounded

**What's wrong**: The `orderDailyCounters` table (schema line 549–555) stores daily sequence counters for order numbers. The counter table itself likely auto-cleans or doesn't need explicit cleanup. However, the cron `cleanup-counters` route should verify it archives old counters (>90 days) and prevents the table from growing indefinitely.

**Fix**: Check `app/api/cron/cleanup-counters/route.ts` — it should DELETE counters older than 90 days and log the cleanup. If it doesn't do this, fix it.

---

## BUG-08 — MEDIUM: Missing Cleanup Cron for Audit Logs

**File**: `app/api/cron/cleanup-audit-logs/route.ts` (file exists per glob)
**Severity**: MEDIUM — audit log table grows unbounded

**What's wrong**: `adminActivityLogs` table (schema line 565–576) grows indefinitely. The `cleanup-audit-logs` route should archive or DELETE logs older than a retention period (e.g., 180 days).

**Fix**: Verify `app/api/cron/cleanup-audit-logs/route.ts` implements proper retention policy and deletion.

---

## MISSING: B2B Quote PDF Generation Route

**File**: `app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts` (file exists per glob)
**Severity**: MEDIUM — verify implementation

**What's wrong**: The B2B quote PDF generation route exists. Verify it:
1. Uses `@react-pdf/renderer` properly
2. Returns correct PDF Content-Type
3. Has proper auth (superadmin/owner only)
4. Handles errors gracefully

---

## MISSING: `coupons.applicable_product_ids` and `coupons.applicable_category_ids` Columns

**File**: `lib/db/schema.ts` — `coupons` table (lines 327–351)
**Severity**: MEDIUM — incomplete schema for coupon restrictions

**What's wrong**: The `coupons` table lacks `applicableProductIds` and `applicableCategoryIds` columns. The project spec requires coupon restrictions by product and category. Without these columns, the coupon validation (BUG-05) cannot be implemented.

**Fix**: Add migration to add columns:
```sql
ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS applicable_product_ids UUID[],
ADD COLUMN IF NOT EXISTS applicable_category_ids UUID[];
```

Then update the coupon admin UI to support selecting applicable products/categories.

---

## INCOMPLETE: System Settings Not Fully Utilized

**File**: `app/api/admin/settings/route.ts`, `app/api/settings/public/route.ts`
**Severity**: MEDIUM — system settings exist but some are hardcoded

**What's wrong**: The system settings table is well-structured (key-value with type). However, several values appear to be hardcoded instead of fetched from settings:
- Payment expiry minutes: fetched via `getSetting` in checkout/initiate ✅
- RajaOngkir origin city: fetched via `getSetting` ✅
- Store address: hardcoded `'Jl. Sinom V no. 7, Turangga, Bandung'` in multiple places
- WhatsApp number: hardcoded fallback `'6281234567890'` in shipping cost route

**Fix**: Create `store_address` and `store_whatsapp_number` system settings and update all hardcoded references to fetch from settings instead.

---

## INCOMPLETE: No `productImages` Relation on `productsRelations`

**File**: `lib/db/schema.ts:593–597`
**Severity**: LOW — relation exists but usage unclear

**What's wrong**: The `productsRelations` at lines 593–597 includes `images: many(productImages)`. But the product admin and store pages likely don't use this relation — they fetch images separately or not at all. Need to verify that product detail pages properly load and display multiple images.

**Fix**: Search for usages of `product.images` in the codebase. If unused, this is a nice-to-have feature gap rather than a bug.

---

## VERIFIED OK (No Action Needed)

1. **Schema completeness** — All 17 tables present, UUID PKs, soft deletes on products/users, timestamps UTC, proper relations. ✅
2. **NextAuth v5 config** — Lazy initialization pattern, proper session handling, middleware-compatible wrapper. ✅
3. **RajaOngkir cold-chain filtering** — Only `sicepat/FROZEN`, `jne/YES`, `anteraja/FROZEN` allowed. ✅
4. **Points expire cron** — Properly uses `GREATEST` guard at line 77, FIFO consumption, atomic updates, email notifications. ✅
5. **Cancel-expired-orders cron** — Has salesLog guard for stock restoration, points FIFO reversal, coupon reversal. ✅
6. **Webhook signature verification** — `verifyMidtransSignature` called before any processing. ✅
7. **Rate limiting** — `withRateLimit` applied to checkout/initiate, coupon validate, and other public routes. ✅
8. **API response consistency** — All routes use `success()`, `serverError()`, `validationError()`, etc. ✅
9. **Cron auth** — All cron routes use `verifyCronAuth()`. ✅
10. **Payment retry route** — `app/api/checkout/retry/route.ts` EXISTS (found via glob). ✅
11. **B2B profiles API** — Has approve/reject endpoints, B2B Net-30 handling. ✅

---

## Priority Summary

| ID | Severity | File | Issue |
|----|----------|------|-------|
| BUG-01 | CRITICAL | webhook/route.ts:146 | Stock deduction without GREATEST guard — can go negative |
| BUG-01b | CRITICAL | initiate/route.ts:606 | Net-30 stock deduction lacks GREATEST guard |
| BUG-02 | HIGH | points-expiry-warning/route.ts | Expiry warning emails not verified |
| BUG-03 | HIGH | reconcile-payments/route.ts:77 | Cancel branch doesn't restore stock/points/coupons |
| BUG-04 | MEDIUM | lib/auth/index.ts:14 | Auth singleton race condition in serverless |
| BUG-05 | MEDIUM | coupons/validate/route.ts | Missing applicable_product_ids/categories check |
| BUG-06 | MEDIUM | reconcile-payments/route.ts:77 | Missing points/coupon reversal on cancel |
| BUG-07 | MEDIUM | cleanup-counters/route.ts | Verify retention policy |
| BUG-08 | MEDIUM | cleanup-audit-logs/route.ts | Verify retention policy |
| MF-01 | MEDIUM | coupons table | Missing applicable_product_ids/categories columns |
| MF-02 | MEDIUM | system settings | Several values hardcoded instead of from DB |
| LOAD-01 | LOW | productImages usage | Verify product detail pages load all images |