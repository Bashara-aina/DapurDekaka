# FINAL AUDIT 02 — ADMIN PANEL & ORDER MANAGEMENT
**Date:** 2026-05-16  
**Severity scale:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## BUG 01 🔴 — Admin order detail: `currentRole` is always empty on first load

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 116–142

The `currentRole` state is set inside a `useEffect` that depends on `[orderId]`, reading from the `session` variable via closure. `useSession()` is asynchronous — if session hasn't loaded when the effect fires, `session?.user?.role` is `undefined`, so `currentRole` is set to `''`.

Since the dependency array only includes `orderId`, the effect never re-runs when session loads. Result: `canUpdateStatus` on line 208 is always `false` until the user navigates away and back — **no admin can update order status on first page load**.

**Current broken code:**
```ts
useEffect(() => {
  if (!orderId) return;
  async function fetchData() {
    ...
    setCurrentRole(session?.user?.role ?? '');  // session may be null here
  }
  fetchData();
}, [orderId]); // session not in deps
```

**Fix:** Separate the role sync into its own effect:
```ts
useEffect(() => {
  if (session?.user?.role) {
    setCurrentRole(session.user.role);
  }
}, [session?.user?.role]);
```
Or derive directly from session without state:
```ts
const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(session?.user?.role ?? '');
```

---

## BUG 02 🟠 — Admin order detail: warehouse role sees ALL status buttons but API rejects them

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 86–91, 208–209

```ts
const VALID_TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: 'Proses' }],
  processing: [{ status: 'packed', label: 'Kemas' }],
  ...
};
const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(currentRole);
const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
```

Warehouse users see the same `VALID_TRANSITIONS` as superadmin/owner. So a warehouse user on a `paid` order sees the "Proses" button. Clicking it fires the API which returns:
```
403 Forbidden: "Warehouse hanya dapat mengubah status ke shipped"
```

This creates a confusing error for warehouse staff who shouldn't see these buttons at all.

**Fix:** Filter transitions by role:
```ts
const allowedTransitions = (() => {
  const all = VALID_TRANSITIONS[order.status] || [];
  if (currentRole === 'warehouse') {
    return all.filter(t => t.status === 'shipped');
  }
  return all;
})();
```

---

## BUG 03 🟠 — Admin order detail: duplicate coupon discount shown in order summary

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 303–325

The order financial summary shows the coupon discount **twice**:
1. Line 303–308: A general "Diskon" row with `order.discountAmount`
2. Line 319–323: A "Kupon (CODE)" row also with `-order.discountAmount`

```tsx
{order.discountAmount > 0 && (
  <div className="flex justify-between text-green-600">
    <span>Diskon</span>
    <span>-{formatIDR(order.discountAmount)}</span>
  </div>
)}
...
{order.couponCode && (
  <div className="flex justify-between text-gray-500">
    <span>Kupon ({order.couponCode})</span>
    <span>-{formatIDR(order.discountAmount)}</span>  {/* Same amount again! */}
  </div>
)}
```

**Fix:** Remove the generic "Diskon" row and only show the coupon-specific row when couponCode is present. If there's a non-coupon discount in future, add a separate field. For now:
```tsx
// Remove the generic Diskon row entirely
// Keep only the coupon row:
{order.couponCode && order.discountAmount > 0 && (
  <div className="flex justify-between text-green-600">
    <span>Kupon ({order.couponCode})</span>
    <span>-{formatIDR(order.discountAmount)}</span>
  </div>
)}
```

---

## BUG 04 🟠 — Admin order detail: tracking number input has no Save button

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 417–454

The "Input Resi" section shows three input fields (tracking number, URL, estimated days) but there is **no Save button** in that section. The tracking is submitted as part of the status update button ("Kirim" / mark as shipped) below. This is:

1. **Confusing UX**: The tracking inputs look like a standalone form but have no submit action
2. **Non-obvious**: Users must scroll down to find the status button, realize it submits the tracking too
3. **Impossible when already shipped**: If the order is `shipped` and the admin wants to update tracking, there are no status buttons shown (VALID_TRANSITIONS for `shipped` only has `delivered`), so there's no way to update tracking from this page

**Fix:** Add a dedicated "Simpan Resi" button in the tracking section that calls the status API with `trackingNumber` only (when order is already `shipped`):
```tsx
{canUpdateStatus && (order.status === 'packed' || order.status === 'shipped') && (
  <div className="bg-white rounded-lg border border-admin-border p-6">
    <h2 className="font-semibold text-gray-700 mb-4">Input Resi</h2>
    {/* ... inputs ... */}
    
    {/* Add this button: */}
    {order.status === 'shipped' && (
      <button
        onClick={() => handleTrackingUpdate()} // New function that only updates tracking fields
        className="w-full h-10 mt-3 bg-brand-red text-white rounded"
      >
        Update Resi
      </button>
    )}
    {order.status === 'packed' && (
      <p className="text-sm text-text-secondary mt-3">
        Klik "Kirim" di bawah untuk menyimpan resi dan ubah status ke Dikirim.
      </p>
    )}
  </div>
)}
```

Also add a separate API endpoint or extend `PATCH /api/admin/orders/[id]/status` to handle tracking-only updates.

---

## BUG 05 🟡 — Admin order detail: status timeline has no connecting lines (display: none)

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 252–255

```tsx
{idx < STATUS_TIMELINE.length - 1 && (
  <div className={`absolute h-0.5 w-full bg-gray-200 -z-10`} style={{ display: 'none' }} />
)}
```
The connector line between timeline steps is explicitly hidden with `display: none`. The timeline shows isolated dots with no visual connection.

**Fix:** Remove `style={{ display: 'none' }}` and fix the positioning. The connector needs to be part of the flex layout, not absolute:
```tsx
{idx < STATUS_TIMELINE.length - 1 && (
  <div className="h-0.5 flex-1 bg-gray-200 mt-4" />
)}
```
But the dots and lines need a different container structure — use a horizontal `flex` row where each step is `flex-1`:
```tsx
<div className="flex items-start gap-0">
  {STATUS_TIMELINE.map((step, idx) => (
    <React.Fragment key={step}>
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ...`}>{idx + 1}</div>
        <span className="mt-1 text-xs">{STATUS_LABELS[step]}</span>
      </div>
      {idx < STATUS_TIMELINE.length - 1 && (
        <div className={`flex-1 h-0.5 mt-4 ${idx < currentStepIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
      )}
    </React.Fragment>
  ))}
</div>
```

---

## BUG 06 🟡 — Admin order detail: cancelled status not in STATUS_TIMELINE → timeline broken for cancelled orders

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 93–100, 207

```ts
const STATUS_TIMELINE: string[] = [
  'pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered',
];
const currentStepIdx = STATUS_TIMELINE.indexOf(order.status); // Returns -1 for 'cancelled'
```

For cancelled orders, `currentStepIdx = -1`. The logic `idx < currentStepIdx` is always false (nothing < -1), so no steps appear completed. The `isCurrent` check `order.status === step` is also false for all steps. Result: all timeline dots appear as uncompleted grey for cancelled orders.

**Fix:** Handle the cancelled case explicitly:
```tsx
{order.status === 'cancelled' ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
    <span className="text-red-600 font-medium">Pesanan dibatalkan</span>
    {order.cancelledAt && (
      <p className="text-sm text-gray-500 mt-1">{formatWIB(order.cancelledAt)}</p>
    )}
  </div>
) : (
  // Normal timeline rendering
)}
```

---

## BUG 07 🟡 — `router.refresh()` in client component doesn't re-fetch useEffect data

**File:** `app/(admin)/admin/orders/[id]/page.tsx` lines 172–174

```ts
async function handleStatusUpdate(newStatus: string) {
  ...
  router.refresh();
  const updated = await fetch(`/api/admin/orders/${orderId}`).then(r => r.json());
  setOrder(updated.data);
}
```

`router.refresh()` in Next.js 14 App Router re-invalidates server component cache, but this is a Client Component that manually fetches data. The `router.refresh()` here is redundant and the manual fetch after it is the actual update mechanism. The issue is the code runs both, and `router.refresh()` may cause a flash/rerender. Just remove `router.refresh()` and keep the manual refetch.

**Fix:**
```ts
async function handleStatusUpdate(newStatus: string) {
  ...
  const updated = await fetch(`/api/admin/orders/${orderId}`).then(r => r.json());
  if (updated.data) setOrder(updated.data);
  else toast.error('Status updated but failed to reload order data');
}
```

---

## BUG 08 🟡 — Admin settings page: calls `/api/admin/settings/{key}` which is a per-key route — verify it exists and handles PATCH

**File:** `app/(admin)/admin/settings/page.tsx` lines 75, 99

The settings page saves via:
```ts
const res = await fetch(`/api/admin/settings/${key}`, {
  method: 'PATCH',
  body: JSON.stringify({ value: editValue }),
});
```

The per-key route is at `app/api/admin/settings/[key]/route.ts`. This file needs to exist and have a `PATCH` handler that is superadmin-only. If it's missing, all settings saves silently fail (the route returns 404 which is non-2xx, but the error handling catches it). **Action: verify this file exists and has PATCH with superadmin auth.**

---

## BUG 09 🟡 — Admin orders list: search filter uses raw SQL and may be injection-prone

**Context from prior audit (CURSOR-AUDIT-02):** The `admin/orders` page search uses raw SQL for text search. Verify that the search in `app/(admin)/admin/orders/page.tsx` or `OrdersClient.tsx` uses parameterized queries (Drizzle ORM) rather than string interpolation.

**Action:** In `app/(admin)/admin/orders/page.tsx` and `app/api/admin/orders/route.ts`, verify search is:
```ts
// Safe (Drizzle):
where(like(orders.orderNumber, `%${searchTerm}%`))

// Not this (injection risk):
where(sql`order_number LIKE '%${searchTerm}%'`)
```

---

## BUG 10 🔵 — Admin order detail: pickup orders don't show pickup code prominently

**File:** `app/(admin)/admin/orders/[id]/page.tsx`

For pickup orders, the `order.deliveryMethod === 'delivery'` block (lines 366–388) is skipped. But there's no equivalent pickup info block. Admin can see `deliveryMethod === 'pickup'` but there's no pickup code displayed, no store address shown, no "mark as delivered" shortcut.

**Fix:** Add a pickup info card when `order.deliveryMethod === 'pickup'`:
```tsx
{order.deliveryMethod === 'pickup' && (
  <div className="bg-white rounded-lg border border-admin-border p-6">
    <h2 className="font-semibold text-gray-700 mb-4">Pickup Info</h2>
    <div className="text-center">
      <p className="text-sm text-gray-500 mb-2">Kode Pengambilan</p>
      <p className="font-mono text-3xl font-bold text-brand-red">
        {order.pickupCode ?? order.orderNumber}
      </p>
    </div>
  </div>
)}
```

---

## MISSING FEATURE 01 🟠 — Admin has no way to cancel an order once it's been paid and stock was deducted

**File:** `app/(admin)/admin/orders/[id]/page.tsx`

The `VALID_TRANSITIONS` for `paid` includes `['processing', 'cancelled']`. So admins can cancel a paid order. However, the admin order detail page only shows the "Proses" button for `paid` orders (VALID_TRANSITIONS). There's no "Batalkan" / cancel button visible in the UI.

Looking at lines 86–91:
```ts
const VALID_TRANSITIONS = {
  paid: [{ status: 'processing', label: 'Proses' }],
  // No cancel button defined here
};
```

The API supports cancellation for paid orders (lines 26–32 of status/route.ts), but the client doesn't expose it. For superadmin, a cancel option should be visible with a reason field.

**Fix:** Add cancel option to VALID_TRANSITIONS for superadmin:
```ts
const VALID_TRANSITIONS_ADMIN: Record<string, { status: string; label: string }[]> = {
  paid: [
    { status: 'processing', label: 'Proses' },
    { status: 'cancelled', label: 'Batalkan' },
  ],
  processing: [
    { status: 'packed', label: 'Kemas' },
    { status: 'cancelled', label: 'Batalkan' },
  ],
  ...
};
```

---

## MISSING FEATURE 02 🔵 — Admin dashboard KPIs: revenue chart and live feed not verified

**Files:** `app/api/admin/dashboard/revenue-chart/route.ts`, `app/api/admin/dashboard/live-feed/route.ts`

These API routes exist but the dashboard page at `app/(admin)/admin/dashboard/page.tsx` needs to be verified to actually render charts using recharts or similar. If the chart components are present, verify:
1. Revenue chart uses real data (not mock)
2. Date range picker works
3. Live feed refreshes properly

---

## MISSING FEATURE 03 🔵 — Admin users management page implementation status

**File:** `app/(admin)/admin/users/page.tsx`

The users management page exists. Verify it:
1. Lists all admin users
2. Has invite/create functionality  
3. Has role change capability (superadmin only)
4. Has disable/delete functionality
5. The invite API at `/api/admin/users/invite/route.ts` sends actual email invitations
