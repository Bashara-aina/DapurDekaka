# CURSOR AUDIT 01 — Checkout & Payment Flow (End-to-End)
**Project:** DapurDekaka.com  
**Date:** 2026-05-15  
**Scope:** Full purchase funnel: cart → checkout steps → Midtrans payment → webhook → confirmation

---

## Overview

The checkout flow is broadly functional for the happy path (logged-in user, delivery order, successful payment). However, there are **5 active bugs** that break real customer scenarios. Each issue below lists the exact file, line number, what the bug is, and the precise fix.

---

## BUG 01 — Checkout Failed Page: Cart Items Never Restored

**Severity:** High — all failed payments result in empty "Coba Lagi" button  
**File:** `app/(store)/checkout/failed/page.tsx:28-33`

### What's broken
When a payment fails, the page fetches the cancelled order and tries to restore items to cart. The fetch path is wrong:

```ts
// CURRENT (BROKEN):
const res = await fetch(`/api/orders/${orderNumber}`);
const data = await res.json();
if (data.data?.items) {          // ← data.data is { order: {...}, verified: true }
  setOrderItems(data.data.items); // ← items are at data.data.order.items
}
```

The API route `app/api/orders/[orderNumber]/route.ts` wraps the response in `success({ order, verified: true })`. The `success()` helper wraps again in `{ success: true, data: { order: {...}, verified: true } }`. So items are at `data.data.order.items`, not `data.data.items`.

### Fix
```ts
// app/(store)/checkout/failed/page.tsx — restoreCart function
const res = await fetch(`/api/orders/${orderNumber}`);
if (res.ok) {
  const data = await res.json();
  // order API returns: { success: true, data: { order: {...}, verified: bool } }
  if (data.data?.order?.items) {
    setOrderItems(data.data.order.items);
  }
}
```

---

## BUG 02 — Points Deducted at Checkout But Cannot Be Reversed on Cancellation

**Severity:** Critical — customer loses real points balance permanently on any failed payment  
**Files:**  
- `app/api/checkout/initiate/route.ts:278-301` (redeem records created with `orderId: null`)  
- `app/api/webhooks/midtrans/route.ts:168-190` (reversal queries by `orderId`)

### What's broken

During checkout initiate, points are deducted BEFORE the order is created (both happen inside the same DB transaction). Redeem records are inserted with `orderId: null`:

```ts
// app/api/checkout/initiate/route.ts:293
await tx.insert(pointsHistory).values({
  userId,
  type: 'redeem',
  pointsAmount: -deductFromThis,
  pointsBalanceAfter: sql`points_balance`,
  orderId: null,  // ← null because order doesn't exist yet
  referencedEarnId: earnRecord.id,
});
```

The order is created several lines later. But the reversal in the webhook cancellation path queries by `orderId`:

```ts
// app/api/webhooks/midtrans/route.ts:168-172
const redeemRecords = await tx
  .select()
  .from(pointsHistory)
  .where(
    and(
      eq(pointsHistory.userId, order.userId),
      eq(pointsHistory.type, 'redeem'),
      eq(pointsHistory.orderId, order.id), // ← finds ZERO rows (they all have null orderId)
      sql`${pointsHistory.referencedEarnId} IS NOT NULL`
    )
  );
```

**Result:** Zero redeem records found → no earn records unconsumed → `users.pointsBalance` restored via `+order.pointsUsed` but the earn records stay permanently `consumedAt = now` → they can never be used again by FIFO → customer lost their points.

### Fix

After creating the order in the transaction, back-fill `orderId` on the redeem records:

```ts
// app/api/checkout/initiate/route.ts — INSIDE the transaction, AFTER `const [created] = await tx.insert(orders).values(...).returning()`

// Back-fill orderId on the redeem records we just created
if (pointsDeducted && userId && pointsUsed) {
  await tx
    .update(pointsHistory)
    .set({ orderId: created.id })
    .where(
      and(
        eq(pointsHistory.userId, userId!),
        eq(pointsHistory.type, 'redeem'),
        sql`${pointsHistory.orderId} IS NULL`,
        sql`${pointsHistory.referencedEarnId} IS NOT NULL`,
        sql`${pointsHistory.createdAt} >= NOW() - INTERVAL '30 seconds'`
      )
    );
}
```

Place this code block immediately after the `tx.insert(orders).values(...).returning()` call, before the `tx.insert(orderItems)` call.

---

## BUG 03 — Guest Checkout Has No Idempotency (Double-Click Creates Two Orders)

**Severity:** Medium — duplicate charges, duplicate order emails, inventory chaos  
**File:** `app/api/checkout/initiate/route.ts:193-205`

### What's broken

The idempotency check only runs for logged-in users:

```ts
if (userId) {   // ← skips entirely for guests
  const existingPending = await db.query.orders.findFirst({...});
  if (existingPending?.midtransSnapToken) {
    return success({...});
  }
}
```

A guest user double-clicking "Bayar Sekarang" fires two identical POST requests within milliseconds. Both find no existing order, both create an order, both charge the customer.

### Fix

Add a content-based idempotency key using the guest's email + cart hash. Simplest fix: use a short-circuit based on email + subtotal + recent timestamp:

```ts
// app/api/checkout/initiate/route.ts — add BEFORE the idempotency block
// Guest idempotency: check for very recent order (30s) with same email + amount
if (!userId && recipientEmail) {
  const thirtySecsAgo = new Date(Date.now() - 30 * 1000);
  const recentGuestOrder = await db.query.orders.findFirst({
    where: and(
      eq(orders.recipientEmail, recipientEmail.toLowerCase()),
      eq(orders.status, 'pending_payment'),
      gte(orders.createdAt, thirtySecsAgo),
      eq(orders.totalAmount, totalAmount)
    ),
    orderBy: [desc(orders.createdAt)],
  });
  if (recentGuestOrder?.midtransSnapToken) {
    return success({
      orderId: recentGuestOrder.id,
      orderNumber: recentGuestOrder.orderNumber,
      snapToken: recentGuestOrder.midtransSnapToken,
    });
  }
}
```

Note: `totalAmount` must be computed before this check (move the total calculation up).

---

## BUG 04 — Checkout Page: Phone Number Not Pre-filled for Logged-in Users

**Severity:** Low — UX degradation, user must type phone at every checkout  
**File:** `app/(store)/checkout/page.tsx:149-159`

### What's broken

When a logged-in user reaches checkout, the identity step is auto-skipped:

```ts
useEffect(() => {
  if (session?.user && step === 'identity') {
    updateForm({
      recipientName: session.user.name || '',
      recipientEmail: session.user.email || '',
      recipientPhone: '',    // ← always blank — session doesn't carry phone
    });
    setStep('delivery');
  }
}, [session?.user]);
```

`session.user.phone` is not loaded by default in NextAuth session token.

### Fix

Option A (recommended): Pre-fetch user's phone from DB on checkout page mount and populate the form.

```ts
// app/(store)/checkout/page.tsx — add useQuery after existing queries
const { data: profileData } = useQuery({
  queryKey: ['account', 'profile'],
  queryFn: async () => {
    const res = await fetch('/api/account/profile');
    const json = await res.json();
    return json.success ? json.data : null;
  },
  enabled: !!session?.user,
});

// In the identity auto-skip useEffect:
useEffect(() => {
  if (session?.user && step === 'identity') {
    updateForm({
      recipientName: session.user.name || '',
      recipientEmail: session.user.email || '',
      recipientPhone: profileData?.phone || '',  // ← use fetched phone
    });
    setStep('delivery');
  }
}, [session?.user, profileData]);
```

Option B: Extend the NextAuth session callback to include `user.phone` in the token. This requires changes to `lib/auth/index.ts`.

---

## BUG 05 — Coupon Per-User Limit Not Enforced at Checkout Initiate

**Severity:** Medium — a user can bypass coupon validation and reuse single-use coupons  
**File:** `app/api/checkout/initiate/route.ts:152-182` (coupon validation section)

### What's broken

The coupon validation UI calls `/api/coupons/validate` which correctly checks `maxUsesPerUser`. But the checkout initiate route has its own coupon validation that does NOT check per-user limits:

```ts
// app/api/checkout/initiate/route.ts:169-171
if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
  return conflict('Kupon sudah mencapai batas penggunaan');
}
// ← no check for maxUsesPerUser
```

A user who's already used a coupon can skip the validate step (intercept with a modified request) and go straight to checkout initiate. The initiate route will accept the coupon.

### Fix

Add per-user limit check in the initiate route's coupon section, after the `maxUses` check:

```ts
// app/api/checkout/initiate/route.ts — add after line 171 (after maxUses check)
if (coupon.maxUsesPerUser && userId) {
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
```

Add import: `import { couponUsages } from '@/lib/db/schema';` — already imported in this file.

---

## INCOMPLETE FEATURE 01 — Pending Payment Page Shows No Payment Instructions

**Severity:** Medium — users with VA payments have no payment instructions shown  
**File:** `app/(store)/checkout/pending/page.tsx`

### What's broken

The pending page shows the order number and a "Bayar Sekarang" retry button, but shows no VA number, bank name, or payment amount. Midtrans pushes VA details in the webhook, which arrives AFTER the user is redirected to `/checkout/pending`.

The page does not poll the order status or fetch payment details. Users who paid via Virtual Account see generic text "Pembayaran sedang diproses" with no instructions.

### Fix

Add a polling mechanism to fetch order details (including VA number) from the API:

```ts
// app/(store)/checkout/pending/page.tsx — add to PendingContent
const [orderDetails, setOrderDetails] = useState<{
  totalAmount?: number;
  vaNumber?: string;
  paymentType?: string;
  paymentExpiresAt?: string;
} | null>(null);

useEffect(() => {
  if (!orderNumber) return;
  
  const poll = async () => {
    const res = await fetch(`/api/orders/${orderNumber}`);
    const data = await res.json();
    if (data.data?.order) {
      const order = data.data.order;
      setOrderDetails({
        totalAmount: order.totalAmount,
        vaNumber: order.midtransVaNumber,
        paymentType: order.midtransPaymentType,
        paymentExpiresAt: order.paymentExpiresAt,
      });
      // If payment confirmed, redirect to success
      if (order.status === 'paid') {
        router.push(`/checkout/success?order=${orderNumber}`);
      }
    }
  };
  
  poll(); // immediate
  const interval = setInterval(poll, 5000); // poll every 5s
  return () => clearInterval(interval);
}, [orderNumber, router]);
```

Note: The `orders/[orderNumber]/route.ts` currently returns `{ order: minimal, verified: false, requiresEmailVerification: true }` for unauthenticated guests. You need to expose `totalAmount`, `midtransVaNumber`, `paymentExpiresAt` in the minimal (unverified) response so the pending page can show it.

---

## INCOMPLETE FEATURE 02 — Checkout Success Page Missing PDF Receipt Download

**Severity:** Medium — P0 requirement per PRD: "PDF receipt generated and emailed after payment"  
**File:** `app/(store)/checkout/success/page.tsx` (check if PDF download exists)

### Status

The API route `app/api/orders/[orderNumber]/receipt/route.ts` exists. Verify the success page:
1. Shows a "Download Bukti Pembayaran" button
2. Links to `/api/orders/[orderNumber]/receipt`

If the button is absent, add it to the success page. The receipt API is already implemented.

---

## FLOW TRACE: Midtrans Callback → DB State

When `window.snap.pay(snapToken)` resolves, Midtrans calls one of three callbacks:
- `onSuccess` → Midtrans webhook fires first, then client redirected to `/checkout/success?order=DDK-...`
- `onPending` → Client redirected to `/checkout/pending?order=DDK-...`
- `onError` / `onClose` → Client stays on payment page

The webhook at `app/api/webhooks/midtrans/route.ts` is the canonical source of truth. The client callbacks should redirect but NOT update DB state. Verify `MidtransPayment` component in `components/store/checkout/MidtransPayment.tsx` does not perform DB writes on callback — it should only navigate.

---

## CHECKLIST FOR CURSOR

- [ ] Fix cart restoration path in `app/(store)/checkout/failed/page.tsx:28-33` (`data.data?.order?.items`)
- [ ] Back-fill `orderId` on points redeem records in `app/api/checkout/initiate/route.ts` (after order creation inside transaction)
- [ ] Add guest idempotency check in `app/api/checkout/initiate/route.ts` (before existing `userId` check)
- [ ] Pre-fill phone number for logged-in users at checkout using `/api/account/profile`
- [ ] Add `maxUsesPerUser` check in `app/api/checkout/initiate/route.ts` coupon validation section
- [ ] Add VA payment instructions + polling to `app/(store)/checkout/pending/page.tsx`
- [ ] Verify PDF download button exists on `app/(store)/checkout/success/page.tsx`
