# AUDIT 02 — ADMIN PANEL & OPERATIONS
**Date**: 2026-05-22 | **Branch**: currently on `fix/multiple-audit-fixes-may-2026`
**Scope**: `app/(admin)/admin/`, `app/api/admin/field/`, role-based access, warehouse operations
**If 100 users hit this tomorrow**: Warehouse staff can't pack orders (broken API); tracking numbers never get saved; admin can change system settings without audit log.

---

## BUG-01 — CRITICAL: Packing Queue API Does Not Match UI Payload

**File**: `app/api/admin/field/packing-queue/route.ts:39–41, 43–121`
**Severity**: CRITICAL — warehouse cannot pack orders

**What's wrong**: The `packing-queue` route's PATCH handler expects `{ orderId: string }` only (line 39-41). The `field/page.tsx` UI sends `{ status: 'packed', note, coldChainCondition }` (line 329):
```ts
packOrder(orderId, { status: 'packed', note, coldChainCondition: coldChain });
```

The Zod schema `packSchema` at line 39 only accepts `orderId`, and the handler at line 43–121 completely ignores `status`, `note`, and `coldChainCondition`. The cold chain condition (baik/perlu_tambah_es/rusak) is captured from the warehouse worker but never saved anywhere. The note is also lost.

Additionally, the endpoint returns `{ orderId, status: 'packed' }` but the UI expects `{ orderId, ... }` from the response at line 139, which works since it just needs `json.success`.

**Current code (line 56)**:
```ts
const body = await req.json();
const parsed = packSchema.safeParse(body);
// parsed.data is just { orderId: string }
// status, note, coldChainCondition are silently ignored
```

**Fix** — Update the schema and handler:
```ts
const packSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['packed']).optional(),
  note: z.string().optional(),
  coldChainCondition: z.enum(['baik', 'perlu_tambah_es', 'rusak']).optional(),
});

// In the handler, after successfully setting status to 'packed':
// Add cold chain and note to order metadata via a separate update or JSON field
// Note: orders table does NOT have a coldChainCondition or note field currently.
// Recommendation: Add `packingNote` and `coldChainCondition` columns to orders table,
// OR store in orderStatusHistory.metadata JSONB (which already exists).
// The safest immediate fix: store in orderStatusHistory.metadata:
await tx.update(orders).set({
  status: 'packed',
  updatedAt: new Date(),
  // Add a metadata field or note if available in schema
});
// Actually, since schema doesn't have these fields, use orderStatusHistory.note:
// The note at line 113 already says "Order dikemas oleh ${session.user.name}"
// We should extend this to include coldChainCondition in the metadata
```

For immediate fix without schema change — update the history note:
```ts
await tx.insert(orderStatusHistory).values({
  orderId,
  fromStatus: 'processing',
  toStatus: 'packed',
  changedByUserId: session.user.id,
  changedByType: 'user',
  note: `Order dikemas oleh ${session.user.name}${parsed.data.coldChainCondition ? ` — cold chain: ${parsed.data.coldChainCondition}` : ''}${parsed.data.note ? ` — catat: ${parsed.data.note}` : ''}`,
  metadata: {
    coldChainCondition: parsed.data.coldChainCondition,
    warehouseNote: parsed.data.note,
  },
});
```

---

## BUG-02 — HIGH: Field Dashboard — Missing API Routes

**File**: `app/(admin)/admin/field/page.tsx:97–130`
**Severity**: HIGH — 4 out of 5 tabs won't load any data

**What's wrong**: The field dashboard calls 5 API endpoints. The `packing-queue` route EXISTS (at `app/api/admin/field/packing-queue/route.ts`). But 4 others are likely missing:

| Endpoint | File referenced | Status |
|----------|-----------------|--------|
| `/api/admin/field/packing-queue` | ✅ EXISTS (GET + PATCH) | OK |
| `/api/admin/field/tracking-queue` | fetchTrackingQueue (line 97) | ❓ MISSING — needs GET + PATCH |
| `/api/admin/field/pickup-queue` | fetchPickupQueue (line 104) | ❓ MISSING — needs GET + PATCH |
| `/api/admin/field/today-summary` | fetchTodaySummary (line 111) | ❓ MISSING — needs GET |
| `/api/admin/field/worker-activity` | fetchWorkerActivity (line 118) | ❓ MISSING — needs GET |
| `/api/admin/field/inventory` | fetchInventory (line 125) | ❓ MISSING — needs GET |
| `/api/admin/field/inventory/restock` | restockInventory (line 165) | ❓ MISSING — needs POST |
| `/api/admin/field/inventory/adjust` | adjustInventory (line 176) | ❓ MISSING — needs POST |
| `/api/admin/field/orders/[orderId]` | packOrder (line 132) | ❓ MISSING — needs PATCH |

All these endpoints need to be created. The packing tab will work; the other 4 tabs will show "Gagal memuat data" to warehouse staff.

**Fix**: Create all missing endpoints. Each should:
1. Auth check (warehouse/owner/superadmin)
2. Return `{ success: true, data: ... }` format
3. Handle the specific query/mutation

See Appendix A for all endpoint specifications.

---

## BUG-03 — HIGH: Field Dashboard Has No Auth Protection

**File**: `app/(admin)/admin/field/page.tsx:1`
**Severity**: HIGH — unauthenticated users can access warehouse dashboard

**What's wrong**: The `field/page.tsx` is a `'use client'` component. It does NOT have any auth check — no `auth()` from next-auth, no session verification. The server-side route that renders this page (likely `app/(admin)/admin/field/page.tsx` is itself the page) does not check auth either.

The admin layout (`app/(admin)/admin/layout.tsx`) likely has auth protection, but the field page being a client component with no auth check is a defense-in-depth failure. If someone bypasses the admin middleware, they can access the warehouse dashboard without authentication.

**Fix**: Add auth check. Either:
1. In the page server component (default export), wrap in auth:
```ts
export default async function FieldDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (!['superadmin', 'owner', 'warehouse'].includes(role)) redirect('/admin');
  return <FieldDashboardClient />;
}
```
2. Or add a client-side auth check using `useSession` from next-auth/react.

---

## BUG-04 — MEDIUM: Hardcoded Emoji in Admin UI

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:62–67`, `app/(admin)/admin/field/page.tsx` (multiple locations)
**Severity**: MEDIUM — violation of project anti-slop rules

**What's wrong**: The project rules state no emoji in production code UI. The OrdersClient has emoji in status transitions (lines 62-67):
```ts
const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: '🔄 Proses' }],
  processing: [{ status: 'packed', label: '📦 Kemas' }],
  packed: [{ status: 'shipped', label: '🚚 Kirim' }],
  shipped: [{ status: 'delivered', label: '✅ Terima' }],
};
```

The field/page.tsx has emoji everywhere: `📦`, `🚚`, `✅`, `🏠`, `📍`, `🏷`, `📝`, `⚠`, `☕`, `🍜`.

**Fix**: Replace emoji with SVG icons from lucide-react. For the TRANSITIONS map, use icon components instead of emoji labels.

---

## BUG-05 — MEDIUM: Inline Hex Colors in Admin Orders Table

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:210, 242, 430`
**Severity**: MEDIUM — violation of design system

**What's wrong**: Project rules say "Never use arbitrary Tailwind color values like bg-[#C8102E]". The OrdersClient has hardcoded hex in inline styles at multiple locations:
- Line 210: `className="h-10 px-4 bg-[#0F172A] text-white..."`
- Line 242: `className="bg-[#0F172A] text-white"`
- Line 430: `className="bg-[#0F172A] text-white"`

These should use the `bg-admin-sidebar` or similar admin design system token. The admin sidebar color is defined as `#0F172A` in the project rules, but this should be defined as a CSS variable or Tailwind custom class, not hardcoded inline.

**Fix**: Define `bg-admin-sidebar` in the Tailwind config to `bg-[#0F172A]` once, then use `bg-admin-sidebar` throughout admin pages instead of raw hex values.

---

## BUG-06 — MEDIUM: Orders Admin — Role Mismatch in Status Transitions

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:88`
**Severity**: MEDIUM — incorrect role permissions

**What's wrong**: Line 88 checks `canUpdateStatus`:
```ts
const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(userRole);
```

But according to the project role permission matrix (CURSOR_RULES.md Section 9), warehouse role has "partial" permission for order status — they can only set packed→shipped by entering tracking number. They should NOT be able to advance orders from `paid→processing` or `processing→packed` through the admin orders page dropdown.

The TRANSITIONS map (lines 62-67) shows the full chain: paid→processing→packed→shipped→delivered. Warehouse should only be able to do the packed→shipped transition (via tracking number entry), not the earlier ones.

**Fix**: Create a `warehouseTransitions` map:
```ts
const WAREHOUSE_TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  packed: [{ status: 'shipped', label: '🚚 Kirim' }], // warehouse only gets this
};

const roleTransitions = userRole === 'warehouse'
  ? WAREHOUSE_TRANSITIONS
  : TRANSITIONS;
```

---

## BUG-07 — MEDIUM: Coupon Validation — `applicable_product_ids` Not Implemented

**File**: `app/api/checkout/initiate/route.ts:176–182`
**Severity**: MEDIUM — coupon can be applied to wrong products

**What's wrong**: Coupon validation at line 176 only checks:
1. Coupon exists and isActive
2. minOrderAmount
3. expiresAt
4. startsAt
5. maxUses / usedCount
6. maxUsesPerUser (per-user limit)

It does NOT check `applicable_product_ids` or `applicable_category_ids` — the coupon validation rule #8 from the project spec: "If applicable_product_ids: at least one cart item matches" and "If applicable_category_ids: at least one cart item matches".

If a superadmin creates a coupon that only applies to "Dimsum Crabstick" but it's used on a cart with only "Lumpia", the coupon should be rejected, but it won't be.

**Fix**: Add product/category restriction checks after line 200:
```ts
// Check applicable_product_ids
if (coupon.applicableProductIds && coupon.applicableProductIds.length > 0) {
  const cartProductIds = items.map(i => i.productId);
  const hasValidProduct = cartProductIds.some(pid => coupon.applicableProductIds!.includes(pid));
  if (!hasValidProduct) {
    // Rollback the claimed coupon slot
    if (coupon.maxUses) {
      await db.update(coupons)
        .set({ usedCount: sql`used_count - 1` })
        .where(eq(coupons.id, coupon.id));
    }
    return conflict('Kupon ini tidak berlaku untuk produk yang dipilih');
  }
}

// Check applicable_category_ids
if (coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0) {
  // Need to fetch product category IDs for cart items
  const cartProductIds = [...new Set(items.map(i => i.productId))];
  const productsData = await db.query.products.findMany({
    where: inArray(products.id, cartProductIds),
    columns: { id: true, categoryId: true },
  });
  const cartCategoryIds = productsData.map(p => p.categoryId);
  const hasValidCategory = cartCategoryIds.some(cid => coupon.applicableCategoryIds!.includes(cid));
  if (!hasValidCategory) {
    if (coupon.maxUses) {
      await db.update(coupons)
        .set({ usedCount: sql`used_count - 1` })
        .where(eq(coupons.id, coupon.id));
    }
    return conflict('Kupon ini tidak berlaku untuk kategori produk yang dipilih');
  }
}
```

Note: The `applicableProductIds` and `applicableCategoryIds` fields need to exist on the `coupons` table. Verify schema — they may not be present. If missing, add to schema and create migration.

---

## BUG-08 — MEDIUM: Orders Admin — No Status Validation

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:91–125`
**Severity**: MEDIUM — invalid status transitions can be attempted

**What's wrong**: The `handleStatusUpdate` function calls `/api/admin/orders/${orderId}/status` with `{ status: newStatus }`. There's no validation that the transition is valid (e.g., you shouldn't be able to go from `delivered` back to `shipped`). The API route likely handles this, but it should be verified.

Additionally, there's no handling for the case where the order has already been changed by another user (optimistic update risk). The local state update at line 116 followed by `router.refresh()` could show stale data if the refresh fails.

**Fix**: Verify the API route `app/api/admin/orders/[orderId]/status` validates status transitions server-side. Add a check in the client: if the API returns 409 (conflict), show a toast explaining the order was already updated and call `router.refresh()`.

---

## BUG-09 — LOW: Orders Admin Table Uses Emoji in Status Labels

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:51–60`
**Severity**: LOW — anti-slop violation

**What's wrong**: `STATUS_LABELS` uses emoji inline:
```ts
const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Menunggu',
  paid: 'Dibayar',
  // ...
};
```
These don't have emoji, so this is fine. But the `TRANSITIONS` at lines 62-67 uses emoji — already noted in BUG-04.

---

## INCOMPLETE FEATURE: Order Detail Page Missing

**File**: `app/(admin)/admin/orders/[orderId]/page.tsx` (does not exist)
**Severity**: HIGH — admins can't view order details

**What's wrong**: The OrdersClient has a link at line 345-350:
```tsx
<a href={`/admin/orders/${order.id}`} ...>Detail</a>
```
But `app/(admin)/admin/orders/[orderId]/page.tsx` does not exist. Every click on "Detail" goes to a 404.

**Fix**: Create `app/(admin)/admin/orders/[orderId]/page.tsx` showing:
- Full order information (customer, address, items, payment info)
- Order status history timeline
- Ability to add tracking number (if not already set)
- Ability to print packing slip
- Ability to manually mark as refunded (superadmin/owner only)

---

## INCOMPLETE FEATURE: Coupon CRUD Pages Missing

**File**: `app/(admin)/admin/coupons/page.tsx:117–122`
**Severity**: MEDIUM — coupons can only be listed, not created/edited

**What's wrong**: The coupons page has a "Buat Kupon" button linking to `/admin/coupons/new` (line 118), but `app/(admin)/admin/coupons/new/page.tsx` likely does not exist. The "Edit" link at line 197 links to `/admin/coupons/${coupon.id}`, which likely also doesn't exist.

**Fix**: Create `app/(admin)/admin/coupons/new/page.tsx` and `app/(admin)/admin/coupons/[id]/page.tsx` with full coupon CRUD forms including:
- Code (uppercase, auto-generate option)
- Type (percentage/fixed/free_shipping/buy_x_get_y)
- Discount value / buy_x_get_y quantities
- minOrderAmount, maxDiscountAmount
- maxUses, maxUsesPerUser
- applicable_product_ids, applicable_category_ids (multi-select)
- startsAt, expiresAt (date pickers)
- isActive, isPublic toggle

---

## MISSING: loading.tsx and error.tsx for Admin Routes

| Route | loading.tsx | error.tsx |
|-------|-------------|-----------|
| `app/(admin)/admin/orders/page.tsx` | ❌ MISSING | ❌ MISSING |
| `app/(admin)/admin/coupons/page.tsx` | ❌ MISSING | ❌ MISSING |
| `app/(admin)/admin/field/page.tsx` | ❌ MISSING | ❌ MISSING |
| `app/(admin)/admin/orders/[orderId]/page.tsx` | N/A (doesn't exist) | N/A |

---

## Priority Summary

| ID | Severity | File | Issue | Status |
|----|----------|------|-------|--------|
| BUG-01 | CRITICAL | packing-queue/route.ts | Schema mismatch — coldChain/note ignored | Fix needed |
| BUG-02 | HIGH | field/page.tsx | 4 missing API routes | Create needed |
| BUG-03 | HIGH | field/page.tsx | No auth check on client component | Fix needed |
| BUG-04 | MEDIUM | OrdersClient.tsx, field/page.tsx | Hardcoded emoji in UI | Fix needed |
| BUG-05 | MEDIUM | OrdersClient.tsx | Inline hex colors not using design tokens | Fix needed |
| BUG-06 | MEDIUM | OrdersClient.tsx:88 | Warehouse gets too many status transitions | Fix needed |
| BUG-07 | MEDIUM | checkout/initiate/route.ts:176 | applicable_product_ids/categories not validated | Fix needed |
| BUG-08 | MEDIUM | OrdersClient.tsx:91 | No status transition conflict handling | Fix needed |
| MF-01 | HIGH | orders/[orderId]/page.tsx | Order detail page missing (404 on Detail click) | Create needed |
| MF-02 | MEDIUM | coupons/new/page.tsx | Coupon creation page missing | Create needed |
| MF-03 | MEDIUM | coupons/[id]/page.tsx | Coupon edit page missing | Create needed |
| LOAD-01 | HIGH | admin/orders/page.tsx | No loading.tsx | Create needed |
| LOAD-02 | HIGH | admin/field/page.tsx | No loading.tsx | Create needed |

---

## Appendix A — Missing API Routes for Field Dashboard

### `app/api/admin/field/tracking-queue/route.ts`
- **GET**: Return orders with status = 'packed' (need tracking), with items
- **PATCH**: Accept `{ orderId, trackingNumber, courierCode?, trackingUrl? }` — set status to 'shipped' and save trackingNumber/trackingUrl, also save to courierCode field on order

### `app/api/admin/field/pickup-queue/route.ts`
- **GET**: Return orders with status = 'paid' AND deliveryMethod = 'pickup'
- **PATCH**: Accept `{ orderId }` — set status to 'delivered'

### `app/api/admin/field/today-summary/route.ts`
- **GET**: Return `{ packedCount, trackingCount, pickupCount, inventoryUpdateCount, date }` based on today's orderStatusHistory and inventoryLogs

### `app/api/admin/field/worker-activity/route.ts`
- **GET**: Return today's order status history and inventory logs for the logged-in warehouse user

### `app/api/admin/field/inventory/route.ts`
- **GET**: Return all product variants with stockLevel classification (out/stock=0, low/stock<5, healthy)

### `app/api/admin/field/inventory/restock/route.ts`
- **POST**: Add stock to variant (increase), log as 'restock' in inventoryLogs with reason/note

### `app/api/admin/field/inventory/adjust/route.ts`
- **POST**: Set absolute stock quantity (override), log as 'adjustment' in inventoryLogs with reason

### `app/api/admin/field/orders/[orderId]/route.ts`
- **PATCH**: Accept `{ status?, trackingNumber?, coldChainCondition?, note? }` — update order, write status history with metadata