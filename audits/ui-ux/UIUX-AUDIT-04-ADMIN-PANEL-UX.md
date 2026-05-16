# UI/UX AUDIT 04 — Admin Panel UX

**Scope:** Admin dashboard, orders, inventory, shipments, field/warehouse, products, customers, settings  
**Priority:** Critical = 🔴 | High = 🟠 | Medium = 🟡 | Polish = 🟢

---

## SUMMARY OF ISSUES

| # | Issue | Priority | File |
|---|-------|----------|------|
| 01 | Orders page: clicking a Live Order Feed row links to `?id=` which doesn't work | 🔴 | admin/dashboard/page.tsx |
| 02 | Orders page: no dedicated order detail — `[id]` page exists but navigation is broken | 🔴 | admin/orders/page.tsx |
| 03 | Admin layout: no mobile sidebar — admin panel completely unusable on phones | 🔴 | admin/layout.tsx |
| 04 | Field page: no visual pickup list — orders waiting for pickup have no dedicated view | 🔴 | admin/field/page.tsx |
| 05 | Inventory: search/filter missing — 30+ variants, no way to find specific SKU | 🟠 | admin/inventory/InventoryClient.tsx |
| 06 | Shipments: status column missing — can't tell if order is `packed` or `shipped` | 🟠 | admin/shipments/ShipmentsClient.tsx |
| 07 | Dashboard "Download CSV" uses `window.location.href` — no feedback/progress | 🟠 | admin/dashboard/page.tsx |
| 08 | Dashboard date picker: no preset ranges (Today, This Week, This Month) | 🟠 | admin/dashboard/page.tsx |
| 09 | Admin sidebar: active state only highlights top-level items, not sub-pages | 🟠 | AdminSidebar.tsx |
| 10 | Products page: no bulk actions (disable/delete multiple products at once) | 🟠 | admin/products/page.tsx |
| 11 | Order detail (admin): no one-click status advancement button | 🟠 | admin/orders/[id]/page.tsx |
| 12 | Customers page: search is missing (only filter) | 🟡 | admin/customers/page.tsx |
| 13 | Settings page: PATCH only — no live preview of settings changes | 🟡 | admin/settings/page.tsx |
| 14 | Blog editor: no image preview after upload (only URL shown) | 🟡 | admin/blog/[id]/page.tsx |
| 15 | Dashboard: KPI cards have no sparkline trend — just a delta percentage | 🟢 | KPICard.tsx |
| 16 | Dashboard funnel bar chart: text "count" is white on colored bar — unreadable when count is low | 🟠 | admin/dashboard/page.tsx |
| 17 | Admin audit log: userId shown as truncated ID, not user name | 🟡 | admin/dashboard/page.tsx |

---

## DETAILED FINDINGS

---

### 🔴 01 — Live Order Feed: "Detail" Link is Broken
**File:** `app/(admin)/admin/dashboard/page.tsx:601-604`

**Problem:**
```tsx
<a href={`/admin/orders?id=${order.id}`} className="...">Detail</a>
```
The orders page at `/admin/orders` does NOT accept an `?id=` query param to open a specific order. This link navigates to the orders list with no indication of which order to look at. The order is not highlighted or filtered.

**Fix:** Change to the actual order detail route:
```tsx
<a href={`/admin/orders/${order.id}`}>Detail</a>
```
This matches the existing `app/(admin)/admin/orders/[id]/page.tsx` route.

---

### 🔴 02 — Admin Orders: No Visible Navigation to Order Detail
**File:** `app/(admin)/admin/orders/page.tsx`

**Problem:** The admin orders list page (`OrdersClient.tsx`) renders rows but there's no clickable element that navigates to the order detail page. The `[id]` detail page exists but is unreachable from normal admin navigation. The only way to reach it is by typing the URL directly.

**Fix:** Wrap each order row (or add a "Lihat Detail" button) with a link to `/admin/orders/${order.id}`.

---

### 🔴 03 — Admin Panel: No Mobile Sidebar
**File:** `app/(admin)/admin/layout.tsx`

**Problem:** The admin sidebar (via `AdminSidebar.tsx`) is a fixed desktop sidebar. There is no hamburger menu, no drawer, no mobile navigation. On screens under 768px:
- The sidebar takes up space but is not dismissable
- The content area is severely compressed
- Forms and tables overflow horizontally

The admin panel is completely unusable on mobile devices, which is a problem when Bashara needs to check orders from a phone.

**Fix:** Add a mobile drawer:
```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);

// In AdminHeader:
<button onClick={() => setSidebarOpen(true)}>
  <Menu className="w-5 h-5" />
</button>

// Sidebar with Sheet behavior on mobile:
<aside className={cn(
  'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform',
  'md:relative md:transform-none',
  sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
)}>
  <AdminSidebar onClose={() => setSidebarOpen(false)} />
</aside>
```

---

### 🔴 04 — Field Page: No Dedicated Pickup Order View
**File:** `app/(admin)/admin/field/page.tsx`

**Problem:** The field/warehouse page shows a general order queue but there is no dedicated section for **pickup orders**. Field staff need to see:
1. Which orders are "Ambil di Toko" (pickup)
2. The pickup code for each order
3. Whether the customer has been notified

Currently, pickup and delivery orders are mixed in the same queue with no visual distinction. Field staff must scan every row to identify pickup orders.

**Fix:** Add a "Pesanan Pickup" tab/section at the top of the field page:
```tsx
<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
  <h2 className="font-semibold text-amber-800 mb-3">🏪 Ambil di Toko ({pickupCount})</h2>
  {pickupOrders.map(order => (
    <div key={order.id} className="flex items-center justify-between py-2 border-b border-amber-200 last:border-0">
      <div>
        <p className="font-medium">{order.orderNumber}</p>
        <p className="text-sm text-amber-700">Kode pickup: <strong>{order.pickupCode ?? order.orderNumber}</strong></p>
      </div>
      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded font-bold">{order.status}</span>
    </div>
  ))}
</div>
```

---

### 🟠 05 — Inventory: No Search or Filter
**File:** `app/(admin)/admin/inventory/InventoryClient.tsx:130-210`

**Problem:** The inventory table shows all variants with no search, filter, or sort. As the product catalog grows (20+ products, 3+ variants each = 60+ rows), finding a specific SKU requires scrolling through the entire table. There's also no sort by stock level (most urgent = out of stock first).

**Fix:** Add a search input above the table:
```tsx
const [search, setSearch] = useState('');
const filtered = variants.filter(v => 
  v.sku.toLowerCase().includes(search.toLowerCase()) ||
  v.product.nameId.toLowerCase().includes(search.toLowerCase()) ||
  v.nameId.toLowerCase().includes(search.toLowerCase())
);
```
And a sort button to put OOS items first:
```tsx
const sorted = [...filtered].sort((a, b) => a.stock - b.stock); // OOS first
```

---

### 🟠 06 — Shipments: Status Column Missing
**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx:83-93`

**Problem:** The shipments table columns are: Order | Penerima | Kota | Kurir | Tgl Dibayar | Aksi

There is no `Status` column. The "Aksi" cell shows an input field for orders in `packed` or `shipped` status, but there's no visual indicator of the current status in the table. Warehouse staff can't quickly see which orders are `packed` (ready to input resi) vs `shipped` (resi already entered).

**Fix:** Add a status column between "Kurir" and "Tgl Dibayar":
```tsx
<th>Status</th>
// In row:
<td>
  <span className={`px-2 py-1 text-xs rounded ${statusColors[order.status]}`}>
    {order.status === 'packed' ? 'Siap Kirim' : order.status === 'shipped' ? 'Dikirim' : order.status}
  </span>
</td>
```

---

### 🟠 07 — Dashboard CSV Download: No Feedback
**File:** `app/(admin)/admin/dashboard/page.tsx:738-742`

**Problem:**
```tsx
onClick={() => { window.location.href = '/api/admin/audit-logs?export=csv'; }}
```
This triggers a file download via navigation. There is no:
- Loading spinner while the CSV is being generated
- Success notification
- Error handling if the download fails

The button gives zero feedback for what may be a 2-3 second operation.

**Fix:** Use `fetch` instead:
```tsx
const handleDownload = async () => {
  setDownloading(true);
  try {
    const res = await fetch('/api/admin/audit-logs?export=csv');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    toast.success('Audit log berhasil diunduh');
  } catch {
    toast.error('Gagal mengunduh');
  } finally {
    setDownloading(false);
  }
};
```

---

### 🟠 08 — Dashboard Date Picker: No Preset Ranges
**File:** `app/(admin)/admin/dashboard/page.tsx:337-364`

**Problem:** The date range picker requires manually typing both `from` and `to` dates. There are no quick preset buttons for common periods (Today, Yesterday, This Week, This Month, Last 30 Days). This is a standard admin dashboard UX pattern that saves significant time for daily use.

**Fix:** Add preset chips above the date inputs:
```tsx
const PRESETS = [
  { label: 'Hari Ini', from: today, to: today },
  { label: 'Minggu Ini', from: startOfWeek, to: today },
  { label: 'Bulan Ini', from: startOfMonth, to: today },
  { label: '30 Hari', from: minus30days, to: today },
];
{PRESETS.map(preset => (
  <button
    key={preset.label}
    onClick={() => setDateRange({ from: preset.from, to: preset.to })}
    className="px-3 py-1 text-xs rounded-full border ..."
  >
    {preset.label}
  </button>
))}
```

---

### 🟠 09 — Admin Sidebar: Active State Missing for Sub-pages
**File:** `components/admin/layout/AdminSidebar.tsx`

**Problem:** The sidebar highlights active items based on path matching but likely doesn't handle sub-pages correctly. For example:
- Navigating to `/admin/orders/abc-123` (order detail) — the "Pesanan" sidebar link is NOT highlighted as active
- Navigating to `/admin/products/edit-123` — the "Produk" link is not active

The active check needs to use `pathname.startsWith('/admin/orders')` not `pathname === '/admin/orders'`.

**Fix:** In `AdminSidebar.tsx`:
```tsx
const isActive = (href: string) => {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
};
```

---

### 🟠 10 — Products: No Bulk Actions
**File:** `app/(admin)/admin/products/page.tsx`

**Problem:** Managing products one-by-one is tedious. Common bulk operations needed:
- Bulk disable/enable (e.g., seasonal unavailability)  
- Bulk delete (cleanup)
- Bulk category change

Currently every action requires opening each product individually.

**Fix:** Add checkboxes to product rows and a "Bulk Actions" bar that appears when items are selected:
```tsx
{selectedIds.length > 0 && (
  <div className="sticky top-0 z-10 bg-brand-red text-white p-3 flex items-center gap-4">
    <span>{selectedIds.length} dipilih</span>
    <button onClick={handleBulkDisable}>Nonaktifkan</button>
    <button onClick={handleBulkDelete}>Hapus</button>
  </div>
)}
```

---

### 🟠 11 — Order Detail (Admin): No Quick Status Advancement
**File:** `app/(admin)/admin/orders/[id]/page.tsx`

**Problem:** The admin order detail page shows the order status but requires a dropdown + submit to change status. For the most common workflow (paid → processing → packed → shipped), this is repetitive. Warehouse staff should be able to one-click advance an order to the next logical status.

**Fix:** Add "Next Step" buttons that advance the order to the next status:
```tsx
const nextStatus = {
  paid: 'processing',
  processing: 'packed',
  packed: 'shipped',
  shipped: 'delivered',
};

{nextStatus[order.status] && (
  <button
    onClick={() => handleStatusChange(nextStatus[order.status])}
    className="h-12 px-6 bg-brand-red text-white font-bold rounded-button"
  >
    Tandai sebagai "{STATUS_LABELS[nextStatus[order.status]]}"
  </button>
)}
```

---

### 🟡 12 — Customers: No Search Input
**File:** `app/(admin)/admin/customers/page.tsx`

**Problem:** The customers page has role/status filters but no text search. With 100+ customers, finding a specific customer by name or email requires scrolling through paginated results.

**Fix:** Add a search bar that filters by name or email (server-side via URL param):
```tsx
<input
  type="search"
  placeholder="Cari nama atau email..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
/>
```
Add debounced search param to the URL and filter at the DB level.

---

### 🟠 16 — Funnel Bar: Text Invisible When Count is 0 or Very Low
**File:** `app/(admin)/admin/dashboard/page.tsx:455-465`

**Problem:** The order funnel bar chart uses:
```tsx
<span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-darken">
  {count}
</span>
```
When `count` is `0`, the bar renders at 0% width and the text "0" sits on the gray background. With `mix-blend-darken` and white text on light gray, it's nearly invisible.

**Fix:**
```tsx
{count > 0 ? (
  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
    {count}
  </span>
) : (
  <span className="pl-2 text-xs text-gray-500">{count}</span>
)}
```

---

### 🟡 13 — Settings: No Live Preview
**File:** `app/(admin)/admin/settings/page.tsx`

**Problem:** The settings page allows changing things like promo banner text, store hours, etc. After saving, the admin must navigate to the storefront manually to verify the change looks correct. There's no preview pane.

**Fix:** Add an inline preview for text-based settings (promo title, promo subtitle). For the promo banner, show a small preview component next to the input:
```tsx
<div className="border rounded-lg p-4 bg-brand-cream">
  <p className="text-xs text-text-secondary">Preview:</p>
  <p className="font-bold">{promoTitleValue}</p>
  <p className="text-sm">{promoSubtitleValue}</p>
</div>
```

---

### 🟡 14 — Blog Editor: No Image Preview After Upload
**File:** `app/(admin)/admin/blog/[id]/page.tsx`

**Problem:** After uploading a cover image, only the Cloudinary URL is shown in a text field. There's no visual preview of the uploaded image. Admins must open the URL in a new tab to verify the image looks correct.

**Fix:** After upload, show an `<Image>` preview below the uploader:
```tsx
{coverImageUrl && (
  <div className="mt-2 relative aspect-video w-full rounded-lg overflow-hidden">
    <Image src={coverImageUrl} alt="Cover preview" fill className="object-cover" />
  </div>
)}
```

---

### 🟡 17 — Audit Log Shows Truncated User IDs, Not Names
**File:** `app/(admin)/admin/dashboard/page.tsx:757-758`

**Problem:**
```tsx
<td>{log.userId ? `…${log.userId.slice(-6)}` : '—'}</td>
```
The audit log "Actor" column shows the last 6 characters of the UUID. This is useless — admins can't tell who performed an action. The API should join users table to return `userName` or `email`.

**Fix:** Update the audit log API endpoint to join the users table:
```sql
JOIN users ON audit_logs.user_id = users.id
SELECT audit_logs.*, users.name as actor_name, users.email as actor_email
```
Then render `{log.actorName ?? log.actorEmail ?? '—'}` in the table.

---

### 🟢 15 — KPI Cards: No Mini Trend Sparkline
**File:** `components/admin/dashboard/KPICard.tsx`

**Problem:** KPI cards show a `change` percentage (e.g., "+12% vs minggu lalu") but no visual sparkline. A tiny 7-day line chart inside the card would immediately show trend direction and magnitude, which is far more informative than a single delta percentage.

**Fix:** Add a `sparkData` optional prop to `KPICard`:
```tsx
interface KPICardProps {
  sparkData?: number[]; // 7 values, most recent last
}
// Render as a tiny SVG line using the data points
```
The revenue chart data is already being fetched — reuse it to compute 7-day sparklines.

---

## IMPLEMENTATION PRIORITY ORDER

1. **🔴 03** — Admin mobile sidebar (60 min — blocks mobile use entirely)
2. **🔴 01 & 02** — Fix order navigation from dashboard + orders list (15 min)
3. **🔴 04** — Field page pickup order view (30 min)
4. **🟠 11** — One-click status advancement on order detail (20 min)
5. **🟠 06** — Add status column to shipments (10 min)
6. **🟠 05** — Inventory search/filter (20 min)
7. **🟠 08** — Dashboard date presets (20 min)
8. **🟠 09** — Fix sidebar active state (5 min)
9. **🟠 16** — Fix funnel bar text visibility (5 min)
10. **🟠 07** — Fix CSV download feedback (15 min)
