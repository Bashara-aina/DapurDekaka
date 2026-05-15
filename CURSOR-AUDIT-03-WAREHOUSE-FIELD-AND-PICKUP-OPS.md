# CURSOR AUDIT 03 — Warehouse Field Dashboard & Pickup Operations
**Project:** DapurDekaka.com  
**Date:** 2026-05-15  
**Scope:** Warehouse-role operations: field dashboard, pickup queue, packing queue, inventory, tracking

---

## Overview

The field dashboard (`/admin/field`) is a sophisticated 42KB client component used by warehouse staff on mobile. The underlying APIs are well-built. However, several critical warehouse workflows are broken or disconnected due to role permission mismatches, missing data (pickupCode never set), and a disconnect between what the UI requests and what APIs allow.

---

## BUG 01 — Pickup Code Is Never Set (Pickup Queue Shows "N/A" for All Orders)

**Severity:** High — warehouse staff cannot verify customer identity for store pickup  
**Files:**  
- `lib/db/schema.ts:orders.pickupCode` (column exists, never written)  
- `app/api/checkout/initiate/route.ts` (doesn't set pickupCode)  
- `app/api/webhooks/midtrans/route.ts` (doesn't set pickupCode on payment)  

### What's broken

The `orders` table has a `pickupCode` column. The PRD states the pickup code should be generated and shown to the customer so warehouse staff can verify it. But:

1. `checkout/initiate` creates the order without setting `pickupCode` 
2. The Midtrans webhook doesn't set it on settlement
3. The pickup invitation component uses `order.orderNumber` as the "code" to display
4. The warehouse pickup queue shows `order.pickupCode ?? 'N/A'`

**Field dashboard pickup queue (from large page component):**
```ts
// Pickup code displayed in the UI as:
pickupCode: order.pickupCode ?? 'N/A'
```

All pickup orders show "N/A", making verification impossible.

### The Design Question

There are two options:
- **Option A (Simple):** The pickup code IS the order number. Set `orders.pickupCode = orders.orderNumber` when creating pickup orders. Customer shows their order number at the store. Simple and unambiguous.
- **Option B (Separate code):** Generate a shorter, human-readable code (e.g., 4-digit PIN) separately. More complex, minor UX benefit.

The current email template (`PickupInvitationEmail`) already passes `pickupCode: order.orderNumber`. So Option A is the correct intent.

### Fix

Set `pickupCode = orderNumber` when creating pickup orders in checkout initiate:

```ts
// app/api/checkout/initiate/route.ts — in the order insert values, add:
pickupCode: deliveryMethod === 'pickup' ? orderNumber : null,
```

This should be done after the order number is generated (`const orderNumber = generateOrderNumber(seq)`) and inside the transaction.

Also ensure the pickup invitation page at `app/(store)/orders/[orderNumber]/pickup/page.tsx` shows this value prominently to the customer.

---

## BUG 02 — Field Dashboard Inventory Adjust: Role Check Blocks Warehouse Staff

**Severity:** Medium — warehouse staff get 403 when trying to adjust stock from field dashboard  
**File:** `app/api/admin/field/inventory/adjust/route.ts:20-25`

### What's broken

```ts
const role = session.user.role;
if (!role || !['superadmin', 'owner'].includes(role)) {
  return forbidden('Hanya owner atau superadmin yang dapat melakukan penyesuaian manual');
}
```

Warehouse staff have role `warehouse`, which is NOT in the allowed list. But the field dashboard UI allows warehouse staff to adjust inventory. Every adjust call from the field dashboard returns 403.

### Clarification needed

There are two inventory routes:
- `POST /api/admin/field/inventory/adjust` — requires superadmin/owner, records as `adjustment`
- `POST /api/admin/field/inventory/restock` — should allow warehouse, records as `restock`

Per the PRD, warehouse staff should be able to:
- Update stock count (manual count reconciliation)
- Input received stock quantities

### Fix Option A: Allow warehouse to use the adjust route

```ts
// app/api/admin/field/inventory/adjust/route.ts
if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
  return forbidden('...');
}
```

### Fix Option B: Use the restock route for warehouse

If the field dashboard inventory section is intended to call `restock` (not `adjust`), update the field dashboard to use the correct endpoint:

```ts
// In the field dashboard component, for warehouse role:
const endpoint = role === 'warehouse' 
  ? '/api/admin/field/inventory/restock' 
  : '/api/admin/field/inventory/adjust';
```

**Recommended:** Fix Option A is simpler. The distinction between `adjustment` and `restock` is at the business level. Warehouse doing a physical count correction should be allowed via `adjust`. Add a note to the log entry.

---

## BUG 03 — Field Dashboard: No Shipped Email Sent When Warehouse Ships via Tracking Queue

**Severity:** Medium — customers don't receive "Pesanan dikirim" email when warehouse uses field dashboard  
**Files:**  
- `app/api/admin/field/tracking-queue/route.ts:PATCH` — ships the order but doesn't send email  
- `app/api/admin/orders/[id]/status/route.ts` — DOES send shipped email

### What's broken

The field tracking queue PATCH correctly moves order to `shipped` and saves tracking number, but does NOT trigger the shipped email:

```ts
// app/api/admin/field/tracking-queue/route.ts:67-72
await db.update(orders).set(updateData).where(eq(orders.id, orderId));
await db.insert(orderStatusHistory).values({...});
return success({ orderId, status: 'shipped', trackingNumber });
// ← No email sent
```

The admin order detail page sends the email via `/api/admin/orders/[id]/status`, but the field dashboard uses `/api/admin/field/tracking-queue`. So when warehouse uses the field dashboard (which they always do), no email is sent.

### Fix

Add email dispatch to the tracking queue PATCH handler:

```ts
// app/api/admin/field/tracking-queue/route.ts — after db.update, add:

// Build tracking URL
const COURIER_TRACKING_URLS: Record<string, string> = {
  SICEPAT: `https://www.sicepat.com/checkAwb?awb=${trackingNumber}`,
  JNE: `https://www.jne.co.id/id/tracking/trace/${trackingNumber}`,
  ANTERAJA: `https://anteraja.id/tracking/${trackingNumber}`,
};
const builtTrackingUrl = trackingUrl ?? 
  (courierCode ? COURIER_TRACKING_URLS[courierCode.toUpperCase()] ?? '' : '');

// Fire-and-forget email
sendEmail({
  to: order.recipientEmail,
  subject: `Pesanan ${order.orderNumber} sudah dikirim!`,
  react: OrderShippedEmail({
    orderNumber: order.orderNumber,
    customerName: order.recipientName,
    courierName: order.courierName ?? courierName ?? 'Pengiriman',
    trackingNumber,
    trackingUrl: builtTrackingUrl,
    estimatedDays: estimatedDays ?? '',
    items: order.items?.map(item => ({
      name: item.productNameId,
      variant: item.variantNameId,
      quantity: item.quantity,
    })) ?? [],
    totalAmount: order.totalAmount,
  }),
}).catch(console.error);
```

Add required imports: `sendEmail`, `OrderShippedEmail`.

---

## INCOMPLETE FEATURE 01 — Field Dashboard: Pickup Queue Shows Paid/Processing Orders, Not Pickup-Ready Orders

**Severity:** Medium — warehouse doesn't know which pickup orders to prepare  
**File:** `app/api/admin/field/pickup-queue/route.ts`

### What's needed

Check what the pickup queue API returns. It should show orders with:
- `deliveryMethod = 'pickup'`
- Status in `['paid', 'processing']` (not yet delivered)

The UI should allow warehouse to:
1. Mark as ready (update to `processing`)
2. Mark as delivered when customer arrives with pickup code
3. Verify customer's pickup code against `orders.pickupCode` (once BUG 01 is fixed)

Verify the pickup queue API returns the full order including `pickupCode` and that the field dashboard shows it prominently.

---

## INCOMPLETE FEATURE 02 — Packing Queue: No Mark-as-Packed Button for Owner/Superadmin

**Severity:** Low — owner must use admin order list to mark packed, field dashboard doesn't help  
**File:** `app/api/admin/field/packing-queue/route.ts`

The packing queue shows `paid` orders that need to be processed and packed. The field dashboard should allow moving `paid → processing → packed`. Verify the field dashboard's packing queue section has working action buttons that call `PATCH /api/admin/orders/[id]/status`.

---

## COMPLETE FEATURES IN FIELD DASHBOARD (reference for Cursor)

These field dashboard features ARE correctly implemented and should not be changed:

1. **Today's Summary** (`/api/admin/field/today-summary`) — counts packed, tracking, pickup, inventory updates today
2. **Worker Activity** (`/api/admin/field/worker-activity`) — shows recent status changes and inventory adjustments
3. **Tracking Queue** (`/api/admin/field/tracking-queue GET`) — correctly fetches `packed` orders
4. **Tracking Queue** (`/api/admin/field/tracking-queue PATCH`) — correctly sets tracking number and moves to `shipped` (but missing email — see BUG 03)
5. **Inventory GET** (`/api/admin/field/inventory`) — correctly lists all variants with stock levels

---

## MIDDLEWARE VERIFICATION

The middleware at `app/middleware.ts` correctly restricts warehouse staff:

```ts
if (role === 'warehouse') {
  const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
  if (!allowed.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/admin/field', req.url));
  }
}
```

This is correct. Warehouse can access:
- `/admin/inventory` — stock view (but read-only — see Audit 02)
- `/admin/shipments` — shipment view (but read-only — see Audit 02)
- `/admin/field` — the main field dashboard

Warehouse is blocked from:
- `/admin/dashboard` (revenue)
- `/admin/customers` (PII)
- `/admin/settings` (config)
- `/admin/users` (user management)

This is correct per PRD role matrix. **Do not change the middleware.**

---

## COMPLETE PICKUP FLOW (current state vs required state)

### Current State
```
Customer pays → webhook fires → status = 'paid'
                                   ↓
                   pickupCode = null (BUG 01)
                   pickup email sent ✓ (uses orderNumber as code)
                                   ↓
              /orders/[orderNumber]/pickup page shows orderNumber as code ✓
                                   ↓
              Warehouse pickup queue shows "N/A" for pickup code (BUG 01)
                                   ↓
              Owner manually moves: paid → processing → delivered
              (warehouse cannot do this from field dashboard easily)
```

### Required State (after fixes)
```
Customer pays → webhook fires → status = 'paid', pickupCode = orderNumber
                                   ↓
               pickup email sent with order number as code
                                   ↓
              /orders/[orderNumber]/pickup page shows prominent orderNumber/code
                                   ↓
              Warehouse pickup queue shows the pickup code
              Warehouse can verify customer's code matches
                                   ↓
              Warehouse marks processing → delivered via field dashboard action button
```

---

## CHECKLIST FOR CURSOR

- [ ] Set `pickupCode = orderNumber` when `deliveryMethod === 'pickup'` in `app/api/checkout/initiate/route.ts` (inside transaction, after order number is generated)
- [ ] Fix role check in `app/api/admin/field/inventory/adjust/route.ts` to include `warehouse`
- [ ] Add shipped email dispatch to `app/api/admin/field/tracking-queue/route.ts` PATCH handler
- [ ] Verify `app/api/admin/field/pickup-queue/route.ts` returns pickup code and correct status filter
- [ ] Verify field dashboard pickup queue UI shows pickup code and has "Mark Delivered" action
- [ ] Verify field dashboard packing queue has working "Mark Packed" action button
