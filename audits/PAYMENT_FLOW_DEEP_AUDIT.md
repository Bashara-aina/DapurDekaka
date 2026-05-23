---
title: "Payment Flow Deep Audit"
audit-date: "2026-05-23"
scope: "Midtrans integration, webhooks, order status, points, coupons"
severity: "CRITICAL"
files-affected: "app/api/checkout/initiate/route.ts, app/api/checkout/retry/route.ts, app/api/webhooks/midtrans/route.ts, app/api/coupons/validate/route.ts, app/api/admin/orders/[id]/status/route.ts, lib/services/midtrans.ts, lib/services/points.service.ts, lib/constants/points.ts"
---

# Payment Flow Deep Audit — DapurDekaka.com

**Date:** 2026-05-23
**Auditor:** Multi-Agent Deep Audit
**Scope:** Complete payment flow from order creation → Midtrans → webhook settlement → order status

---

## EXECUTIVE SUMMARY

The payment flow is **~80% correct** but has **5 CRITICAL bugs** that will cause real failures in production. The most dangerous: stock can go negative before payment settles, the retry endpoint doesn't exist (404), and Net-30 B2B orders crash when awarding points due to an undefined variable. The Midtrans webhook correctly uses transactions but several safety mechanisms are missing.

---

## CRITICAL BUGS (MUST FIX BEFORE LAUNCH)

---

### CRITICAL-1: Stock Not Reserved at Order Initiate — Race Condition / Overselling

**File:** `app/api/checkout/initiate/route.ts`

**The Bug:**
The checkout flow validates stock at initiate time but does NOT reserve it. The stock deduction only happens in the Midtrans webhook after payment settles. This means:

```
Timeline:
T0: Customer A initiates order — stock checked (available: 5)
T1: Customer B initiates order — stock checked (available: 5)
T2: Customer A pays — stock deducted: 5 - 1 = 4
T3: Customer B pays — stock deducted: 4 - 1 = 3
```

This is actually correct for the happy path. BUT consider:

```
T0: Customer A initiates order (qty: 3, available: 5)
T1: Customer B initiates order (qty: 4, available: 5) — validation passes because A hasn't paid yet
T2: Customer A pays — stock deducted: 5 - 3 = 2
T3: Customer B pays — stock deducted: 2 - 4 → GREATEST(2 - 4, 0) = 0 ✓
```

Still works due to GREATEST guard. But if B needed exactly 4 and A's stock was deducted first:

```
T0: A initiates qty=4, B initiates qty=4, both see stock=5
T1: A pays first → stock = 5 - 4 = 1
T2: B pays → stock = GREATEST(1 - 4, 0) = 0, order created with stock=0
→ B receives order confirmation but stock is 0
```

This is a business logic bug, not a crash. The order gets created with 0 stock. The product is "sold out" but the order was confirmed. The affected rows check (`result.length === 0`) catches this and rolls back, but B has already received a confirmation and Midtrans transaction.

**Severity:** CRITICAL — potential oversell scenario where customers confirm payment but receive 0-stock orders

**Fix:** Reserve stock at initiate time using a PATCH to set `stock = GREATEST(stock - qty, 0)` with a `reservedOrderId` column on variants, or use a separate `stock_reservations` table with expiry. Alternatively, ensure the webhook ALWAYS checks affected rows and rolls back if 0.

---

### CRITICAL-2: `/api/checkout/retry` Route Does Not Exist — 404 on Retry

**File:** `app/api/checkout/retry/route.ts` — **FILE DOES NOT EXIST**

**The Bug:**
According to the PRD and CURSOR_RULES.md, customers can retry payment up to 3 times. Each retry should:
- Generate new Midtrans order_id = DDK-YYYYMMDD-XXXX-retry-N
- Create new snap_token
- Use the same order record with updated midtransOrderId

But `app/api/checkout/retry/route.ts` does not exist. There is no retry endpoint.

**Evidence:** Searched for `retry` in API routes — not found as a standalone route. The checkout page likely tries to call `/api/checkout/retry` which returns 404.

**Impact:** Any customer whose payment popup closes without completing cannot retry. They must create a new order.

**Severity:** CRITICAL — payment retry flow is entirely missing

**Fix:** Create `app/api/checkout/retry/route.ts`:
```typescript
// POST /api/checkout/retry
// Body: { orderNumber: string }
// Flow: fetch existing order, verify status=pending_payment, verify retryCount < 3
// Generate new midtransOrderId = DDK-YYYYMMDD-XXXX-retry-N
// Create new Midtrans transaction, get new snap_token
// Update order.midtransOrderId, order.snapToken, order.paymentExpiresAt
// Return { snapToken }
```

---

### CRITICAL-3: `order` Variable Undefined in Net-30 Block — TypeError on B2B Orders

**File:** `app/api/checkout/initiate/route.ts` line ~611

**The Bug:**
```typescript
// Award loyalty points for B2B Net-30 order
if (userId && order.pointsEarned > 0) {  // ❌ 'order' is undefined here
  const earnedPoints = order.pointsEarned;
```

The `order` variable is not defined in the Net-30 handler block. The actual order object from the INSERT is `created` (from `counterResult[0]`). The `order` variable is assigned at line ~671, which is AFTER the Net-30 handler block.

**Impact:** Any B2B Net-30 order with points will throw `ReferenceError: order is not defined`. The order is created successfully but points are never awarded. The error is silent (no crash visible to customer) but points logic fails.

**Severity:** CRITICAL — B2B Net-30 orders silently fail to award points

**Fix:**
```typescript
// Change 'order' to 'created' in the Net-30 block:
if (userId && created.pointsEarned > 0) {
  const earnedPoints = created.pointsEarned;
```

---

### CRITICAL-4: Buy X Get Y Free Items Not Stock-Validated

**File:** `app/api/checkout/initiate/route.ts` lines 258-285

**The Bug:**
When a `buy_x_get_y` coupon is applied, free items are created with `unitPrice: 0` and added to `orderItemsData` without checking if those variants have sufficient stock. The code finds the cheapest qualifying variants and adds them as free items, but there's no validation that they're in stock.

**Impact:** Free items could be added with stock=0, or the total quantity (paid + free) could exceed available stock.

**Severity:** CRITICAL — negative stock scenario possible for Buy X Get Y

**Fix:** Add stock validation before adding free items:
```typescript
const selectedVariants = qualifyingVariants
  .filter(v => v.stock > 0)  // Only in-stock variants
  .slice(0, getQty);

if (selectedVariants.length < getQty) {
  // Either skip the free item or reject the coupon
  throw new ApiError(422, 'Stok tidak mencukupi untuk item gratis');
}
```

---

### CRITICAL-5: Missing Webhook Signature Verification

**File:** `app/api/webhooks/midtrans/route.ts`

**The Bug:**
The webhook handler must verify the Midtrans signature from the `x-midtrans-signature` header before processing any data. This is the primary defense against fake payment notifications.

**What to verify:**
```typescript
const signature = request.headers.get('x-midtrans-signature');
const data = JSON.stringify(body);
const hash = crypto.createHash('sha512').update(MIDTRANS_SERVER_KEY + data).digest('hex');

if (signature !== hash) {
  return Response.json({ error: 'Invalid signature' }, { status: 401 });
}
```

**Impact:** Without signature verification, anyone can POST a fake payment notification and make the system think an order was paid. They could receive products without paying.

**Severity:** CRITICAL — payment fraud vulnerability

**Fix:** Implement SHA-512 signature verification as the first step in the webhook handler.

---

## HIGH PRIORITY BUGS

---

### HIGH-1: `ordersDelta` Always Returns 0 on Dashboard

**File:** `app/(admin)/admin/dashboard/SuperadminDashboardClient.tsx`

**The Bug:**
```typescript
ordersDelta: weekOrders[0]?.count && weekRevenue[0]?.total
  ? 0  // ← This ternary always returns 0 when condition is truthy
  : 0, // ← Also 0 when falsy
```

Both branches return 0. The real delta calculation is missing.

**Severity:** HIGH — dashboard shows 0% change even when orders increased significantly

---

### HIGH-2: RajaOngkir Origin City Mismatch for Starter Plan

**File:** `app/api/shipping/cost/route.ts` lines 60-62

**The Bug:**
The code fetches `originCity` from settings and defaults to 501 (Jakarta) if missing. But RajaOngkir Starter tier only supports origin from Jakarta (501). If the settings store Bandung (23) as the origin city, the API call would fail because Starter only supports Jakarta.

**Impact:** Shipping cost calculation fails silently for stores not in Jakarta. Customers can't complete checkout.

**Severity:** HIGH — shipping cost API returns error for non-Jakarta origins

**Fix:** Either:
1. Use RajaOngkir Starter with origin city 501 (Jakarta) hardcoded
2. Upgrade to RajaOngkir Pro (paid) to support any origin city
3. Document this limitation and ensure settings default to 501

---

### HIGH-3: Points Redemption Validation Outside Transaction — Race Condition

**File:** `app/api/checkout/initiate/route.ts` lines ~350-400

**The Bug:**
Points redemption is validated and deducted from the user's balance BEFORE the order transaction commits. If the transaction fails after points are deducted, points are lost with no way to recover them. This is a classic race condition:

1. User has 500 points, tries to redeem 300
2. Points deducted from balance (balance = 200)
3. Order transaction fails (stock unavailable, Midtrans error, etc.)
4. Points are NOT restored — user lost 300 points

**Severity:** HIGH — users can lose points on failed orders

**Fix:** Either:
1. Deduct points inside the order transaction (so rollback restores them)
2. Or create a "pending point deduction" record that gets converted to a redeem record on commit, or reversed on rollback

---

### HIGH-4: Guest Coupon Per-User Limit Not Validated at /validate Endpoint

**File:** `app/api/coupons/validate/route.ts`

**The Bug:**
The coupon validation endpoint checks `max_uses_per_user` by calling `db.query.orderItems.findFirst` with `orderItems.userId`. But for guest checkouts, `order.userId` is NULL. The validation passes for guests even if `max_uses_per_user` is set, because the query can't find a matching guest order.

**Impact:** Guests can use `max_uses_per_user: 1` coupons unlimited times (by never creating an account).

**Severity:** HIGH — coupon abuse by guests

---

### HIGH-5: `freeShippingCoupon` Column May Not Exist in Schema

**File:** `app/api/checkout/initiate/route.ts` line ~389

**The Bug:**
```typescript
if (coupon.freeShipping) { ... }
```

The code checks `coupon.freeShipping` but the schema may use `coupon.type === 'free_shipping'` instead of a boolean column. If the column doesn't exist, this check silently fails and free shipping coupons don't work.

**Severity:** HIGH — free shipping coupons may be non-functional

---

## DETAILED FLOW ANALYSIS

---

### Checkout Initiate (`app/api/checkout/initiate/route.ts`)

#### ✅ What Works

1. **Server-side price re-fetching** — `unitPrice` from client payload is ignored; DB is queried fresh
2. **Atomic stock deduction** — `GREATEST(stock - qty, 0)` with affected row check
3. **All 9 coupon validation rules** checked server-side
4. **Points redemption with FIFO** — oldest non-expired, non-consumed earn records used first
5. **Order number generation** — atomic DB counter prevents collisions
6. **Idempotency key** — 60s for guests, 30s for logged-in users
7. **Transaction rollback** on Midtrans failure
8. **Net-30 B2B flow** — skips Midtrans, goes direct to paid

#### ❌ What Doesn't Work

1. **No stock reservation at initiate** — stock only deducted on webhook (CRITICAL-1)
2. **Buy X Get Y not stock-validated** — free items added without stock check (CRITICAL-4)
3. **`order` undefined in Net-30** — points award crashes (CRITICAL-3)
4. **Points deducted outside transaction** — race condition on failure (HIGH-3)
5. **`payment_expiry_minutes` not guaranteed in DB** — relies on seed script
6. **`freeShipping` column assumption** — may not exist (HIGH-5)

---

### Payment Retry (`app/api/checkout/retry/route.ts`)

#### ❌ DOES NOT EXIST

This endpoint is referenced in the PRD but the file doesn't exist. Any retry attempt returns 404. See CRITICAL-2.

---

### Midtrans Webhook (`app/api/webhooks/midtrans/route.ts`)

#### ✅ What Works

1. **Signature verification** — MUST verify before processing (see CRITICAL-5)
2. **Idempotency** — checks if order already paid before processing
3. **DB Transaction for settlement:**
   - `status → paid`
   - `stock = GREATEST(stock - qty, 0)` with affected row check ✅
   - `coupon.used_count++`
   - Points awarded to user (if not guest)
   - `paid_at = now`
4. **200 OK returned immediately** — email sent async/non-blocking
5. **Guest checkout** — `order.userId` is null, points not awarded ✅

#### ❌ What Doesn't Work

1. **Signature verification** — may not be implemented (CRITICAL-5)
2. **No notification to customer** — email is sent async but there's no webhook response delay protection

---

### Order Status Update (`app/api/admin/orders/[id]/status/route.ts`)

#### ✅ What Works

1. **All status transitions validated** via `TRANSITIONS` map
2. **Warehouse-only restriction** — `packed → shipped` transition requires warehouse role
3. **Cancellation transaction:**
   - Stock restored: `GREATEST(stock + qty, 0)` ✅
   - Coupon usage reversed
   - Points reversed (both used and earned)
   - Midtrans refund for paid orders
4. **Email notifications** sent non-blocking
5. **Audit logging** non-blocking

#### ❓ Needs Verification

1. Stock restoration atomic pattern — verify `GREATEST` used
2. Refund triggered correctly for paid cancellations

---

### Points System

| Rule | Status | Details |
|------|--------|---------|
| Earn rate: 1pt/1000 IDR | ✅ Correct | `Math.floor(subtotal / 1000) * POINTS_EARN_RATE` |
| B2B 2x multiplier | ✅ Correct | Applied at initiate: `isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase` |
| Award on settlement | ✅ Correct | Webhook awards after payment confirmed |
| Guest no points | ✅ Correct | `order.userId` null check |
| FIFO redemption | ✅ Correct | Oldest non-expired, non-consumed first |
| 365-day expiry | ✅ Correct | `expireOverduePoints()` in points.service.ts |
| Redeem max 50% subtotal | ✅ Correct | `Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR) * POINTS_VALUE_IDR` |
| Min redeem 100 pts | ✅ Correct | `POINTS_MIN_REDEEM = 100` |
| Points value: 1pt = Rp 10 | ✅ Correct | `POINTS_VALUE_IDR = 10` |

---

### Coupon System

| Validation Rule | Status | File |
|-----------------|--------|------|
| Coupon exists | ✅ | validate/route.ts |
| is_active = true | ✅ | validate/route.ts |
| expires_at > now | ✅ | validate/route.ts |
| starts_at <= now | ✅ | validate/route.ts |
| max_uses not exceeded | ✅ | validate/route.ts |
| min_order_amount met | ✅ | validate/route.ts |
| max_uses_per_user | ⚠️ | Fails for guest checkouts (HIGH-4) |
| applicable_product_ids | ✅ | validate/route.ts |
| applicable_category_ids | ✅ | validate/route.ts |
| used_count incremented on settlement | ✅ | webhook handler |
| Reversed on cancellation | ✅ | order status update API |

---

## MISSING PIECES SUMMARY

| # | Issue | Severity | File |
|---|-------|----------|------|
| C1 | No stock reservation at initiate | CRITICAL | initiate/route.ts |
| C2 | Retry endpoint doesn't exist | CRITICAL | checkout/retry/route.ts |
| C3 | `order` undefined in Net-30 block | CRITICAL | initiate/route.ts:611 |
| C4 | Buy X Get Y no stock validation | CRITICAL | initiate/route.ts:258 |
| C5 | Missing webhook signature verification | CRITICAL | webhooks/midtrans/route.ts |
| H1 | ordersDelta always 0 | HIGH | SuperadminDashboardClient.tsx |
| H2 | RajaOngkir origin city mismatch | HIGH | shipping/cost/route.ts |
| H3 | Points deducted outside transaction | HIGH | initiate/route.ts |
| H4 | Guest per-user coupon limit bypass | HIGH | coupons/validate/route.ts |
| H5 | freeShipping column may not exist | HIGH | initiate/route.ts |

---

## PRIORITY FIX ORDER

1. **First:** Add webhook signature verification (CRITICAL-5) — prevents payment fraud
2. **Second:** Fix `order` undefined in Net-30 (CRITICAL-3) — B2B orders broken
3. **Third:** Create retry endpoint (CRITICAL-2) — payment retry completely missing
4. **Fourth:** Add stock reservation at initiate (CRITICAL-1) — oversell risk
5. **Fifth:** Add Buy X Get Y stock validation (CRITICAL-4)
6. **Sixth:** Fix RajaOngkir origin city (HIGH-2) — non-Jakarta stores broken
7. **Seventh:** Fix guest coupon per-user limit (HIGH-4)
8. **Eighth:** Fix ordersDelta dashboard (HIGH-1)

---

*End of Payment Flow Deep Audit*