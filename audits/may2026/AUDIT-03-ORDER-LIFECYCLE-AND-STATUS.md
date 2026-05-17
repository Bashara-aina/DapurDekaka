# AUDIT-03 — Order Lifecycle & Status Management
**Date:** 2026-05-16  
**Scope:** Order tracking, status transitions, `OrderTrackingClient`, status history, email triggers  
**Severity legend:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## BUG-01 🔴 `OrderTrackingClient` auto-verify for logged-in users never works

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`  
**Lines:** 104–118

**Root cause:**  
```ts
useEffect(() => {
  async function tryAutoVerify() {
    try {
      const res = await fetch(`/api/orders/${orderNumber}`);
      const data = await res.json();
      if (data?.order && data?.verified) {    // ← WRONG: checks data.order not data.data.order
        setOrder(data.order as Order);
        setVerified(true);
      }
    } catch {
      // Not logged in or not their order
    }
  }
  tryAutoVerify();
}, [orderNumber]);
```

The `success()` utility wraps all responses in `{ success: true, data: { ... } }`. So the API response shape is:
```json
{
  "success": true,
  "data": {
    "order": { ... },
    "verified": true
  }
}
```

But the client reads `data?.order` and `data?.verified` — these are **one level too shallow**. They should be `data?.data?.order` and `data?.data?.verified`.

**Impact:** Logged-in users who own an order are forced through the email verification form instead of auto-loading their order. Every logged-in user sees the "Enter email to verify" gate even when they're authenticated.

**Fix:**
```ts
const data = await res.json();
const payload = data?.data;   // unwrap the success envelope
if (payload?.order && payload?.verified) {
  setOrder(payload.order as Order);
  setVerified(true);
}
```

Also check the manual email verification handler `handleVerifyEmail` at ~line 120+ for the same response unwrapping pattern.

---

## BUG-02 🟠 Admin cancel of paid order does NOT reverse `pointsEarned` already credited

**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Lines:** 141–218

**Root cause:**  
When a PAID order is cancelled by admin, the handler:
- ✅ Restores stock (lines 146–168)
- ✅ Reverses `pointsUsed` (lines 171–207)
- ✅ Reverses coupon `usedCount` (lines 210–216)
- ❌ Does NOT reverse `pointsEarned`

When an order is paid via Midtrans webhook, `pointsEarned` points are credited to the user's balance (webhook handler lines 152–173). But when admin later cancels a paid order (e.g., customer requested refund), those earned points remain in the user's balance permanently. The user keeps free points from an order that was refunded.

**Impact:** Users accumulate loyalty points from refunded/cancelled paid orders. Financial integrity issue.

**Fix:** In `admin/orders/[id]/status/route.ts`, inside the `if (newStatus === 'cancelled')` block, after reversing points-used, also reverse points-earned if the order was previously paid:

```ts
// In the cancellation transaction block, after handling pointsUsed reversal:

const statusesThatEarnedPoints = ['paid', 'processing', 'packed', 'shipped', 'delivered'];
if (order.userId && order.pointsEarned > 0 && statusesThatEarnedPoints.includes(currentStatus)) {
  // Find the earn record for this order
  const earnRecord = await tx.query.pointsHistory.findFirst({
    where: and(
      eq(pointsHistory.orderId, orderId),
      eq(pointsHistory.type, 'earn'),
      eq(pointsHistory.userId, order.userId),
    ),
  });

  if (earnRecord && !earnRecord.consumedAt) {
    // Deduct earned points (mark as expired to prevent reuse)
    const [updatedUser] = await tx
      .update(users)
      .set({ pointsBalance: sql`GREATEST(points_balance - ${order.pointsEarned}, 0)` })
      .where(eq(users.id, order.userId))
      .returning({ pointsBalance: users.pointsBalance });

    await tx.insert(pointsHistory).values({
      userId: order.userId,
      type: 'adjust',
      pointsAmount: -order.pointsEarned,
      pointsBalanceAfter: updatedUser?.pointsBalance ?? 0,
      descriptionId: `Poin dicabut — pembatalan pesanan ${order.orderNumber}`,
      descriptionEn: `Points reversed — order ${order.orderNumber} cancelled`,
      orderId: orderId,
    });

    // Mark the original earn record as consumed to prevent double-reversal
    await tx.update(pointsHistory)
      .set({ consumedAt: new Date() })
      .where(eq(pointsHistory.id, earnRecord.id));
  }
}
```

---

## BUG-03 🟠 Admin status change: warehouse can call admin PATCH with `shipped` even on `paid` orders

**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Lines:** 82–98, 100–103

**Root cause:**  
```ts
// VALID_TRANSITIONS enforces:
paid: ['processing', 'cancelled'],
processing: ['packed', 'cancelled'],
packed: ['shipped', 'cancelled'],

// Warehouse restriction:
const WAREHOUSE_TRANSITIONS = ['shipped'];
if (role === 'warehouse' && !WAREHOUSE_TRANSITIONS.includes(newStatus)) {
  return forbidden('...');
}
```

Warehouse can only set status to `shipped`. But `VALID_TRANSITIONS` requires an order to be in `packed` state before going to `shipped`. The `VALID_TRANSITIONS` check is:
```ts
} else if (!allowedTransitions?.includes(newStatus)) {
  return conflict(`Tidak dapat mengubah status dari ${currentStatus} ke ${newStatus}`);
}
```

This check IS correct and would block `paid → shipped`. However, the warehouse transition check comes AFTER the VALID_TRANSITIONS check. So a warehouse user trying to ship a `paid` order gets the VALID_TRANSITIONS error, not the forbidden error. The flow logic is correct but the error message is confusing.

**Actual problem:** The field `packing-queue` API bypasses the admin status route entirely and allows `paid → packed` directly. This is intentional (warehouse uses field API). The admin route's warehouse restriction is for when warehouse accesses the admin UI. This design is correct but undocumented.

**Fix (documentation only):** Add a comment in the status route explaining:
```ts
// Note: Warehouse staff are expected to use the /api/admin/field/* endpoints (packing-queue, tracking-queue)
// which have dedicated authorization. The warehouse restriction here only applies if they access
// the admin panel's status update directly, which is the /admin/orders/[id] page.
```

No code change needed — this is architectural intent.

---

## BUG-04 🟠 Order status history `fromStatus` is not always set correctly

**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Lines:** 129–138

**Issue:**
```ts
await tx.insert(orderStatusHistory).values({
  orderId: order.id,
  fromStatus: currentStatus as any,  // ← 'as any' bypasses type safety
  toStatus: newStatus as any,
  ...
});
```

The `fromStatus` field is read from `order.status` fetched BEFORE the transaction. If there's a concurrent status change between the fetch and the transaction, `fromStatus` could record an incorrect state. However, there is no optimistic locking check (no `.where(eq(orders.status, currentStatus))`) on the orders UPDATE.

**Impact:** Under concurrent admin access, status history can record incorrect transitions, making auditing unreliable.

**Fix:** Add a conditional check on the UPDATE to ensure atomicity:

```ts
const [updatedOrder] = await tx
  .update(orders)
  .set(updateData)
  .where(and(
    eq(orders.id, orderId),
    eq(orders.status, currentStatus as any),  // optimistic lock
  ))
  .returning({ id: orders.id, status: orders.status });

if (!updatedOrder) {
  throw new Error('ORDER_STATUS_CHANGED_CONCURRENTLY');
}
```

Then in the catch block, handle `ORDER_STATUS_CHANGED_CONCURRENTLY` with a 409 Conflict response.

---

## BUG-05 🟠 Pickup orders in account order list are missing pickup code display

**File:** `app/(store)/account/orders/page.tsx`  
**Scope:** Order list items for pickup orders

**Root cause:**  
The `orders.pickupCode` column exists in the schema and is set in the webhook handler:
```ts
// midtrans/route.ts:
pickupCode: order.orderNumber,  // set for pickup orders
```

Wait — looking at the webhook again, `pickupCode` is NOT explicitly set in the webhook handler. The `orders.pickupCode` is set to `null` unless explicitly assigned. The pickup invitation email uses `order.orderNumber` as the pickup code (line 222), but the DB column `orders.pickupCode` remains NULL.

**Impact:** The warehouse field `orders/[id]` route that displays the pickup code shows "N/A" because `order.pickupCode` is always null. The pickup invitation email uses `pickupCode: order.orderNumber` which works, but the database column has no value.

**Fix:** In the Midtrans webhook handler (`app/api/webhooks/midtrans/route.ts`), when updating the order on settlement for pickup orders, also set `pickupCode`:

```ts
// Inside the settlement db.transaction, when updating order status:
await tx.update(orders).set({
  status: 'paid',
  paidAt: new Date(),
  midtransPaymentType: body.payment_type ?? null,
  midtransVaNumber: body.va_numbers?.[0]?.va_number ?? null,
  midtransTransactionId: body.transaction_id ?? null,
  // Add this:
  ...(order.deliveryMethod === 'pickup' && { pickupCode: order.orderNumber }),
}).where(eq(orders.id, order.id));
```

Also update the `order.orderNumber` used in PickupInvitationEmail to use `order.pickupCode ?? order.orderNumber` for future-proofing.

---

## BUG-06 🟡 Account order list crashes when `statusFilter` is an invalid enum value

**File:** `app/(store)/account/orders/page.tsx`  
**Lines:** 43–50

**Root cause:**
```ts
const ordersCondition = statusFilter
  ? (o: ReturnType<typeof eq>, { and, eq }: any) => and(eq(o.userId, session.user.id!), eq(o.status, statusFilter))
  : (o: any, { eq }: any) => eq(o.userId, session.user.id!);
```

`statusFilter` comes directly from `searchParams.status` (URL parameter). A user could visit `/account/orders?status=invalid_value` and Drizzle would attempt to filter by an invalid enum value. PostgreSQL would throw an error.

**Fix:** Validate the status against the allowed enum values before using:

```ts
const VALID_STATUSES = ['pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'] as const;

const validStatus = statusParam && VALID_STATUSES.includes(statusParam as any)
  ? statusParam as typeof VALID_STATUSES[number]
  : undefined;
```

Then use `validStatus` in the Drizzle query instead of `statusFilter`.

---

## BUG-07 🟡 No status history entry recorded when cron expires an order (cancel-expired-orders)

**File:** `app/api/cron/cancel-expired-orders/route.ts`  
**Lines:** 84–92

**Current state:**  
The cancel cron DOES insert a status history entry:
```ts
await tx.insert(orderStatusHistory).values({
  orderId: order.id,
  fromStatus: order.status,
  toStatus: 'cancelled',
  changedByUserId: null,
  changedByType: 'system',
  note: `Otomatis dibatalkan karena tidak dibayar dalam 15 menit`,
});
```

This is correct. ✅

**BUT:** The status history references `order.status` which is `pending_payment` at query time. If a concurrent webhook changes the order status between the initial query and the transaction, the `fromStatus` could be stale. The conditional WHERE (`eq(orders.status, 'pending_payment')`) guards the UPDATE but not the history insert.

**Fix:** Use `returning()` on the UPDATE to confirm the actual transition:

```ts
const cancelResult = await tx
  .update(orders)
  .set({ status: 'cancelled', cancelledAt: now })
  .where(and(eq(orders.id, order.id), eq(orders.status, 'pending_payment')))
  .returning({ id: orders.id });

if (cancelResult.length === 0) {
  return; // already handled by webhook
}

// Only insert history if cancellation was successful
await tx.insert(orderStatusHistory).values({ ... });
```

This is already done correctly (line 79-83 checks `cancelResult.length === 0`). The current code is correct. **No change needed for this specific sub-bug.**

---

## BUG-08 🟡 `OrderTimeline` component is imported but the tracking page renders its own inline timeline

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`  
**Line:** 7

**Issue:**
```ts
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
```

This import exists but looking at the OrderTrackingClient's return JSX, it renders its own hardcoded TIMELINE_STEPS array instead of using the `OrderTimeline` component. The import is either unused (dead code) or the component was intended to replace the inline timeline but was never wired up.

**Impact:** Code inconsistency. The `OrderTimeline` component's improvements won't appear in the tracking page. Dead import wastes bundle space.

**Fix (Option A):** Remove the import if the inline timeline is intentional:
```ts
// Delete: import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
```

**Fix (Option B):** Replace the inline timeline with the component (recommended for DRY):
```tsx
// Replace the inline timeline JSX with:
<OrderTimeline
  currentStatus={currentStatus}
  deliveryMethod={order?.deliveryMethod as 'delivery' | 'pickup'}
  statusHistory={[]}  // or pass actual history if available
/>
```

---

## Summary Table

| Bug | File | Severity | Impact |
|-----|------|----------|--------|
| BUG-01 | `OrderTrackingClient.tsx:108` | 🔴 Critical | Auto-verify for logged-in users broken |
| BUG-02 | `admin/orders/[id]/status/route.ts` | 🟠 High | Earned points not reversed on cancel |
| BUG-03 | `admin/orders/[id]/status/route.ts:100` | 🟠 High | Architectural — documented as intended |
| BUG-04 | `admin/orders/[id]/status/route.ts:129` | 🟠 High | Concurrent status change race condition |
| BUG-05 | `webhooks/midtrans/route.ts` | 🟠 High | pickupCode always null in DB |
| BUG-06 | `account/orders/page.tsx:43` | 🟡 Medium | Invalid status crashes DB query |
| BUG-07 | `cron/cancel-expired-orders/route.ts` | 🟡 Medium | (Already fixed — confirm no action needed) |
| BUG-08 | `OrderTrackingClient.tsx:7` | 🟢 Low | Dead import / unused component |
