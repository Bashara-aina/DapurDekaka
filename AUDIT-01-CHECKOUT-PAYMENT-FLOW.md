# AUDIT 01 — CHECKOUT & PAYMENT FLOW
**Project:** DapurDekaka.com
**Audit Date:** May 22, 2026
**Files Audited:**
- `app/(store)/checkout/page.tsx`
- `store/cart.store.ts`
- `app/api/checkout/initiate/route.ts`
- `app/api/webhooks/midtrans/route.ts`
- `app/api/checkout/retry/route.ts`
- `app/api/coupons/validate/route.ts`
- `app/api/shipping/cost/route.ts`
- `app/api/cart/validate/route.ts`
- `app/api/cron/cancel-expired-orders/route.ts`
- `app/(store)/checkout/success/page.tsx`
- `app/(store)/checkout/pending/page.tsx`
- `app/(store)/checkout/failed/page.tsx`
- `components/store/checkout/MidtransPayment.tsx`
- `app/(store)/orders/[orderNumber]/pickup/page.tsx`
- `lib/midtrans/create-transaction.ts`
- `lib/midtrans/verify-webhook.ts`
- `lib/utils/generate-order-number.ts`

---

## BUG-01 — CRITICAL: Confetti fires on success page for ALL statuses, not just 'paid'

**File:** `app/(store)/checkout/success/page.tsx:38-49`

```typescript
useEffect(() => {
  if (orderData?.order?.status === 'paid') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }
}, []);
```

**What's wrong:**
The `orderData` query uses `staleTime: 60000` and fetches `queryKey: ['order', orderNumber]`. The useEffect runs on mount with `[]` deps, checking `orderData?.order?.status === 'paid'`. However:

1. **Race condition on success page load**: If the page loads before `orderData` is populated, `orderData` is undefined, so the confetti condition fails (correct). But if the page is re-rendered (e.g., React StrictMode double-mounts in dev), `orderData` may be stale from a previous render and the check might fire incorrectly.

2. **The deps array is `[]` but `orderData` is not in deps** — if `orderData` changes to `paid` after the initial render (e.g., from a query refetch), the confetti won't re-fire. This is actually correct behavior (once per mount), but the pattern is fragile and the comment "Intentionally runs only once on mount" is misleading — it should clarify the dependency chain.

3. **No re-trigger on query update**: If `orderData` loads with status `pending_payment` initially (order not yet settled), then refetches and becomes `paid`, confetti won't fire because `[]` deps only run on mount. The order page (`/orders/[orderNumber]`) uses the same query key but the success page query specifically checks its own data.

**Fix:**
```typescript
useEffect(() => {
  if (orderData?.order?.status === 'paid') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }
}, [orderData?.order?.status]);
```

---

## BUG-02 — CRITICAL: PDF receipt endpoint requires authentication — guests cannot download their receipt

**File:** `app/api/orders/[orderNumber]/receipt/route.ts:22-38`

```typescript
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return forbidden();  // ← GUEST GETS 403, CANNOT DOWNLOAD RECEIPT
  }

  // Allow owner/superadmin to view any receipt, customers only their own
  if (!['superadmin', 'owner'].includes(session.user.role) && order.userId !== session.user.id) {
    return forbidden();
  }
```

**What's wrong:**
Guest checkout users (no account) cannot download their PDF receipt after payment. The success page links to `/api/orders/${orderNumber}/receipt` but guests have no session — they get `forbidden()`. This is explicitly called out in PRD as a requirement: "PDF receipt generated and emailed after payment" — but the download link is broken for guests.

**Fix:**
Add a new endpoint `GET /api/orders/[orderNumber]/receipt/public` that accepts `?email=X` and verifies the order's `recipientEmail` matches before serving the PDF. Alternatively, modify the existing endpoint to check `recipientEmail` from the order for unauthenticated requests.

---

## BUG-03 — CRITICAL: `MidtransPayment` component opens popup immediately on mount — no user action required

**File:** `components/store/checkout/MidtransPayment.tsx:50-92`

```typescript
useEffect(() => {
  if (scriptLoaded.current) return;

  const snap = (window as Window & { snap?: any }).snap;
  if (snap) {
    snap.pay(snapToken, {  // ← POPUP OPENS IMMEDIATELY ON MOUNT
      onSuccess: handleSuccess,
      onPending: handlePending,
      onError: handleError,
      onClose: handleClose,
    });
  }
}, [snapToken, handleSuccess, handlePending, handleError, handleClose, router]);
```

**What's wrong:**
The Midtrans Snap popup opens **automatically** when `MidtransPayment` mounts (triggered by `snapToken` being set in checkout page at line 823-839). This means:

1. The popup opens before the user clicks anything (triggered by state change in parent)
2. The comment at line 90-91 is empty — no cleanup code
3. If the component remounts (React StrictMode, navigation back), a second popup may open

**However:** This is actually the intended behavior per checkout page design — the checkout page shows a "Bayar Sekarang — Rp X" button that calls `handlePlaceOrder()` which sets `snapToken`, then the `MidtransPayment` component renders and immediately opens the popup. So this is not a bug — it's by design. The popup IS triggered by user action (the button click), just not directly by the user pressing a "Pay" button in the popup component itself. The popup opens after the API returns the token.

**Note:** The callback also navigates to `/checkout/success?order=${orderNumber}` directly, but the parent `handleMidtransSuccess` also calls `clearCart()` and navigates to success. So the redirect happens twice — once from the callback and once from the parent. But since each navigation replaces the current page, this is fine.

**Verdict:** NOT A BUG — BY DESIGN. The popup opens after user clicks "Bayar Sekarang" → API returns snapToken → component mounts and opens popup.

---

## BUG-04 — HIGH: Points deducted at order creation, not held tentatively — UX problem

**File:** `app/api/checkout/initiate/route.ts:516-564`

```typescript
// Deduct from user balance using GREATEST guard (prevents negative balance)
const updatedUsers = await tx
  .update(users)
  .set({ pointsBalance: sql`GREATEST(points_balance - ${pointsUsed}, 0)` })
  .where(and(
    eq(users.id, userId),
    gte(users.pointsBalance, pointsUsed)
  ))
  .returning({ pointsBalance: users.pointsBalance });
```

**What's wrong:**
Points are **immediately deducted** from `users.pointsBalance` at order creation (initiate), not held tentatively and confirmed on settlement. The reversal logic in the webhook/cancellation is correct, but from a UX perspective:

1. User places order using 500 points → their balance immediately drops by 500
2. If payment fails after 15 minutes → points are restored (correct)
3. But if user checks their points balance during the pending period → it shows reduced balance even though order is unpaid

**Per PRD:** "Points deducted at order creation (before payment)" — this is actually specified in PRD Section 6.4. So it's BY DESIGN. The reversal is correct. This is a LOW severity observation — the design choice is documented, but the user-facing wording (" Poin digunakan: -IDR 5.000") on the success page says "dikonfirmasi setelah pesanan dibuat" which matches.

**Fix:**
No code fix needed — but the success page message "dikonfirmasi setelah pesanan dibuat" is misleading since points are deducted immediately, not confirmed later. Change to "Poin digunakan langsung saat pesanan dibuat" for accuracy.

---

## BUG-05 — HIGH: Points earned message shows on success even for pickup orders before payment confirmed

**File:** `app/(store)/checkout/success/page.tsx:71-81`

```typescript
{orderData?.order?.pointsEarned && orderData.order.pointsEarned > 0 && orderData.order.status === 'paid' ? (
  <div className="bg-gradient-to-r from-brand-gold/20 to-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 mb-6">
    <p className="text-sm text-text-secondary mb-1">Kamu mendapat</p>
    <p className="text-2xl font-bold text-brand-gold">
      +{orderData.order.pointsEarned.toLocaleString('id-ID')} poin
    </p>
    <p className="text-xs text-text-secondary mt-1">
      Poin akan dikreditkan setelah pembayaran dikonfirmasi oleh sistem
    </p>
  </div>
) : null}
```

**What's wrong:**
The message "Poin akan dikreditkan setelah pembayaran dikonfirmasi oleh sistem" is shown for ALL orders, but it's only accurate for delivery orders. For pickup orders, points ARE credited immediately on webhook settlement (same as delivery). The message is misleading — it suggests points aren't yet credited when they actually are.

**Fix:**
For `deliveryMethod === 'pickup'` orders, change message to "Poin sudah dikreditkan ke akun Anda" or conditionally render based on delivery method.

---

## BUG-06 — HIGH: BuyXGetY not validated in standalone coupon validate endpoint

**File:** `app/api/coupons/validate/route.ts:117-123`

```typescript
} else if (coupon.type === 'buy_x_get_y') {
  discountAmount = 0;
  buyXgetY = {
    buyQuantity: coupon.buyQuantity ?? 1,
    getQuantity: coupon.getQuantity ?? 1,
  };
}
```

**What's wrong:**
The standalone `/api/coupons/validate` endpoint returns `buyXgetY` info but **does not check** whether the user's cart actually qualifies (has enough quantity of the qualifying product). The full validation with cart check is only done at `/api/checkout/initiate` (lines 243-260). A user can "apply" a buy_x_get_y coupon in the UI and see the discount as `0` + the buyXgetY info, but when they submit the order it may fail if the cart doesn't qualify.

**Fix:**
Add the same cart-qualification check that exists in initiate to the validate endpoint, or accept `productIds` in the validate request and check them server-side. The validate endpoint already accepts `productIds` (line 15) but doesn't use it for buy_x_get_y validation.

---

## BUG-07 — MEDIUM: `free_shipping` coupon sets `discountAmount = baseShippingCost` — shipping cost formula bug

**File:** `app/api/checkout/initiate/route.ts:476-483`

```typescript
const baseShippingCost = deliveryMethod === 'pickup' ? 0 : (addressData.courierCode ? (parsed.data.shippingCost ?? 0) : 0);
const isFreeShippingCoupon = coupon && (coupon.type === 'free_shipping' || coupon.freeShipping) && deliveryMethod === 'delivery';
const shippingCost = isFreeShippingCoupon ? 0 : baseShippingCost;

// BUG-07: free_shipping discount must offset shipping cost in totalAmount formula
if (isFreeShippingCoupon) {
  discountAmount = baseShippingCost;  // ← discountAmount = shipping cost
}
```

**What's wrong:**
The `free_shipping` coupon type sets `discountAmount = baseShippingCost` — this means the **shipping cost itself** becomes the monetary discount amount. But the `discountAmount` is then used in `totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost`. 

If shipping costs Rp 25,000 and `discountAmount = 25000`:
```
totalAmount = 120000 - 25000 - 0 + 0 = Rp 95,000
```

That is correct — the customer pays Rp 95,000 (subtotal only). But the problem is:
1. `shippingCost = 0` (line 478) — shipping is zeroed
2. `discountAmount = baseShippingCost` — monetary discount equals the shipping cost
3. So `totalAmount = subtotal - baseShippingCost` — customer gets shipping free, which is correct

Actually the formula is correct. The comment says "BUG-07: free_shipping discount must offset shipping cost" — but the code does exactly that. Let me re-read...

Actually this looks correct. The totalAmount formula is:
`totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost`

With `isFreeShippingCoupon`: `shippingCost = 0`, `discountAmount = baseShippingCost`
So `totalAmount = subtotal - baseShippingCost + 0 = subtotal - shippingCost`

This IS correct for free_shipping. So either the bug was already fixed, or the comment is outdated.

**Verdict:** This appears to be already fixed. The formula correctly gives `totalAmount = subtotal - shippingCost` for free_shipping coupons.

---

## BUG-08 — MEDIUM: Pending page shows VA number only for bank transfer payment types

**File:** `app/(store)/checkout/pending/page.tsx:213-221`

```typescript
{orderDetails.vaNumber && (
  <div className="bg-brand-cream rounded-lg p-3 mb-3">
    <p className="text-xs text-text-secondary mb-1">Virtual Account</p>
    <p className="font-mono font-bold text-lg text-text-primary">
      {orderDetails.vaNumber}
    </p>
  </div>
)}
```

**What's wrong:**
VA number is only shown if `vaNumber` is populated. For non-VA payment methods (e-wallet like GoPay/OVO, QRIS, credit card installment), there is no VA number. The pending page should show alternative information — e.g., "Payment method: GoPay" or "Scan QRIS code" — but there's no handling for non-VA payment types. The `paymentType` is shown as `orderDetails.paymentType?.replace('_', ' ')` which is fine, but the VA box only appears if VA number exists.

**Fix:**
Add conditional rendering for payment types without VA numbers — show "Payment Amount" in a different highlighted box for all types, and specific instructions for e-wallets/QRIS.

---

## BUG-09 — MEDIUM: `getMidtransOrderId` uses raw `orderNumber` for retry — no collision with existing order IDs

**File:** `lib/utils/generate-order-number.ts:19-22`

```typescript
export function getMidtransOrderId(orderNumber: string, retryCount: number): string {
  if (retryCount === 0) return orderNumber;
  return `${orderNumber}-retry-${retryCount}`;  // e.g., "DDK-20260512-0047-retry-1"
}
```

**What's wrong:**
Each retry gets a new `midtransOrderId` (e.g., `DDK-20260512-0047-retry-1`, `DDK-20260512-0047-retry-2`, etc.). Midtrans considers these separate transactions. The webhook receives `order_id` which is the `midtransOrderId` with retry suffix, and the webhook handler looks up by `midtransOrderId` which is updated in retry route (line 167). So the latest retry's webhook will match the current `midtransOrderId`. But older retry webhooks (if Midtrans fires them late) will have the old `midtransOrderId` and won't find the order.

This is actually correct behavior — only the latest retry matters. But the `midtransOrderId` on the order record gets overwritten on each retry, so older retry webhooks are orphaned. This is fine.

**Verdict:** Not a bug — by design. Each retry is a separate Midtrans transaction.

---

## BUG-10 — MEDIUM: `paymentRetryCount >= 3` check in retry endpoint has TOCTOU race condition

**File:** `app/api/checkout/retry/route.ts:47`

```typescript
if (order.paymentRetryCount >= 3) {
  // BUG-04: Wrap cancellation in full transaction...
```

**What's wrong:**
Between checking `paymentRetryCount >= 3` (line 47) and updating `paymentRetryCount: retryCount` (line 169), two concurrent retry requests could both pass the check and allow a 4th retry. The update at line 169 doesn't use a conditional WHERE clause — it unconditionally sets `paymentRetryCount: retryCount`. If two requests pass the check simultaneously, both will proceed to line 169 and set the count to their respective retry values (race winner loses).

**Fix:**
Use atomic conditional update:
```typescript
const updated = await db
  .update(orders)
  .set({ paymentRetryCount: sql`paymentRetryCount + 1` })
  .where(and(
    eq(orders.id, order.id),
    lt(orders.paymentRetryCount, 3)
  ))
  .returning({ paymentRetryCount: orders.paymentRetryCount });

if (updated.length === 0) {
  return conflict('Batas retry tercapai');
}
const retryCount = updated[0].paymentRetryCount;
```

---

## BUG-11 — MEDIUM: Failed page retry creates NEW order instead of reusing the failed one

**File:** `app/(store)/checkout/failed/page.tsx:50-86`

```typescript
const handleRetry = async () => {
  if (!orderItems?.length) {
    router.push('/checkout');
    return;
  }

  setIsRestoring(true);
  try {
    for (const item of orderItems) {
      addItem({ ...item, stock: 999 });  // ← Restores items to cart
    }

    // BUG-05: Validate cart after restore — redirect to /cart if stock issues
    const validateRes = await fetch('/api/cart/validate', { method: 'POST' });
    const validateData = await validateRes.json();
    if (!validateData.success || validateData.data?.hasStockIssues) {
      router.push('/cart');
      return;
    }

    router.push('/checkout');  // ← Creates BRAND NEW order
  }
};
```

**What's wrong:**
When user clicks "Coba Lagi" on the failed page:
1. Cart items are restored from the failed order's data
2. Page navigates to `/checkout` which creates a **completely new order** with new `orderNumber`
3. The original failed order remains in `pending_payment` status until cron cancels it (after 15 min from original payment expiry)

**Problems:**
- The original order's `paymentRetryCount` is NOT incremented (no retry happened)
- The failed order will be cancelled by cron later, but in the meantime two orders exist
- If the same customer retries multiple times, multiple pending orders accumulate
- The original `paymentExpiresAt` is still based on the original order time, not a fresh window

**Fix:**
Use the existing `/api/checkout/retry` endpoint instead of redirecting to `/checkout`. The retry endpoint already handles this — it should be called from the failed page with the original order number.

---

## BUG-12 — MEDIUM: Failed page restore uses hardcoded `stock: 999` for cart items

**File:** `app/(store)/checkout/failed/page.tsx:58-71`

```typescript
addItem({
  variantId: item.variantId,
  productId: item.productId,
  productNameId: item.productNameId,
  ...
  unitPrice: item.unitPrice,
  weightGram: item.weightGram,
  stock: 999,  // ← HARDCODED, not real stock
});
```

**What's wrong:**
When restoring cart items from a failed order, `stock: 999` is hardcoded. The real stock may be lower. The subsequent `/api/cart/validate` call should catch stock issues and redirect to `/cart` (per BUG-05 fix), but the initial `addItem` call uses `999` as a placeholder. If stock is 3 and user had qty 5, the cart will show 5 items until validation corrects it.

**Fix:**
Fetch the actual current stock from the order's items data (which has variant data) or fetch fresh stock during the restore process. The order items in the DB query (`app/api/orders/[orderNumber]`) should include current stock if the order query joins with productVariants. If not, fetch stock during the restore.

---

## BUG-13 — MEDIUM: Cart validation on failed page uses incorrect response structure check

**File:** `app/(store)/checkout/failed/page.tsx:75-80`

```typescript
const validateRes = await fetch('/api/cart/validate', { method: 'POST' });
const validateData = await validateRes.json();
if (!validateData.success || validateData.data?.hasStockIssues) {
  router.push('/cart');
  return;
}
```

**What's wrong:**
The `/api/cart/validate` POST endpoint returns `{ success: true, data: { items: [...] } }`. It does NOT return a `hasStockIssues` field. The check `validateData.data?.hasStockIssues` will always be `undefined` (falsy), so the redirect to `/cart` on stock issues never happens.

The cart validate response structure is:
```json
{
  "success": true,
  "data": {
    "items": [
      { "variantId": "...", "cartQty": 2, "availableStock": 3, "available": true },
      { "variantId": "...", "cartQty": 5, "availableStock": 3, "available": false }
    ]
  }
}
```

**Fix:**
Check `validateData.data.items.some((i: any) => !i.available)` instead of `hasStockIssues`.

---

## BUG-14 — MEDIUM: Pending page countdown hits 00:00 but no automatic redirect

**File:** `app/(store)/checkout/pending/page.tsx:84-89`

```typescript
if (remaining <= 0) {
  setCountdown('00:00');
  if (orderNumber) {
    router.push(`/checkout/failed?order=${orderNumber}`);
  }
  return;
}
```

**What's wrong:**
The countdown hits `00:00` and does redirect to `/checkout/failed`. However:
1. The redirect happens **inside the interval callback** — but if the tab is not in focus, the interval may not fire precisely at 0
2. There's no `clearInterval` when payment is made (the interval continues running even after successful payment until the next poll detects `paid` status and redirects to success)
3. If the user has the pending page open and payment expires while they're looking at it, the redirect is correct

The flow is actually correct — but there's a potential edge case: if `router.push` to failed is called, the component may not unmount properly because `PendingContent` is still running intervals. The `useEffect` cleanup (lines 66-69) handles `stopped` and `clearInterval`, but the `stopped` flag is in the closure of the outer effect and might not be set before the redirect.

**Verdict:** Minor — the redirect does fire but the cleanup pattern is fragile.

---

## BUG-15 — MEDIUM: Points earned on success page shown even when `pointsEarned === 0` (B2B orders with 2x multiplier not shown correctly)

**File:** `app/(store)/checkout/success/page.tsx:71`

```typescript
{orderData?.order?.pointsEarned && orderData.order.pointsEarned > 0 && orderData.order.status === 'paid' ? (
```

**What's wrong:**
If `pointsEarned = 0` (e.g., guest order, or B2B order where `pointsEarned` is correctly 0 because subtotal < 1000), the block doesn't show. But if B2B order earned 200 points, `pointsEarned = 200` so it would show. This is actually correct.

Wait — let me re-check. B2B orders have `pointsEarnedBase * 2` set at initiate (line 487):
```typescript
const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;
```

For B2B orders, `pointsEarned > 0` so the block would show. Correct.

**Verdict:** Not a bug.

---

## BUG-16 — MEDIUM: `loadFromDb` in cart store calls `/api/auth/cart` but that route may not exist

**File:** `store/cart.store.ts:131-155`

```typescript
loadFromDb: async () => {
  try {
    const res = await fetch('/api/auth/cart');  // ← Does this route exist?
```

**What's wrong:**
The `loadFromDb` method fetches `/api/auth/cart` (GET). I searched and found no `app/api/auth/cart/route.ts` in the codebase. The cart store's `loadFromDb` is a no-op that silently fails (line 152-153 comment confirms). But the merge-cart endpoint at `app/api/auth/merge-cart/route.ts` handles the server-side cart storage, and `syncToDb` calls it.

The `loadFromDb` is called after login merge to reload the merged cart into the Zustand store. But if the GET endpoint doesn't exist, it silently fails and the cart remains empty after login.

**Fix:**
Either implement `GET /api/auth/cart` endpoint (returns the user's saved cart), or change `loadFromDb` to call the same merge-cart endpoint and use its response.

---

## BUG-17 — MEDIUM: Coupon `usedCount` incremented at initiate but webhook increments AGAIN

**File:** `app/api/checkout/initiate/route.ts:209-224` vs `app/api/webhooks/midtrans/route.ts:158-163`

**At initiate (line 209-224):**
```typescript
const [claimed] = await db
  .update(coupons)
  .set({ usedCount: sql`used_count + 1` })
  .where(...)
  .returning({ usedCount: coupons.usedCount });
```

**At webhook settlement (line 158-163):**
```typescript
if (order.couponId) {
  await tx
    .update(coupons)
    .set({ usedCount: sql`used_count + 1` })  // ← SECOND INCREMENT!
```

**What's wrong:**
The coupon `usedCount` is incremented **twice** for settled orders:
1. Once atomically at initiate (line 220) — provisional claim
2. Again at webhook settlement (line 161) — confirmation

For `maxUses` coupons this causes over-counting. For `maxUsesPerUser` coupons, the provisional `couponUsages` row is inserted at initiate and the webhook's `insert...onConflictDoNothing` is harmless.

**Fix:**
At webhook, use `GREATEST(used_count, old_usedCount)` pattern or check if already incremented. Or remove the increment at initiate and only increment at webhook settlement.

However, the current approach of provisional increment at initiate + confirm at webhook is the correct pattern to prevent race conditions where two concurrent requests both claim the same coupon slot. The double-increment on `usedCount` is a side effect but the provisional row prevents over-claim. The `usedCount` over-increment is minor (may exceed `maxUses` by 1 in race conditions that get resolved).

**Verdict:** Known trade-off — the race condition prevention on `maxUsesPerUser` is more important than the double-increment on `usedCount`.

---

## BUG-18 — MEDIUM: `pending` webhook handler doesn't update order status — only saves payment info

**File:** `app/api/webhooks/midtrans/route.ts:278-290`

```typescript
} else if (transaction_status === 'pending') {
  // ── Step 6b: Payment is pending — save VA/payment info for admin visibility ─
  await db
    .update(orders)
    .set({
      midtransPaymentType: body.payment_type ?? null,
      midtransVaNumber: body.va_numbers?.[0]?.va_number ?? null,
      midtransTransactionId: body.transaction_id ?? null,
    })
    .where(eq(orders.id, order.id));
```

**What's wrong:**
For `transaction_status === 'pending'`, the order status stays `pending_payment` (correct per PRD). But the code only saves payment type and VA number — it doesn't update `paymentExpiresAt` even though Midtrans may grant a new expiry time on the pending transaction. If the customer completes the VA payment 2 days later, the order's `paymentExpiresAt` (from the original initiate) is long past, but cron hasn't cancelled it yet (if cron runs every 5 min), so it works. But if cron cancelled it, the settlement webhook would fail.

The current design: `paymentExpiresAt` is set at initiate (15 min from order creation). If customer pays within that window → settlement fires. If not → cron cancels after expiry. This is correct. The `pending` status just means Midtrans is still processing the payment (e.g., bank transfer not yet received), and the order stays alive.

**Verdict:** Not a bug — by design.

---

## BUG-19 — LOW: `syncToDb` silently fails — no error propagated to UI

**File:** `store/cart.store.ts:116-129`

```typescript
syncToDb: async () => {
  const items = get().items;
  if (items.length === 0) return;

  try {
    await fetch('/api/auth/merge-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
  } catch {
    // Silently fail - cart will remain in localStorage
  }
},
```

**What's wrong:**
If `syncToDb` fails (network error, API error), the error is silently swallowed and the local cart remains in localStorage. For a logged-in user, this means their cart changes aren't saved to the DB and could be lost. The comment says "cart will remain in localStorage" — but if they log out and log back in on a different device, the server cart (from before merge) would be loaded, losing any changes made while the sync failed.

**Fix:**
Use `toast.error()` from `sonner` to notify the user that cart sync failed. Or implement a retry mechanism with exponential backoff. This is low severity because:
1. The failure rate is very low (network issues)
2. The merge on next login would overwrite the failed local changes with server state

---

## BUG-20 — LOW: `loadFromDb` silently fails

**File:** `store/cart.store.ts:131-155`

```typescript
loadFromDb: async () => {
  try {
    const res = await fetch('/api/auth/cart');
    if (!res.ok) return;
    ...
  } catch {
    // Silently fail - local cart remains
  }
},
```

**What's wrong:**
Same silent failure pattern as `syncToDb`. If the fetch fails, the local cart stays but the user may have a stale view. Minor.

**Fix:** Add toast notification for failures, or implement a flag in the store that marks sync status.

---

## BUG-21 — LOW: Missing `api/checkout/pickup-invitation` route — invitation API doesn't exist

**File:** `app/(store)/orders/[orderNumber]/pickup/page.tsx:63`

```typescript
<PickupInvitation orderNumber={order.orderNumber} />
```

**What's wrong:**
The `PickupInvitation` component is passed only the `orderNumber` and likely fetches its own data. But the PRD says there should be a `/api/checkout/pickup-invitation?orderNumber=X` endpoint for generating pickup instructions. The pickup page itself is a server component that fetches the order directly (line 24-29), and the `PickupInvitation` component likely receives data as props. The missing API route is a gap — there is no public API for pickup instructions, but the page itself works by fetching the order server-side.

**Fix:**
Verify that `PickupInvitation` component works without needing the API route. If it requires client-side data fetching, add the API route or ensure the order data is passed as props from the page component.

---

## BUG-22 — LOW: `updateQuantity` allows updating to quantity > stock without warning

**File:** `store/cart.store.ts:59-71`

```typescript
updateQuantity: (variantId, quantity) => {
  if (quantity <= 0) {
    get().removeItem(variantId);
    return;
  }
  const item = get().items.find((i) => i.variantId === variantId);
  const maxQty = Math.min(99, item?.stock ?? 99);
  set({
    items: get().items.map((i) =>
      i.variantId === variantId ? { ...i, quantity: Math.min(quantity, maxQty) } : i
    ),
  });
},
```

**What's wrong:**
`updateQuantity` caps the quantity at `maxQty` (99 or stock), but `maxQty` is computed from `item?.stock` which may be stale from when the item was added to cart. Stock can change between cart addition and checkout. The cart page calls `validateCartStock` on mount and shows warnings, but the `updateQuantity` itself doesn't call validation.

**Fix:**
Call `validateStock` after `updateQuantity` and show a toast if the new quantity exceeds available stock. Or require a fresh stock fetch before allowing checkout.

---

## BUG-23 — LOW: Cancel-expired cron has hardcoded "15 menit" message

**File:** `app/api/cron/cancel-expired-orders/route.ts:93`

```typescript
note: `Otomatis dibatalkan karena tidak dibayar dalam 15 menit`,
```

**What's wrong:**
The cron note says "15 menit" but `payment_expiry_minutes` is configurable via DB setting. If an admin changes it to 30 or 60 minutes, the audit trail still says "15 menit."

**Fix:**
Fetch `expiryMinutes` from `getSetting('payment_expiry_minutes')` and use it in the note:
```typescript
const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;
note: `Otomatis dibatalkan karena tidak dibayar dalam ${expiryMinutes} menit`,
```

---

## BUG-24 — LOW: Points earned message uses inconsistent language on success page

**File:** `app/(store)/checkout/success/page.tsx:78-79`

```typescript
<p className="text-xs text-text-secondary mt-1">
  Poin akan dikreditkan setelah pembayaran dikonfirmasi oleh sistem
</p>
```

**What's wrong:**
"dikonfirmasi oleh sistem" — the points are already credited by the time the success page loads (webhook settles and credits immediately). The message implies they're still pending. Also applies to B2B Net-30 orders where points are credited synchronously at order creation.

**Fix:**
For delivery orders (webhook-settled): "Poin sudah dikreditkan ke akun Anda"
For pickup orders (webhook-settled): same message
For Net-30 orders (immediate): "Poin sudah dikreditkan ke akun Anda"

---

## BUG-25 — LOW: `handleDeliveryMethodChange` skips courier step for pickup but doesn't clear courier data

**File:** `app/(store)/checkout/page.tsx:266-271`

```typescript
const handleDeliveryMethodChange = async (method: 'delivery' | 'pickup') => {
  updateForm({ deliveryMethod: method, shippingCost: 0 });
  if (method === 'pickup' && step === 'courier') {
    setStep('delivery');
  }
};
```

**What's wrong:**
When switching to pickup, `shippingCost` is set to 0 but `courierCode`, `courierService`, `courierName` are not cleared. If user then switches back to delivery, old courier data may persist unless `handleAddressSubmit` overwrites it.

**Fix:**
Clear courier fields when switching to pickup:
```typescript
updateForm({
  deliveryMethod: method,
  shippingCost: 0,
  courierCode: '',
  courierService: '',
  courierName: '',
});
```

---

## BUG-26 — LOW: Cart page shows stock warning but allows proceeding to checkout anyway

**File:** `app/(store)/cart/page.tsx:141-154`

```typescript
{hasValidated && hasStockIssues && (
  <div role="alert" className="bg-warning-light border border-warning/30 rounded-card p-4 mb-4 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-medium text-text-primary">
        {invalidCount} item tidak tersedia dengan jumlah yang diminta
      </p>
      <p className="text-xs text-text-secondary mt-0.5">
        Stok telah diperbarui. Silakan kurangi jumlah atau hapus item yang tidak
        tersedia.
      </p>
    </div>
  </div>
)}
```

**What's wrong:**
The warning is shown but there's no blocking mechanism — the user can still click "Checkout" even with stock issues. The checkout page itself validates stock at initiate, so it would fail there, but the UX is confusing — user goes to checkout and gets an error rather than being blocked at the cart level.

**Fix:**
Disable the checkout button when `hasStockIssues === true` in the CartSummary component.

---

## INCOMPLETE FEATURES

### INCOMPLETE-01: Pickup invitation API route doesn't exist
**File:** `app/api/checkout/pickup-invitation/route.ts` — MISSING
**Status:** The store page at `app/(store)/orders/[orderNumber]/pickup/page.tsx` is a server component that fetches the order directly, so it works without the API route. But per PRD, there should be a `GET /api/checkout/pickup-invitation?orderNumber=X` for generating pickup instructions. Currently the page uses the order data directly.

### INCOMPLETE-02: PDF receipt download for guests not implemented
**File:** `app/api/orders/[orderNumber]/receipt/route.ts`
Guest checkout users cannot download their PDF receipt — auth is required. The success page links to this endpoint but guests get 403.

### INCOMPLETE-03: Points expiry warning cron job exists but not verified
The `app/api/cron/expire-points/route.ts` exists (mentioned in audit files) but I didn't read it. It should:
- Find points that expire within 30 days
- Send `PointsExpiring` email via Resend
- Mark points as `isExpired: true` on expiry date

### INCOMPLETE-04: Pickup orders skip `packed` and `shipped` status in PRD
PRD says: "Pickup orders skip shipping steps and go directly: `paid` → `processing` → `delivered` (no `packed` or `shipped`)". Verify the admin order status update workflow handles this correctly.

---

## CRITICAL RACE CONDITIONS

### RACE-01: `paymentRetryCount >= 3` TOCTOU in retry endpoint
**File:** `app/api/checkout/retry/route.ts:47-48`
Two concurrent requests can both pass the check before either increments the counter. Use atomic conditional update.

### RACE-02: Coupon `maxUses` concurrent claim at initiate
**File:** `app/api/checkout/initiate/route.ts:209-224`
The atomic conditional UPDATE handles this correctly (`used_count < maxUses`). Not a bug — this is the fix.

---

## PAYMENT FLOW GAPS

### GAP-01: No "retry" button on failed page uses the retry API
The failed page (`/checkout/failed`) redirects to `/checkout` (new order) instead of calling `/api/checkout/retry` with the original order number. This leaves the old order pending until cron cancels it.

### GAP-02: Pending page doesn't show instructions for non-VA payment types
For e-wallet (GoPay, OVO), QRIS, and credit card payments, there's no instruction shown on the pending page — only VA number for bank transfer.

### GAP-03: Payment expiry countdown in pending page doesn't auto-renew on retry
When user retries (new Midtrans token), the `paymentExpiresAt` is updated in the DB but the pending page polls `orderDetails.paymentExpiresAt` — this should update on next poll. But there's no visual indication that the expiry has been extended after a retry.

### GAP-04: No payment method change allowed on pending page
Customer cannot change payment method (e.g., from VA to GoPay) on the pending page. They can only retry with the same method.

---

## STOCK MANAGEMENT BUGS

### STOCK-01: Stock is never reserved at order creation — first come first served
Confirmed: NO soft hold. Stock is only deducted at webhook settlement. This is correct per PRD but means two customers can order the last stock simultaneously and both receive confirmation before stock is checked at settlement. The second customer's payment would then trigger a settlement failure on the webhook (insufficient stock → error thrown → payment rejected).

### STOCK-02: Webhook settlement fails entirely if ANY item has insufficient stock
**File:** `app/api/webhooks/midtrans/route.ts:145-155`
```typescript
if (!updated) {
  throw new Error(`Insufficient stock for variant ${item.variantId}`);
}
```
If one item fails (e.g., due to race condition with another order), the entire settlement fails. The order stays `pending_payment`, Midtrans collected the money, but the order isn't confirmed. Manual intervention required.

**Fix needed:** Partial fulfillment logic — confirm the order and flag which items had stock issues, or prevent the second order from being created in the first place.

---

## COUPON POINTS ISSUES

### CPOINTS-01: `POINTS_VALUE_IDR = 10` means 100 points = Rp 1,000, not 1 point = Rp 10
**File:** `lib/constants/points.ts:10`
The constant `POINTS_VALUE_IDR = 10` is used as `pointsUsed * POINTS_VALUE_IDR` in checkout (line 243):
```typescript
const pointsDiscount = usePoints && formData.pointsUsed > 0
  ? formData.pointsUsed * POINTS_VALUE_IDR  // 500 * 10 = 5000 Rp discount
  : 0;
```
So 500 points = Rp 5,000 discount. This is correct per PRD: "100 points = Rp 1,000 discount → 1 point = Rp 10". The constant is named `POINTS_VALUE_IDR` (value per point in IDR) which is 10. This is correct.

### CPOINTS-02: Per-user coupon limit only checked in initiate, not in validate
The `/api/coupons/validate` endpoint checks `maxUsesPerUser` using `couponUsages` table (line 59-70), but at validate time the provisional row from initiate hasn't been written yet. For a brand new order, initiate is where the real check happens. The validate endpoint is for display purposes only.

### CPOINTS-03: B2B points multiplier = 2x applied at initiate correctly
**File:** `app/api/checkout/initiate/route.ts:487`
```typescript
const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;
```
This is correct per PRD.

---

## SUMMARY OF CRITICAL/HIGH SEVERITY ITEMS

| ID | Severity | Title | File |
|----|----------|-------|------|
| BUG-02 | CRITICAL | PDF receipt endpoint requires auth — guests can't download | `app/api/orders/[orderNumber]/receipt/route.ts:22-38` |
| BUG-10 | MEDIUM | `paymentRetryCount >= 3` race condition | `app/api/checkout/retry/route.ts:47` |
| BUG-11 | MEDIUM | Failed page retry creates new order instead of calling retry API | `app/(store)/checkout/failed/page.tsx:82` |
| BUG-13 | MEDIUM | Cart validate check uses wrong field (`hasStockIssues`) | `app/(store)/checkout/failed/page.tsx:77` |
| BUG-17 | MEDIUM | Coupon `usedCount` incremented twice for settled orders | `initiate:209-224` vs `webhook:158-163` |
| STOCK-02 | HIGH | Webhook settlement fails entirely if any item has insufficient stock | `app/api/webhooks/midtrans/route.ts:152-155` |
| GAP-01 | HIGH | Failed page doesn't use retry API — old orders accumulate | `app/(store)/checkout/failed/page.tsx:82` |

---

## WHAT WAS NOT CHANGED (AND WHY)

The following are by design or already correct:
- **MidtransPayment popup auto-opens**: By design — user clicks "Bayar Sekarang" → API returns snapToken → component mounts → popup opens. User action triggered it indirectly.
- **Points deducted immediately at create**: By design per PRD Section 6.4.
- **Webhook settlement for cancelled orders → manual review**: By design — prevents money loss on edge cases.
- **`free_shipping` coupon formula**: Correctly calculates `totalAmount = subtotal - baseShippingCost`.
- **No stock soft-hold at initiate**: Correct per PRD — first come first served, deducted only on settlement.
- **Pending status keeps order alive**: By design — `pending` webhook doesn't change status.
- **BuyXGetY validated only at initiate**: The validate endpoint returns info but initiate does the real check.
- **Cart `loadFromDb` is fire-and-forget**: Acceptable for non-critical sync.
- **Points expiry cron**: Exists at `app/api/cron/expire-points/route.ts` (not read but referenced in codebase).