# CURSOR AUDIT 02 — Order Lifecycle & Admin Operations
**Project:** DapurDekaka.com  
**Date:** 2026-05-15  
**Scope:** Order management from paid → shipped → delivered, admin dashboard, status transitions, warehouse tools

---

## Overview

The admin order management is partially functional. The order list and detail pages work. Status transitions and email notifications are correctly implemented. However, two critical operational tools (Shipments page, Inventory page) are **read-only stubs** with no editing capability — warehouse staff cannot do their core jobs from the UI. The reconcile cron has a critical bug that leaves paid orders stuck.

---

## BUG 01 — Reconcile Cron: Settled Orders Never Updated to Paid

**Severity:** Critical — paid customers have orders stuck in `pending_payment` forever  
**File:** `app/api/cron/reconcile-payments/route.ts:57-65`

### What's broken

When Midtrans confirms an order is `settlement` but the DB still shows `pending_payment`, the cron only logs a warning:

```ts
if (midtransStatus === 'settlement') {
  logger.warn('[Reconcile] Order paid but status is pending', {
    orderNumber: order.orderNumber,
    midtransStatus,
  });
  results.reconciled++;  // ← increments a counter then does NOTHING
}
```

No DB update. No stock deduction. No points awarded. No confirmation email. The order stays `pending_payment` until the payment expiry cron cancels it — effectively treating a paid customer as if they never paid.

### When this happens

- Midtrans sends webhook but it times out or returns 500 (Vercel cold start)
- Webhook fires but Neon HTTP driver returns a transient error
- Network partition between Midtrans and Vercel during peak hours

### Fix

When `settlement` is detected, trigger the same processing that the webhook would do. The cleanest approach is to dispatch the full settlement logic inline:

```ts
// app/api/cron/reconcile-payments/route.ts — replace the settlement branch

if (midtransStatus === 'settlement') {
  logger.warn('[Reconcile] Recovering missed settlement', { orderNumber: order.orderNumber });
  
  // Fetch full order with items for processing
  const fullOrder = await db.query.orders.findFirst({
    where: eq(orders.id, order.id),
    with: { items: true },
  });
  
  if (!fullOrder || fullOrder.status !== 'pending_payment') continue;
  
  await db.transaction(async (tx) => {
    // Mark as paid
    await tx.update(orders).set({
      status: 'paid',
      paidAt: new Date(),
    }).where(eq(orders.id, fullOrder.id));
    
    // Deduct stock
    for (const item of fullOrder.items) {
      await tx.update(productVariants)
        .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)`, updatedAt: new Date() })
        .where(eq(productVariants.id, item.variantId));
      
      const updated = await tx.query.productVariants.findFirst({
        where: eq(productVariants.id, item.variantId),
        columns: { stock: true },
      });
      
      await tx.insert(inventoryLogs).values({
        variantId: item.variantId,
        changeType: 'sale',
        quantityBefore: (updated?.stock ?? 0) + item.quantity,
        quantityAfter: updated?.stock ?? 0,
        quantityDelta: -item.quantity,
        orderId: fullOrder.id,
        note: '[Reconcile] Stock deducted via cron recovery',
      });
    }
    
    // Award points if registered user
    if (fullOrder.userId && fullOrder.pointsEarned > 0) {
      await tx.update(users)
        .set({ pointsBalance: sql`points_balance + ${fullOrder.pointsEarned}` })
        .where(eq(users.id, fullOrder.userId));
      
      await tx.insert(pointsHistory).values({
        userId: fullOrder.userId,
        type: 'earn',
        pointsAmount: fullOrder.pointsEarned,
        pointsBalanceAfter: sql`(SELECT points_balance FROM users WHERE id = ${fullOrder.userId})`,
        descriptionId: `Pembelian ${fullOrder.orderNumber} (reconcile)`,
        descriptionEn: `Purchase ${fullOrder.orderNumber} (reconcile)`,
        orderId: fullOrder.id,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }
    
    // Record coupon usage
    if (fullOrder.couponId) {
      await tx.update(coupons)
        .set({ usedCount: sql`used_count + 1` })
        .where(eq(coupons.id, fullOrder.couponId));
      
      await tx.insert(couponUsages).values({
        couponId: fullOrder.couponId,
        orderId: fullOrder.id,
        userId: fullOrder.userId ?? null,
        discountApplied: fullOrder.discountAmount,
      });
    }
    
    // Status history
    await tx.insert(orderStatusHistory).values({
      orderId: fullOrder.id,
      fromStatus: 'pending_payment',
      toStatus: 'paid',
      changedByType: 'system',
      note: 'Pembayaran dikonfirmasi via reconcile cron',
    });
  });
  
  // Send confirmation email (fire-and-forget)
  sendEmail({
    to: fullOrder.recipientEmail,
    subject: `Pesanan ${fullOrder.orderNumber} telah dikonfirmasi!`,
    react: OrderConfirmationEmail({ /* same props as webhook */ }),
  }).catch(console.error);
  
  results.reconciled++;
}
```

Add required imports: `productVariants`, `inventoryLogs`, `users`, `pointsHistory`, `coupons`, `couponUsages`, `orderStatusHistory`, `sendEmail`, `OrderConfirmationEmail`.

---

## BUG 02 — Admin Status Update: Warehouse Can Mark `packed→shipped` Without Tracking Number

**Severity:** Medium — orders ship with no tracking number, customer never gets tracking info  
**File:** `app/api/admin/orders/[id]/status/route.ts:120-125`

### What's broken

The status update endpoint allows warehouse to set status to `shipped` without providing a `trackingNumber`:

```ts
const statusUpdateSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered', 'cancelled']),
  trackingNumber: z.string().optional(),  // ← optional, not required for 'shipped'
  ...
});
```

The PRD states: "When tracking number saved: order status auto-updates to `shipped`" — tracking number is a prerequisite for `shipped`, not an optional extra.

### Fix

```ts
// app/api/admin/orders/[id]/status/route.ts — update schema validation
const statusUpdateSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered', 'cancelled']),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
  cancellationReason: z.string().optional(),
}).refine(
  (data) => data.status !== 'shipped' || (!!data.trackingNumber && data.trackingNumber.trim().length > 0),
  { message: 'Nomor resi harus diisi untuk mengubah status ke shipped', path: ['trackingNumber'] }
);
```

---

## INCOMPLETE FEATURE 01 — Shipments Page: No Tracking Number Input Form

**Severity:** High — warehouse staff cannot input tracking numbers from this page  
**File:** `app/(admin)/admin/shipments/page.tsx`  
**PRD reference:** Section 8.4 — "Tracking number entered by warehouse staff in `/admin/shipments`"

### What's missing

The shipments page is a read-only Server Component:

```ts
// Current: just a table with a "Detail" link per row
<Link href={`/admin/orders/${order.id}`} className="text-brand-red">
  Detail
</Link>
```

Warehouse staff must navigate to each order detail page individually to input tracking. For 20+ orders this is impractical on mobile.

### What to build

Convert to a Client Component with inline tracking number input. For each row in `packed` status, show an inline form:

```tsx
// app/(admin)/admin/shipments/page.tsx — convert to:
'use client';

import { useState } from 'react';
// ... 

function TrackingInputRow({ order, onShipped }: { order: Order; onShipped: () => void }) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) return;
    setSubmitting(true);
    
    const res = await fetch('/api/admin/field/tracking-queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        trackingNumber: trackingNumber.trim(),
        courierCode: order.courierCode,
        courierName: order.courierName,
      }),
    });
    
    if (res.ok) {
      toast.success(`Resi ${trackingNumber} berhasil disimpan`);
      onShipped();
    } else {
      toast.error('Gagal menyimpan resi');
    }
    setSubmitting(false);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        placeholder="No. Resi..."
        className="border rounded px-2 py-1 text-sm w-40"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !trackingNumber.trim()}
        className="bg-brand-red text-white px-3 py-1 rounded text-sm disabled:opacity-50"
      >
        {submitting ? '...' : 'Kirim'}
      </button>
    </div>
  );
}
```

The API endpoint `PATCH /api/admin/field/tracking-queue` already exists and handles this correctly. The page just needs to call it.

**Columns to show:** Order #, Penerima, Kurir, Tgl Dibayar, Action  
**Rows to show:** Orders with status `processing` or `packed` (not `shipped` — those are done)

---

## INCOMPLETE FEATURE 02 — Admin Inventory Page: No Inline Stock Update

**Severity:** High — warehouse staff cannot update stock from mobile  
**File:** `app/(admin)/admin/inventory/page.tsx`  
**PRD reference:** Section 7.4 — "Staff taps variant → input field → new stock count → Simpan"

### What's missing

The inventory page is a read-only Server Component showing a table with an "Edit Produk" link. The "Edit Produk" link goes to the full product edit page where warehouse could accidentally change prices, names, and descriptions.

### What to build

Add an inline stock editor. The pattern is:
1. Each row shows current stock
2. Clicking the stock number shows an input field
3. User enters new absolute stock count
4. Client computes `delta = newCount - currentStock`
5. Calls `PATCH /api/admin/field/inventory/adjust` with `delta`

Note: The adjust endpoint at `app/api/admin/field/inventory/adjust/route.ts` requires `superadmin` or `owner` role. Warehouse staff should use the restock endpoint instead: `POST /api/admin/field/inventory/restock/route.ts`.

**Check which endpoint is appropriate for warehouse:**
- `adjust` = manual correction (owner/superadmin only)
- `restock` = warehouse receives stock shipment (warehouse allowed)

```tsx
// app/(admin)/admin/inventory/page.tsx — convert to client component
'use client';

function StockCell({ variant }: { variant: InventoryVariant }) {
  const [editing, setEditing] = useState(false);
  const [newStock, setNewStock] = useState(variant.stock.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const newValue = parseInt(newStock, 10);
    if (isNaN(newValue) || newValue < 0) return;
    setSaving(true);
    
    const delta = newValue - variant.stock;
    
    const res = await fetch('/api/admin/field/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId: variant.id,
        delta,
        reason: 'Manual stock update from inventory page',
      }),
    });
    
    if (res.ok) {
      toast.success('Stok diperbarui');
      setEditing(false);
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error || 'Gagal menyimpan stok');
    }
    setSaving(false);
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="...">
        {variant.stock}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        value={newStock}
        onChange={(e) => setNewStock(e.target.value)}
        className="border rounded px-2 py-1 text-sm w-20"
        autoFocus
      />
      <button onClick={handleSave} disabled={saving}>Simpan</button>
      <button onClick={() => setEditing(false)}>Batal</button>
    </div>
  );
}
```

---

## INCOMPLETE FEATURE 03 — Admin Order List: Missing Filters and Search

**Severity:** Medium — with 500+ orders, there's no way to find orders quickly  
**File:** `app/(admin)/admin/orders/page.tsx` and `app/(admin)/admin/orders/OrdersClient.tsx`

### What's missing

The order list has:
- Status filter (via URL param `?status=paid`)
- Pagination (25 per page)
- No date range filter
- No search by order number or customer name/email
- No courier filter

### What to build

Add a search bar and date filter to `OrdersClient.tsx`:

```tsx
// In OrdersClient, add state:
const [searchQuery, setSearchQuery] = useState('');

// Filter orders client-side (for current page) or add server-side search:
// Server approach: pass searchQuery via URL param to page.tsx, add WHERE clause to DB query
```

For server-side search in `app/(admin)/admin/orders/page.tsx`:
```ts
const searchQuery = params.search ?? null;

const whereClause = sql`
  (${statusFilter ? sql`${orders.status} = ${statusFilter}` : sql`true`})
  AND (${searchQuery ? sql`
    ${orders.orderNumber} ILIKE ${'%' + searchQuery + '%'}
    OR ${orders.recipientName} ILIKE ${'%' + searchQuery + '%'}
    OR ${orders.recipientEmail} ILIKE ${'%' + searchQuery + '%'}
  ` : sql`true`})
`;
```

---

## INCOMPLETE FEATURE 04 — Admin Order Detail: Tracking URL Not Auto-Generated

**Severity:** Low — warehouse staff must manually compose courier tracking URLs  
**File:** `app/(admin)/admin/orders/[id]/page.tsx` (order detail, tracking form)

### What's missing

When warehouse inputs a tracking number, the tracking URL is a manual field. The PRD defines exact URL patterns per courier:
- SiCepat: `https://www.sicepat.com/checkAwb?awb={tracking}`
- JNE: `https://www.jne.co.id/id/tracking/trace/{tracking}`
- AnterAja: `https://anteraja.id/tracking/{tracking}`

### Fix

Auto-generate tracking URL when tracking number is entered, based on `order.courierCode`:

```ts
// Shared constant (add to lib/constants/couriers.ts or wherever courier constants live):
export const COURIER_TRACKING_URLS: Record<string, string> = {
  SICEPAT: 'https://www.sicepat.com/checkAwb?awb={tracking}',
  JNE: 'https://www.jne.co.id/id/tracking/trace/{tracking}',
  ANTERAJA: 'https://anteraja.id/tracking/{tracking}',
};

export function buildTrackingUrl(courierCode: string | null, trackingNumber: string): string {
  if (!courierCode) return '';
  const template = COURIER_TRACKING_URLS[courierCode.toUpperCase()];
  if (!template) return '';
  return template.replace('{tracking}', trackingNumber);
}
```

In the order detail form:
```ts
// Auto-fill tracking URL when tracking number changes
useEffect(() => {
  if (trackingNumber && order?.courierCode) {
    setTrackingUrl(buildTrackingUrl(order.courierCode, trackingNumber));
  }
}, [trackingNumber, order?.courierCode]);
```

---

## ORDER STATUS FLOW REFERENCE (for Cursor context)

```
pending_payment
    ↓ webhook: settlement
paid
    ↓ admin manually
processing
    ↓ admin manually
packed
    ↓ warehouse: must provide trackingNumber
shipped
    ↓ admin manually (or future: courier callback)
delivered
```

Pickup orders skip `packed` and `shipped`:
```
paid → processing → delivered
```

Cancellation: Any status → cancelled (superadmin/owner) or via webhook (expire/deny)

---

## CHECKLIST FOR CURSOR

- [ ] Fix reconcile cron settlement branch — add full settlement processing in `app/api/cron/reconcile-payments/route.ts`
- [ ] Add tracking number required validation for `shipped` status in `app/api/admin/orders/[id]/status/route.ts`
- [ ] Convert shipments page to client component with inline tracking input calling `/api/admin/field/tracking-queue`
- [ ] Convert inventory page to client component with inline stock editor
- [ ] Add order search by order number/customer name/email to admin orders list
- [ ] Auto-generate tracking URL from courier code when warehouse inputs tracking number
