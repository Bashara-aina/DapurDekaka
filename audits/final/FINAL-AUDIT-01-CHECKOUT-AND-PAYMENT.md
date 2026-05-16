# FINAL AUDIT 01 — CHECKOUT & PAYMENT FLOW
**Date:** 2026-05-16  
**Severity scale:** 🔴 Critical (data loss / wrong money) | 🟠 High (broken UX) | 🟡 Medium (wrong behavior) | 🔵 Low (cosmetic/minor)

---

## BUG 01 🔴 — Points earn calculated on totalAmount instead of subtotal

**File:** `app/api/checkout/initiate/route.ts` line 362–364  
**PRD Rule (§6.4):** "Rate: 1 point per IDR 1,000 spent **calculated on subtotal only, not shipping, not discount**."

**Current code:**
```ts
const pointsEarnedBase = Math.floor(totalAmount / 1000) * POINTS_EARN_RATE;
```
`totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost`

This means shipping cost inflates points earned and discounts reduce them — both wrong per PRD.

**Fix:**
```ts
const pointsEarnedBase = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;
```

---

## BUG 02 🔴 — After Midtrans payment success, checkout page does NOT redirect to /checkout/success

**File:** `app/(store)/checkout/page.tsx` line 395–397
```ts
const handleMidtransSuccess = () => {
  clearCart();
};
```
After Midtrans snap closes (success), the cart is cleared but no redirect happens. The user lands on the checkout page which immediately shows "Keranjangmu kosong" (empty cart EmptyState) — this is the **success** experience they see. The `/checkout/success?order=XXX` page is never shown.

**Fix:** Add router redirect to success page:
```ts
const handleMidtransSuccess = () => {
  clearCart();
  router.push(`/checkout/success?order=${orderNumber}`);
};
```

---

## BUG 03 🟠 — Points discount formula is dimensionally inconsistent across the codebase

**Files:**  
- `app/(store)/checkout/page.tsx` lines 224–226, 343–346, 727  
- `app/(store)/account/points/page.tsx` line 69  
- `app/(store)/checkout/success/page.tsx` line 64  

**PRD Rule:** 100 points = IDR 1,000 → **1 point = IDR 10**

**Inconsistency map:**

| Location | Formula | Result for 100 pts | Correct? |
|---|---|---|---|
| `success/page.tsx:64` | `pointsEarned * 10` | IDR 1,000 | ✅ Correct |
| `points/page.tsx:69` | `balance * 1000` | IDR 100,000 | ❌ 100x too high |
| `checkout/page.tsx:224` | `Math.floor(pointsUsed / POINTS_VALUE_IDR) * POINTS_VALUE_IDR` | Depends on constant | ❓ Needs verification |
| `checkout/page.tsx:343` | `Math.floor((subtotal - coupon) * 0.5)` as `maxPointsValue` | IDR amount, not points | ❌ Unit mismatch |

**Specific bugs:**

### 03a — `account/points/page.tsx:69` shows wrong redeemable value
```ts
// WRONG: shows IDR 100,000 for 100 pts
~{formatIDR((data?.balance || 0) * 1000)} bisa ditukarkan

// CORRECT:
~{formatIDR((data?.balance || 0) * 10)} bisa ditukarkan
```

### 03b — `handlePointsToggle` compares IDR to points (unit mismatch)
```ts
// Line 343-346 — WRONG
const maxPointsValue = Math.floor((subtotal - couponDiscount) * 0.5); // This is IDR
const maxPoints = Math.min(pointsBalance, maxPointsValue); // Compares pts to IDR!
const pointsToUse = Math.floor(maxPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
```

**Correct logic:**
```ts
const maxPointsInIDR = Math.floor((subtotal - couponDiscount) * 0.5);
const maxPointsFromIDR = Math.floor(maxPointsInIDR / 10); // Convert IDR to points (1pt = 10 IDR)
const maxPoints = Math.min(pointsBalance, maxPointsFromIDR);
const pointsToUse = Math.floor(maxPoints / POINTS_MIN_REDEEM) * POINTS_MIN_REDEEM; // Round to min 100
updateForm({ pointsUsed: pointsToUse });
```

### 03c — `pointsDiscount` on checkout page is the same formula issue
```ts
// Line 224-226 — verify POINTS_VALUE_IDR value and fix:
const pointsDiscount = usePoints && formData.pointsUsed > 0
  ? formData.pointsUsed * 10  // 1 point = IDR 10
  : 0;
```

---

## BUG 04 🟠 — Checkout page silently 403's when fetching store hours (admin-only endpoint)

**File:** `app/(store)/checkout/page.tsx` lines 191–205  
**Endpoint:** `GET /api/admin/settings` requires `superadmin` or `owner` role.  
Any customer (or unauthenticated user) hitting this returns 403. The `catch` block only handles network errors — a non-2xx response is not thrown and `json.success` check also fails silently. Store hours always show hardcoded defaults.

**Fix:** Create a public settings endpoint `/api/settings/public?keys=...` that only exposes non-sensitive settings (store hours, WhatsApp number, etc.), OR pre-fetch store hours server-side via a server component wrapper.

**Quick fix for checkout page:**
```ts
const res = await fetch('/api/admin/settings?keys=store_open_days,store_opening_hours');
if (!res.ok) return; // 403 fails silently
const json = await res.json();
```
→ Change to use a new `/api/public/settings` route that requires no auth for specific allowed keys.

---

## BUG 05 🟡 — buy_x_get_y coupon: free item silently fails if all variants already in cart

**File:** `app/api/checkout/initiate/route.ts` lines 249–254  
```ts
const cartVariantIds = new Set(items.map((i) => i.variantId));
const eligibleVariants = qualifyingVariants.filter((v) => !cartVariantIds.has(v.id));
const selectedVariants = eligibleVariants.slice(0, getQty);
```
If the user has all variants of the qualifying product in cart, `eligibleVariants` is empty. The order succeeds with no free items added, but the user was shown a success message that they qualified. No error is returned.

**Fix:** If `selectedVariants.length < getQty`, either:
1. Allow the free item to be added as a duplicate (unitPrice = 0), or  
2. Return a conflict error explaining the free item couldn't be added.

The PRD says "free item is lowest-priced variant in qualifying product" — if all variants are in cart, pick the lowest-priced variant regardless of whether it's in the cart and add it with unitPrice = 0.

---

## BUG 06 🟡 — Points reversal in cancel-expired-orders cron uses wrong sign + wrong type

**File:** `app/api/cron/cancel-expired-orders/route.ts` lines 91–100  
```ts
await tx.insert(pointsHistory).values({
  userId: order.userId,
  type: 'expire',           // WRONG: should be 'redeem' reversal or new 'reversal' type
  pointsAmount: -order.pointsUsed,  // WRONG: negative means deduction; reversal should be positive
  ...
});
```

Compare with the webhook handler (`app/api/webhooks/midtrans/route.ts` lines 287–317) which correctly:
1. Finds specific redeem records by `orderId`
2. Unconsumes the referenced earn records (`consumedAt = null`)
3. Restores balance

The cancel-expired-orders cron only restores balance but doesn't unconsume earn records → FIFO is broken for future redemptions. Also the history entry shows a negative number (looks like a deduction) in the UI when the user expects to see points returned.

**Fix:** Apply the same FIFO logic as the webhook cancel handler:
```ts
// 1. Find redeem records for this order
const redeemRecords = await tx.select().from(pointsHistory)
  .where(and(
    eq(pointsHistory.userId, order.userId),
    eq(pointsHistory.type, 'redeem'),
    eq(pointsHistory.orderId, order.id)
  ));

// 2. Unconsume referenced earn records
for (const redeem of redeemRecords) {
  if (redeem.referencedEarnId) {
    await tx.update(pointsHistory)
      .set({ consumedAt: null })
      .where(eq(pointsHistory.id, redeem.referencedEarnId));
  }
}

// 3. Restore balance
await tx.update(users)
  .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
  .where(eq(users.id, order.userId));

// 4. Log as positive return (history)
// Don't insert a new record for the reversal — the redeem records remain with orderId context
```

---

## BUG 07 🟡 — Reconcile cron: cancellation points reversal doesn't unconsume earn records

**File:** `app/api/cron/reconcile-payments/route.ts` lines 176–198  
Same pattern as BUG 06. The reconcile cron restores balance but doesn't unconsume the FIFO earn records. The `type: 'expire'` used in reconcile is also semantically wrong for a payment cancellation.

**Fix:** Same as BUG 06 — apply full FIFO reversal from the webhook handler.

---

## BUG 08 🟡 — Checkout failed page restores cart items with stock: 0 → addItem may be blocked

**File:** `app/(store)/checkout/failed/page.tsx` line 69  
```ts
addItem({
  ...item,
  stock: 0,  // Restored with stock=0
});
```
If the cart store's `addItem` checks stock before adding (it shouldn't add if stock=0), items won't be restored. Verify `cart.store.ts` — if `addItem` validates `stock > 0`, the retry fails silently.

**Fix:** Fetch current stock from the product variant before restoring, or set a placeholder high value and let checkout validation catch real stock issues:
```ts
addItem({
  ...item,
  stock: 999, // Will be validated at checkout initiate anyway
});
```

---

## BUG 09 🟡 — Pending page shows hardcoded "15 menit" text instead of dynamic expiry

**File:** `app/(store)/checkout/pending/page.tsx` line 130  
```tsx
Harap selesaikan pembayaran sebelum 15 menit dari sekarang.
```
The actual expiry is shown correctly via `orderDetails.paymentExpiresAt` (line 166) but the text above is hardcoded. If admin changes `payment_expiry_minutes` in settings, the text is wrong.

**Fix:**
```tsx
// Replace hardcoded text with dynamic countdown or just remove the absolute "15 menit" claim
{orderDetails?.paymentExpiresAt
  ? `Batas waktu pembayaran: ${formatWIB(new Date(orderDetails.paymentExpiresAt))}`
  : 'Harap selesaikan pembayaran sebelum batas waktu yang ditentukan.'
}
```

---

## BUG 10 🟡 — Checkout initiate: coupon per-user limit only checked for logged-in users, but guest users bypass

**File:** `app/api/checkout/initiate/route.ts` lines 345–356  
The per-user coupon limit check requires `userId`. Guests (`userId = null`) bypass this check entirely. If `maxUsesPerUser = 1`, a guest can use the same coupon email multiple times by staying as a guest.

**Fix:** For guest users, check per-email instead of per-userId when `coupon.maxUsesPerUser` is set:
```ts
if (coupon && coupon.maxUsesPerUser) {
  const checkId = userId ?? null;
  const checkEmail = !userId ? recipientEmail?.toLowerCase() : null;
  
  const usageCount = await db.select({ count: sql<number>`count(*)::int` })
    .from(couponUsages)
    .where(and(
      eq(couponUsages.couponId, coupon.id),
      checkId ? eq(couponUsages.userId, checkId)
               : eq(couponUsages.guestEmail, checkEmail!) // Add guestEmail column or use orders join
    ));
  
  if ((usageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
    return conflict('Kupon ini sudah digunakan maksimal yang diizinkan');
  }
}
```

---

## MISSING FEATURE 01 🔵 — Checkout success page: points shown before webhook fires

**File:** `app/(store)/checkout/success/page.tsx` lines 22–39  

The success page queries `/api/orders/${orderNumber}` immediately. But at this point the Midtrans webhook may not have fired yet (webhook is async). The order is still `pending_payment`, `pointsEarned` is set on the order record but has NOT been credited to the user balance yet.

So the message `+{orderData.order.pointsEarned} poin sudah masuk ke akun kamu` is a lie — points aren't in the account until settlement webhook fires.

**Fix:** Change the text to future tense:
```tsx
<p className="text-xs text-text-secondary mt-1">
  Akan ditambahkan ke akun setelah pembayaran dikonfirmasi
</p>
```
Or only show the points message if `order.status === 'paid'`.

---

## MISSING FEATURE 02 🔵 — No Midtrans onPending/onError/onClose callbacks handled

**File:** `app/(store)/checkout/page.tsx` lines 768–775  
```tsx
<MidtransPayment
  snapToken={snapToken}
  callbacks={{
    onSuccess: handleMidtransSuccess,
    // Missing: onPending, onError, onClose
  }}
/>
```
When the user closes the Midtrans snap without paying (onClose), nothing happens. The user is stuck on the payment step with an active snap token. Should redirect to `/checkout/pending?order=${orderNumber}` on onPending, and stay on current step (reset loading) on onClose/onError.

**Fix:**
```ts
callbacks={{
  onSuccess: handleMidtransSuccess,
  onPending: () => router.push(`/checkout/pending?order=${orderNumber}`),
  onError: () => {
    setSnapToken(null);
    setIsLoading(false);
    toast.error('Pembayaran gagal. Silakan coba lagi.');
  },
  onClose: () => {
    setSnapToken(null);
    setIsLoading(false);
  },
}}
```
