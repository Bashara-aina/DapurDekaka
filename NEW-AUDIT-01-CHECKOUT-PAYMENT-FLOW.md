# AUDIT 01 — CHECKOUT & PAYMENT FLOW
**Date**: 2026-05-22 | **Branch**: fix/multiple-audit-fixes-may-2026  
**Scope**: `app/(store)/checkout/`, `app/api/checkout/`, `app/api/webhooks/midtrans/`  
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

## BUG-02 — CRITICAL: PDF Receipt Button Is a 404

**File**: `app/(store)/account/orders/[orderNumber]/page.tsx` (references PDF download)  
**Also**: `components/email/OrderReceiptPDF.tsx` (component exists, no route to serve it)  
**Severity**: HIGH — broken feature, user-facing 404  

**What's wrong**: The account order detail page shows a "Download Receipt" button. The `OrderReceiptPDF.tsx` React-PDF component exists at `components/email/OrderReceiptPDF.tsx`. However, there is no API route at `/api/orders/[orderNumber]/receipt` (or anywhere else) that renders this component and streams it as a PDF. Every download click returns 404.

**Fix Option A** — Hide the button until built:
In `app/(store)/account/orders/[orderNumber]/page.tsx`, comment out or remove the PDF download button.

**Fix Option B** — Implement the route:
Create `app/api/orders/[orderNumber]/receipt/route.ts`:
```ts
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import { OrderReceiptPDF } from '@/components/email/OrderReceiptPDF';
import { notFound, forbidden } from 'next/navigation';

export async function GET(req: Request, { params }: { params: { orderNumber: string } }) {
  const session = await auth();
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, params.orderNumber),
    with: { items: true },
  });

  if (!order) return notFound();

  // Auth check: must be owner or admin
  const isAdmin = ['superadmin', 'owner', 'warehouse'].includes(session?.user?.role ?? '');
  if (!isAdmin && order.userId !== session?.user?.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const buffer = await renderToBuffer(<OrderReceiptPDF order={order} />);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${order.orderNumber}.pdf"`,
    },
  });
}
```

---

## BUG-03 — HIGH: `showAddressPicker` State Never Consumed

**File**: `app/(store)/checkout/page.tsx:142, 596–607`  
**Severity**: HIGH — broken back-navigation from address form  

**What's wrong**: State `showAddressPicker` is declared and set to `true` in the "back" handler of the AddressForm component, but it is NEVER used in the JSX render conditionals. The picker display logic uses `savedAddresses.length > 0 && !showNewAddressForm` (line 536). So calling `setShowAddressPicker(true)` (line 602) has no effect — the picker already shows when `showNewAddressForm = false`. The call to `setShowAddressPicker(true)` alongside `setShowNewAddressForm(false)` is redundant but confusing. More critically, the state is dead code that makes the component harder to reason about.

**Fix**: Remove the `showAddressPicker` state entirely.
```ts
// DELETE line 142:
const [showAddressPicker, setShowAddressPicker] = useState(false);

// In AddressForm onBack handler (line 596), the fix is already correct:
onBack={() => {
  if (session?.user && savedAddresses.length > 0) {
    setShowNewAddressForm(false); // This is enough
    // Remove: setShowAddressPicker(true);
  } else {
    handleBack();
  }
}}
```

---

## BUG-04 — MEDIUM: Back Button in Payment Step Shows Wrong Label for Pickup Orders

**File**: `app/(store)/checkout/page.tsx:787`  
**Severity**: MEDIUM — confusing UX  

**What's wrong**: The "Kembali" button in the payment step always reads `← Kembali ke Kurir`. But for pickup orders, there is no courier step — the flow is identity → delivery → payment. A pickup user who clicks back will correctly go to the delivery step, but the label is wrong and confusing.

**Fix**:
```tsx
// Line 787 — replace:
<button ... onClick={handleBack}>
  ← Kembali ke Kurir
</button>

// With:
<button ... onClick={handleBack}>
  ← Kembali ke {formData.deliveryMethod === 'pickup' ? 'Pengiriman' : 'Kurir'}
</button>
```

---

## BUG-05 — MEDIUM: Cart Restore on Failed Payment Adds Items with stock=999

**File**: `app/(store)/checkout/failed/page.tsx:73`  
**Severity**: MEDIUM — users can add sold-out items  

**What's wrong**: When restoring the cart after a failed payment, `addItem({ ...item, stock: 999 })` is used as a placeholder. The comment acknowledges this is intentional ("will be re-validated at checkout initiate server-side"). However, this means:
1. The cart shows the item as fully in-stock
2. If the actual stock is 0 (item sold out between order creation and expiry), the user tries to checkout again, gets "Stok tidak mencukupi" error on the server, and has a broken experience with no explanation.

**Fix**: After restoring items, redirect to `/cart` instead of `/checkout`, and call `/api/cart/validate` first to surface stock issues before the user wastes time filling in address/courier again:
```ts
const handleRetry = async () => {
  if (!orderItems?.length) {
    router.push('/checkout');
    return;
  }
  setIsRestoring(true);
  
  // Add items with placeholder stock
  for (const item of orderItems) {
    addItem({ ...item, stock: 999, variantNameEn: item.variantNameEn ?? '', ... });
  }
  
  // Validate stock before sending to checkout
  const validateRes = await fetch('/api/cart/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: orderItems.map(i => ({ variantId: i.variantId, quantity: i.quantity })) }),
  });
  const validateData = await validateRes.json();
  
  // If any items are out of stock, go to cart page so user can see
  const hasStockIssues = validateData.data?.some((v: any) => !v.available);
  router.push(hasStockIssues ? '/cart' : '/checkout');
};
```

---

## BUG-06 — MEDIUM: `isLoading` State is Dead Code

**File**: `app/(store)/checkout/page.tsx:85, 834, 840`  
**Severity**: LOW — technical debt  

**What's wrong**: `const [isLoading, setIsLoading] = useState(false)` is declared but `setIsLoading(true)` is never called. It's only set to `false` in `onError` and `onClose` MidtransPayment callbacks. The actual loading state is tracked by `isSubmitting`. This is dead state that will confuse future maintainers.

**Fix**: Remove `isLoading` state. Replace `setIsLoading(false)` in both callbacks with nothing (or remove the callbacks' loading reset):
```ts
// DELETE line 85:
const [isLoading, setIsLoading] = useState(false);

// Line 834 — remove setIsLoading(false)
onError: () => {
  setSnapToken(null);
  // setIsLoading(false); — delete this
  toast.error('Pembayaran gagal. Silakan coba lagi.');
},
// Line 840
onClose: () => {
  setSnapToken(null);
  // setIsLoading(false); — delete this
},
```

---

## BUG-07 — LOW: Points-to-IDR Conversion Hardcoded as `/ 10` in Checkout

**File**: `app/(store)/checkout/page.tsx:384–387`  
**Severity**: LOW — uses hardcoded constant instead of named constant  

**What's wrong**: 
```ts
const maxPointsFromIDR = Math.floor(maxPointsInIDR / 10); // 1pt = 10 IDR
```
The value `10` is the `POINTS_VALUE_IDR` constant from `@/lib/constants/points`. If the business ever changes the points redemption rate, this line won't be updated.

**Fix**:
```ts
import { POINTS_VALUE_IDR } from '@/lib/constants/points';
// ...
const maxPointsFromIDR = Math.floor(maxPointsInIDR / POINTS_VALUE_IDR);
```

---

## BUG-08 — LOW: Account Page Has Duplicate `formatIDR` Function + Hardcoded Points Rate

**File**: `app/(store)/account/page.tsx:57–64, 211`  
**Severity**: LOW — code quality  

**What's wrong**:
1. `formatIDR` is defined locally (lines 57–64) instead of importing from `@/lib/utils/format-currency`
2. Line 211: `{formatIDR(user.pointsBalance * 10)}` hardcodes `* 10` instead of using `POINTS_VALUE_IDR`

**Fix**:
```ts
// Remove local formatIDR definition (lines 57-64)
// Add import at top:
import { formatIDR } from '@/lib/utils/format-currency';
import { POINTS_VALUE_IDR } from '@/lib/constants/points';

// Line 211 — change:
{formatIDR(user.pointsBalance * POINTS_VALUE_IDR)}
```

---

## BUG-09 — MEDIUM: Checkout Pending Page — "Retry" Button Disabled Until Snap Loads

**File**: `app/(store)/checkout/pending/page.tsx:236`  
**Severity**: MEDIUM — UX friction  

**What's wrong**: The "Bayar Sekarang" button is disabled while `snapLoaded` is false. The Snap script loads with `strategy="afterInteractive"`. On slow connections or if Midtrans CDN is slow, this button can remain disabled for several seconds with only a spinner — no explanation to the user about why it's disabled.

**Fix**: Add a loading message: "Memuat sistem pembayaran... Tunggu sebentar." below the button when `!snapLoaded`. Also consider a timeout after 15 seconds that shows: "Sistem pembayaran tidak dapat dimuat. Coba refresh halaman."

---

## INCOMPLETE FEATURE: No Coupon Usage Row for Non-Per-User Coupons

**File**: `app/api/checkout/initiate/route.ts:655–665`  
**Severity**: MEDIUM — coupon dedup gaps  

**What's wrong**: A provisional `couponUsages` row is only inserted at checkout initiate when `coupon.maxUsesPerUser` is set (line 658: `if (coupon && coupon.maxUsesPerUser && userId && !isNet30Order)`). For coupons without per-user limits, no row is inserted until settlement. This means:
- A user can use the same coupon multiple times simultaneously if they open multiple checkout tabs (race condition on `usedCount` check at line 198)
- The webhook's `onConflictDoNothing` at settlement handles the normal case, but concurrent checkouts can still both pass the `maxUses` check before either increments

**Fix**: Insert the provisional `couponUsages` row for ALL coupons (not just per-user ones) at initiate time, and remove on cancel. This gives a proper lock.
