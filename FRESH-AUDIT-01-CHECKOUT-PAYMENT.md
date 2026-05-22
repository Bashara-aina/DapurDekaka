# FRESH AUDIT 01 — Checkout, Payment, Cart & Coupons
> Deep code-level audit — May 2026. Use this file directly in Cursor to fix each bug.
> Every bug references the exact file path and the specific code that is wrong.

---

## BUG-01 — Cart restoration on checkout failure uses wrong data path
**File:** `app/(store)/checkout/failed/page.tsx`  
**Severity:** HIGH — users lose their cart after a failed payment

**What's wrong:**  
When checkout fails, the page tries to restore cart items from the server response. The data path is `data.data?.order?.items` but the checkout initiate API returns items at `data.data?.items` (not nested under `order`).

**Fix:**  
Find the cart restoration logic and change:
```ts
// WRONG
const items = data.data?.order?.items

// CORRECT  
const items = data.data?.items
```

---

## BUG-02 — Points redeem record created with `orderId: null` at checkout initiate
**File:** `app/api/checkout/initiate/route.ts`  
**Severity:** CRITICAL — points used at checkout can never be reversed on payment failure/cancellation

**What's wrong:**  
When a user redeems points at checkout, the `pointsHistory` redeem record is inserted *before* the order row exists (or with `orderId: null`). When the webhook or cancel-expired-orders cron tries to reverse the redemption, it looks for:
```ts
eq(pointsHistory.orderId, order.id)
```
It finds nothing because `orderId` is null. Points are permanently consumed even if the order is never paid.

**Fix:**  
In `checkout/initiate/route.ts`, inside the transaction:
1. Insert the order row FIRST and capture `newOrder.id`  
2. Insert the `pointsHistory` redeem record AFTER, using `orderId: newOrder.id`

```ts
// Step 1: Create order
const [newOrder] = await tx.insert(orders).values({ ... }).returning();

// Step 2: Insert redeem record WITH orderId
if (data.pointsUsed > 0) {
  await tx.insert(pointsHistory).values({
    userId: session.user.id,
    type: 'redeem',
    pointsAmount: -data.pointsUsed,
    pointsBalanceAfter: newPointsBalance,
    orderId: newOrder.id,  // <-- THIS MUST BE SET
    descriptionId: `Poin digunakan untuk pesanan ${newOrder.orderNumber}`,
    descriptionEn: `Points redeemed for order ${newOrder.orderNumber}`,
  });
}
```

---

## BUG-03 — Per-user coupon limit bypassed at checkout initiate
**File:** `app/api/checkout/initiate/route.ts`  
**Severity:** HIGH — users can use the same coupon unlimited times even if `maxUsesPerUser` is set

**What's wrong:**  
`app/api/coupons/validate/route.ts` correctly checks `maxUsesPerUser` before returning the coupon as valid. But `app/api/checkout/initiate/route.ts` re-validates the coupon independently and does NOT perform the `maxUsesPerUser` check. A determined user can bypass the limit by skipping the validate endpoint and going directly to initiate.

**Fix:**  
In `checkout/initiate/route.ts`, in the coupon validation section, add the per-user usage check after confirming the coupon is valid:
```ts
if (coupon.maxUsesPerUser && userId) {
  const userUsageCount = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(couponUsages)
    .where(and(
      eq(couponUsages.couponId, coupon.id),
      eq(couponUsages.userId, userId)
    ));
  if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
    return badRequest('Kamu sudah mencapai batas penggunaan kupon ini');
  }
}
```

---

## BUG-04 — Guest checkout has no idempotency — double-click creates two orders
**File:** `app/api/checkout/initiate/route.ts`  
**Severity:** HIGH — accidental double submission charges the customer twice

**What's wrong:**  
For logged-in users, there may be a check for duplicate in-progress orders. For guests (no `session.user.id`), there is NO deduplication. A fast double-click on the checkout button sends two identical requests, both succeed, and the customer gets two Midtrans payment links for the same cart.

**Fix:**  
Option A (simplest): On the checkout page client, disable the submit button immediately on first click and re-enable only on error response.

Option B (server): Before inserting the order, check if a `pending_payment` order already exists with the same `recipientEmail` + items subtotal + `createdAt > now - 30 seconds`. If found, return the existing order instead of creating a new one.

Option C: Add a client-generated idempotency key (UUID stored in sessionStorage) sent as a header, and deduplicate on the server by that key.

**Recommended:** Option A for immediate fix, Option C for robustness.

---

## BUG-05 — Midtrans webhook: B2B users earn 4x points instead of 2x
**File:** `app/api/webhooks/midtrans/route.ts`  
**Severity:** HIGH — B2B users get double points every settlement

**What's wrong:**  
At checkout initiate, `pointsEarned` is already calculated with the B2B multiplier (2×). When the Midtrans webhook receives `settlement`, it awards `order.pointsEarned` to the user. But the webhook ALSO applies the B2B multiplier again:
```ts
// In webhook handler (settlement branch)
const multiplier = order.isB2b ? 2 : 1;
const earned = order.pointsEarned * multiplier; // WRONG: already multiplied
```
Result: B2B users get 4× points.

**Fix:**  
In the webhook handler, remove the multiplier — use `order.pointsEarned` directly since it was already computed at initiate time:
```ts
const earned = order.pointsEarned; // already has B2B 2x baked in from initiate
```
Verify by grepping for `isB2b` in `webhooks/midtrans/route.ts` and removing the secondary multiplication.

---

## BUG-06 — Checkout success page: points earned display is stub / never populated
**File:** `app/(store)/checkout/success/page.tsx`  
**Severity:** MEDIUM — misleading UX, user doesn't know how many points they earned

**What's wrong:**  
The success page fetches the order but the `pointsEarned` field is either not included in the API response or the UI conditionally renders `undefined`. The points earned banner shows 0 or is hidden.

**Fix:**  
Ensure `/api/orders/[orderNumber]` GET includes `pointsEarned` in the minimal (unverified) response shape, AND that the success page reads `order.pointsEarned` correctly. The success page should show:
```tsx
{order.pointsEarned > 0 && (
  <div>+{order.pointsEarned} poin didapat!</div>
)}
```

---

## BUG-07 — Coupon `free_shipping` type not handled in total calculation
**File:** `app/api/checkout/initiate/route.ts` and `app/(store)/checkout/page.tsx`  
**Severity:** MEDIUM — free_shipping coupons silently do nothing

**What's wrong:**  
The coupon service handles `percentage`, `fixed`, and `buy_x_get_y` types. When type is `free_shipping`, the discount calculation returns `discountAmount = 0` because the code only checks:
```ts
if (coupon.type === 'percentage') { ... }
else if (coupon.type === 'fixed') { ... }
// free_shipping falls through with 0 discount
```

**Fix:**  
In the coupon discount calculation function, add:
```ts
else if (coupon.type === 'free_shipping') {
  discountAmount = shippingCost; // zero out the shipping cost
}
```
Also update the checkout page's client-side total preview to reflect this.

---

## BUG-08 — Pending payment page expiry countdown never auto-cancels locally
**File:** `app/(store)/checkout/pending/page.tsx`  
**Severity:** LOW — UX issue, countdown reaches 0 but page doesn't redirect

**What's wrong:**  
The pending payment page shows a countdown to `paymentExpiresAt`. When the countdown reaches zero, the page should redirect to `/checkout/failed` or show a "payment expired" state. Currently it just shows "00:00" and stays on the page.

**Fix:**  
In `checkout/pending/page.tsx`, in the countdown `useEffect`, when `timeLeft <= 0`:
```ts
if (timeLeft <= 0) {
  router.push(`/checkout/failed?orderNumber=${orderNumber}`);
  return;
}
```

---

## BUG-09 — Cart validate API: items with 0 available stock show as valid
**File:** `app/api/cart/validate/route.ts`  
**Severity:** MEDIUM — items appear available when they're sold out

**What's wrong:**  
The cart validation returns `available: true` for items where `stock >= 1`, but it does not check `isActive`. An inactive variant with stock > 0 will appear as available in the cart.

**Fix:**  
In `/api/cart/validate/route.ts`, add `isActive` check:
```ts
where: and(
  inArray(productVariants.id, variantIds),
  eq(productVariants.isActive, true)  // Add this
)
```

---

## BUG-10 — Checkout page: no loading state on form submit button during API call
**File:** `app/(store)/checkout/page.tsx`  
**Severity:** LOW — UX, contributes to double-submit (BUG-04)

**What's wrong:**  
The checkout form submit button doesn't disable/show loading state while the initiate API call is in flight. This is a contributing factor to duplicate order creation.

**Fix:**  
Add `disabled={isSubmitting}` and a spinner to the checkout submit button. Set `isSubmitting = true` before the fetch call and `false` in the finally block.

---

## BUG-11 🚨 CRITICAL — Stock is NEVER decremented — unlimited overselling possible
**File:** `app/api/webhooks/midtrans/route.ts` (settlement branch, ~lines 128–144)  
**Severity:** P0 — any product can be oversold infinitely; cancellations inflate stock further.

**What's wrong:**  
The settlement webhook creates an `inventoryLog` of type `'sale'`, but NEVER executes an actual `UPDATE productVariants SET stock = stock - quantity`. The stock column on `productVariants` is never touched after checkout.

Meanwhile, the cancellation paths (webhook cancel handler AND `app/api/cron/cancel-expired-orders/route.ts`) DO run:
```ts
.set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
```
On stock that was never decremented — so every cancellation permanently inflates stock counts. Over time, stock numbers become meaninglessly large.

**Fix — in `app/api/webhooks/midtrans/route.ts` settlement branch, inside the transaction:**
```ts
// After creating inventoryLog entries, add stock decrement:
for (const item of order.items) {
  await tx
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
    .where(eq(productVariants.id, item.variantId));
}
```

**Fix — in cancellation paths (webhook cancel + cron cancel):**  
Keep the `stock + quantity` restoration, but ONLY run it if there's a corresponding `inventoryLog` of type `'sale'` for that order. Without the guard, cancelled-before-payment orders will inflate stock.
```ts
// Check if stock was ever decremented for this order:
const salesLogs = await tx.query.inventoryLogs.findMany({
  where: and(eq(inventoryLogs.orderId, order.id), eq(inventoryLogs.type, 'sale')),
});
if (salesLogs.length > 0) {
  // Only then restore stock
  for (const item of order.items) { ... }
}
```

---

## BUG-12 🚨 CRITICAL — Net-30 B2B checkout crashes: `order` referenced before assignment
**File:** `app/api/checkout/initiate/route.ts` ~line 606  
**Severity:** P0 — every Net-30 B2B order crashes at checkout initiation.

**What's wrong:**  
Inside the `db.transaction()` callback, the inserted order is returned as `created` (from the `.returning()` call). The variable `order` is only assigned AFTER the transaction block ends (~line 666). Inside the transaction, when building the `pointsHistory` record for Net-30 orders, the code references `order.pointsEarned`:

```ts
// INSIDE the transaction (WRONG - order is undefined here):
pointsEarned: order.pointsEarned,

// order is only assigned AFTER the transaction:
const order = created; // line ~666
```

This throws `TypeError: Cannot read properties of undefined (reading 'pointsEarned')`, causing every Net-30 B2B checkout to fail with a 500 error.

**Fix:**  
```ts
// CHANGE (inside transaction body):
pointsEarned: order.pointsEarned,

// TO:
pointsEarned: created.pointsEarned,
```

Grep in `app/api/checkout/initiate/route.ts` for all occurrences of `order.` inside the transaction callback and confirm they all reference the correct in-scope variable.
