# AUDIT 03 — CHECKOUT & PAYMENT FLOW
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** `app/api/checkout/`, `app/api/webhooks/midtrans/`, `app/api/coupons/validate/`, `lib/midtrans/`, `lib/services/shipping.service.ts`, `lib/services/payment.service.ts`
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## 🔴 CRITICAL

### C-01: RajaOngkir Starter Tier Cannot Ship from Bandung — All Shipping Queries Fail in Production

**Files:**
- `lib/services/shipping.service.ts` lines 9–11
- `app/api/shipping/cost/route.ts` line 45

```typescript
// lib/services/shipping.service.ts:9-11
// NOTE: RajaOngkir Starter tier only supports Jakarta (origin_id: 501) as origin.
// If shipping from Bandung, you need RajaOngkir Pro account.
// Current ORIGIN_CITY_ID = 23 (Bandung) will return error on Starter tier.
const ORIGIN_CITY_ID = '23'; // ← This is WRONG for Starter tier
```

**Issue:** The system settings store `rajaongkir_origin_city_id = "23"` (Bandung), but the RajaOngkir **Starter** tier API only supports `origin_id: 501` (Jakarta). Every shipping cost query sent to RajaOngkir will fail or return an error. No courier options will ever be returned at checkout. **All customers in production will see zero shipping options.**

**Fix Options:**
- **Option A (preferred):** Upgrade to RajaOngkir Pro account which supports arbitrary origin cities including Bandung. Set `RAJAONGKIR_API_KEY` to Pro credentials. Remove or update the comment in `shipping.service.ts`.
- **Option B (fallback):** Change `ORIGIN_CITY_ID` to `'501'` (Jakarta) in system settings. Accept that shipping costs will be calculated from Jakarta (not Bandung), resulting in wrong pricing for Bandung customers. This is a business decision.

**Action:** Determine which option, implement it, remove the misleading comment.

---

### C-02: Settlement Webhook Stock Deduction — Missing Affected Row Null Check

**File:** `app/api/webhooks/midtrans/route.ts` lines 128–145

```typescript
const [updated] = await tx
 .update(productVariants)
 .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
 .where(and(
 eq(productVariants.id, item.variantId),
 gte(productVariants.stock, item.quantity)
 ))
 .returning({ newStock: productVariants.stock });

if (!updated) {
 logger.error('Stock deduction failed', { variantId: item.variantId });
} // ← logs but CONTINUES to award points and update status
```

**Issue:** The `returning()` clause always emits a row even when `GREATEST(stock - qty, 0)` evaluated to 0 (no actual change). The `if (!updated)` check only catches when no rows matched at all — not when stock was insufficient. The webhook continues to award loyalty points and update order status even when stock was insufficient. The comment "This shouldn't happen" is incorrect — under 100 concurrent users, race conditions are guaranteed to happen.

**Also:** The `if (!updated)` log-then-continue pattern (lines 137–145) awards points even when stock deduction "failed". This means a customer could receive loyalty points for an order that didn't actually deduct stock.

**Expected fix:** After the update, check if the returned `newStock` value is consistent. If stock was 0 and order quantity was 5, `newStock` would be 0 (correct for `GREATEST`). But if the race condition caused a different issue, the transaction should be aborted. Add:

```typescript
const [updated] = await tx
 .update(productVariants)
 .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
 .where(and(
 eq(productVariants.id, item.variantId),
 gte(productVariants.stock, item.quantity)
 ))
 .returning({ newStock: productVariants.stock });

if (!updated || updated.newStock === undefined) {
 throw new Error(`Insufficient stock for variant ${item.variantId}`);
}
```

**Action:** Add the null/abort check after the stock deduction, throw to rollback transaction.

---

### C-03: Coupon `used_count` Double-Increment on Duplicate Midtrans Webhook

**File:** `app/api/webhooks/midtrans/route.ts` lines 158–163

```typescript
if (order.couponId) {
 await tx
 .update(coupons)
 .set({ usedCount: sql`used_count + 1` })
 .where(eq(coupons.id, order.couponId));
}
```

**Issue:** No check that `couponUsages` already has a record for this order before incrementing `used_count`. The `ON CONFLICT DO NOTHING` at line 216 prevents duplicate insert into `couponUsages`, but `used_count` is incremented regardless. If Midtrans fires the same webhook twice within a short window, `used_count` increments twice. A coupon with `maxUses: 1` would show as expired after the second legitimate webhook when it should still be valid.

**Expected fix:** Before incrementing, verify no usage record exists for this order:

```typescript
const existingUsage = await tx
 .select()
 .from(couponUsages)
 .where(and(
 eq(couponUsages.couponId, order.couponId),
 eq(couponUsages.orderId, order.id)
 ));
if (existingUsage.length === 0 && order.couponId) {
 await tx
 .update(coupons)
 .set({ usedCount: sql`used_count + 1` })
 .where(eq(coupons.id, order.couponId));
}
```

**Action:** Add the pre-check before incrementing `used_count`.

---

### C-04: No Payment Expiry Auto-Cancel Cron Job Confirmed

**File:** No `app/api/cron/cancel-expired-orders/route.ts` found in codebase

**Issue:** Orders left in `pending_payment` state after 15 minutes are never auto-cancelled. Stock that may have been "reserved" at initiate time (if stock reservation happens at initiate — needs verification) is never released. Orders accumulate indefinitely in `pending_payment`. This creates inventory discrepancies and a poor UX where expired payment sessions sit in the order list.

**Expected fix:** Create `app/api/cron/cancel-expired-orders/route.ts`:
1. Query all orders where `status = 'pending_payment' AND payment_expires_at < NOW()`
2. For each expired order: update status to `'cancelled'`, restore stock (using `GREATEST(stock + qty, 0)`), reverse coupon usage, reverse points redemption, send cancellation email

**Action:** Create the cron job and verify it's configured in Vercel Cron (`vercel.json` or dashboard).

---

### C-05: Midtrans Callback URLs Use `/pesanan/` Path — Non-Existent Routes

**File:** `lib/midtrans/create-transaction.ts` lines 48–52

```typescript
callbacks: {
 finish: `${appUrl}/pesanan/${orderNumber}?payment=finish`,
 unfinish: `${appUrl}/pesanan/${orderNumber}?payment=unfinish`,
 error: `${appUrl}/pesanan/${orderNumber}?payment=error`,
}
```

**Issue:** PRD specifies `/orders/[orderNumber]` as the public order tracking URL. The Midtrans Snap popup redirect URLs use `/pesanan/` which does not appear to exist in the folder structure. After payment, customers are redirected to a non-existent page. The intended URLs should be `/checkout/success`, `/checkout/pending`, `/checkout/failed` respectively.

**Action:** Change callback URLs to point to the correct `/checkout/success/[orderNumber]`, `/checkout/pending/[orderNumber]`, and `/checkout/failed` paths.

---

## 🟠 HIGH

### H-01: Concurrent Requests Can Bypass 30-Second Idempotency Check

**File:** `app/api/checkout/initiate/route.ts` lines 350–368

```typescript
// Check idempotency for logged-in users
const existingOrder = await db.query.orders.findFirst({
 where: and(
 eq(orders.userId, userId),
 eq(orders.status, 'pending_payment'),
 sql`${subtotal} = orders.subtotal`,
 sql`EXTRACT(EPOCH FROM (NOW() - orders.createdAt)) < 30`
 ),
});
if (existingOrder) return success(existingOrder);
```

**Issue:** This check is read-before-write in a non-transactional sequence. Two concurrent requests from the same user within 30 seconds with the same subtotal both pass the `findFirst` check (neither sees the other's in-flight order), then both attempt to insert. The first succeeds, the second fails on the `orderNumber` unique constraint — returning a 500 instead of returning the first order's snap token. Under 100 concurrent users, this is unlikely but possible for the same user rapid-clicking "Checkout".

**Fix:** Wrap the idempotency check inside the same transaction that creates the order, or use a database advisory lock.

---

### H-02: Guest Email Case Mismatch Bypasses Coupon Per-User Limit

**File:** `app/api/checkout/initiate/route.ts` lines 411–422

```typescript
eq(orders.recipientEmail, recipientEmail.toLowerCase())
```

**Issue:** The email is lowercased at lookup time, but the original stored email may not have been normalized. A guest could use `SITI@Example.COM` at checkout and later `siti@example.com` — the coupon per-user limit would miss the first usage.

**Action:** Normalize email to lowercase when storing in `orders` and when comparing.

---

### H-03: Net-30 B2B Orders — Stock Deduction Missing `GREATEST` Guard

**File:** `app/api/checkout/initiate/route.ts` lines 613–615

```typescript
await tx
 .update(productVariants)
 .set({ stock: sql`stock - ${item.quantity}` })
 .where(eq(productVariants.id, item.variantId))
 .returning({ newStock: productVariants.stock });
```

**Issue:** Raw `stock - quantity` without `GREATEST`. If concurrent B2B Net-30 orders or a bug causes stock to go negative here, it will. The regular checkout path uses `GREATEST(stock - qty, 0)` but this B2B path doesn't.

**Fix:** Change to `sql`GREATEST(stock - ${item.quantity}, 0)``.

---

### H-04: Points Redemption — FIFO Reversal Fragile with Concurrent Redemptions

**File:** `app/api/checkout/retry/route.ts` lines 99–119

**Issue:** Points reversal in retry cancellation sets `consumedAt: null` on referenced earn records. If a subsequent order already consumed part of the same earn records (FIFO), reversing one order breaks the FIFO chain. With 100 real users, FIFO consumption chains become complex. This is a fundamental design limitation that needs stress testing.

**Action:** Document this limitation. Add a comment that FIFO reversal must be tested with concurrent orders. Consider adding a "reversalBatchId" to track which cancellation triggered which reversal.

---

### H-05: No `payment_expires_at` Enforcement in Checkout UI

**File:** `app/(store)/checkout/pending/page.tsx` lines 96–98

**Issue:** The countdown timer is displayed but there is no client-side auto-trigger for retry or cancellation when time expires. Users must manually click "Bayar Lagi" after expiry. This is a UX gap — the page should auto-navigate or prompt when the timer hits 0.

**Action:** Add a `useEffect` with `setInterval` that checks `expiryDate` and triggers `router.push('/checkout/retry?orderId=...')` when time is below 0.

---

### H-06: Settlement — Points Awarded Even When Stock Deduction Fails

**File:** `app/api/webhooks/midtrans/route.ts` lines 137–145

**Issue:** Per C-02, when stock deduction "fails" (insufficient stock), the code logs but continues to award loyalty points and update order status to `paid`. The customer pays for an order that may have incomplete stock deduction.

**Fix:** The transaction must abort if stock deduction fails. No points awarded, no status update to `paid`.

---

## 🟡 MEDIUM

### M-01: `lib/services/payment.service.ts` — Empty File, Logic Scattered

**File:** `lib/services/payment.service.ts`

The file only has `MidtransClient` initialization. Actual payment logic is in `lib/midtrans/create-transaction.ts`. This file is a kitchen-sink that should either be deleted or properly contain the payment service abstraction.

**Action:** Either delete the file or consolidate payment service logic here.

---

### M-02: `orderDailyCounters` Cleanup Cron Needs Verification

**File:** `lib/db/schema.ts` lines 586–592 + `app/api/cron/cleanup-counters/route.ts` (referenced in audit files)

**Issue:** The cleanup cron for `order_daily_counters` is referenced but needs verification that it's configured in Vercel Cron dashboard. If the cron doesn't run, the table grows 1 row per day indefinitely.

**Action:** Verify `vercel.json` includes the cron schedule for cleanup-counters, or configure it.

---

### M-03: Shipping Cost — 3 DB Calls Per Request in `getSetting`

**File:** `app/api/shipping/cost/route.ts` lines 29–33

```typescript
const [paymentExpiry, rajaongkirOrigin, whatsapp] = await Promise.all([
 getSetting('payment_expiry_minutes'),
 getSetting('rajaongkir_origin_city_id'),
 getSetting('store_whatsapp_number'),
]);
```

**Issue:** `getSetting` is called 3 times per request with no caching. Each call hits the DB. With 100 concurrent users, this is 300 extra DB queries. The `get-settings.ts` function should use an in-memory cache with a short TTL (e.g., 60 seconds).

**Action:** Add an in-memory cache with TTL to `getSetting` or batch the settings fetch into a single query.

---

### M-04: Payment Type Not Easily Queryable for Reporting

**File:** `app/api/webhooks/midtrans/route.ts` line 118

**Issue:** `midtransPaymentType` is saved but there's no admin UI to view/filter by payment type. This field could be valuable for reporting (credit card vs e-wallet breakdown).

**Action:** Consider adding payment type to the orders admin list view or as a filter option.

---

### M-05: Pickup Invitation Route May Not Exist

**File:** `app/api/checkout/pickup-invitation/route.ts` (referenced but not verified)

**Issue:** The pickup invitation email is sent at settlement but there may not be a dedicated `/api/checkout/pickup-invitation` route to generate the pickup page URL.

**Action:** Verify this route exists and is functional.

---

## 🟢 LOW

### L-01: Dead Code — `require('crypto')` Inline in payment.service.ts

**File:** `lib/services/payment.service.ts:65`

### L-02: Order Sequence Gaps from Cancelled Orders

**File:** `app/api/checkout/initiate/route.ts` lines 442–459

Cancelled orders don't reclaim sequence numbers. With 500-1000 orders/month, sequence gaps are acceptable but documented as known behavior.

### L-03: Midtrans Order ID Not Updated After Retry

**File:** `app/api/checkout/retry/route.ts` line 172

The retry route correctly updates `orders.midtransOrderId` inside the transaction (confirmed working), but the stored `orderNumber` field is reused, making order lookups by `midtransOrderId` slightly confusing.

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | `shipping.service.ts:9` | RajaOngkir Starter can't use Bandung origin=23 | Upgrade to Pro or use origin=501 |
| C-02 | 🔴 CRITICAL | `webhooks/midtrans/route.ts:128` | Stock deduction missing affected row check + continues on fail | Add null check + throw to rollback |
| C-03 | 🔴 CRITICAL | `webhooks/midtrans/route.ts:158` | `used_count` can double-increment on duplicate webhook | Add pre-check for existing couponUsage |
| C-04 | 🔴 CRITICAL | No cron file | No payment expiry auto-cancel cron | Create `cancel-expired-orders` cron |
| C-05 | 🔴 CRITICAL | `create-transaction.ts:48` | Midtrans callbacks use `/pesanan/` non-existent path | Fix to `/checkout/success/pending/failed` |
| H-01 | 🟠 HIGH | `checkout/initiate/route.ts:350` | Concurrent idempotency race condition | Wrap in transaction or use advisory lock |
| H-02 | 🟠 HIGH | `checkout/initiate/route.ts:411` | Guest email case mismatch bypasses coupon per-user limit | Normalize email to lowercase |
| H-03 | 🟠 HIGH | `checkout/initiate/route.ts:613` | Net-30 stock deduction missing GREATEST guard | Add `GREATEST(stock - qty, 0)` |
| H-04 | 🟠 HIGH | `checkout/retry/route.ts:99` | FIFO reversal fragile with concurrent redemptions | Add stress testing + comment |
| H-05 | 🟠 HIGH | `checkout/pending/page.tsx:96` | No auto-retry on payment expiry | Add useEffect countdown → router.push |
| H-06 | 🟠 HIGH | `webhooks/midtrans/route.ts:137` | Points awarded even when stock deduction fails | Abort transaction on stock failure |
| M-01 | 🟡 MEDIUM | `payment.service.ts` | Empty file, logic scattered | Consolidate or delete |
| M-02 | 🟡 MEDIUM | `cleanup-counters/route.ts` | Cron needs Vercel verification | Check vercel.json config |
| M-03 | 🟡 MEDIUM | `shipping/cost/route.ts:29` | 3 DB calls per request, no cache | Add TTL cache to getSetting |
| M-04 | 🟡 MEDIUM | Schema + webhook | Payment type not in admin reporting UI | Add as filter in orders admin |
| M-05 | 🟡 MEDIUM | `pickup-invitation/route.ts` | Route may not exist | Verify and implement if missing |
| L-01 | 🟢 LOW | `payment.service.ts:65` | `require('crypto')` inline | Use top-level import |
| L-02 | 🟢 LOW | `checkout/initiate/route.ts:442` | Sequence gaps from cancelled orders | Document as known behavior |
| L-03 | 🟢 LOW | `checkout/retry/route.ts:172` | midtransOrderId confusion after retry | Document in comments |

**Total: 5 CRITICAL · 6 HIGH · 5 MEDIUM · 3 LOW**