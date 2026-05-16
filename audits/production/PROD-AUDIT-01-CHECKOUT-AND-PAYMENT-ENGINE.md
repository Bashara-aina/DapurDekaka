# PROD-AUDIT-01: Checkout & Payment Engine
**Status: NOT PRODUCTION READY — 8 critical bugs, 4 high severity**
**Focus: `app/api/checkout/`, `app/api/webhooks/midtrans/`, checkout UI pages**

---

## BUG-01 [CRITICAL] Free items priced at `1` in Midtrans causes transaction rejection

**File:** `app/api/checkout/initiate/route.ts` ~line 610–617

**Problem:** Free items (`buy_x_get_y` promotions) are stored in `orderItems` with `unitPrice: 0, subtotal: 0` so `order.totalAmount` correctly excludes them. But in the `itemDetails` array sent to Midtrans, these same free items are given `price: 1`. The Midtrans `grossAmount` equals `order.totalAmount`, but the sum of `item_details` prices = `totalAmount + freeItemCount`. Midtrans validates that `sum(item_details) === gross_amount` and will reject with "item details mismatch".

**Fix:**
```typescript
// In the itemDetails mapping for free/promo items, set price: 0
const freeItemsDetails = appliedFreeItems.map(item => ({
  id: item.variantId,
  price: 0,           // ← was: 1
  quantity: item.quantity,
  name: item.name,
}));
```
Or exclude free items from `itemDetails` entirely (include a single line-item for "Promo Discount" instead).

---

## BUG-02 [CRITICAL] Midtrans `capture` status (credit card) never handled — CC payments stuck forever

**File:** `app/api/webhooks/midtrans/route.ts` ~line 101

**Problem:** The webhook handler only treats `settlement` as a successful payment. Midtrans sends `capture` for credit card transactions that are auto-captured. Credit card orders will remain in `pending_payment` indefinitely until the reconciliation cron runs (if ever).

**Fix:**
```typescript
// Current (broken):
if (transaction_status === 'settlement') {

// Fixed:
if (transaction_status === 'settlement' || transaction_status === 'capture') {
```

---

## BUG-03 [CRITICAL] 1-hour stale webhook rejection breaks all VA/bank transfer payments

**File:** `app/api/webhooks/midtrans/route.ts` ~line 53–60

**Problem:** Virtual account and bank transfer payments can be settled hours or days after the order is created. The stale-webhook check rejects any notification older than 1 hour with a 400. Midtrans will retry indefinitely, but the order will never be marked paid. The customer actually paid but the order stays in `pending_payment`.

**Fix:** Remove the stale-time check entirely. Idempotency is already handled by the `midtransTransactionId` uniqueness check at line 75. If a replay-attack concern exists, rely on the Midtrans signature verification (already in place).

```typescript
// DELETE this entire block:
const webhookAge = Date.now() - new Date(notification.transaction_time).getTime();
if (webhookAge > 60 * 60 * 1000) {
  return NextResponse.json({ error: 'Stale webhook' }, { status: 400 });
}
```

---

## BUG-04 [CRITICAL] Retry endpoint cancels order on 3rd failure with zero side-effects

**File:** `app/api/checkout/retry/route.ts` ~line 46–52

**Problem:** When `paymentRetryCount >= 3`, the code does `db.update(orders).set({ status: 'cancelled' })` — a bare update with no transaction, no points reversal, no coupon reversion (`couponUsages` row not deleted, `coupon.usedCount` not decremented), no inventory restoration, no `orderStatusHistory` entry. The customer's points are permanently lost and the coupon is permanently consumed even though the order is cancelled.

**Fix:** Wrap in a transaction and mirror the full cancellation side-effects from the webhook's cancel path:

```typescript
await db.transaction(async (tx) => {
  // 1. Update order status
  await tx.update(orders)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(eq(orders.id, order.id));

  // 2. Write status history
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: 'cancelled',
    changedBy: 'system',
    note: 'Cancelled after 3 failed payment retries',
  });

  // 3. Restore stock
  for (const item of order.items) {
    await tx.update(productVariants)
      .set({ stock: sql`stock + ${item.quantity}` })
      .where(eq(productVariants.id, item.variantId));
  }

  // 4. Reverse coupon if used
  if (order.couponId) {
    await tx.update(coupons)
      .set({ usedCount: sql`used_count - 1` })
      .where(eq(coupons.id, order.couponId));
    await tx.delete(couponUsages)
      .where(eq(couponUsages.orderId, order.id));
  }

  // 5. Reverse points if redeemed
  if (order.pointsUsed && order.pointsUsed > 0) {
    await tx.update(users)
      .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
      .where(eq(users.id, order.userId));
    // Also unconsume FIFO earn records:
    const redeemRecord = await tx.query.pointsHistory.findFirst({
      where: and(eq(pointsHistory.orderId, order.id), eq(pointsHistory.type, 'redeem')),
    });
    if (redeemRecord?.metadata?.consumedEarnIds) {
      for (const earnId of redeemRecord.metadata.consumedEarnIds) {
        await tx.update(pointsHistory)
          .set({ consumedAt: null })
          .where(eq(pointsHistory.id, earnId));
      }
    }
  }
});
```

---

## BUG-05 [CRITICAL] Admin-created orders never insert `orderItems` — orders are empty

**File:** `app/api/admin/orders/route.ts` POST ~line 173–203

**Problem:** The POST handler validates `data.items` in its Zod schema but never inserts them into the `order_items` table. Every admin-created order will have no items, making order detail pages crash and inventory reports incorrect. The order number generator also uses a plain `count(*)` — not atomic — so concurrent admin order creation can produce duplicate order numbers.

**Fix:**
```typescript
// After creating the order:
const [newOrder] = await tx.insert(orders).values({ ... }).returning();

// INSERT the items:
if (data.items && data.items.length > 0) {
  await tx.insert(orderItems).values(
    data.items.map(item => ({
      orderId: newOrder.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.quantity * item.unitPrice,
    }))
  );

  // Decrement stock for each item
  for (const item of data.items) {
    await tx.update(productVariants)
      .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
      .where(eq(productVariants.id, item.variantId));
  }
}

// Write initial status history
await tx.insert(orderStatusHistory).values({
  orderId: newOrder.id,
  fromStatus: null,
  toStatus: newOrder.status,
  changedBy: session.user.id,
  note: 'Order created manually by admin',
});
```

For order number generation, use the same `orderDailyCounters` upsert pattern from `lib/utils/generate-order-number.ts`.

---

## BUG-06 [CRITICAL] `process.exit(0)` in `lib/points/expiry-check.ts` kills the Next.js server

**File:** `lib/points/expiry-check.ts` ~line 111–121

**Problem:** The file ends with a self-executing block:
```typescript
checkExpiringPoints().then(() => process.exit(0)).catch(() => process.exit(1));
```
If this file is ever imported (even transitively), it will execute DB queries, send emails, then call `process.exit(0)`, killing the entire Next.js server process. Additionally, lines 56–57 hardcode the developer's email `'bashara@dapurdekaka.com'` as a skip exception in production business logic.

**Fix:** Delete the self-executing block entirely. The cron endpoint (`/api/cron/points-expiry-warning/route.ts`) should call `checkExpiringPoints()` directly. Remove the hardcoded email exception.

```typescript
// DELETE from lib/points/expiry-check.ts:
// Everything after the exported function declaration, including:
checkExpiringPoints()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });

// Also remove/replace line 56:
// if (user.email === 'bashara@dapurdekaka.com') continue; ← DELETE THIS
```

---

## BUG-07 [CRITICAL] No stock reservation — concurrent buyers can oversell

**File:** `app/api/checkout/initiate/route.ts` ~line 114–152

**Problem:** Stock is checked at initiate time, but stock is only decremented in the Midtrans webhook (after payment confirmation). The window between `initiate` and webhook (could be minutes) allows two customers to both pass the stock check, both pay, and both have confirmed orders — even when only 1 unit of stock exists.

**Fix (recommended — decrement at initiate, restore at cancel/expire):**
```typescript
// Inside the main transaction at initiate time, after validating stock:
for (const item of validatedItems) {
  const [updated] = await tx
    .update(productVariants)
    .set({ stock: sql`stock - ${item.quantity}` })
    .where(
      and(
        eq(productVariants.id, item.variantId),
        gte(productVariants.stock, item.quantity)  // atomic guard
      )
    )
    .returning({ newStock: productVariants.stock });

  if (!updated) {
    throw new Error(`Insufficient stock for variant ${item.variantId}`);
  }
}
```
Then remove the stock decrement from the webhook's settlement path (since it was already decremented at initiate).
Make sure `cancel-expired-orders` cron, `retry` cancellation, and webhook cancellation all restore stock.

---

## BUG-08 [CRITICAL] Per-user coupon limit bypassable with concurrent checkout

**File:** `app/api/checkout/initiate/route.ts` ~line 362–388

**Problem:** The `maxUsesPerUser` check queries `couponUsages` to count prior uses. But the `couponUsages` row is only inserted at settlement (webhook). Two simultaneous checkout sessions with the same coupon both pass the check (no rows exist yet) and both create orders. The second settlement hits the DB but not the per-user limit guard.

**Fix:** Insert a provisional `couponUsages` row at initiate time, inside the main transaction:

```typescript
// Inside the main transaction, after coupon validation passes:
if (coupon && coupon.maxUsesPerUser) {
  // Provisional row — will be cleaned up if order is cancelled
  await tx.insert(couponUsages).values({
    couponId: coupon.id,
    orderId: newOrder.id,  // use the newly created orderId
    userId: userId,
    usedAt: new Date(),
  });
}
```
The webhook's settlement path should then check if a `couponUsages` row already exists before inserting (use `ON CONFLICT DO NOTHING`).

---

## BUG-09 [HIGH] `pointsBalanceAfter` stored as SQL expression literal, not an integer

**File:** `app/api/checkout/initiate/route.ts` ~line 477

**Problem:**
```typescript
pointsBalanceAfter: sql`points_balance`,  // ← this is a SQL column reference, not a value
```
This will store the literal string `"points_balance"` (or fail with a type error) in the `integer NOT NULL` column. The points history record will have invalid data.

**Fix:**
```typescript
// After the user points balance update, read the new balance:
const [updatedUser] = await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance - ${pointsToRedeem}` })
  .where(eq(users.id, userId))
  .returning({ pointsBalance: users.pointsBalance });

// Then use the returned value:
await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: updatedUser.pointsBalance,  // ← correct integer
});
```

---

## BUG-10 [HIGH] `free_shipping` coupon type not handled — falls through to `discountAmount = 0` silently

**File:** `app/api/checkout/initiate/route.ts` ~line 200–279

**Problem:** The coupon type handler checks `percentage`, `fixed`, and `buy_x_get_y` but not `free_shipping`. The schema enum includes `'free_shipping'`. The current code falls through without setting `discountAmount`, so the client-provided `discountAmount` value is used directly — exploitable by a malicious client.

**Fix:** Add the missing branch:
```typescript
} else if (coupon.type === 'free_shipping') {
  discountAmount = 0; // Discount is applied to shipping, not subtotal
  shippingDiscount = shippingCost; // Zero out shipping cost
}
```
Also validate that `parsed.data.discountAmount` is never trusted from the client — always recompute server-side.

---

## BUG-11 [HIGH] Reconcile payments cron has no atomic guard — races with the webhook

**File:** `app/api/cron/reconcile-payments/route.ts` ~line 71–135

**Problem:** When recovering a missed settlement, the cron does `db.update(orders).set({ status: 'paid' })` without a conditional `WHERE status = 'pending_payment'` guard. If the Midtrans webhook fires at the same time, both the webhook and cron will update the order, double-award points, and double-decrement the coupon's `usedCount`.

**Fix:**
```typescript
// Always use a conditional WHERE to make the update atomic:
const [updated] = await tx
  .update(orders)
  .set({ status: 'paid', paidAt: new Date() })
  .where(
    and(
      eq(orders.id, order.id),
      eq(orders.status, 'pending_payment')  // ← guard: only update if still pending
    )
  )
  .returning();

if (!updated) {
  // Another process already handled this order, skip all side-effects
  continue;
}
// Only award points, update coupon, etc. if `updated` is truthy
```

---

## BUG-12 [HIGH] Admin order cancellation reverses points with wrong type and skips FIFO unconsume

**File:** `app/api/admin/orders/[id]/status/route.ts` ~line 171–187

**Problem:** When an admin cancels an order where points were redeemed, the code restores the balance and inserts a `pointsHistory` record with `type: 'expire'` (should be `type: 'adjust'` or `type: 'refund'`). More critically, it does NOT find and clear `consumedAt` on the earn records that were FIFO-consumed during the original redemption. Those earn records remain marked as consumed, so they won't be available for future redemptions despite the balance being restored.

**Fix:**
```typescript
// Find the original redeem record
const redeemRecord = await tx.query.pointsHistory.findFirst({
  where: and(
    eq(pointsHistory.orderId, orderId),
    eq(pointsHistory.type, 'redeem')
  ),
});

// Restore balance
await tx.update(users)
  .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
  .where(eq(users.id, order.userId));

// Write reversal history with correct type
await tx.insert(pointsHistory).values({
  userId: order.userId,
  orderId: orderId,
  type: 'adjust',   // ← not 'expire'
  pointsAmount: order.pointsUsed,
  note: `Points refunded - order ${order.orderNumber} cancelled by admin`,
  pointsBalanceAfter: /* compute from updated user */,
});

// Unconsume FIFO earn records
if (redeemRecord?.metadata?.consumedEarnIds) {
  await tx.update(pointsHistory)
    .set({ consumedAt: null })
    .where(inArray(pointsHistory.id, redeemRecord.metadata.consumedEarnIds));
}
```

---

## BUG-13 [HIGH] `checkout/success/page.tsx` — `useQuery` called after `useEffect` that depends on it (hooks ordering)

**File:** `app/(store)/checkout/success/page.tsx` ~line 15–44

**Problem:** The `useEffect` at line 15 references `orderData` which is declared at line 25 (the `useQuery` call comes after the effect). While React hooks ordering rules technically only care about the call sequence (not declaration sequence), the TypeScript type checker will error because `orderData` is `undefined` at the point of the `useEffect` callback closure. Additionally, `pointsEarned` is missing from the `useQuery` generic type but accessed in JSX.

**Fix:**
1. Move the `useQuery` call to before all `useEffect` calls that reference `orderData`.
2. Add `pointsEarned: number` to the generic type:

```typescript
const { data: orderData } = useQuery<{
  order: {
    orderNumber: string;
    status: string;
    totalAmount: number;
    pointsEarned: number;   // ← add this
    verified: boolean;
    // ... rest of fields
  }
}>({ ... });

// THEN the useEffect that uses orderData:
useEffect(() => {
  if (orderData?.order?.status === 'paid') { ... }
}, [orderData]);
```
