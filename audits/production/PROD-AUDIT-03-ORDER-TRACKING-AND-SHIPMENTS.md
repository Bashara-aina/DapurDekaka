# PROD-AUDIT-03: Order Tracking & Shipment Management
**Status: NOT PRODUCTION READY — 4 critical, 5 high severity**
**Focus: `app/(admin)/admin/shipments/`, field tracking flow, customer-facing tracking page**

---

## The intended full shipment flow

```
Order paid → (Admin marks processing) → (Warehouse marks packed) → 
(Warehouse enters tracking number → status = shipped → email sent to customer) → 
(Delivery → status = delivered)
```

Customer-facing: `/orders/[orderNumber]` shows live status with timeline.
Admin shipments page: shows orders needing tracking numbers; warehouse enters resi.

---

## BUG-01 [CRITICAL] Shipments page SQL NULL comparison always returns 0 rows

**File:** `app/(admin)/admin/shipments/page.tsx` ~line 18

**Problem:**
```typescript
// Current (BROKEN — generates `tracking_number = NULL` in SQL, always false):
where: eq(orders.trackingNumber, null)

// What this generates in SQL:
WHERE tracking_number = NULL  ← always false/unknown in SQL
```
The shipments page will always be empty regardless of how many orders need tracking numbers. Warehouse staff cannot do their job.

**Fix:**
```typescript
import { isNull } from 'drizzle-orm';

// Correct:
where: and(
  isNull(orders.trackingNumber),
  inArray(orders.status, ['packed', 'processing']),
  eq(orders.deliveryMethod, 'delivery'),  // ← also exclude pickup orders
)
```

---

## BUG-02 [CRITICAL] Tracking queue includes pickup orders — warehouse might enter wrong tracking numbers

**File:** `app/api/admin/field/tracking-queue/route.ts` ~line 23–36

**Problem:** The tracking queue returns ALL `status = 'packed'` orders without filtering by `deliveryMethod`. Pickup orders appear in the tracking/shipping queue. Warehouse staff may attempt to enter courier tracking numbers for pickup orders, or be confused by orders that should not be there.

**Fix:**
```typescript
where: and(
  eq(orders.status, 'packed'),
  eq(orders.deliveryMethod, 'delivery'),  // ← add this
),
```

---

## BUG-03 [CRITICAL] Warehouse can transition `packed → delivered` directly — bypasses tracking number requirement

**File:** `app/api/admin/field/orders/[id]/route.ts` ~line 55–59

**Problem:**
```typescript
const WAREHOUSE_RESTRICTED_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],
  processing: ['packed'],
  packed: ['shipped', 'delivered'],  // ← warehouse can skip 'shipped' entirely
};
```
A warehouse user can mark an order as `delivered` without entering a tracking number and without going through `shipped`. The customer gets no shipped email, no tracking number, and the order jumps directly to delivered.

**Fix:**
```typescript
const WAREHOUSE_RESTRICTED_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],
  processing: ['packed'],
  packed: ['shipped'],      // ← warehouse can only do packed → shipped (requires tracking number)
  // 'shipped' → 'delivered' is done by admin/system only
};
```

---

## BUG-04 [CRITICAL] Status update and status history insert are separate DB calls — no transaction

**File:** `app/api/admin/field/orders/[id]/route.ts` ~line 143–153

**Problem:**
```typescript
await db.update(orders).set({ status: newStatus }).where(...);        // call 1
await db.insert(orderStatusHistory).values({ orderId, ... });        // call 2
```
These two operations are NOT wrapped in a transaction. If the process crashes between them (OOM, Vercel timeout, network error), the order status changes but no history entry is written. The order timeline in the admin panel will show gaps.

**Fix:**
```typescript
await db.transaction(async (tx) => {
  await tx.update(orders)
    .set({
      status: newStatus,
      trackingNumber: trackingNumber ?? order.trackingNumber,
      courierCode: courierCode ?? order.courierCode,
      courierName: courierName ?? order.courierName,
      ...(newStatus === 'shipped' ? { shippedAt: new Date() } : {}),
      ...(newStatus === 'delivered' ? { deliveredAt: new Date() } : {}),
    })
    .where(eq(orders.id, orderId));

  await tx.insert(orderStatusHistory).values({
    orderId,
    fromStatus: order.status,
    toStatus: newStatus,
    changedBy: session.user.id,
    note: note || null,
  });
});
```

---

## BUG-05 [CRITICAL] Cancel-expired-orders cron never writes `orderStatusHistory`

**File:** `app/api/cron/cancel-expired-orders/route.ts` ~line 65–120

**Problem:** The cancellation transaction updates order status, reverses points, removes coupon usage, restores stock — but never inserts an `orderStatusHistory` row. Admin users reviewing order timelines will see no cancellation event. The order detail page shows the last status before cancellation with no explanation.

**Fix:** Inside the transaction, add:
```typescript
await tx.insert(orderStatusHistory).values({
  orderId: order.id,
  fromStatus: order.status,
  toStatus: 'cancelled',
  changedBy: 'system',
  note: `Otomatis dibatalkan karena tidak dibayar dalam ${PAYMENT_EXPIRY_MINUTES} menit`,
  createdAt: new Date(),
});
```

---

## BUG-06 [HIGH] Customer-facing order tracking page forces email verification for logged-in users

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` ~line 86–99

**Problem:** The component starts with `verified = false` and `order = null`. The API `GET /api/orders/[orderNumber]` returns full order data (with `verified: true`) for logged-in users who own the order — no email verification required. But the component never calls `GET` on mount. It only calls the verify endpoint (`POST`) when the email form is submitted. Logged-in users who click "Track Order" are forced to enter their email and go through a verification step that serves no security purpose for them.

**Fix:** Add an initial data fetch on mount:
```typescript
useEffect(() => {
  async function tryAutoVerify() {
    try {
      const res = await fetch(`/api/orders/${orderNumber}`);
      const data = await res.json();
      if (data?.order && data?.verified) {
        setOrder(data.order);
        setVerified(true);
      }
    } catch {
      // Not logged in or not their order — show the email form
    }
  }
  tryAutoVerify();
}, [orderNumber]);
```

---

## BUG-07 [HIGH] Worker activity query uses wrong table column for user lookup

**File:** `app/api/admin/field/worker-activity/route.ts` ~line 43

**Problem:**
```typescript
// Current (BROKEN):
const user = await db.query.users.findFirst({
  where: eq(adminActivityLogs.userId, uid)  // ← wrong table's column used in users query
});

// This generates: SELECT ... FROM users WHERE admin_activity_logs.user_id = $1
// SQL will error or return nothing (column from different table in WHERE clause)
```

**Fix:**
```typescript
const user = await db.query.users.findFirst({
  where: eq(users.id, uid)  // ← correct column from the users table
});
```

---

## BUG-08 [HIGH] Today-summary `packedToday` counts wrong orders

**File:** `app/api/admin/field/today-summary/route.ts` ~line 24–31

**Problem:** The query counts orders currently in `packed` status AND updated today. An order packed last week that had its `updatedAt` bumped today (e.g. someone looked at it, or a cron touched it) will be counted as "packed today". The intent is to count orders that *transitioned to* packed today.

**Fix:** Join against `orderStatusHistory` to count actual transitions:
```typescript
const packedToday = await db
  .select({ count: count() })
  .from(orderStatusHistory)
  .where(
    and(
      eq(orderStatusHistory.toStatus, 'packed'),
      gte(orderStatusHistory.createdAt, startOfDay),
      lt(orderStatusHistory.createdAt, endOfDay)
    )
  );
```

---

## BUG-09 [HIGH] `packing-queue` skips `processing` step — creates status history gaps

**File:** `app/api/admin/field/packing-queue/route.ts` ~line 68–84

**Problem:** The packing queue transitions orders directly from `paid` to `packed`, skipping `processing`. The admin order status route enforces `paid → processing → packed` as sequential steps. The field queue bypasses this, creating order timelines that skip an entire status. Admin dashboards tracking "orders in processing" will miss orders that went through the field queue.

**Fix (option A — add intermediate step):**
```typescript
// When marking as packed from field:
await db.transaction(async (tx) => {
  // First: paid → processing
  await tx.update(orders)
    .set({ status: 'processing' })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'paid')));

  await tx.insert(orderStatusHistory).values({
    orderId, fromStatus: 'paid', toStatus: 'processing',
    changedBy: session.user.id, note: 'Auto-progressed by packing queue',
  });

  // Then: processing → packed
  await tx.update(orders)
    .set({ status: 'packed', packedAt: new Date() })
    .where(eq(orders.id, orderId));

  await tx.insert(orderStatusHistory).values({
    orderId, fromStatus: 'processing', toStatus: 'packed',
    changedBy: session.user.id,
  });
});
```

**Fix (option B — align admin route to allow `paid → packed`):**
Update the `allowedTransitions` map in `admin/orders/[id]/status/route.ts` to include `paid: ['processing', 'packed']`.

---

## BUG-10 [MEDIUM] Admin order detail: no client-side validation before submitting empty tracking number

**File:** `app/(admin)/admin/orders/[id]/page.tsx` ~line 163–191

**Problem:** `handleStatusUpdate('shipped')` sends `trackingNumber: trackingNumber || undefined`. If the field is empty, the API correctly rejects with a validation error, but the UI shows a generic toast with no specific message about the tracking number. Warehouse admins don't know why the status change failed.

**Fix:** Add validation before the API call:
```typescript
async function handleStatusUpdate(newStatus: string) {
  if (newStatus === 'shipped' && !trackingNumber.trim()) {
    toast.error('Nomor resi wajib diisi sebelum mengubah status ke "Dikirim"');
    trackingNumberInputRef.current?.focus();
    return;
  }
  // ... proceed with API call
}
```

---

## BUG-11 [MEDIUM] No tracking URL generated for customers — only tracking number shown

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`
**File:** `app/api/admin/orders/[id]/status/route.ts`

**Problem:** When a tracking number is entered, customers only see a raw number. There are no deep links to courier tracking pages (JNE, JNT, SiCepat, etc.) so customers cannot easily check their delivery status.

**Fix:** Add a helper function that generates courier tracking URLs:
```typescript
// lib/utils/tracking-url.ts
const COURIER_TRACKING_URLS: Record<string, string> = {
  'jne': 'https://www.jne.co.id/id/tracking/trace/',
  'jnt': 'https://www.j-express.id/lacak/',
  'sicepat': 'https://www.sicepat.com/checkAwb?awb=',
  'anteraja': 'https://anteraja.id/tracking/',
  'pos': 'https://www.posindonesia.co.id/id/tracking/',
  'tiki': 'https://www.tiki.id/id/tracking?awb=',
  'gosend': null, // No public tracking URL
  'gojek': null,
};

export function getTrackingUrl(courierCode: string, trackingNumber: string): string | null {
  const base = COURIER_TRACKING_URLS[courierCode?.toLowerCase()];
  return base ? `${base}${trackingNumber}` : null;
}
```
Display as a button/link in the customer tracking page and in the shipped email.

---

## BUG-12 [MEDIUM] `ShipmentsClient.tsx` removes entry on success but page reload repopulates it (due to BUG-01)

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx`

**Problem:** `handleSubmitTracking` on success removes the order from the local state array. But if the user refreshes, all orders reappear because the server-side query in the page component uses the broken `eq(orders.trackingNumber, null)` (see BUG-01). Fix BUG-01 first; this symptom will resolve automatically once the SQL NULL check is correct.

---

## Complete tracking flow verification checklist

After all fixes above, verify this end-to-end flow works:

- [ ] Admin marks order `processing` → status history written ✓
- [ ] Warehouse marks order `packed` via field interface → status history written ✓
- [ ] Order appears in shipments page (via `isNull(trackingNumber)` fix) ✓
- [ ] Order does NOT appear if it's a pickup order ✓
- [ ] Warehouse enters tracking number → status changes to `shipped` ✓
- [ ] Status history entry written for `packed → shipped` ✓
- [ ] Customer receives shipped email with tracking number and courier link ✓
- [ ] Customer visits `/orders/[orderNumber]` → auto-verified if logged in ✓
- [ ] Customer sees tracking timeline with all status steps ✓
- [ ] Tracking URL link to courier website shown ✓
- [ ] Admin marks `delivered` → status history written ✓
- [ ] Pickup orders: warehouse marks `packed` → admin marks `ready for pickup` → customer collects with pickup code ✓
