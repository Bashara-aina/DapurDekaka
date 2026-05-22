# AUDIT 03 — ADMIN PANEL & OPERATIONS
**Date**: 2026-05-22 | **Branch**: fix/multiple-audit-fixes-may-2026  
**Scope**: `app/(admin)/admin/`, `app/api/admin/`, `components/admin/`  
**If 100 users hit this tomorrow**: Orders get stuck in "processing" because admins can't advance them to "packed" or "shipped" from the list view; inventory activity not audited; B2B inquiry updates may not persist.

---

## BUG-01 — HIGH: OrdersClient TRANSITIONS Map Incomplete — Orders Get Stuck

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:53–56`  
**Severity**: HIGH — operational blocker  

**What's wrong**: The `TRANSITIONS` map defines which status changes are available per current status:
```ts
const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: 'Proses' }],
  shipped: [{ status: 'delivered', label: 'Terima' }],
};
```

This means from the order list, admin can ONLY:
- Move `paid → processing`
- Move `shipped → delivered`

**Missing transitions**:
- `processing → packed` — there's no button, so after setting to "processing", the admin is stuck. They'd have to go to the individual order detail page to advance it.
- `packed → shipped` — same problem. Cannot ship from list view.

For a warehouse with 30+ orders per day, having to click into each order individually to advance status is a major workflow bottleneck.

**Fix**:
```ts
const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: '🔄 Proses' }],
  processing: [{ status: 'packed', label: '📦 Kemas' }],
  packed: [{ status: 'shipped', label: '🚚 Kirim' }],
  shipped: [{ status: 'delivered', label: '✅ Terima' }],
};
```

Note: The `packed → shipped` transition should also prompt for a tracking number. Consider opening a modal to collect `trackingNumber` before submitting the status change.

---

## BUG-02 — HIGH: Admin Orders List Shows No Item Details

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:190–230`  
**Severity**: HIGH — operational gap  

**What's wrong**: The orders table has columns: Order, Pelanggan, Status, Total, Tanggal, Aksi. There is no column or sub-row showing what products were ordered. Admin must click into each order to see items. For a fulfillment workflow, knowing "this order has 3 pcs siomay and 2 pcs dimsum" from the list view is essential.

The `initialOrders` type (`OrderItem` in `OrdersClientProps`) doesn't include items — the page-level query would need to be updated to include items.

**Fix**: 
1. Update `app/(admin)/admin/orders/page.tsx` server query to include `with: { items: true }`
2. Update `OrderItem` interface in `OrdersClient.tsx` to include `items: Array<{ productNameId: string; variantNameId: string; quantity: number }>`
3. In the table row, add a sub-text under the order number:
```tsx
<td className="px-6 py-4">
  <div className="flex flex-col">
    <span className="font-medium text-sm">{order.orderNumber}</span>
    <span className="text-xs text-gray-400">
      {order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}
    </span>
    {order.items && (
      <span className="text-xs text-gray-500 mt-0.5">
        {order.items.slice(0, 2).map(i => `${i.productNameId} ×${i.quantity}`).join(', ')}
        {order.items.length > 2 && ` +${order.items.length - 2} lagi`}
      </span>
    )}
  </div>
</td>
```

---

## BUG-03 — HIGH: Admin Settings Changes Not Logged to Audit Trail

**File**: `app/api/admin/settings/route.ts`  
**Severity**: MEDIUM — audit gap  

**What's wrong**: `adminActivityLogs` is imported at the top of the file but never actually used in the PATCH handler. When a superadmin changes system settings (e.g., payment expiry, promo codes, store hours), there is no audit log entry. If something breaks in production, there's no way to trace who changed what setting.

**Fix**: After the settings loop, insert an audit log:
```ts
// After the update loop, add:
await db.insert(adminActivityLogs).values({
  userId: session.user.id,
  action: 'UPDATE_SETTINGS',
  entityType: 'system_settings',
  entityId: 'bulk',
  metadata: {
    updatedKeys: parsed.data.settings.map(s => s.key),
    updatedCount: updatedSettings.length,
  },
});
```

---

## BUG-04 — MEDIUM: Admin Settings GET Allows `owner` Role; No Public Settings Route

**File**: `app/api/admin/settings/route.ts:19–21`  
**Severity**: MEDIUM — missing endpoint  

**What's wrong**: The settings GET endpoint requires `superadmin` OR `owner` role. The PATCH requires `superadmin` only — correct. But there's no public settings endpoint for the store front. The checkout page tries to fetch store hours from `/api/settings/public` (checkout/page.tsx:213):
```ts
const res = await fetch('/api/settings/public');
```

This route (`/api/settings/public/route.ts`) **does not appear to exist** in the codebase. The checkout silently catches the error and falls back to hardcoded defaults. But promo settings (PROMO_CODE, PROMO_TITLE) are fetched in HomePage using `db.query.systemSettings.findMany` directly — inconsistent approach.

**Fix**: Create `app/api/settings/public/route.ts`:
```ts
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { success } from '@/lib/utils/api-response';

const PUBLIC_KEYS = ['store_open_days', 'store_opening_hours', 'PROMO_CODE', 'PROMO_TITLE', 'PROMO_SUBTITLE'];

export async function GET() {
  const settings = await db.query.systemSettings.findMany({
    where: sql`${systemSettings.key} IN (${sql.join(PUBLIC_KEYS.map(k => sql`${k}`), sql`,`)})`,
  });
  const result = Object.fromEntries(settings.map(s => [s.key, { value: s.value, type: s.type }]));
  return success(result);
}
```

---

## BUG-05 — MEDIUM: B2B Inquiry Status Update Component — No Optimistic Update Revert

**File**: `components/admin/b2b/InquiryStatusUpdate.tsx`  
**Severity**: MEDIUM  

**What's wrong**: The `InquiryStatusUpdate` component updates B2B inquiry status via API. If the API call fails, there's no error state shown to the admin — the UI might show the updated status while the DB still has the old one. The admin would need to refresh to see the real state.

**Fix**: Wrap the mutation in try/catch, and on error, revert the local state and show a toast error:
```ts
try {
  await updateInquiryStatus(inquiryId, newStatus);
  // optimistic update already applied
} catch (error) {
  // Revert
  setCurrentStatus(previousStatus);
  toast.error('Gagal mengubah status. Coba lagi.');
}
```

---

## BUG-06 — HIGH: Admin Dashboard Route Redirect Target May Not Exist

**File**: `app/(admin)/admin/page.tsx`  
**Severity**: HIGH — admin landing page may 404  

**What's wrong**: `/admin/page.tsx` unconditionally redirects to `/admin/dashboard`. The dashboard page needs to exist at `app/(admin)/admin/dashboard/page.tsx`. This file was visible in the worktree but needs to be confirmed in the main branch.

**Verification needed**: Check if `app/(admin)/admin/dashboard/page.tsx` exists. If it doesn't, every admin login results in a 404.

**Fix if missing**: Create the dashboard page with basic KPIs (total orders today, revenue today, pending orders, low stock items). Use existing `RevenueChart` and `KPICard` components from `components/admin/dashboard/`.

---

## BUG-07 — MEDIUM: Admin Field Page — `packed → shipped` Doesn't Require Tracking Number

**File**: `app/(admin)/admin/field/page.tsx:329–468` (PackingTab)  
**Severity**: MEDIUM — workflow gap  

**What's wrong**: The packing workflow goes: pack order → mark as "packed". The next step (tracking/shipping) is handled in the **TrackingTab**. But the transition from `packed → shipped` in the main admin orders list (once BUG-01 is fixed) will allow advancing status WITHOUT entering a tracking number. This would leave `trackingNumber = null` on a "shipped" order, meaning customers can't track their package.

**Fix**: When `packed → shipped` transition is triggered from OrdersClient, open a modal to collect tracking number before confirming the status change. Alternatively, restrict the `packed → shipped` transition to only be available from the Field Dashboard tracking tab (where tracking number entry is required).

---

## BUG-08 — LOW: Admin Coupons Page — No Search or Filter

**File**: `app/(admin)/admin/coupons/page.tsx`  
**Severity**: LOW — operational usability  

**What's wrong**: The coupons list fetches ALL coupons ordered by creation date with no pagination, search, or filter. As coupon count grows (already showing Expired, Active, Maxed, Scheduled states), finding a specific coupon requires manually scanning the table.

**Fix**: Add:
1. Status filter tabs (All / Active / Expired / Inactive)
2. Code search input
3. Pagination (if > 20 coupons)

---

## BUG-09 — MEDIUM: Admin Orders — Delivered Orders Still Appear in Default View

**File**: `app/(admin)/admin/orders/page.tsx`  
**Severity**: MEDIUM — UX clutter  

**What's wrong**: The default admin orders view shows ALL orders. For an active business, this means delivered and cancelled orders from days/weeks ago clutter the view. The operational team only cares about orders that need action (paid, processing, packed).

**Fix**: Add default filter to show only "active" orders, with option to see all:
```ts
// Default status filter: exclude delivered and cancelled
const defaultStatuses = ['pending_payment', 'paid', 'processing', 'packed', 'shipped'];
```
Or add quick filter tabs: "Perlu Tindakan | Dikirim | Selesai | Dibatalkan"

---

## BUG-10 — HIGH: Blog Admin — TiptapEditor Has No Image Paste Handling

**File**: `components/admin/blog/TiptapEditor.tsx`  
**Severity**: HIGH — content management UX  

**What's wrong**: The blog editor uses Tiptap for rich text editing. When an admin pastes an image from clipboard or drags an image in, Tiptap's default behavior embeds it as a base64 data URL — which would bloat the blog post content in the DB significantly (a 100KB image becomes ~133KB base64 string in JSON).

**Fix**: Add a Tiptap image paste handler that:
1. Intercepts paste/drop events
2. Uploads the image to Cloudinary via `/api/admin/upload`
3. Inserts the Cloudinary URL instead of base64

```ts
// In TiptapEditor, add extension:
import { Extension } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';

// Custom paste handler that uploads images
```

---

## BUG-11 — MEDIUM: Admin Users Page — Role Change Has No Confirmation

**File**: `app/(admin)/admin/users/page.tsx` (based on worktree content)  
**Severity**: MEDIUM — dangerous action without confirmation  

**What's wrong**: If the admin users page has a role change dropdown, changing a user's role (e.g., from `customer` to `warehouse`) should require explicit confirmation. Without it, an accidental click could give someone inappropriate access.

**Fix**: Add `confirm()` dialog before role change API call:
```ts
if (!confirm(`Yakin ubah role ${userName} menjadi ${newRole}? Perubahan ini langsung berlaku.`)) return;
```

---

## MISSING FEATURE: No Bulk Order Status Update

**File**: `app/(admin)/admin/orders/OrdersClient.tsx`  
**Severity**: MEDIUM — operational efficiency  

**What's missing**: When there are 20 paid orders ready to process, admin must click each one individually. There's no checkbox selection + bulk "Proses Semua" button.

**Fix**: Add checkbox column to table, "Select All" header checkbox, and a bulk action toolbar that appears when items are selected:
```
[x] 5 pesanan dipilih → [Proses Semua] [Batalkan]
```

---

## MISSING FEATURE: No Tracking Number Entry When Shipping from Admin Orders List

**File**: `app/(admin)/admin/orders/OrdersClient.tsx`  
**Severity**: HIGH  

**What's missing**: When an admin advances an order from `packed → shipped` (after BUG-01 fix), there's no way to enter a tracking/resi number in the transition. The tracking number is only enterable from the Field Dashboard's Tracking tab.

**Fix**: When the `packed → shipped` transition is clicked in OrdersClient, show a minimal inline form requesting:
- Nomor Resi (required)  
- Kurir Override (optional)

Submit both the status change and tracking number together to `/api/admin/orders/${orderId}/status`.

---

## INCOMPLETE FEATURE: Admin Dashboard Revenue Chart — No Date Range Picker

**File**: `components/admin/dashboard/RevenueChart.tsx`  
**Severity**: LOW  

**What's missing**: The revenue chart likely shows a fixed date range (last 7 or 30 days). There's no way to select a custom date range. For a growing business, seeing revenue by month or custom range is essential.

**Fix**: Add date range selector: Last 7 days | Last 30 days | This Month | Last Month | Custom
