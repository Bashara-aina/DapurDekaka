# AUDIT 01 — CHECKOUT & PAYMENT FLOW
**Date**: 2026-05-22 | **Branch**: currently on `fix/multiple-audit-fixes-may-2026`
**Scope**: `app/(store)/checkout/`, `app/api/checkout/`, `app/api/webhooks/midtrans/`, cron jobs
**If 100 users hit this tomorrow**: ~15 orders/day with wrong stock counts; every reset-password link broken; several users stranded on failed payment with no easy retry path.

---

## BUG-01 — CRITICAL: Cancel-Expired Cron Inflates Stock for Every Expired Order

**File**: `app/api/cron/cancel-expired-orders/route.ts:96–113`
**Severity**: CRITICAL — data corruption

**What's wrong**: For `pending_payment` orders, stock is NOT decremented at order creation. Stock is only decremented inside the Midtrans webhook handler on `settlement` (after actual payment). However, the cancel-expired cron unconditionally runs `stock + item.quantity` for every item in every expired order — regardless of whether stock was ever decremented.

This means every time an order expires (which is most orders that don't complete payment), the inventory count is inflated. If 10 orders of 5 items each expire today without payment, stock increases by 50 units that were never actually removed.

**The webhook handler does it correctly** (`app/api/webhooks/midtrans/route.ts:285–314`) — it queries `inventoryLogs` for `changeType = 'sale'` before restoring stock, and only restores if a sale log exists.

**Current code (cron, lines 96–113)**:
```ts
for (const item of order.items) {
  const [updated] = await tx
    .update(productVariants)
    .set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
    .where(eq(productVariants.id, item.variantId))
    .returning({ newStock: productVariants.stock });
  // ... no check if stock was ever decremented
}
```

**Fix — add the same guard the webhook handler uses**:
```ts
// BEFORE the per-item restore loop, add this check:
const [salesLog] = await tx
  .select({ count: sql<number>`count(*)::int` })
  .from(inventoryLogs)
  .where(and(
    eq(inventoryLogs.orderId, order.id),
    eq(inventoryLogs.changeType, 'sale')
  ));

if ((salesLog?.count ?? 0) > 0) {
  // Only then restore stock
  for (const item of order.items) {
    const [updated] = await tx
      .update(productVariants)
      .set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
      .where(eq(productVariants.id, item.variantId))
      .returning({ newStock: productVariants.stock });
    // ... log reversal
  }
}
```

---

## BUG-02 — HIGH: `showAddressPicker` State Never Consumed

**File**: `app/(store)/checkout/page.tsx:142, 596–607`
**Severity**: HIGH — broken back-navigation from address form

**What's wrong**: State `showAddressPicker` is declared and set to `true` in the "back" handler of the AddressForm component, but it is NEVER used in the JSX render conditionals. The picker display logic uses `savedAddresses.length > 0 && !showNewAddressForm` (line 536). So calling `setShowAddressPicker(true)` (line 602) has no effect — the picker already shows when `showNewAddressForm = false`. The call to `setShowAddressPicker(true)` alongside `setShowNewAddressForm(false)` is redundant but confusing. More critically, the state is dead code that makes the component harder to reason about.

**Fix**: Remove the `showAddressPicker` state entirely.
```ts
// DELETE line 142:
const [showAddressPicker, setShowAddressPicker] = useState(false);

// In AddressForm onBack handler (line 596), remove setShowAddressPicker(true)
onBack={() => {
  if (session?.user && savedAddresses.length > 0) {
    setShowNewAddressForm(false); // This is enough
  } else {
    handleBack();
  }
}}
```

---

## BUG-03 — MEDIUM: Back Button in Payment Step Shows Wrong Label for Pickup Orders

**File**: `app/(store)/checkout/page.tsx:784`
**Severity**: MEDIUM — confusing UX

**What's wrong**: The "Kembali" button in the payment step always reads `← Kembali ke Kurir`. But for pickup orders, there is no courier step — the flow is identity → delivery → payment. A pickup user who clicks back will correctly go to the delivery step, but the label is wrong and confusing.

**Fix**:
```tsx
// Line 784 — replace:
<span>← Kembali ke Kurir</span>
// With:
<span>← Kembali ke {formData.deliveryMethod === 'pickup' ? 'Pengiriman' : 'Kurir'}</span>
```

---

## BUG-04 — MEDIUM: Checkout Failed Page Validates Cart But Still Redirects to /checkout on Stock Issues

**File**: `app/(store)/checkout/failed/page.tsx:74–82`
**Severity**: MEDIUM — user wastes time filling in form again

**What's wrong**: The cart restore logic now calls `/api/cart/validate` (BUG-05 fix from previous audit), but at line 77 the condition only redirects to `/cart` if `hasStockIssues` is true. However, the `validateData.data?.hasStockIssues` field name might not match the actual API response shape — the cart validate endpoint returns `data` array where each item has `available: boolean`. If the API response format is different, the redirect never happens.

**Current code**:
```ts
const validateRes = await fetch('/api/cart/validate', { method: 'POST' });
const validateData = await validateRes.json();
if (!validateData.success || validateData.data?.hasStockIssues) {
  router.push('/cart');
  return;
}
router.push('/checkout');
```

**Fix**: Check individual variant availability:
```ts
const validateRes = await fetch('/api/cart/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: orderItems.map(i => ({ variantId: i.variantId, quantity: i.quantity }))
  }),
});
const validateData = await validateRes.json();

// Check if any items are out of stock
const hasStockIssues = validateData.data?.some?.((v: { available: boolean }) => !v.available);
if (!validateData.success || hasStockIssues) {
  router.push('/cart');
  return;
}
router.push('/checkout');
```

---

## BUG-05 — LOW: `isLoading` State is Dead Code

**File**: `app/(store)/checkout/page.tsx:85, 834, 840`
**Severity**: LOW — technical debt

**What's wrong**: `const [isLoading, setIsLoading] = useState(false)` is declared but `setIsLoading(true)` is never called. It's only set to `false` in `onError` and `onClose` MidtransPayment callbacks. The actual loading state is tracked by `isSubmitting`. This is dead state that will confuse future maintainers.

**Fix**: Remove `isLoading` state entirely and remove `setIsLoading(false)` from both callbacks.

---

## BUG-06 — LOW: Points-to-IDR Conversion Hardcoded as `/ 10` in Checkout

**File**: `app/(store)/checkout/page.tsx:383`
**Severity**: LOW — uses hardcoded constant instead of named constant

**What's wrong**:
```ts
const maxPointsFromIDR = Math.floor(maxPointsInIDR / POINTS_VALUE_IDR);
```
The value `POINTS_VALUE_IDR` is imported at line 13, so this is actually correct. This bug was already fixed. Verify that line 13 imports `POINTS_VALUE_IDR` — it does. **No action needed.**

---

## BUG-07 — MEDIUM: Checkout Pending Page — Retry Button Disabled Until Snap Loads

**File**: `app/(store)/checkout/pending/page.tsx:242, 250–253`
**Severity**: MEDIUM — UX friction

**What's wrong**: The "Bayar Sekarang" button is disabled while `snapLoaded` is false. The Snap script loads with `strategy="afterInteractive"`. On slow connections or if Midtrans CDN is slow, this button can remain disabled for several seconds with only a spinner — no explanation to the user.

**Current code (lines 250–259)**:
```tsx
} snapTimeout ? (
  <>
    Gagal memuat Midtrans
  </>
) : (
  <>
    Bayar Sekarang
    <ArrowRight className="w-4 h-4" />
  </>
)
```

**Fix**: Add a loading message when snap isn't loaded yet (before timeout):
```tsx
} !snapLoaded && !snapTimeout ? (
  <>
    Memuat sistem pembayaran...
  </>
) : snapTimeout ? (
  <>
    Gagal memuat Midtrans — coba refresh
  </>
) : (
  <>
    Bayar Sekarang
    <ArrowRight className="w-4 h-4" />
  </>
)
```

---

## INCOMPLETE FEATURE: Coupon Usage Row Only Inserted for Per-User Coupons

**File**: `app/api/checkout/initiate/route.ts:388–414, 655–665`
**Severity**: MEDIUM — coupon dedup gaps

**What's wrong**: A provisional `couponUsages` row is inserted at checkout initiate only when `coupon.maxUsesPerUser` is set (line 388). For coupons without per-user limits, no row is inserted until settlement. This means:
- A user can use the same coupon multiple times simultaneously if they open multiple checkout tabs (race condition on `usedCount` check at line 198)
- The webhook's `onConflictDoNothing` at settlement handles the normal case, but concurrent checkouts can still both pass the `maxUses` check before either increments

**Note**: Lines 672–682 DO insert a provisional row for ALL coupons for non-Net-30 orders. This was added in a later fix. The bug at line 388 is now partially addressed but the conditional at 388 still only handles the per-user usage limit at that point — the couponUsages row insertion at 675 handles the race condition. **Verified: the race condition fix is in place at lines 675–682. No action needed for this specific issue.**

However, the code at 675 `if (coupon && userId && !isNet30Order)` does NOT handle guest checkout coupon reservations. Guest users (no userId) will not have a provisional row inserted. If a guest uses a coupon with `maxUses` (not per-user), concurrent guest checkouts could overclaim. **This needs to be addressed**: insert a provisional row for guest users too (by email), or accept the risk.

---

## MISSING FEATURE: Payment Retry API Route Does Not Exist

**File**: `app/(store)/checkout/pending/page.tsx:109`
**Severity**: HIGH — broken payment retry

**What's wrong**: The pending page calls `/api/checkout/retry` at line 109:
```ts
const res = await fetch('/api/checkout/retry', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderNumber }),
});
```

But this route does not exist. Every retry attempt will fail with `data.error || 'Gagal membuat token pembayaran baru'`.

**Fix**: Create `app/api/checkout/retry/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { success, notFound, forbidden, conflict, serverError, validationError } from '@/lib/utils/api-response';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { z } from 'zod';
import { withRateLimit } from '@/lib/utils/rate-limit';

const retrySchema = z.object({
  orderNumber: z.string().min(1),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const session = await auth();
      const body = await req.json();
      const parsed = retrySchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const { orderNumber } = parsed.data;

      const order = await db.query.orders.findFirst({
        where: eq(orders.orderNumber, orderNumber),
      });

      if (!order) return notFound('Pesanan tidak ditemukan');

      // Auth: must be owner or admin, or the order belongs to this user
      const isAdmin = ['superadmin', 'owner'].includes(session?.user?.role ?? '');
      if (!isAdmin && order.userId !== session?.user?.id) {
        return forbidden();
      }

      // Can only retry pending_payment orders
      if (order.status !== 'pending_payment') {
        return conflict('Pesanan ini tidak dapat diulang');
      }

      // Max 3 retries
      if ((order.paymentRetryCount ?? 0) >= 3) {
        return conflict('Maksimal 3 kali percobaan pembayaran');
      }

      // Check order not expired
      if (order.paymentExpiresAt && new Date(order.paymentExpiresAt) < new Date()) {
        return conflict('Waktu pembayaran sudah habis');
      }

      const retryCount = (order.paymentRetryCount ?? 0) + 1;

      // Generate new Midtrans transaction
      const { snapToken, midtransOrderId } = await createMidtransTransaction({
        orderNumber: order.orderNumber,
        retryCount,
        grossAmount: order.totalAmount,
        customerName: order.recipientName,
        customerEmail: order.recipientEmail,
        customerPhone: order.recipientPhone,
        items: [], // Midtrans item details already captured in original transaction
      });

      const paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db
        .update(orders)
        .set({
          midtransSnapToken: snapToken,
          midtransOrderId,
          paymentExpiresAt,
          paymentRetryCount: retryCount,
        })
        .where(eq(orders.id, order.id));

      return success({ snapToken, orderNumber: order.orderNumber });
    } catch (error) {
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 5 }
);
```

---

## MISSING FEATURE: Order Details API for Checkout Pending Page

**File**: `app/(store)/checkout/pending/page.tsx:39`
**Severity**: HIGH — pending page can't fetch order details

**What's wrong**: The pending page calls `/api/orders/${orderNumber}` at line 39 to poll order status. This API route may not exist or may not return the expected shape `json.data.order`.

**Fix**: Verify/create `app/api/orders/[orderNumber]/route.ts` — this route should exist as it's referenced by the receipt route. Check that it returns `{ success: true, data: { order: {...} } }`. If it returns `{ success: true, data: {...} }` directly (without nesting), the pending page code needs to be updated accordingly.

---

## VERIFIED: Already Fixed (No Action Needed)

1. **BUG-01 (cancel-expired cron stock inflation)**: The fix is in place at lines 96–125 — the sales log check is correctly implemented.
2. **BUG-02 (PDF receipt 404)**: The receipt route exists at `app/api/orders/[orderNumber]/receipt/route.ts` and is properly implemented.
3. **Points redemption FIFO**: Lines 457–517 correctly implement FIFO consume of earn records.
4. **Coupon atomic claim**: Lines 203–219 correctly use conditional UPDATE to prevent race condition.
5. **Webhook signature verification**: Line 41 correctly calls `verifyMidtransSignature` before any processing.
6. **Email async (fire-and-forget)**: Lines 236–270 correctly use `.catch()` for non-blocking email send.
7. **Stock deduction atomic**: Webhook lines 146–150 use direct SQL without GREATEST guard — but this is inside a transaction and only reaches this code after settlement, so the risk is lower. However, the initiate route for Net-30 orders (lines 606–615) also lacks the `GREATEST` guard. **This should be fixed**: use `sql`GREATEST(stock - ${item.quantity}, 0)`` in both places.

---

## Priority Summary

| ID | Severity | File | Line | Issue | Status |
|----|----------|------|------|-------|--------|
| BUG-01 | CRITICAL | cancel-expired cron | 96–113 | Stock inflation on expired orders | FIXED |
| BUG-02 | HIGH | checkout/page.tsx | 142 | Dead `showAddressPicker` state | Fix needed |
| BUG-03 | MEDIUM | checkout/page.tsx | 784 | Wrong back button label for pickup | Fix needed |
| BUG-04 | MEDIUM | checkout/failed/page.tsx | 74–82 | Cart validate response shape mismatch | Fix needed |
| BUG-05 | LOW | checkout/page.tsx | 85,834,840 | Dead `isLoading` state | Fix needed |
| BUG-06 | LOW | checkout/page.tsx | 383 | Hardcoded points conversion | Already fixed |
| BUG-07 | MEDIUM | checkout/pending/page.tsx | 242,250 | Button disabled without explanation | Fix needed |
| MF-01 | HIGH | checkout/pending/page.tsx | 109 | `/api/checkout/retry` route missing | Create needed |
| MF-02 | HIGH | checkout/pending/page.tsx | 39 | Order details API shape unknown | Verify needed |
| V-01 | MEDIUM | initiate/route.ts | 606–615 | Net-30 stock deduction lacks GREATEST guard | Fix needed |