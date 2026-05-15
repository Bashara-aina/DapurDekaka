# FINAL AUDIT 05 — Business Logic, Data Integrity & Edge Cases
**Date:** 2026-05-15  
**Focus:** Financial calculations, webhook processing, points/coupon math, email notifications, security, race conditions, edge cases  
**Priority:** P0 = data corruption / revenue loss | P1 = incorrect behavior | P2 = fragility

---

## 1. FINANCIAL CALCULATION INTEGRITY

### 1.1 Points Discount Not Included in Checkout Initiate [P0]
**File:** `app/(store)/checkout/page.tsx:278-305`

The `handlePlaceOrder` function sends `pointsDiscount` to the API:

```typescript
body: JSON.stringify({
  items: items.map(...),
  ...formData,
  subtotal,
  discountAmount: couponDiscount,
  pointsDiscount,   // ← sent as a field
}),
```

But `formData.pointsUsed` is never updated from the `PointsRedeemer` component. The `usePoints` toggle affects the local `pointsDiscount` display but not `formData.pointsUsed`.

**Trace the problem:**
```typescript
// In PointsRedeemer render:
usedPoints={usePoints ? Math.min(pointsBalance, Math.floor((subtotal - couponDiscount) * 0.5 / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) : 0}

// But nowhere is:
updateForm({ pointsUsed: calculatedUsedPoints })
```

**Result:**
- `formData.pointsUsed = 0` (default, never updated)
- `pointsDiscount = 0` (because `formData.pointsUsed` is 0)
- Customer sees "Poin digunakan: -Rp 5.000" on screen
- But API receives `pointsDiscount: 0` and `pointsUsed: 0`
- Order created with no points deducted, customer pays full price
- Points balance unchanged — customer wasn't charged points but saw a discount

**This is a double failure:** customer thinks they used points (but didn't), AND they paid as if they had no discount applied.

**Fix:** In the payment step, when `usePoints` is true, compute the `usedPoints` value and call `updateForm({ pointsUsed: computedValue })`. The total must be recalculated using this value.

---

### 1.2 Total Amount Calculation Has Race Condition [P1]
**File:** `app/(store)/checkout/page.tsx:161-166`

```typescript
const pointsDiscount = usePoints && formData.pointsUsed > 0
  ? Math.floor(formData.pointsUsed / POINTS_VALUE_IDR) * POINTS_VALUE_IDR
  : 0;
const totalAmount = subtotal - couponDiscount - pointsDiscount + formData.shippingCost;
```

The `totalAmount` displayed on the "Bayar Sekarang — {total}" button uses local state. But the server (Midtrans) sees the amount from `/api/checkout/initiate`, which computes its own total.

If there's a mismatch between what the user sees and what Midtrans charges, the webhook's amount cross-check will fail:

```typescript
// In webhook:
if (webhookAmount !== expectedAmount) {
  return NextResponse.json({ received: false }, { status: 400 });
}
```

This would cause ALL payments to fail silently (webhook rejected, order never marked paid).

**The root cause:** The client calculates `totalAmount` but the server recalculates it independently. Any floating-point or rounding difference causes mismatch.

**Fix:** The `/api/checkout/initiate` response should return the final `totalAmount` as computed by the server. The Midtrans token is created with the server's amount. Display the server's amount on the payment button, not the client-computed one.

---

### 1.3 Midtrans Amount Cross-Check May Be Broken [P0]
**File:** `app/api/webhooks/midtrans/route.ts:93-96`

```typescript
const expectedAmount = order.totalAmount;
const webhookAmount = parseInt(gross_amount, 10);
if (webhookAmount !== expectedAmount) {
  return NextResponse.json({ received: false }, { status: 400 });
}
```

`gross_amount` from Midtrans is a string like `"125000.00"`. Parsing with `parseInt("125000.00", 10)` gives `125000`. But `order.totalAmount` stored in the DB is also in IDR as an integer.

**Potential issue:** If Midtrans sends `"125000.00"` and the DB has `125000`, parseInt gives `125000` — this matches. BUT if Midtrans sends `"125000.50"` (unlikely for IDR but possible), parseInt gives `125000` which matches despite being different values.

**Safer fix:** Use `Math.round(parseFloat(gross_amount))` instead of `parseInt`.

---

### 1.4 Stock Deduction Has Oversell Risk Without Transaction Lock [P1]
**File:** `app/api/webhooks/midtrans/route.ts:110-131`

The stock deduction in the webhook uses:
```typescript
await tx.update(productVariants)
  .set({ stock: sql`stock - ${item.quantity}` })
  .where(and(
    eq(productVariants.id, item.variantId),
    gte(productVariants.stock, item.quantity)
  ))
```

This is a conditional decrement (only if stock >= quantity). But in a high-concurrency scenario (two webhooks for two orders of the same item arriving simultaneously), both could pass the `gte` check before either commits, causing oversell.

**Assessment:** For the scale of this business (500-1000 orders/month), this is LOW risk but worth noting. Neon PostgreSQL's row-level locking within a transaction should handle this, but it depends on isolation level.

**Fix:** Add `FOR UPDATE` locking on the variant row before checking stock (PostgreSQL `SELECT ... FOR UPDATE`).

---

### 1.5 Coupon Used_Count Double-Increment [P1]
**File:** `app/api/webhooks/midtrans/route.ts:144-149` and cancellation handler `317-322`

In the settlement webhook:
```typescript
// Increment coupon used_count
if (order.couponId) {
  await tx.update(coupons)
    .set({ usedCount: sql`used_count + 1` })
    .where(eq(coupons.id, order.couponId));
}
```

Then ALSO inserts into `couponUsages`:
```typescript
if (order.couponId) {
  await tx.insert(couponUsages).values({...});
}
```

**Questions:**
1. Is `used_count` on the `coupons` table the source of truth for "how many times was this used"?
2. Or is it `COUNT(*) FROM couponUsages WHERE couponId = ?`?
3. Is `used_count` also incremented in `/api/checkout/initiate` (before payment)? If yes, it will be double-incremented.

Looking at the coupon validation route, it checks `coupons.usedCount` vs `coupons.maxUses`. If used_count is incremented at initiate AND at settlement, the coupon burns through uses twice as fast.

**Fix:** Decide on ONE source of truth:
- Option A: Only increment in webhook (after settlement). The coupon validation at checkout time reads the CURRENT usedCount (which only reflects completed payments).
- Option B: Soft-reserve at initiate, confirm at settlement. This prevents overselling coupons but requires a reversal mechanism.

---

### 1.6 Order Total Doesn't Cap Points Discount at 50% of Subtotal [P1]
**PRD:** "Maximum redemption per order: 50% of subtotal value"

**File:** `app/(store)/checkout/page.tsx:583`

```typescript
usedPoints={usePoints ? Math.min(pointsBalance, Math.floor((subtotal - couponDiscount) * 0.5 / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) : 0}
```

The client correctly caps at 50% of `(subtotal - couponDiscount)`. But does the server-side `/api/checkout/initiate` also enforce this cap? If not, a manipulated request could redeem more than 50%.

**Fix:** In `/api/checkout/initiate`, enforce:
```typescript
const maxPointsDiscount = Math.floor(subtotal * 0.5);
const actualPointsDiscount = Math.min(requestedPointsDiscount, maxPointsDiscount);
```

---

## 2. PAYMENT & WEBHOOK PROCESSING

### 2.1 Webhook Has No Response Within Midtrans Timeout [P1]
Midtrans expects a webhook response within a certain timeout (typically 5-10 seconds). The webhook currently:
1. Verifies signature ✅
2. Finds order in DB ✅
3. Runs DB transaction with multiple operations ✅
4. Sends email (awaited!) ← This can take 1-3 seconds
5. Returns response

If Resend (email service) is slow or times out, the entire webhook handler times out. Midtrans may retry the webhook, causing double-processing.

**Fix:** Send emails asynchronously (fire-and-forget, don't `await`):
```typescript
// Instead of await:
sendEmail({...}).catch(err => logger.error('[Email] Failed', { err }));
```

Or use Vercel's `waitUntil` to run emails after response is sent.

---

### 2.2 Duplicate Webhook Processing Not Fully Idempotent [P1]
**File:** `app/api/webhooks/midtrans/route.ts:74-81`

The idempotency checks are:
```typescript
if (order.status === 'paid' && transaction_status === 'settlement') {
  return success({ received: true, note: 'already_processed' });
}
if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status)) {
  return success({ received: true, note: 'already_cancelled' });
}
```

**Gap:** What if the order is `pending_payment` and a `settlement` webhook arrives twice concurrently? Both checks pass (status is still `pending_payment` for both), both transactions run simultaneously, resulting in:
- Stock deducted twice
- Points awarded twice
- `usedCount` incremented twice

**Fix:** Use a database-level advisory lock or an idempotency key stored in the DB (e.g., `midtransTransactionId`). Before processing, check if this exact transaction ID was already processed.

---

### 2.3 Payment Retry Count Not Enforced [P1]
**PRD:** "After 3 failed regenerations, order is cancelled automatically"

**Schema:** `paymentRetryCount: integer` on orders.

**File:** `app/api/checkout/retry/route.ts`

Need to verify: does the retry API increment `paymentRetryCount` and block retries after 3 attempts? If not, a customer can retry indefinitely.

---

### 2.4 Webhook Doesn't Update `midtransTransactionId` on Settlement [P2]
**File:** `app/api/webhooks/midtrans/route.ts:99-107`

```typescript
await tx.update(orders)
  .set({
    status: 'paid',
    paidAt: new Date(),
    midtransPaymentType: body.payment_type ?? null,
    midtransVaNumber: body.va_numbers?.[0]?.va_number ?? null,
  })
  .where(eq(orders.id, order.id));
```

`midtransTransactionId` is NOT saved on settlement. This field exists in the schema and in the webhook body (`body.transaction_id`). Without it stored, reconciliation is impossible — you can't match a Midtrans transaction ID to an order in your DB.

**Fix:** Add `midtransTransactionId: body.transaction_id ?? null` to the update.

---

## 3. POINTS SYSTEM INTEGRITY

### 3.1 Points FIFO Redemption Logic Needs Verification [P1]
**PRD:** "FIFO redemption: oldest points used first"

The schema has:
- `pointsHistory.expiresAt` per record
- `pointsHistory.consumedAt` — set when points are used
- `pointsHistory.referencedEarnId` — links redeem record to the earn record used

The webhook reversal logic unconsumes referenced earn records. But does `/api/checkout/initiate` actually implement FIFO? It should:
1. Query `pointsHistory WHERE type='earn' AND isExpired=false AND consumedAt IS NULL ORDER BY expiresAt ASC`
2. Consume oldest-first until `pointsUsed` is satisfied
3. Set `consumedAt = now` on each consumed earn record
4. Create a `redeem` record with `referencedEarnId` pointing to each consumed earn record

This is complex logic. Verify it's implemented correctly in `/api/checkout/initiate`.

---

### 3.2 Points Balance Can Go Negative [P1]
If two checkout requests for the same user run concurrently:
1. Both read `pointsBalance = 500`
2. Both check `pointsUsed <= 500` ✅
3. Both deduct 500 from balance
4. Final balance: -500 ❌

**Fix:** Use a SQL conditional update:
```sql
UPDATE users 
SET points_balance = points_balance - X 
WHERE id = ? AND points_balance >= X
RETURNING points_balance
```

If the update affects 0 rows, abort with an error.

---

### 3.3 Expired Points Not Auto-Removed From Balance [P1]
**Schema:** `pointsHistory.isExpired` and `pointsHistory.expiresAt`

The cron job at `/api/cron/expire-points` should:
1. Find earn records where `expiresAt < now AND isExpired = false`
2. Set `isExpired = true` and `consumedAt = now`
3. Decrement `users.pointsBalance` by the expired amount
4. Insert a `expire` type record in `pointsHistory`

Need to verify this cron job is correctly implemented and registered.

**Also:** Is this cron job registered in `vercel.json`? Check `vercel.json` for cron configuration.

---

### 3.4 Points History Description Uses Indonesian Only [P2]
**File:** `app/api/webhooks/midtrans/route.ts:171-176`

```typescript
descriptionId: `Pembelian ${order.orderNumber}${isB2B ? ' (Poin B2B 2x)' : ''}`,
descriptionEn: `Purchase ${order.orderNumber}${isB2B ? ' (B2B Points 2x)' : ''}`,
```

This is good. But check other points operations (redemption at initiate, expiry cron) to ensure both `descriptionId` and `descriptionEn` are always populated.

---

## 4. EMAIL SYSTEM INTEGRITY

### 4.1 Missing Email Templates [P0]
**PRD Email Notification Matrix:**

| Status Change | Template | Status |
|---|---|---|
| `pending_payment` → `paid` | `OrderConfirmationEmail` | ✅ Exists |
| `paid` → `processing` | No notification | ✅ (none needed) |
| `processing` → `packed` | No notification | ✅ (none needed) |
| `packed` → `shipped` | "Pesanan dikirim" + tracking | ❌ **MISSING** |
| `shipped` → `delivered` | "Pesanan tiba" + thank you + points | ❌ **MISSING** |
| Any → `cancelled` | "Pesanan dibatalkan" | ✅ Exists |
| Pickup (paid) | Pickup invitation | ✅ Exists |

The two missing email templates mean customers are never notified when their order ships or arrives. This is a major operational gap — customers will WhatsApp asking "where is my order?"

---

### 4.2 No Transactional Email for Admin Order Status Changes [P1]
When an admin manually updates order status (e.g., to `shipped`), the email send logic must be in the order status update API (`/api/admin/orders/[id]/status/route.ts`), not just in the webhook.

**Current state:** The webhook only handles `settlement`, `cancel`, `deny`, `expire` from Midtrans. Admin status changes (processing, packed, shipped, delivered) have their own API route. If that route doesn't send emails, customers get no notifications after payment confirmation.

---

### 4.3 Email Failures Are Silently Ignored [P2]
**File:** `app/api/webhooks/midtrans/route.ts:239-241`

```typescript
} catch (emailError) {
  logger.error('[Email] Failed to send confirmation', { error: ... });
}
```

Email failures are logged but swallowed. There's no retry mechanism, no admin alert, no dead letter queue.

For critical transactional emails (order confirmation), silent failure means the customer never gets their receipt.

**Fix:** Consider a simple retry mechanism or store failed email jobs in a `email_queue` table for retry.

---

### 4.4 PDF Attachment in Email Is Not Implemented [P1]
**PRD Says:** "Send confirmation email via Resend (order summary + PDF attachment)"

The `OrderConfirmationEmail` is sent but there is no PDF attached. The PDF receipt generation doesn't exist yet (see Audit 01). Once PDF generation is implemented, it must be attached to the confirmation email.

---

## 5. SECURITY GAPS

### 5.1 Public Order Tracking Exposes PII [P0]
Already documented in Audit 01. The `/orders/[orderNumber]` page shows full order details (name, phone, address) to anyone who knows the order number. Order numbers are sequential and predictable (DDK-YYYYMMDD-XXXX).

An attacker could enumerate order numbers and scrape customer data.

**Fix:** Email gate (see Audit 01, section 6.1).

---

### 5.2 Checkout API Doesn't Validate User Owns the Points [P1]
**File:** `app/api/checkout/initiate/route.ts`

When a logged-in user sends `pointsUsed: 500` in the checkout, the API must verify:
1. The user has at least 500 points (`user.pointsBalance >= 500`)
2. The user is not tampering with a higher value

If the API doesn't verify the user's actual balance before deducting, a user could manipulate the checkout request to apply more discount than they have points for.

**Fix:** Always read `user.pointsBalance` from the DB inside the checkout initiate handler — never trust the client's reported points value.

---

### 5.3 Cart Validate API Uses GET with Query Params [P2]
**File:** `app/(store)/cart/page.tsx:35-38`

```typescript
const res = await fetch(
  `/api/cart/validate?variantIds=${variantIds}&quantities=${quantities}`
);
```

Sending `variantIds` as comma-separated values in a GET URL works but:
- Has URL length limits for large carts
- Leaks cart contents in server logs (URL is logged)
- Inconsistent with the POST-based approach in the cart store

---

### 5.4 Rate Limiting Not Applied to Cart Validate [P2]
The `/api/cart/validate` endpoint has no rate limiting. An attacker could hammer this endpoint to check stock levels for all variants rapidly.

---

### 5.5 Coupon Validate Returns Too Much Information [P2]
**File:** `/api/coupons/validate/route.ts`

On success, the coupon validation should return the discount amount. It should NOT return:
- Internal coupon ID
- `maxUses`, `usedCount` (competitor can gauge how many used)
- Internal description fields

Return only: `{ type, discountAmount, freeShipping }`.

---

## 6. DATA INTEGRITY RULES

### 6.1 Order Number Daily Counter Has No DB-Level Unique Constraint [P1]
**Schema:** `orderDailyCounters` has `date: varchar unique`.

The order number generation in `/api/checkout/initiate` must:
1. Read today's counter
2. Increment it
3. Use the new value

If two orders are created simultaneously, both might read the same counter value, resulting in duplicate order numbers.

**Fix:** Use `INSERT ... ON CONFLICT ... UPDATE RETURNING` (atomic upsert) for the daily counter:
```sql
INSERT INTO order_daily_counters (date, last_sequence)
VALUES (today, 1)
ON CONFLICT (date) DO UPDATE 
SET last_sequence = order_daily_counters.last_sequence + 1
RETURNING last_sequence;
```

This is atomic and race-condition safe.

---

### 6.2 Soft Delete Not Consistently Applied [P2]
Several tables have `deletedAt: timestamp` (products, categories, coupons, b2bProfiles, blogPosts). But do all queries that read these tables filter `WHERE deleted_at IS NULL`?

If any query forgets the `isNull(deletedAt)` filter, deleted records appear in the store.

**Critical check:** The product catalog, product detail page, and admin product list all must include `isNull(products.deletedAt)` in their WHERE clause.

---

### 6.3 Product Variants Orphaned on Product Delete [P1]
If a product is soft-deleted (via `deletedAt`), its variants still exist in `productVariants`. The schema uses `onDelete: 'cascade'` only for hard deletes. Soft deletes don't cascade.

If an admin soft-deletes a product but the product variants are still in an active order item reference, this creates data inconsistency.

**Assessment:** This is low risk since `orderItems` snapshots product name/variant name at order creation time. But variant editing/deletion should also check if variants are referenced in active orders.

---

### 6.4 Address District Field vs RajaOngkir District Mismatch [P2]
**Schema:** `addresses.district` is a `varchar(255)`.

**RajaOngkir API:** Returns city data with `city_name` and `type`. The "district" in the schema refers to `kecamatan` (sub-district) but RajaOngkir only provides city-level data, not kecamatan.

In the checkout address form:
- `province` → from RajaOngkir provinces
- `city` → from RajaOngkir cities (cascades from province)
- `district` → **free text input** (not RajaOngkir data)

This means `district` is whatever the customer types. Shipping cost is calculated based on `cityId` (which IS from RajaOngkir), but the district field is just for display/delivery purposes.

This is acceptable but should be clearly documented so delivery address display is correct.

---

## 7. CRON JOBS AND BACKGROUND JOBS

### 7.1 Cron Jobs Registered in vercel.json [P1]
**File:** `vercel.json` (not inspected in detail)

The following cron jobs were found in the file listing:
- `/api/cron/cleanup-audit-logs`
- `/api/cron/cleanup-counters`
- `/api/cron/reconcile-payments`
- `/api/cron/reconcile-points`
- `/api/cron/cancel-expired-orders`
- `/api/cron/expire-points`
- `/api/cron/points-expiry-warning`

**Verify each cron:**
1. Is the schedule correct in `vercel.json`?
2. Are cron endpoints protected (require `CRON_SECRET` header)?
3. Do they handle failure gracefully?
4. Is there logging for each run?

---

### 7.2 Expired Orders Cancellation Cron [P1]
`/api/cron/cancel-expired-orders` should cancel orders where `paymentExpiresAt < now AND status = 'pending_payment'`.

**Important:** When an order is auto-cancelled by cron, it must also:
1. Reverse any points used (if `pointsUsed > 0`)
2. Decrement `coupon.usedCount` (if coupon was applied)
3. NOT deduct stock (since it was never paid)

Does this cron implement the same reversal logic as the webhook cancellation handler?

---

### 7.3 No Cron for Reconcile Payment Status [P1]
If a Midtrans webhook is missed (network failure, server restart), an order may be stuck in `pending_payment` forever even though the customer paid.

There should be a reconciliation cron that:
1. Finds orders in `pending_payment` where `paidAt IS NULL` and `paymentExpiresAt > now`
2. Calls Midtrans API to check transaction status
3. If settled: trigger the same logic as the webhook
4. If expired: cancel the order

The `/api/cron/reconcile-payments` file exists. Verify it's implemented correctly.

---

## SUMMARY TABLE

| # | Issue | File/Location | Priority |
|---|---|---|---|
| 1.1 | Points discount not sent to checkout API | `checkout/page.tsx:163` | **P0** |
| 1.3 | Amount cross-check may reject valid payments | `webhooks/midtrans/route.ts:93` | **P0** |
| 2.2 | Duplicate webhooks can double-deduct stock | `webhooks/midtrans/route.ts:74` | P1 |
| 2.4 | `midtransTransactionId` not saved on settlement | `webhooks/midtrans/route.ts:99` | P2 |
| 3.1 | FIFO points redemption needs verification | `api/checkout/initiate` | P1 |
| 3.2 | Points balance can go negative (race condition) | `api/checkout/initiate` | P1 |
| 4.1 | Shipped + Delivered email templates missing | Email templates | **P0** |
| 4.2 | Admin status changes don't trigger emails | `api/admin/orders/[id]/status` | P1 |
| 5.1 | Order tracking exposes PII without auth | `orders/[orderNumber]/page.tsx` | **P0** |
| 5.2 | Checkout doesn't verify user owns points | `api/checkout/initiate` | P1 |
| 6.1 | Order number generation has race condition | `api/checkout/initiate` | P1 |
| 1.2 | Total amount mismatch between client/server | `checkout/page.tsx:161` | P1 |
| 1.5 | Coupon used_count double-increment risk | `webhooks/midtrans/route.ts:144` | P1 |
| 2.1 | Email sending blocks webhook response | `webhooks/midtrans/route.ts:210` | P1 |
| 7.2 | Expired orders cron may not reverse points/coupon | `api/cron/cancel-expired-orders` | P1 |
