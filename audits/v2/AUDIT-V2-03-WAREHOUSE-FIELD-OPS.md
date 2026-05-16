# AUDIT V2-03 — Warehouse & Field Operations
**Date:** 2026-05-15  
**Scope:** `app/(admin)/admin/field/page.tsx`, `app/(admin)/admin/shipments/`, `app/(admin)/admin/inventory/`, `app/api/admin/field/`  
**Severity:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW

---

## BUG-01 🔴 CRITICAL — Warehouse role cannot pack orders (permission bug in field orders route)

**File:** `app/api/admin/field/orders/[id]/route.ts`  
**Lines:** 107–112

### What's wrong
```typescript
const WAREHOUSE_RESTRICTED_TRANSITIONS: Record<string, string[]> = {
  packed: ['shipped'],  // ← warehouse can only do packed→shipped
};

if (role === 'warehouse') {
  const warehouseAllowed = WAREHOUSE_RESTRICTED_TRANSITIONS[currentStatus];
  if (!warehouseAllowed?.includes(newStatus)) {
    return forbidden('Warehouse role hanya dapat mengubah status packed ke shipped');
  }
}
```
Warehouse workers are the primary users of the field dashboard. But:
- `paid → processing`: NOT in `WAREHOUSE_RESTRICTED_TRANSITIONS` → forbidden for warehouse
- `processing → packed`: NOT in `WAREHOUSE_RESTRICTED_TRANSITIONS` → forbidden for warehouse
- Only `packed → shipped` is allowed

This means warehouse staff cannot process or pack ANY orders via the field dashboard.

### Fix — Expand warehouse permissions to include the packing flow:

```typescript
const WAREHOUSE_RESTRICTED_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],      // ← Add: warehouse can start processing
  processing: ['packed'],    // ← Add: warehouse can pack
  packed: ['shipped'],       // Already allowed
  // Note: shipped→delivered is handled separately for pickup orders
};
```

---

## BUG-02 🔴 CRITICAL — Field dashboard "Input Nomor Resi" calls non-existent endpoint

**File:** `app/(admin)/admin/field/page.tsx`  
**Lines:** 143–150 (`addTracking` function)

### What's wrong
```typescript
async function addTracking(orderId: string, data: { trackingNumber: string; courierCode?: string }) {
  const res = await fetch(`/api/admin/field/orders/${orderId}/tracking`, {
    method: 'PATCH',
    ...
  });
```
The route `/api/admin/field/orders/[id]/tracking` does **NOT exist**. There is no `app/api/admin/field/orders/[id]/tracking/route.ts`.

The correct endpoint for adding tracking is:
- `PATCH /api/admin/field/tracking-queue` (accepts `{ orderId, trackingNumber }`, changes `packed → shipped`)
- OR `PATCH /api/admin/field/orders/[id]` (accepts `{ status: 'shipped', trackingNumber }`)

When the field worker tries to save a resi number, it silently fails with 404.

### Fix — Change `addTracking` to use the correct endpoint:

```typescript
async function addTracking(orderId: string, data: { trackingNumber: string; courierCode?: string }) {
  const res = await fetch('/api/admin/field/tracking-queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, trackingNumber: data.trackingNumber }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
```

---

## BUG-03 🔴 CRITICAL — Field dashboard "Tandai Selesai Dikemas" uses wrong API and wrong status transition

**File:** `app/(admin)/admin/field/page.tsx`  
**Lines:** 132–141 (`packOrder` function)

### What's wrong
```typescript
async function packOrder(orderId: string, data: { status: string; note?: string; coldChainCondition?: string }) {
  const res = await fetch(`/api/admin/field/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),  // { status: 'packed', note, coldChainCondition }
  });
```
Two problems:
1. The field orders route (`/api/admin/field/orders/[id]`) requires status transitions. A `paid` order can only go to `processing` not directly to `packed`. Sending `status: 'packed'` from a `paid` order returns a 409 conflict.
2. The `coldChainCondition` field is not in the schema (gets silently stripped) — that's OK.

The correct API for packing is `PATCH /api/admin/field/packing-queue` which takes just `{ orderId }` and moves `paid → packed` directly (bypassing the intermediate `processing` step — this is intentional for field ops).

### Fix — Change `packOrder` to use packing-queue endpoint:

```typescript
async function packOrder(orderId: string, data: { status: string; note?: string; coldChainCondition?: string }) {
  const res = await fetch('/api/admin/field/packing-queue', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
    // Note: note and coldChainCondition could be added to packing-queue API if needed
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}
```

---

## BUG-04 🔴 CRITICAL — Pickup delivery calls right URL but pickup orders can't reach 'shipped' status

**File:** `app/(admin)/admin/field/page.tsx`  
**Lines:** 154–162 (`deliverPickup` function)

### What's wrong
```typescript
async function deliverPickup(orderId: string) {
  const res = await fetch(`/api/admin/field/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'delivered' }),
  });
```
The field orders route `VALID_TRANSITIONS` is:
```typescript
{ paid: ['processing'], processing: ['packed'], packed: ['shipped'], shipped: ['delivered'] }
```
For a pickup order, the expected flow is: `paid → packed → delivered` (skip shipping). But the API requires `packed → shipped` first, then `shipped → delivered`. Sending `status: 'delivered'` from a `packed` pickup order returns 409 conflict.

Additionally, warehouse role cannot do `packed → shipped` for pickup orders (which don't have a tracking number — the API at line 114 requires trackingNumber for shipped status).

### Fix — Two changes needed:

**1. In `app/api/admin/field/orders/[id]/route.ts`**, add pickup delivery support:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],
  processing: ['packed'],
  packed: ['shipped', 'delivered'],  // ← Allow packed→delivered for pickup orders
  shipped: ['delivered'],
};
```
And relax the tracking number requirement for pickup orders:
```typescript
// Change line 114:
if (newStatus === 'shipped' && !trackingNumber) {
  // Check if it's a pickup order — pickup orders don't need tracking
  const isPickup = order.deliveryMethod === 'pickup';
  if (!isPickup) {
    return validation error...
  }
}
```

**2. In `deliverPickup` function in field/page.tsx**, the URL is correct (`/api/admin/field/orders/${orderId}`), just the server needs to accept the transition.

---

## BUG-05 🟠 HIGH — ShipmentsClient shows resi input for 'processing' orders but API rejects them

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx`  
**Lines:** 122–126 (table action cell condition)

### What's wrong
```typescript
order.status === 'packed' || order.status === 'processing' || order.status === 'shipped'
```
The input is shown for `processing` status orders. But the tracking-queue PATCH at `/api/admin/field/tracking-queue` checks:
```typescript
if (order.status !== 'packed') {
  return conflict('Hanya order dengan status packed yang dapat dikirim');
}
```
Submitting a resi for a `processing` order fails with 409. User sees a confusing error.

### Fix — Remove `processing` from the condition:
```typescript
// Change line 122:
order.status === 'packed' || order.status === 'shipped'
// (processing orders shouldn't show resi input)
```

Also: the shipments page currently doesn't show pickup orders. Confirm the server-side query in `app/(admin)/admin/shipments/page.tsx` filters to `deliveryMethod = 'delivery'` only.

---

## BUG-06 🟡 MEDIUM — Field inventory adjust sends `delta` but field page sends `newQuantity`

**File:** `app/(admin)/admin/field/page.tsx` vs `app/(admin)/admin/inventory/InventoryClient.tsx`

### What's wrong
Two different callers use the same `/api/admin/field/inventory/adjust` endpoint with different request bodies:

**InventoryClient.tsx (line 44):**
```typescript
body: JSON.stringify({ variantId: variant.id, delta, reason: '...' })
// Sends a delta (difference from current stock)
```

**field/page.tsx `adjustInventory` (line 180):**
```typescript
body: JSON.stringify({ variantId: selectedItem.id, newQuantity: parseInt(quantity), reason })
// Sends the target absolute quantity
```

The API at `app/api/admin/field/inventory/adjust/route.ts` needs to handle BOTH formats, or the two callers need to agree on a format. Check the actual route to see which format it expects.

### Fix — Standardize to one format. Recommended: use `delta` (relative) in both callers:

In `field/page.tsx adjustInventory`:
```typescript
// Change: newQuantity: parseInt(quantity)
// To: delta: parseInt(quantity) - (selectedItem.stock)
```
Or add handling for both `delta` and `newQuantity` in the API.

---

## BUG-07 🟡 MEDIUM — Packing queue shows ALL 'paid' orders including pickup orders that are already "packed in store"

**File:** `app/api/admin/field/packing-queue/route.ts`  
**Line:** 21–28

### What's wrong
```typescript
const paidOrders = await db.query.orders.findMany({
  where: eq(orders.status, 'paid'),
  ...
});
```
This returns ALL `paid` orders including pickup orders. Pickup orders don't need "packing" in the shipping sense — they need physical preparation. But the packing queue mixes them with delivery orders, which could confuse warehouse staff.

### Fix — Consider filtering by delivery method or adding a visual indicator:
```typescript
// Add a badge in OrderCard to distinguish pickup from delivery orders
// OR split the queue into two sections
```
The current `OrderCard` already shows `'🏠 Ambil Sendiri'` vs `'🚚 Delivery'` badge — so it's visible, just not separated. This is a UX improvement, not a critical fix.

---

## BUG-08 🔵 LOW — Today summary `inventoryUpdateCount` always 0

**File:** `app/api/admin/field/today-summary/route.ts`

### What to check
Confirm the query counts inventory logs with `createdAt >= start of today`. If it uses `date_trunc` without timezone awareness, it may count in UTC not WIB (UTC+7), showing 0 from midnight to 7am.

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 01 | 🔴 CRITICAL | `api/admin/field/orders/[id]/route.ts:107` | Warehouse cannot pack orders (wrong permission transitions) |
| 02 | 🔴 CRITICAL | `admin/field/page.tsx:143` | addTracking calls non-existent `/tracking` sub-route |
| 03 | 🔴 CRITICAL | `admin/field/page.tsx:132` | packOrder sends wrong status transition (packed from paid directly) |
| 04 | 🔴 CRITICAL | `admin/field/page.tsx:154` | Pickup delivery blocked — packed→delivered not a valid transition |
| 05 | 🟠 HIGH | `admin/shipments/ShipmentsClient.tsx:122` | Resi input shown for `processing` but API rejects it |
| 06 | 🟡 MEDIUM | `admin/field/page.tsx:180` | adjustInventory sends `newQuantity` but InventoryClient sends `delta` |
| 07 | 🟡 MEDIUM | `api/admin/field/packing-queue/route.ts:21` | No separation of delivery vs pickup in packing queue |
| 08 | 🔵 LOW | `api/admin/field/today-summary/route.ts` | Timezone issue may cause 0 count early in day |
