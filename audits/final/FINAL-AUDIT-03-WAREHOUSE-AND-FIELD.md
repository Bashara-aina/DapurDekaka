# FINAL AUDIT 03 — WAREHOUSE & FIELD OPERATIONS
**Date:** 2026-05-16  
**Severity scale:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## BUG 01 🟠 — InventoryClient uses `window.location.reload()` — kills React state on every save

**File:** `app/(admin)/admin/inventory/InventoryClient.tsx` line 60  

```ts
toast.success(`Stok diperbarui: ${variant.stock} → ${newStock}`);
setEditing(false);
window.location.reload();
```

Every stock save triggers a full page reload. This:
1. Destroys all React state (any other row being edited is lost)
2. Forces a full server-side data fetch (slow on mobile/slow connections)
3. Resets table scroll position
4. Feels janky on mobile — warehouse staff are on phones

**Fix:** Instead of reloading, update the local stock value and rely on Drizzle returning the new value. Pass an `onUpdate` callback from the parent:

```ts
// In StockCell, accept onUpdate callback
function StockCell({ variant, onUpdate }: { 
  variant: InventoryVariant; 
  onUpdate: (variantId: string, newStock: number) => void;
}) {
  async function handleSave() {
    const res = await fetch('/api/admin/field/inventory/adjust', { ... });
    if (!res.ok) { /* handle error */ return; }
    
    toast.success(`Stok diperbarui: ${variant.stock} → ${newStock}`);
    onUpdate(variant.id, newStock); // Update parent state
    setEditing(false);
    // NO window.location.reload()
  }
}

// In InventoryClient, manage variants state:
const [variants, setVariants] = useState(initialVariants);

const handleUpdate = (variantId: string, newStock: number) => {
  setVariants(prev => prev.map(v => v.id === variantId ? { ...v, stock: newStock } : v));
};
```

---

## BUG 02 🟠 — Field page: inventory adjust `delta` computation crashes if `quantity` is empty

**File:** `app/(admin)/admin/field/page.tsx` lines 740–745

```ts
async function handleSubmit() {
  if (!selectedItem || !quantity) return;  // Guards empty string
  if (actionType === 'adjust') {
    if (!reason) return;
    await adjustMutate({ 
      variantId: selectedItem.id, 
      delta: parseInt(quantity) - selectedItem.stock,  // parseInt('') = NaN
      reason 
    });
  }
}
```

The `!quantity` guard at line 740 rejects truly empty strings, but what about whitespace-only strings like `"  "`? `!quantity` would be truthy (non-empty string passes the guard), but `parseInt("  ")` = `NaN`. Then `NaN - selectedItem.stock = NaN`. The API receives `delta: NaN`, which Zod validates as `z.number().int()` → this will fail Zod validation and return 400.

Also, if the user types `0` and the current stock is already `0`, `delta = 0`. The adjust API call is made unnecessarily.

**Fix:**
```ts
const parsedQty = parseInt(quantity.trim(), 10);
if (isNaN(parsedQty) || parsedQty < 0) {
  toast.error('Masukkan angka yang valid (min 0)');
  return;
}

if (actionType === 'adjust') {
  const delta = parsedQty - selectedItem.stock;
  if (delta === 0) {
    // No change needed
    setSelectedItem(null);
    return;
  }
  await adjustMutate({ variantId: selectedItem.id, delta, reason });
}
```

---

## BUG 03 🟡 — Field page: useMutation has no `onError` handlers — silent failures

**File:** `app/(admin)/admin/field/page.tsx` — multiple useMutation calls

The mutations in `PackingTab`, `TrackingTab`, `PickupTab`, and `InventoryTab` all lack `onError` callbacks:
```ts
const { mutateAsync: packMutate, isPending: isPacking } = useMutation({
  mutationFn: (...) => packOrder(...),
  onSuccess: () => refetch(),
  // No onError!
});
```

When a mutation fails, the error is thrown from `mutateAsync` but there's no UI feedback. The `handlePack`, `handleSubmit`, `handleDeliver`, `handleSubmit` functions don't wrap in try-catch either — the thrown error is unhandled, appearing as a React error boundary or console error.

**Fix:** Add `onError` to all mutations:
```ts
const { mutateAsync: packMutate } = useMutation({
  mutationFn: packOrder,
  onSuccess: () => refetch(),
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : 'Gagal menyimpan. Coba lagi.');
  },
});
```
And wrap `mutateAsync` calls in try-catch in the handler functions.

---

## BUG 04 🟡 — Field page: ShipmentsClient also rendered at `/admin/shipments` but shows stale data after submit

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx` line 53–56

After a successful tracking submit:
```ts
setOrders((prev) =>
  prev.map((o) =>
    o.id === orderId ? { ...o, status: 'shipped', trackingNumber } : o
  )
);
```

The order is updated locally. But the shipments page was a **Server Component** that fetched initial data. On the next user action (e.g., navigating away and back), the server re-fetches fresh data. For now the local state update is sufficient, but:

1. The order remains visible in the list with `status: 'shipped'` and shows the green tracking number badge — this order is **done** but still visible
2. The shipments page should ideally only show orders that **need** tracking (not already shipped with a resi). Verify the backend query filters properly.

**Action:** Check `app/(admin)/admin/shipments/page.tsx` server-side query — it should fetch orders with `status IN ('paid', 'processing', 'packed')` and `deliveryMethod = 'delivery'` and `trackingNumber IS NULL`. After a warehouse adds a resi, the order gets `status: 'shipped'` and should disappear from the list on next load.

If the page doesn't auto-remove shipped orders from the client list, add:
```ts
// After successful submit, remove from list entirely:
setOrders((prev) => prev.filter((o) => o.id !== orderId));
```

---

## BUG 05 🟡 — Field packing queue: "Tandai Selesai Dikemas" requires ALL items to be checked — but checklist has no "check all" button

**File:** `app/(admin)/admin/field/page.tsx` lines 447–451

```tsx
{!allChecked && (
  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
    ⚠ Centang semua item sebelum konfirmasi
  </p>
)}

<Button ... disabled={isPacking || !allChecked}>
  Konfirmasi Kemas
</Button>
```

For an order with 5+ items, the warehouse person must tap each item individually. There's no "Centang Semua" / "Select All" button. On mobile with small touch targets, this is tedious.

**Fix:** Add a "Centang Semua" button above the checklist:
```tsx
<div className="flex items-center justify-between mb-2">
  <p className="text-xs font-semibold text-gray-500 uppercase">Checklist Item</p>
  <button
    type="button"
    onClick={() => setCheckedItems(new Set(selectedOrder.items.map((_, idx) => idx)))}
    className="text-xs text-brand-red underline"
  >
    Centang Semua
  </button>
</div>
```

---

## BUG 06 🟡 — Pickup tab: `handleDeliver` proceeds with no code verification if `pickupCode` is null

**File:** `app/(admin)/admin/field/page.tsx` lines 613–622

```ts
const handleDeliver = async () => {
  if (!selectedOrder) return;
  if (selectedOrder.pickupCode && inputCode.trim().toUpperCase() !== selectedOrder.pickupCode.toUpperCase()) {
    setCodeError('Kode tidak cocok...');
    return;
  }
  await deliverMutate(selectedOrder.id);
};
```

If `selectedOrder.pickupCode` is `null` (which shouldn't happen after the BUG fix where pickupCode = orderNumber, but may for old orders), the code verification is **skipped entirely**. Warehouse staff can mark any pickup order as delivered without verification.

**Fix:** Require code verification always (use orderNumber as fallback):
```ts
const codeToVerify = selectedOrder.pickupCode ?? selectedOrder.orderNumber;
if (inputCode.trim().toUpperCase() !== codeToVerify.toUpperCase()) {
  setCodeError('Kode tidak cocok. Minta pelanggan tunjukkan kode yang benar.');
  return;
}
```

And in the UI, when pickupCode is null, show the orderNumber as the code:
```tsx
{/* Show what the pickup code is */}
<div className="bg-gray-50 rounded p-2 mb-3">
  <p className="text-xs text-gray-500">Kode ambil sistem:</p>
  <p className="font-mono font-bold">{selectedOrder.pickupCode ?? selectedOrder.orderNumber}</p>
</div>
```

---

## BUG 07 🟡 — Shipments page: orders already `shipped` WITH tracking still appear in the list

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx` lines 120–146

```tsx
{order.status === 'shipped' && hasTracking ? (
  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
    {order.trackingNumber}
  </span>
) : order.status === 'packed' || order.status === 'shipped' ? (
  <div className="flex items-center gap-2">
    <input ... />
    <button>Kirim</button>
  </div>
) : (
  <span className="text-xs text-gray-400">-</span>
)}
```

Orders that are `shipped` AND have a tracking number show a green badge and remain in the list. These are done — they're cluttering the view for warehouse staff who need to focus on **pending** items.

The backend query at `app/(admin)/admin/shipments/page.tsx` should filter these out. 

**Action:** Verify the page.tsx server query. It should be:
```ts
where: and(
  eq(orders.deliveryMethod, 'delivery'),
  inArray(orders.status, ['packed', 'processing', 'paid']),
  isNull(orders.trackingNumber)  // Only orders WITHOUT tracking
)
```
If it currently includes shipped orders, update the filter.

---

## BUG 08 🔵 — Field inventory: restock vs adjust distinction isn't explained to warehouse staff

**File:** `app/(admin)/admin/field/page.tsx` lines 812–828

The field inventory tab shows two buttons per item:
- `+` (green) → Restock (adds to current stock)
- `↺` (amber) → Adjust/Koreksi (sets new absolute count)

The distinction is subtle and the button tooltips are `title="Tambah stok"` / `title="Koreksi stok"` which only appear on hover (invisible on mobile).

**Fix:** Replace icon-only buttons with text labels visible without hover:
```tsx
<div className="flex flex-col gap-1 shrink-0">
  <Button size="sm" variant="outline" className="text-green-600 text-xs"
    onClick={() => { ... setActionType('restock'); }}>
    + Tambah
  </Button>
  <Button size="sm" variant="outline" className="text-amber-600 text-xs"
    onClick={() => { ... setActionType('adjust'); }}>
    Koreksi
  </Button>
</div>
```

---

## MISSING FEATURE 01 🟠 — Shipments page: destination city not visible to warehouse staff

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx`

The table shows: Order | Penerima | Kurir | Tgl Dibayar | Aksi

Missing columns that warehouse staff need to write on the package:
- **Kota tujuan** (destination city)
- **Provinsi** (province)
- **Alamat lengkap** (full address — at least partially)

**Fix:** Add destination city to the table row. Modify `ShipmentOrder` interface and the page.tsx query to include `city` and `province` from the orders table, then display:
```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
  <div>{order.city}</div>
  <div className="text-xs text-gray-400">{order.province}</div>
</td>
```

---

## MISSING FEATURE 02 🔵 — No "mark as delivered" shortcut for pickup orders in shipments page

The `/admin/shipments` page only shows delivery orders needing tracking. Pickup orders that are `processing` or `packed` and need to be marked as `delivered` have no workflow in the shipments page — they go through the field dashboard Pickup tab or the admin order detail page.

This is acceptable as the field dashboard handles pickup. Just document it as "by design."

---

## MISSING FEATURE 03 🟡 — Field dashboard: no real-time badge count (shows cached queue data)

**File:** `app/(admin)/admin/field/page.tsx` lines 1034–1050

The tab badges use React Query with `refetchInterval: 30000` (30 seconds). If a new order comes in, the warehouse staff won't see the badge count update for up to 30 seconds. On a busy day, this could cause missed orders.

**Fix:** Reduce refetch interval to 15 seconds or add a visible "last refreshed" timestamp:
```ts
const { data: packingQueue } = useQuery({
  queryKey: ['field', 'packing-queue'],
  queryFn: fetchPackingQueue,
  refetchInterval: 15000, // 15 seconds
  refetchIntervalInBackground: false, // Don't refetch when tab is not active
});
```

Or add a manual "Refresh Semua" button at the top of the dashboard.

---

## MISSING FEATURE 04 🔵 — Field dashboard: worker activity log shows `undefined` for order numbers

**File:** `app/(admin)/admin/field/page.tsx` line 985

```tsx
{item.orderNumber && <span className="font-mono font-semibold text-xs text-gray-500">{item.orderNumber} — </span>}
```

The `workerActivity.orderActivity` type defines `orderNumber?: string`. If the API doesn't join the orders table to get order numbers, this field is always `undefined` and nothing is shown. The activity log becomes unreadable.

**Action:** In `app/api/admin/field/worker-activity/route.ts`, verify the query joins `orderStatusHistory` with `orders` to get `orderNumber`. If not, add:
```ts
// In the query
with: {
  order: { columns: { orderNumber: true } }
}
// Then map:
orderNumber: activity.order?.orderNumber
```
