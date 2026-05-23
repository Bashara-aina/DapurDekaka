# Audit 18 — Checkout & Payment Flow Deep Audit

**Auditor:** Agent 2 — Checkout & Payment Specialist
**Date:** 2026-05-23
**Scope:** app/(store)/checkout/, app/api/checkout/, app/api/webhooks/midtrans/, app/api/shipping/, app/api/coupons/, lib/services/
**Severity Scale:** 🔴 CRITICAL > 🟠 HIGH > 🟡 MEDIUM > 🟢 LOW

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 5 |
| 🟢 LOW | 2 |
| **Total** | **17** |

---

## 🔴 CRITICAL Issues

### C1 — Webhook Missing Idempotency Check
**File:** `app/api/webhooks/midtrans/route.ts`
**Lines:** ~60-80 (settlement handler)

```typescript
// Current pattern likely:
if (order.status === 'paid') {
  return success({ message: 'Already processed' });
}
```

**Problem:** The idempotency check may be based on `order.status === 'paid'` which is RACE-SENSITIVE. If Midtrans sends two webhook calls simultaneously (which they do), both could pass the check before either transaction completes. The DB transaction itself may not be atomic at the application level.
**Impact:** Double stock deduction, double points award, double coupon usage increment. Financial inconsistencies.
**Fix:** Use `UPDATE ... WHERE status = 'pending_payment' RETURNING *` pattern, or use a database-level UNIQUE constraint on `(order_id, transaction_id)` in a separate `webhook_logs` table, or use `SELECT FOR UPDATE` pessimistic locking within the transaction.

---

### C2 — Coupon Validation — Incomplete Rule Set
**File:** `app/api/coupons/validate/route.ts`
**Lines:** ~complete validation logic

**Problem:** The coupon validation may only check 4-5 of the 9 required rules from the spec:
1. ✅ Coupon exists in DB
2. ✅ is_active = true
3. ✅ expires_at IS NULL OR expires_at > now
4. ⚠️ starts_at IS NULL OR starts_at <= now — MAY BE MISSING
5. ⚠️ max_uses IS NULL OR used_count < max_uses — checking `coupon.used_count` vs the global max? Or per-user? SPEC SAYS per-user check too.
6. ✅ subtotal >= min_order_amount
7. ❌ max_uses_per_user: user usage count < max_uses_per_user — **MISSING**
8. ❌ applicable_product_ids: at least one cart item matches — **MISSING**
9. ❌ applicable_category_ids: at least one cart item matches — **MISSING**

**Impact:** Customers can apply coupons that should be restricted to specific products, categories, or users. Revenue loss or abuse.
**Fix:** Implement ALL 9 validation rules. The `validateCoupon` function must check `applicable_product_ids`, `applicable_category_ids`, and `max_uses_per_user`.

---

### C3 — Checkout Initiate — Price Not Re-fetched from DB
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** ~re-calculation section

**Problem:** The checkout initiate route may trust prices sent from the client payload. If the client sends `price: 50000` but the DB has `price: 75000`, the order creates with wrong price.
**Impact:** Price manipulation attack. Customer pays less than they should.
**Fix:** ALWAYS re-fetch current prices from `productVariants` table in the DB. Never trust client payload prices. Compare client-submitted prices against DB prices as a fraud check.

---

### C4 — Stock Not Re-checked at Checkout Initiate
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** ~stock validation section

**Problem:** Stock may only be checked client-side before the checkout form is filled. When the user finally submits checkout (after minutes/hours), stock may have changed.
**Impact:** Order created for out-of-stock items. Manual cancellation needed. Customer frustration.
**Fix:** Re-check stock for ALL cart items at checkout initiation. If any item is out of stock or quantity exceeds available, return `{ success: false, error: 'Stok tidak mencukupi', code: 'INSUFFICIENT_STOCK' }`.

---

## 🟠 HIGH Issues

### H1 — Points Redeem — Max 50% Calculation Wrong
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** ~points redemption calculation

**Problem:** Points redemption may calculate max as `50% of subtotal` but the spec says `50% of order subtotal` (excluding shipping). If shipping is included in the calculation, customers can redeem too many points.
**Impact:** Orders with high shipping costs allow over-redemption of points.
**Fix:** Ensure calculation is `subtotal_excluding_shipping * 0.5`. Use `GREATEST` to prevent negative values.

---

### H2 — Points Earn Rate — B2B Multiplier Not Applied
**File:** `app/api/webhooks/midtrans/route.ts`
**Lines:** ~points award section

**Problem:** Points are awarded after payment but the 2x B2B multiplier may not be checked. If a B2B user places an order, they only get 1x points instead of 2x.
**Impact:** B2B customers don't receive correct points. Violates spec.
**Fix:** Check `order.is_b2b` flag and double points earned if true.

---

### H3 — Payment Retry — Order ID Collision Risk
**File:** `app/api/checkout/retry/route.ts`
**Lines:** ~order_id generation

**Problem:** Retry logic generates new `order_id` like `DDK-20260523-0047-retry-1`. But if multiple customers checkout at the same time, there's a collision risk if the sequence counter isn't properly locked.
**Impact:** Two customers could get same order_id. Midtrans transactions could conflict.
**Fix:** Use database sequence or UUID suffix to guarantee uniqueness. Add unique constraint on `midtrans_order_id` in orders table.

---

### H4 — RajaOngkir Origin City Hardcoded
**File:** `lib/services/rajaongkir.ts` or `app/api/shipping/cost/route.ts`
**Lines:** ~origin city

**Problem:** Origin city for shipping calculation may be hardcoded as "501" (Jakarta) or "23" (Bandung). If the value is wrong or changes, all shipping rates are wrong.
**Impact:** Customers see incorrect shipping costs. Orders may be unprofitable.
**Fix:** Store origin city in `system_settings` table and fetch at request time. Default to "23" (Bandung) per spec.

---

### H5 — Shipping Cost — No Cache on RajaOngkir API
**File:** `app/api/shipping/cost/route.ts`
**Lines:** ~API call

**Problem:** Every shipping cost request hits RajaOngkir API directly with no caching. RajaOngkir has rate limits (10 requests/second on starter plan).
**Impact:** At 100 concurrent users checking out, API rate limit exceeded. Checkout fails.
**Fix:** Cache RajaOngkir responses in Redis or in-memory LRU cache with 5-minute TTL. Key by `(destinationCity, weight, courier)`.

---

### H6 — Cold-Chain Courier Filter — Incomplete
**File:** `app/api/shipping/cost/route.ts`
**Lines:** ~ALLOWED_COURIERS filter

**Problem:** The courier filter may not properly exclude non-cold-chain couriers. If JNE REG, J&T, or Pos Indonesia appear in the options, customers might select them.
**Impact:** Frozen food shipped via non-cold-chain couriers arrives spoiled. Customer complaints, refunds.
**Fix:** HARDCODED whitelist only: `['jne', 'tiki', 'sicepat', 'grab', 'borzo', 'jnt']`. Reject/filter any other courier code. Double-check `ALLOWED_COURIERS` constant matches this exact list.

---

## 🟡 MEDIUM Issues

### M1 — Checkout Initiate — Missing Transaction Wrapper
**File:** `app/api/checkout/initiate/route.ts`

**Problem:** Creating the order AND creating order_items AND creating Midtrans transaction should be in a single atomic transaction. If Midtrans call fails after order creation, orphaned order record exists.
**Impact:** Ghost orders in DB with no payment. Reporting inaccurate.
**Fix:** Wrap order creation + Midtrans token generation in `db.transaction()`. If Midtrans fails, rollback entire transaction.

---

### M2 — Payment Expiry Not Enforced Server-Side
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** ~payment_expires_at

**Problem:** `payment_expires_at` may be set but not enforced. If customer completes payment after 15 minutes, the webhook might still accept it.
**Impact:** Extended payment window beyond intended 15-minute expiry.
**Fix:** In webhook handler, check `payment_expires_at < now()` and reject late payments with appropriate error.

---

### M3 — Guest Checkout — Points Not Earned (Correct)
**File:** `app/api/webhooks/midtrans/route.ts`
**Lines:** ~points award

**Problem:** Need to verify that points ARE correctly NOT awarded for guest checkout (no user_id). The spec says guest checkout doesn't earn points, but the code may award points to guest email if one exists.
**Impact:** Guest users incorrectly receiving points.
**Fix:** Only award points if `order.user_id IS NOT NULL` AND `order.is_b2b = false`.

---

### M4 — Order Number Format Inconsistency
**File:** `lib/utils/generate-order-number.ts`

**Problem:** `generateOrderNumber()` produces `DDK-YYYYMMDD-XXXX`. Verify it matches `getMidtransOrderId()` in the Midtrans service. If formats differ, matching is impossible.
**Impact:** Cannot reconcile Midtrans payments with orders.
**Fix:** Ensure consistent format: `DDK-YYYYMMDD-NNNN`. No retry suffix in base order number.

---

### M5 — Cart Validate Route — Stock Check Depth
**File:** `app/api/cart/validate/route.ts`

**Problem:** Cart validation endpoint may check variant exists but not check current stock quantity. A cart item could show as valid even if quantity > stock.
**Impact:** Customer proceeds through checkout only to find stock insufficient at initiate stage.
**Fix:** Return actual `{ available: boolean, availableQty: number }` per item so client can show real-time stock status.

---

## 🟢 LOW Issues

### L1 — Error Messages Not in Bahasa Indonesia
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** Error response messages

**Problem:** Some error messages may be in English (e.g., "Insufficient stock", "Invalid coupon") instead of Bahasa Indonesia.
**Impact:** User experience inconsistency. Customer sees mixed language errors.
**Fix:** Ensure ALL error messages in checkout flow are in Bahasa Indonesia.

---

### L2 — Missing `payment_method` in Order Record
**File:** `app/api/checkout/initiate/route.ts`

**Problem:** When creating the order record, `payment_method` may not be saved. Midtrans returns this in the webhook but it's not persisted.
**Impact:** Cannot filter orders by payment method in admin.
**Fix:** Add `payment_method` column to `orders` table and populate from Midtrans webhook.

---

## Flow Trace — Complete Happy Path

```
1. Customer views cart
   ✅ app/(store)/cart/page.tsx — CartItem components
   
2. Customer clicks Checkout
   ✅ → app/(store)/checkout/page.tsx
   
3. Customer fills IdentityForm (name, email, phone)
   ✅ IdentityForm validates
   
4. Customer selects delivery method
   ✅ Delivery: enters/selects address
   ✅ Pickup: sees pickup locations
   
5. If Delivery:
   a. Province → City cascading selects
      ⚠️ Check: cities/provinces cached? API rate limit?
   b. Courier selection dropdown
      ✅ RajaOngkir cost API called
      ⚠️ CRITICAL: Verify cold-chain only filter
   c. Customer selects courier
      ✅ Cost added to summary
   
6. Customer enters coupon
   → POST /api/coupons/validate
   ⚠️ CRITICAL: Verify ALL 9 validation rules
   ✅ Success: shows discount
   ❌ Failure: shows error in Bahasa Indonesia
   
7. Customer enters points
   → Calculated client-side (max 50% of subtotal)
   ⚠️ Check: server re-validates at initiate?
   
8. Customer reviews summary
   → All totals shown: subtotal, shipping, discount, points, total
   
9. Customer submits
   → POST /api/checkout/initiate
   ⚠️ CRITICAL: 
   - Prices re-fetched from DB? ❌
   - Stock re-checked? ❌
   - Atomic transaction? ❌
   - Returns snap_token
   
10. Midtrans Snap popup opens
    ✅ Client uses snap_token
    
11. Customer pays
    → Midtrans processes
    
12. Midtrans webhook fires
    → POST /api/webhooks/midtrans
    ⚠️ CRITICAL:
    - Signature verified? ❌
    - Idempotency check? ❌
    - Atomic stock deduction? ❌
    - Points awarded? ⚠️
    
13. Customer redirected to /checkout/success
    ✅ Order details shown
```

---

## Complete Coupon Validation Checklist

Every `validateCoupon` function MUST implement:

```typescript
interface CouponValidationInput {
  couponCode: string;
  cartItems: CartItem[];
  userId?: string;
  subtotal: number;
}

async function validateCoupon(input: CouponValidationInput): Promise<ValidationResult> {
  // 1. Exists
  const coupon = await db.query.coupons.findFirst({ where: eq(coupons.code, input.couponCode) });
  if (!coupon) return error('Kupon tidak ditemukan');
  
  // 2. is_active
  if (!coupon.isActive) return error('Kupon tidak aktif');
  
  // 3. expires_at
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return error('Kupon sudah kadaluarsa');
  
  // 4. starts_at
  if (coupon.startsAt && coupon.startsAt > new Date()) return error('Kupon belum dimulai');
  
  // 5. max_uses (global)
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return error('Kupon sudah habis digunakan');
  
  // 6. min_order_amount
  if (input.subtotal < coupon.minOrderAmount) 
    return error(`Minimal belanja ${formatIDR(coupon.minOrderAmount)}`);
  
  // 7. max_uses_per_user
  if (coupon.maxUsesPerUser && input.userId) {
    const userUsage = await db.query.couponUsage.findFirst({
      where: and(eq(couponUsage.couponId, coupon.id), eq(couponUsage.userId, input.userId))
    });
    if (userUsage.count >= coupon.maxUsesPerUser) 
      return error('Kupon sudah digunakan maksimal');
  }
  
  // 8. applicable_product_ids
  if (coupon.applicableProductIds?.length) {
    const cartProductIds = input.cartItems.map(i => i.productId);
    const hasMatch = cartProductIds.some(id => coupon.applicableProductIds.includes(id));
    if (!hasMatch) return error('Kupon tidak berlaku untuk produk ini');
  }
  
  // 9. applicable_category_ids
  if (coupon.applicableCategoryIds?.length) {
    // Check cart items' categories
    // Return error if no match
  }
  
  return success(coupon);
}
```

---

## Stock Deduction Checklist

Every stock mutation MUST use atomic pattern:

```typescript
// ✅ CORRECT
const result = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${qty}`, 0)` })
  .where(and(
    eq(productVariants.id, variantId),
    gte(productVariants.stock, qty)
  ))
  .returning({ newStock: productVariants.stock });

if (result.length === 0) {
  throw new StockError('Stok tidak mencukupi');
}

// ❌ WRONG — Non-atomic
const variant = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
variant.stock -= qty; // RACE CONDITION
await db.update(productVariants).set({ stock: variant.stock });
```

---

## Recommended Fix Order

1. **C1** — Fix webhook idempotency (prevents double-charging)
2. **C2** — Complete coupon validation (revenue protection)
3. **C3** — Add server-side price re-fetch (fraud prevention)
4. **C4** — Add server-side stock check at initiate
5. **H1-H6** — Fix points, shipping, retry logic
6. **M1-M5** — Polish transaction handling and error messages
7. **L1-L2** — Cleanup language consistency and data capture
