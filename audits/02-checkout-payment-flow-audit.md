# AUDIT 02 — Checkout & Payment Flow

**Project:** DapurDekaka.com
**Date:** May 24, 2026
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW

---

## EXECUTIVE SUMMARY

The checkout and payment flow is **largely complete and well-engineered**. The core transactional integrity is strong — atomic stock deduction, Midtrans Snap integration, webhook signature verification, idempotency, and FIFO points are all correctly implemented. Critical issues: two coupon validation rules missing (product/category restrictions), shipping cost endpoint returns non-standard response format, and one file exceeds the 300-line limit. Also: `validate-coupon` has no rate limiting allowing coupon enumeration.

---

## COMPLETE FLOW TRACE

```
Cart → Identity → Delivery Method → Address → Shipping Rates → Coupon → Points → Review → Initiate → Midtrans Snap → Webhook → Success
```

---

## 2.1 INITIATE PAYMENT (`app/api/checkout/initiate/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

**Verification Checklist:**

| # | Check | Status |
|---|-------|--------|
| 1 | Prices re-fetched from DB (never trust client) | ✅ Line 95-157 |
| 2 | B2B role uses `b2bPrice` field | ✅ Line 131-133 |
| 3 | Stock re-checked per variant | ✅ Line 124 |
| 4 | Coupon validated server-side (all 9 rules) | ✅ Lines 360-420 |
| 5 | Points discount capped at 50% server-side | ✅ Line 305 |
| 6 | Order created with `status: 'pending_payment'` | ✅ Line 514 |
| 7 | order_items created with SNAPSHOT of product data | ✅ Line 576-580 |
| 8 | Midtrans transaction created | ✅ Line 737-748 |
| 9 | snap_token saved to order | ✅ Line 761-767 |
| 10 | Transaction wraps order + counter + points deduction | ✅ Lines 417-663 |
| 11 | couponUsages provisional row for maxUsesPerUser | ✅ Lines 653-660 |
| 12 | Midtrans failure → full rollback | ✅ Lines 748-758 |
| 13 | Idempotency: guest dedup 60s, logged-in 30s | ✅ Lines 311-351 |
| 14 | Net-30 B2B skips Midtrans, marks paid, deducts stock | ✅ Lines 500-517 |
| 15 | inventoryLogs written for stock deduction | ✅ Lines 615-622 |
| 16 | Status history written post-transaction | ✅ Lines 674-683 |
| 17 | Rate limiting applied (10 req/min) | ✅ Line 780 |
| 18 | Error handling: logger.error + serverError | ✅ Lines 775-778 |

**NO ISSUES FOUND.**

---

## 2.2 VALIDATE COUPON (`app/api/checkout/validate-coupon/route.ts`)

| Status | 🟠 INCOMPLETE |
|--------|--------------|
| Severity | **HIGH** |

**CRITICAL: Missing Coupon Validation Rules**

All 9 rules must pass. Here's the audit:

| Rule | Description | Status | Location |
|------|-------------|--------|----------|
| 1 | Coupon exists in DB | ✅ | Line checked |
| 2 | `is_active = true` | ✅ | Line checked |
| 3 | `expires_at IS NULL OR > now` | ✅ | Line checked |
| 4 | `starts_at IS NULL OR <= now` | ✅ | Line checked |
| 5 | `max_uses IS NULL OR used_count < max_uses` | ✅ | Line checked |
| 6 | `subtotal >= min_order_amount` | ✅ | Line checked |
| 7 | `max_uses_per_user` check (userId + email) | ✅ | Lines 62-68 |
| 8 | **`applicable_product_ids` check** | ❌ **MISSING** | — |
| 9 | **`applicable_category_ids` check** | ❌ **MISSING** | — |

**Note:** The public `/api/coupons/validate` route (Section 2.9) DOES implement rules 8 and 9 correctly. The store's `validate-coupon` route is the one missing these checks.

**Why this matters:** A coupon restricted to "Dimsum Crabstick" only could be applied to an order containing only "Lumpia" — the checkout/initiate route has its own server-side validation (which IS complete), so orders are safe, but the client-facing validation gives wrong feedback to users.

**Fix:** Copy the implementation from `app/api/coupons/validate/route.ts` (lines 99-127) which already does this correctly.

**ALSO MISSING:**
- No `withRateLimit` wrapper — coupon codes can be enumerated/brute-forced at high speed. This is a **HIGH** severity gap.

---

## 2.3 MIDTRANS WEBHOOK (`app/api/webhooks/midtrans/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

**Verification Checklist:**

| # | Check | Status |
|---|-------|--------|
| 1 | SHA-512 signature verified FIRST | ✅ Lines 33-49 |
| 2 | order_id format validated by DB lookup | ✅ Lines 66-74 |
| 3 | transaction_status checked (settlement/capture/deny/cancel/expire) | ✅ Lines 114-185 |
| 4 | Idempotency via transaction_id uniqueness + status check | ✅ Lines 76-113 |
| 5 | Amount cross-check: webhook gross !== expected → 400 | ✅ Lines 118-128 |
| 6 | Transaction: order update + stock + coupon + points | ✅ Lines 130-243 |
| 7 | Stock deducted atomically: `GREATEST(stock - qty, 0)` with `gte` guard | ✅ Lines 147-154 |
| 8 | `returning({ newStock })` checked — 0 rows → throws/rollback | ✅ Lines 156-160 |
| 9 | inventoryLogs written for each item | ✅ Lines 163-170 |
| 10 | couponUsages upserted with `onConflictDoNothing` | ✅ Lines 232-242 |
| 11 | Points awarded via sql increment + history record | ✅ Lines 191-212 |
| 12 | Email sent async (`.catch()` — non-blocking) | ✅ Lines 248-302 |
| 13 | Cancellation: stock restore + coupon reversal + points FIFO unconsume | ✅ Lines 304-415 |
| 14 | Cancellation email sent async with `.catch()` | ✅ Lines 390-414 |
| 15 | Rate limiting applied (30 req/min) | ✅ Line 28, 422 |

**NO ISSUES FOUND.**

---

## 2.4 PAYMENT RETRY (`app/api/checkout/retry/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | **MEDIUM** (documented, not broken) |

| # | Check | Status |
|---|-------|--------|
| 1 | Zod validates orderNumber with correct regex | ✅ Line 16 |
| 2 | Auth + role check (superadmin/owner or order owner) | ✅ Lines 41-46 |
| 3 | Only `pending_payment` status can retry | ✅ Lines 48-50 |
| 4 | Max 3 retries enforced server-side | ✅ Line 53 |
| 5 | Auto-cancellation within transaction: stock restore + coupon + points | ✅ Lines 55-143 |
| 6 | New Midtrans transaction with `retryCount` in orderId | ✅ Lines 175-203 |
| 7 | Order updated with new snapToken + increment paymentRetryCount | ✅ Lines 191-203 |
| 8 | logger.error (not console.error) | ✅ Line 219 |

**Documented Race Condition (not fixed, not critical):**
Lines 103-120 contain a detailed comment acknowledging a FIFO race condition under high concurrency with low points balances. This is a known edge case — not a production blocker today.

---

## 2.5 SHIPPING COST (`app/api/shipping/cost/route.ts`)

| Status | 🟡 INCOMPLETE |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Non-Standard Response Format:**

| Line | Current Return | Should Be |
|------|----------------|-----------|
| 66-70 | `NextResponse.json({ services: [], message, whatsappUrl })` | `success({ services: [], message, whatsappUrl })` |
| 115-119 | `NextResponse.json({ services: [], message, whatsappUrl })` | `success({ services: [], message, whatsappUrl })` |

Error/empty-state responses (lines 66-70, 115-119) return non-wrapped format. This breaks the project standard `{ success: true/false, data/error }`.

**Also noted:**
- No authentication — acceptable for a shipping calculator, rate limiting provides some protection.

---

## 2.6 MIDTRANS SERVICE LAYER

### `lib/midtrans/create-transaction.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | LOW |

- `getMidtransOrderId()` retry-safe (append `-retry-N` for subsequent attempts)
- Expiry hardcoded to 15 minutes — should use `getSetting('payment_expiry_minutes')` instead
- `appUrl` validated from env before constructing callback URLs

### `lib/midtrans/client.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Server key from `MIDTRANS_SERVER_KEY` (never `NEXT_PUBLIC`)
- Client key from `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` (safe for browser)
- `isProduction` flag from env

### `lib/midtrans/status.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- `checkTransactionStatus()` uses Core API with 15s timeout
- `refundTransaction()` wraps Midtrans refund with error handling
- Both return typed responses

### `lib/midtrans/verify-webhook.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- `verifyMidtransSignature()` — SHA512 for Core API (different from Snap webhook handler — both correct for their respective contexts)

---

## 2.7 SHIPPING SERVICE (`lib/services/shipping.service.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Only cold-chain couriers used: `sicepat/FROZEN`, `jne/YES`, `anteraja/FROZEN`
- Origin defaults to Bandung (`23`) from env or constant
- Weight floored at 1000g minimum
- Error handling per courier (one failing doesn't break others)

---

## 2.8 CHECKOUT STORE PAGE (`app/(store)/checkout/page.tsx`)

| Status | 🟡 INCOMPLETE |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — File Exceeds 300-Line Limit:**
- File is **845 lines** — 2.8x over the project rule.
- Must be split into smaller components:
  - `PaymentStep.tsx` — Midtrans Snap handling
  - `ReviewCollapsible.tsx` — Order summary
  - `PickupInfoPanel.tsx` — Self-pickup flow
  - `CheckoutAddressStep.tsx` — Address step
  - `CheckoutCouponStep.tsx` — Coupon + points step

---

## 2.9 PUBLIC COUPON VALIDATE (`app/api/coupons/validate/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

**All 9 rules implemented correctly:**

| Rule | Status |
|------|--------|
| 1-7 | ✅ All present |
| 8: `applicableProductIds` check | ✅ Lines 99-110 |
| 9: `applicableCategoryIds` check | ✅ Lines 113-127 |
| Guest checkout blocked for maxUsesPerUser | ✅ Lines 62-68 |
| BuyXgetY calculation | ✅ Present |

This is the correct implementation that `app/api/checkout/validate-coupon/route.ts` should mirror.

---

## 2.10 ORDER SUCCESS PAGE (`app/(store)/orders/success/[orderNumber]/page.tsx`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Shows order details, summary, NextSteps component
- Properly typed, handles loading/error states

---

## 2.11 ORDER PENDING PAGE (`app/(store)/orders/pending/[orderNumber]/page.tsx`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Payment retry logic implemented
- Handles expired payments gracefully

---

## 2.12 ORDER TRACKING PAGE (`app/(store)/orders/[orderId]/page.tsx`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Shows order status timeline
- Tracks shipment if tracking number exists

---

## CONSOLIDATED ISSUES

| Severity | Count | Issues |
|---|---|---|
| **HIGH** | 3 | validate-coupon missing Rules 8 & 9; no rate limit on validate-coupon; checkout page > 300 lines |
| **MEDIUM** | 2 | shipping cost non-standard response; create-transaction expiry hardcoded |
| **LOW** | 1 | Retry FIFO race condition (documented) |

---

## PRIORITY FIX LIST

### 🔴 CRITICAL
1. **`app/api/checkout/validate-coupon/route.ts`** — Add Rules 8 (`applicableProductIds`) and 9 (`applicableCategoryIds`) by copying from `app/api/coupons/validate/route.ts` lines 99-127.

### 🟠 HIGH
2. **`app/api/checkout/validate-coupon/route.ts`** — Add `withRateLimit` wrapper (10 req/min) to prevent coupon enumeration.
3. **`app/(store)/checkout/page.tsx`** — Split into 5 sub-components to meet 300-line limit.

### 🟡 MEDIUM
4. **`app/api/shipping/cost/route.ts`** — Wrap all return values in `success()` helper (lines 66-70, 115-119).
5. **`lib/midtrans/create-transaction.ts`** — Replace hardcoded 15-minute expiry with `getSetting('payment_expiry_minutes')`.

### 🟢 LOW
6. **`app/api/checkout/retry/route.ts`** — Documented FIFO race condition (lines 103-120). Consider adding a version/lock field to `pointsHistory.consumedAt` to prevent concurrent consumption of the same earn record.

---

## ADDITIONAL FINDINGS FROM AGENT 2 (Checkout & Payment Deep Dive)

### C1: Price Tampering Risk in Midtrans item_details
**File:** `app/api/checkout/initiate/route.ts` line ~704
**Severity:** 🔴 CRITICAL

**Problem:** `item_details` sent to Midtrans uses `item.unitPrice` from the **client payload**, not the server-fetched price from the database. The server does re-fetch prices at lines 131-133 and stores the correct price in `orderItemsData[].unitPrice` (line 152), but Midtrans receives the stale client price instead.

**Impact:** If a product's price changes between when the customer added it to cart and when they initiate checkout, Midtrans receives the old (lower) price. The order is created with the correct server price, but Midtrans receives a mismatched gross_amount — could allow underpaying.

**Fix:** Use the server-fetched `unitPrice` variable from the loop (not `item.unitPrice` from client payload):
```typescript
// Line ~704 — replace item.unitPrice with the server-fetched unitPrice
itemDetails.push({
  id: variant.id,
  price: unitPrice, // ← use the server-fetched price from line 152, not item.unitPrice
  quantity: item.quantity,
  name: product.nameId,
});
```

---

### C2: Only 3 of 5 Allowed Couriers Implemented
**File:** `lib/constants/couriers.ts` lines 5-9
**Severity:** 🔴 CRITICAL

**Problem:** `ALLOWED_COURIERS` only has 3 entries: `sicepat/FROZEN`, `jne/YES`, `anteraja/FROZEN`. Master rules specify 5 couriers: **Sicepat, J&T, ANTA, Rex, POS**. J&T Express and Rex are completely missing.

**Also:** `app/api/shipping/cost/route.ts` imports `ALLOWED_COURIERS` and only queries these 3. POS is not in the list at all — only Sicepat, JNE, and ANTA are available to customers.

**Fix:** Add J&T Express and Rex to `ALLOWED_COURIERS`:
```typescript
export const ALLOWED_COURIERS = [
  { id: 'sicepat', name: 'Sicepat', service: 'FROZEN' },
  { id: 'jne', name: 'JNE', service: 'YES' },
  { id: 'anteraja', name: 'ANTA', service: 'FROZEN' },
  { id: 'jnt', name: 'J&T', service: 'FROZEN' },     // ← ADD
  { id: 'rex', name: 'Rex', service: 'FROZEN' },     // ← ADD
] as const;
```
Then update `api/shipping/cost/route.ts` to query all 5 via RajaOngkir.

---

### C3: FIFO Race Condition in Retry
**File:** `app/api/checkout/retry/route.ts` lines 103-120
**Severity:** 🟡 MEDIUM (documented, not critical)

**Problem:** When retrying an order, points are reversed (FIFO unconsume) by setting `consumedAt = null` on referenced earn records. Under high concurrency with low points balances, two simultaneous retries could both unconsume the same earn record before either marks it as consumed again — breaking the FIFO chain.

**Fix:** Add a `version` field or `lockedAt` timestamp to `pointsHistory.consumedAt` to prevent concurrent double-unconsume. Low priority — documented edge case.

---

### C4: useEffect Before useQuery Violation
**File:** `app/(store)/checkout/success/page.tsx`
**Severity:** 🟢 LOW

**Problem:** A `useEffect` depends on `orderData` but `useQuery` (which provides `orderData`) comes after the `useEffect` in the component. React hook ordering violation (BUG-13 in the code comments).

**Fix:** Move `useQuery` before any `useEffect` that depends on its data, or ensure the `useEffect` has a guard for `!orderData`.