# AUDIT-01 — Checkout & Payment Engine
**Date:** 2026-05-16  
**Scope:** `app/api/checkout/`, `app/api/webhooks/midtrans/`, `app/api/cron/`, `app/api/coupons/`  
**Severity legend:** 🔴 Critical (data loss / money) · 🟠 High (broken feature) · 🟡 Medium (wrong output) · 🟢 Low

---

## BUG-01 🔴 `cancel-expired-orders` cron does NOT restore stock

**File:** `app/api/cron/cancel-expired-orders/route.ts`  
**Lines:** Inside the `db.transaction` block — the points and coupon reversal code exists, but the stock restoration loop is MISSING.

**Root cause:**  
Stock is decremented at **initiate time** (when the order is first created) to prevent overselling. When the cron cancels an expired `pending_payment` order, it correctly reverses points (lines 94–117) and coupons (lines 121–128), but it never re-increments stock.

When Midtrans later sends the `expire` webhook, the webhook handler sees `order.status === 'cancelled'` and returns `already_cancelled` (idempotency guard), skipping the stock restoration in the webhook handler. Result: **stock for that order variant is permanently lost**.

**Proof:** The webhook handler (midtrans/route.ts:78–80) returns early for already-cancelled orders:
```ts
if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status)) {
  return success({ received: true, note: 'already_cancelled' });
}
```
And the cancel-expired cron has no stock loop, only:
```ts
// Reverse points if used
if (order.userId && order.pointsUsed > 0) { ... }
// Reverse coupon usage
if (order.couponId) { ... }
// ← no stock restoration here
```

**Fix:** Add a stock restoration loop inside the cron's transaction block, after the `orderStatusHistory` insert:

```ts
// In app/api/cron/cancel-expired-orders/route.ts
// Add inside db.transaction(), after the orderStatusHistory insert:

for (const item of order.items) {
  const [updated] = await tx
    .update(productVariants)
    .set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
    .where(eq(productVariants.id, item.variantId))
    .returning({ newStock: productVariants.stock });

  if (updated) {
    await tx.insert(inventoryLogs).values({
      variantId: item.variantId,
      changeType: 'reversal',
      quantityBefore: updated.newStock - item.quantity,
      quantityAfter: updated.newStock,
      quantityDelta: item.quantity,
      orderId: order.id,
      note: `Pembatalan expired order ${order.orderNumber} — stok dikembalikan`,
    });
  }
}
```

Also add `inventoryLogs` and `productVariants` to the imports at the top of the file.

---

## BUG-02 🔴 `reconcile-payments` cron double-deducts stock

**File:** `app/api/cron/reconcile-payments/route.ts`  
**Lines:** 86–106

**Root cause:**  
Stock is already decremented at **initiate time**. The reconcile cron's settlement path re-deducts stock for the same items:

```ts
// reconcile-payments/route.ts:88-94
const result = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)`, updatedAt: new Date() })
  .where(and(eq(productVariants.id, item.variantId)))
  .returning({ newStock: productVariants.stock });
```

Compare to the webhook handler (midtrans/route.ts:122–141), which explicitly does NOT deduct stock at settlement (only logs):
```ts
// BUG-07: Stock was already decremented at initiate time to prevent overselling.
// At settlement we only need to log the sale — no stock deduction needed here.
```

**Impact:** Any order recovered via the reconcile cron (missed webhook) results in double-deducted inventory. Physical stock becomes inconsistent with the database.

**Fix:** In the reconcile cron's settlement path, remove the stock UPDATE and change to an inventory LOG only — matching the webhook handler approach:

```ts
// Replace the update+log block with log-only:
for (const item of fullOrder.items) {
  const [currentVariant] = await tx
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, item.variantId));

  if (currentVariant) {
    await tx.insert(inventoryLogs).values({
      variantId: item.variantId,
      changeType: 'sale',
      quantityBefore: currentVariant.stock + item.quantity,
      quantityAfter: currentVariant.stock,
      quantityDelta: -item.quantity,
      orderId: fullOrder.id,
      note: '[Reconcile] Inventory sale log — stock already deducted at initiate',
    });
  }
}
```

---

## BUG-03 🔴 `account/vouchers` crashes with ReferenceError — `userId` is undefined

**File:** `app/api/account/vouchers/route.ts`  
**Line:** 63

**Root cause:**  
The variable `userId` is used but never declared in this scope:
```ts
// line 63
const userUsageCounts = userId   // ← 'userId' is undefined — ReferenceError at runtime
  ? await db
      .select({ ... })
      .from(couponUsages)
      .where(eq(couponUsages.userId, userId))   // ← same undefined variable
      .groupBy(couponUsages.couponId)
  : [];
```

The session user id is available as `session.user.id!` (validated at the top of the function), but was never assigned to a local `userId` variable.

**Impact:** The entire `/api/account/vouchers` endpoint throws a JavaScript ReferenceError on every request. The account vouchers page is completely broken.

**Fix:** Replace `userId` with `session.user.id!` on both lines 63 and 66:

```ts
const userUsageCounts = await db
  .select({
    couponId: couponUsages.couponId,
    useCount: sql<number>`count(*)::int`,
  })
  .from(couponUsages)
  .where(eq(couponUsages.userId, session.user.id!))
  .groupBy(couponUsages.couponId);
```

(Remove the ternary — since we've already verified `session.user.id` is non-null at line 12.)

---

## BUG-04 🟠 `account/vouchers` incorrectly hides coupons with `maxUsesPerUser > 1`

**File:** `app/api/account/vouchers/route.ts`  
**Line:** 82

**Root cause:**  
```ts
availableCoupons: trulyAvailable.filter(c => !usedCouponIds.includes(c.id)),
```

`usedCouponIds` is built from ALL `couponUsages` records for this user — including one-time usage. This filter removes coupons the user has EVER used, even if `maxUsesPerUser` allows multiple uses. For example, a coupon with `maxUsesPerUser: 3` disappears from the "available" list after the first use, even though 2 more uses are allowed.

**Fix:** Instead of filtering on `usedCouponIds`, use the `trulyAvailable` result (which already checks per-user usage via `userUsageMap`) and just mark used ones:

```ts
return success({
  usedCoupons: usedCouponsWithDetails,
  availableCoupons: trulyAvailable,  // already filtered by per-user limit via userUsageMap
});
```

The `trulyAvailable` array already handles this correctly via:
```ts
const trulyAvailable = availableCouponsList.filter(coupon => {
  if (!coupon.maxUsesPerUser) return true;
  return (userUsageMap.get(coupon.id) ?? 0) < coupon.maxUsesPerUser;
});
```

---

## BUG-05 🟠 Per-user coupon limit not checked at checkout initiate

**File:** `app/api/checkout/initiate/route.ts`  
**Note:** The `/api/coupons/validate` route checks `maxUsesPerUser` but the initiate route does not re-validate it.

**Root cause:**  
At checkout initiate, coupon validation may call the validate endpoint as a pre-check, but the initiate route itself does not enforce `maxUsesPerUser`. A user who has already used a coupon the maximum allowed times can bypass the limit by:
1. Manually constructing the checkout request
2. Rapidly submitting before validate response returns

**Fix:** In `app/api/checkout/initiate/route.ts`, after fetching the coupon object, add:

```ts
if (coupon.maxUsesPerUser) {
  const userUsageCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(couponUsages)
    .where(and(
      eq(couponUsages.couponId, coupon.id),
      eq(couponUsages.userId, session.user.id)
    ));
  
  if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
    return conflict('Anda sudah menggunakan kupon ini sebanyak batas maksimum');
  }
}
```

Place this check after the coupon is fetched and validated as active/not-expired, but before the order is created.

---

## BUG-06 🟠 Guest checkout has no idempotency — double-click creates duplicate orders

**File:** `app/api/checkout/initiate/route.ts`  
**Scope:** Guest checkout path (no session)

**Root cause:**  
For authenticated users, there's likely a check (e.g., recent order dedup). But for guests, there is NO dedup at all. A user who double-clicks "Bayar Sekarang" or has a slow connection and retries can create two identical orders, both decrementing stock and creating Midtrans transactions.

**Fix:** Add a short-window idempotency key for guests. Use the combination of `recipientEmail + total + items hash` as a dedup key with a 60-second TTL using Redis or a DB timestamp check:

```ts
// In the guest checkout path of initiate route:
if (!session) {
  const recentDuplicate = await db.query.orders.findFirst({
    where: and(
      eq(orders.recipientEmail, body.recipientEmail),
      eq(orders.totalAmount, computedTotal),
      gte(orders.createdAt, new Date(Date.now() - 60_000)), // 60 sec window
      eq(orders.status, 'pending_payment'),
    ),
  });
  
  if (recentDuplicate) {
    return success({
      orderNumber: recentDuplicate.orderNumber,
      snapToken: recentDuplicate.midtransSnapToken,
      paymentUrl: `https://app.midtrans.com/snap/v2/vtweb/${recentDuplicate.midtransSnapToken}`,
    });
  }
}
```

---

## BUG-07 🟡 Checkout success page shows pickup orders wrong points copy

**File:** `app/(store)/checkout/success/page.tsx`  
**Lines:** 74–78

**Issue:**  
The success page shows:
```
+{orderData.order.pointsEarned} poin
(akan masuk setelah pembayaran dikonfirmasi)
```

For pickup orders, this is technically correct (payment webhook triggers points award). But the phrasing "setelah pembayaran dikonfirmasi" (after payment is confirmed) is confusing because the user is ALREADY on the success page, meaning payment was initiated. Points are awarded after Midtrans settlement webhook — which for pickup orders happens immediately after payment.

Additionally, the points displayed are from `order.pointsEarned` which is set at initiate time (the order was just created, not yet paid). The customer sees points "earned" before the webhook has run.

**Fix:** Update the copy to:
```tsx
<p className="text-xs text-text-secondary mt-1">
  Poin akan dikreditkan setelah pembayaran dikonfirmasi oleh sistem
</p>
```

And show the points block only after `orderData.order.status === 'paid'` (poll the order status with a short interval, or hide points on first load and show after a 5s delay).

---

## BUG-08 🟡 Reconcile cron `pointsBalanceAfter` uses raw SQL string in history record

**File:** `app/api/cron/reconcile-payments/route.ts`  
**Lines:** 113–117

**Issue:**
```ts
await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: sql`(SELECT points_balance FROM users WHERE id = ${fullOrder.userId})`,
  // ↑ stores SQL expression object, not an integer
});
```

`pointsBalanceAfter` is an `integer` column. Passing a Drizzle `sql` template here may insert a SQL expression string or `null` instead of the actual integer. This pollutes the points history audit trail.

**Fix:** Read the updated balance explicitly after the UPDATE:

```ts
const [updatedUser] = await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance + ${fullOrder.pointsEarned}` })
  .where(eq(users.id, fullOrder.userId))
  .returning({ pointsBalance: users.pointsBalance });

const newBalance = updatedUser?.pointsBalance ?? 0;

await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: newBalance,  // actual integer
});
```

---

## Summary Table

| Bug | File | Severity | Category |
|-----|------|----------|----------|
| BUG-01 | `cron/cancel-expired-orders/route.ts` | 🔴 Critical | Stock not restored on expiry |
| BUG-02 | `cron/reconcile-payments/route.ts` | 🔴 Critical | Double stock deduction |
| BUG-03 | `api/account/vouchers/route.ts:63` | 🔴 Critical | ReferenceError crash |
| BUG-04 | `api/account/vouchers/route.ts:82` | 🟠 High | Wrong coupon availability |
| BUG-05 | `api/checkout/initiate/route.ts` | 🟠 High | Coupon limit bypass |
| BUG-06 | `api/checkout/initiate/route.ts` | 🟠 High | Guest duplicate orders |
| BUG-07 | `checkout/success/page.tsx:74` | 🟡 Medium | Misleading points copy |
| BUG-08 | `cron/reconcile-payments/route.ts:113` | 🟡 Medium | SQL in integer column |
