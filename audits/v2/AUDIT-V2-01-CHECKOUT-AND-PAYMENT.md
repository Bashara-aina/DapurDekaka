# AUDIT V2-01 — Checkout & Payment Flow
**Date:** 2026-05-15  
**Scope:** `app/(store)/checkout/`, `app/api/checkout/`, `app/api/webhooks/midtrans/`, success/failed pages  
**Severity legend:** 🔴 CRITICAL (breaks flow) · 🟠 HIGH (wrong data) · 🟡 MEDIUM (UX broken) · 🔵 LOW (cosmetic)

---

## BUG-01 🔴 CRITICAL — Entire order creation is dead code for most checkouts

**File:** `app/api/checkout/initiate/route.ts`  
**Lines:** 357–612

### What's wrong
The entire order creation block — shipping cost calculation, total amount, order number generation, DB transaction, Midtrans transaction creation, and `return success(...)` — is nested inside:

```typescript
if (coupon && coupon.maxUsesPerUser && userId) {
```

This means the function **only creates an order** when ALL THREE conditions are true:
1. A coupon code was submitted
2. That coupon has `maxUsesPerUser` set
3. The user is logged in

All other checkouts (no coupon, coupon without per-user limit, guest checkout) fall off the end of the `try` block without returning a response, causing a 500 error in Next.js.

### Root cause
A "FIX 5" comment introduced a coupon per-user limit check but accidentally wrapped the entire remaining function body in the condition.

### Fix
Extract the shipping/total calculation and all remaining code OUT of the if block. The if block should only perform the per-user coupon check and return an error if exceeded, then fall through unconditionally to the order creation.

**Replace lines 357–612 with:**

```typescript
// ── Step 3b: Per-user coupon limit check (after userId is resolved) ────────
if (coupon && coupon.maxUsesPerUser && userId) {
  const userUsageCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponUsages)
    .where(and(
      eq(couponUsages.couponId, coupon.id),
      eq(couponUsages.userId, userId)
    ));
  if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
    return conflict('Anda sudah menggunakan kupon ini sebelumnya');
  }
}

// ── Step 4: Compute shipping, total, points earned ────────────────────────
const baseShippingCost = deliveryMethod === 'pickup'
  ? 0
  : (addressData.courierCode ? (parsed.data.shippingCost ?? 0) : 0);
const shippingCost = (coupon && (coupon.type === 'free_shipping' || coupon.freeShipping)) && deliveryMethod === 'delivery'
  ? 0
  : baseShippingCost;
const totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost;
const pointsEarnedBase = Math.floor(totalAmount / 1000) * POINTS_EARN_RATE;
const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;

// ── Step 5: Generate order number using atomic DB counter ─────────────────
const today = new Date().toISOString().slice(0, 10);
const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;
const paymentExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

// ── Step 6: Create order + deduct points in single transaction ────────────
// [rest of existing transaction code stays the same]
```

Also **remove** the now-duplicate per-user check block that was originally at lines 199–209 (inside the coupon validation block):
```typescript
// REMOVE this block (lines ~199–209):
if (coupon.maxUsesPerUser && userId) {
  const userUsageCount = await db...
  if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
    return conflict('Anda sudah menggunakan kupon ini sebelumnya');
  }
}
```

---

## BUG-02 🟠 HIGH — Success page shows 0 points earned (wrong response path)

**File:** `app/(store)/checkout/success/page.tsx`  
**Lines:** 29–34

### What's wrong
The query function returns `json.data` from `GET /api/orders/${orderNumber}`. But the API response structure is:
```json
{ "success": true, "data": { "order": { "pointsEarned": 120, ... }, "verified": true } }
```

So `json.data` is `{ order: {...}, verified: true }` — not `{ pointsEarned, totalAmount, status }`. Accessing `orderData.pointsEarned` returns `undefined`, so the points celebration card never renders.

### Fix

```typescript
// Line 33 — change:
return json.data;
// to:
return json.data?.order ?? { pointsEarned: 0, totalAmount: 0, status: '' };
```

---

## BUG-03 🟠 HIGH — Cart cleared before payment, leaving user with empty cart on failure

**File:** `app/(store)/checkout/page.tsx`  
**Lines:** 374–376

### What's wrong
`clearCart()` is called immediately after the order is created (`pending_payment`), before the Midtrans payment widget is shown. If the user then closes the payment widget, cancels, or payment fails, their cart is gone. The failed page's "Coba Lagi" button restores items individually via `addItem()` but misses `productNameEn`, `variantNameEn`, `sku` fields (sets them to empty string).

### Fix — Move clearCart to ONLY fire after actual payment success:

```typescript
// Remove clearCart from handlePlaceOrder (lines 374–376)
// Keep only in handleMidtransSuccess:

const handleMidtransSuccess = () => {
  clearCart(); // Only clear after confirmed payment
  router.push(`/checkout/success?order=${orderNumber}`);
};
```

Also fix the failed page's `addItem` calls to include missing fields:

**File:** `app/(store)/checkout/failed/page.tsx` lines 56–68  
```typescript
// Change:
addItem({
  variantId: item.variantId,
  productId: item.productId,
  productNameId: item.productNameId,
  productNameEn: '',         // ← missing
  variantNameId: item.variantNameId,
  variantNameEn: '',         // ← missing
  sku: '',                   // ← missing
  ...
});
// Fix: fetch proper product data OR store full item data when clearing cart
```

---

## BUG-04 🟠 HIGH — "Bayar Sekarang" button shows Rp 0 before order is placed

**File:** `app/(store)/checkout/page.tsx`  
**Line:** 739

### What's wrong
```typescript
{isLoading ? 'Memproses...' : `Bayar Sekarang — ${formatIDR(serverTotalAmount)}`}
```
`serverTotalAmount` starts at `0` and is only set after the API responds. Before clicking, the button reads "Bayar Sekarang — Rp 0".

### Fix — Use client-side `totalAmount` for the button label:

```typescript
// Change line 739:
{isLoading ? 'Memproses...' : `Bayar Sekarang — ${formatIDR(totalAmount)}`}
```

---

## BUG-05 🟠 HIGH — Free shipping coupon doesn't remove shipping cost from UI total

**File:** `app/(store)/checkout/page.tsx`  
**Line:** 220

### What's wrong
```typescript
const totalAmount = subtotal - couponDiscount - pointsDiscount + formData.shippingCost;
```
When coupon type is `free_shipping`, `couponDiscount` remains 0 (because validate API returns `discountAmount: 0` for free shipping coupons). The shipping cost is never deducted from `totalAmount`. User sees wrong total.

Also: the checkout initiate route correctly computes `shippingCost = 0` when coupon is `free_shipping`, but the client sends `shippingCost: formData.shippingCost` (non-zero). The server overrides this correctly, but the displayed total on the client is wrong until the snap token comes back.

### Fix — Track free-shipping coupon separately:

```typescript
// In handleApplyCoupon, after setCouponDiscount:
const isFreeShipping = data.data.type === 'free_shipping' || data.data.freeShipping;
setIsFreeShippingCoupon(isFreeShipping);

// In totalAmount calculation:
const effectiveShipping = isFreeShippingCoupon && formData.deliveryMethod === 'delivery'
  ? 0
  : formData.shippingCost;
const totalAmount = subtotal - couponDiscount - pointsDiscount + effectiveShipping;
```

Add state: `const [isFreeShippingCoupon, setIsFreeShippingCoupon] = useState(false);`

---

## BUG-06 🟡 MEDIUM — Midtrans snap popup blocked by loading overlay

**File:** `app/(store)/checkout/page.tsx`  
**Lines:** 760–775

### What's wrong
When `snapToken` is set, a full-screen loading overlay (`fixed inset-0 bg-black/50 z-40`) renders ON TOP of the Midtrans snap widget. The widget opens (via `MidtransPayment` component) but may be hidden under the overlay. The `MidtransPayment` component uses `z-50` or similar — check that the snap popup `z-index` exceeds `z-40`.

### Fix — Remove the manual overlay (Midtrans snap has its own overlay) and navigate the UX differently:

```typescript
// Replace lines 760–775 with:
{snapToken && orderNumber && (
  <MidtransPayment
    snapToken={snapToken}
    callbacks={{
      onSuccess: handleMidtransSuccess,
      onError: () => router.push(`/checkout/failed?order=${orderNumber}`),
      onClose: () => {
        // User closed without paying — show retry state
        setSnapToken(null);
        setIsLoading(false);
      },
    }}
  />
)}
```

---

## BUG-07 🟡 MEDIUM — Checkout idempotency returns stale snap token even if cart changed

**File:** `app/api/checkout/initiate/route.ts`  
**Lines:** 327–344

### What's wrong
If a logged-in user has a pending order from the last 5 minutes, the API returns the existing snap token — regardless of whether the cart items, coupon, or shipping have changed. A user who edits their cart and re-initiates checkout gets the OLD payment.

### Fix — Either remove the logged-in idempotency check (only keep guest dedup for double-click) or include a cart hash in the comparison:

```typescript
// Change the logged-in idempotency to only deduplicate within 30 seconds (same as guest):
if (userId) {
  const existingPending = await db.query.orders.findFirst({
    where: and(
      eq(orders.userId, userId),
      eq(orders.status, 'pending_payment'),
      gte(orders.createdAt, new Date(Date.now() - 30 * 1000)), // 30s, not 5min
      eq(orders.subtotal, subtotal) // also match subtotal
    ),
    orderBy: [desc(orders.createdAt)],
  });
  if (existingPending?.midtransSnapToken) {
    return success({ orderId: existingPending.id, orderNumber: existingPending.orderNumber, snapToken: existingPending.midtransSnapToken });
  }
}
```

---

## BUG-08 🔵 LOW — Checkout pending page doesn't redirect after payment

**File:** `app/(store)/checkout/pending/page.tsx`  
**Action:** Verify this page polls order status and redirects to `/checkout/success` or `/checkout/failed` when status changes. If it just shows a static message, add polling.

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 01 | 🔴 CRITICAL | `api/checkout/initiate/route.ts:358` | ALL checkouts broken (wrong if nesting) |
| 02 | 🟠 HIGH | `checkout/success/page.tsx:33` | Points never shown (wrong data path) |
| 03 | 🟠 HIGH | `checkout/page.tsx:374` | Cart wiped before payment completes |
| 04 | 🟠 HIGH | `checkout/page.tsx:739` | Button shows Rp 0 |
| 05 | 🟠 HIGH | `checkout/page.tsx:220` | Free shipping coupon doesn't deduct from total |
| 06 | 🟡 MEDIUM | `checkout/page.tsx:760` | Loading overlay hides Midtrans snap popup |
| 07 | 🟡 MEDIUM | `api/checkout/initiate/route.ts:327` | Idempotency ignores cart changes (5min window) |
| 08 | 🔵 LOW | `checkout/pending/page.tsx` | Static page, no auto-redirect |
