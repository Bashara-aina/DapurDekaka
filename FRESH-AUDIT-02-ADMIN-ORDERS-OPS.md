# FRESH AUDIT 02 — Admin Panel, Orders, Shipments & Inventory
> Deep code-level audit — May 2026. Use this file directly in Cursor.
> Every bug references the exact file + the specific code that is wrong.

---

## BUG-01 — Orders list page: SQL OR precedence bug causes search to ignore status filter
**File:** `app/(admin)/admin/orders/page.tsx`  
**Severity:** CRITICAL — filtering by status + search returns wrong results in production

**What's wrong:**  
The `whereClause` is built with a raw `sql` template. The OR conditions inside the search block are NOT wrapped in parentheses:

```ts
// CURRENT CODE (BROKEN)
const whereClause = sql`
  ${statusFilter ? sql`${orders.status} = ${statusFilter}` : sql`true`}
  AND ${searchQuery ? sql`
    ${orders.orderNumber} ILIKE ${'%' + searchQuery + '%'}
    OR ${orders.recipientName} ILIKE ${'%' + searchQuery + '%'}
    OR ${orders.recipientEmail} ILIKE ${'%' + searchQuery + '%'}
  ` : sql`true`}
`;
```

SQL evaluates AND before OR. The generated SQL becomes:
```sql
status = 'paid' AND orderNumber ILIKE '%foo%'
OR recipientName ILIKE '%foo%'
OR recipientEmail ILIKE '%foo%'
```
This means any order where recipientName or recipientEmail matches is returned — completely ignoring the status filter.

**Fix:**  
Wrap the OR group in parentheses:
```ts
const whereClause = sql`
  ${statusFilter ? sql`${orders.status} = ${statusFilter}` : sql`true`}
  AND ${searchQuery ? sql`(
    ${orders.orderNumber} ILIKE ${'%' + searchQuery + '%'}
    OR ${orders.recipientName} ILIKE ${'%' + searchQuery + '%'}
    OR ${orders.recipientEmail} ILIKE ${'%' + searchQuery + '%'}
  )` : sql`true`}
`;
```

---

## BUG-02 — Orders list page: duplicate "Pesanan" heading renders twice
**File:** `app/(admin)/admin/orders/page.tsx` + `app/(admin)/admin/orders/OrdersClient.tsx`  
**Severity:** LOW — visual bug, heading shows twice on the orders page

**What's wrong:**  
`orders/page.tsx` renders its own `<h1>Pesanan</h1>` heading AND then passes the order list to `<OrdersClient>` which also renders `<h1 className="text-2xl font-bold">Pesanan</h1>` inside `OrdersClient.tsx`.

**Fix:**  
Remove the outer heading from `app/(admin)/admin/orders/page.tsx` — the `OrdersClient` already includes its own header with the filter chip. Delete these lines from `page.tsx`:
```tsx
// DELETE THESE from orders/page.tsx:
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Pesanan</h1>
  {statusFilter && ( ... )}
</div>
```

---

## BUG-03 — Orders list (warehouse view): packed→shipped transition doesn't include tracking number
**File:** `app/(admin)/admin/orders/OrdersClient.tsx` → `handleStatusUpdate`  
**Severity:** HIGH — warehouse cannot ship orders from the list view; gets 422 error

**What's wrong:**  
`TRANSITIONS` map in `OrdersClient.tsx` includes `packed → shipped` ("Kirim"). When warehouse clicks "Kirim", `handleStatusUpdate` sends:
```ts
body: JSON.stringify({ status: newStatus })
// Missing: trackingNumber
```
The API at `/api/admin/orders/[id]/status` has a Zod refinement:
```ts
.refine(
  (data) => data.status !== 'shipped' || (!!data.trackingNumber && data.trackingNumber.trim().length > 0),
  { message: 'Nomor resi harus diisi untuk mengubah status ke shipped' }
)
```
This always returns 422. The warehouse must navigate to the order detail page to ship — the list-level shortcut is completely broken.

**Fix:**  
Either:  
A) Remove the `packed → shipped` transition from `TRANSITIONS` in `OrdersClient.tsx` (force warehouse to use detail page), OR  
B) Show an inline resi input modal when "Kirim" is clicked in the list view before submitting.

Option A is the safest immediate fix:
```ts
// In OrdersClient.tsx, change TRANSITIONS to:
const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: 'Proses' }],
  processing: [{ status: 'packed', label: 'Kemas' }],
  // Remove: packed: [{ status: 'shipped', label: 'Kirim' }],
  shipped: [{ status: 'delivered', label: 'Terima' }],
};
```

---

## BUG-04 — Order status update: Russian text in Indonesian error message
**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Severity:** LOW — typo/copy-paste, shows broken text to user

**What's wrong:**  
At the bottom of the PATCH handler, the concurrent-update error message contains Russian:
```ts
return conflict('Status pesanan telah diubah oleh другого пользователя. Silakan refresh dan coba lagi.');
//                                              ^^^^^^^^^^^^^^^^^^^ Russian for "another user"
```

**Fix:**  
```ts
return conflict('Status pesanan telah diubah oleh pengguna lain. Silakan refresh dan coba lagi.');
```

---

## BUG-05 — B2B quotes new page: imports `db` directly in a `'use client'` component
**File:** `app/(admin)/admin/b2b-quotes/new/page.tsx`  
**Severity:** CRITICAL — page crashes at runtime in production (client bundle cannot access Neon DB)

**What's wrong:**  
The file has `'use client'` at the top but also imports:
```ts
import { db } from '@/lib/db';
import { ... } from '@/lib/db/schema';
```
These imports pull the Neon HTTP driver and database schema into the client bundle. In production this causes a runtime crash because `@neondatabase/serverless` is a Node.js module that doesn't run in the browser.

**Fix:**  
Remove the `db` and schema imports from this file entirely. All data fetching for the new-quote form should go through the existing API routes (`/api/admin/b2b-quotes`). The component already uses `fetch()` for form submission, so the DB imports are unused dead code — delete them.

---

## BUG-06 — B2B quotes detail page: checks for non-existent `'admin'` role
**File:** `app/(admin)/admin/b2b-quotes/[id]/page.tsx`  
**Severity:** LOW — dead code causes confusion; `'admin'` role doesn't exist in the schema

**What's wrong:**  
The page has:
```ts
if (!['owner', 'superadmin', 'admin'].includes(role)) {
  redirect('/admin');
}
```
The valid roles in the schema are `superadmin`, `owner`, `warehouse`, `b2b`, `customer`. There is no `admin` role. This check passes through for `superadmin` and `owner` (correct), but the `'admin'` entry is dead code.

**Fix:**  
```ts
if (!['owner', 'superadmin'].includes(role)) {
  redirect('/admin');
}
```

---

## BUG-07 — Customer detail page: "Riwayat Poin" heading but shows orders table
**File:** `app/(admin)/admin/customers/[id]/page.tsx`  
**Severity:** LOW — misleading label confuses admin staff

**What's wrong:**  
Around line 255, there is a section heading that reads `Riwayat Poin` (Points History) but the table rendered below it displays order rows, not points transactions. It's a copy-paste label error.

**Fix:**  
Change the heading to match the actual content:
```tsx
// Find this:
<h2 className="...">Riwayat Poin</h2>

// Change to:
<h2 className="...">Riwayat Pesanan</h2>
```

---

## BUG-08 — Settings page: `owner` role gets 403 but page shows empty table with no error
**File:** `app/(admin)/admin/settings/page.tsx` + `app/api/admin/settings/route.ts`  
**Severity:** MEDIUM — owner sees blank settings page with no explanation

**What's wrong:**  
The settings GET API (`/api/admin/settings`) checks:
```ts
if (!role || role !== 'superadmin') {
  return forbidden('Hanya superadmin yang dapat membaca pengaturan');
}
```
So `owner` gets a 403. But `settings/page.tsx` fetches this in `fetchSettings()` and only catches errors with `toast.error('Gagal memuat pengaturan')`. The settings state stays `[]` and `readOnly` is set to `true`. The page renders an empty table with no explanation.

**Fix — Two parts:**

Part 1: In `app/api/admin/settings/route.ts` GET, allow `owner` to read:
```ts
if (!role || !['superadmin', 'owner'].includes(role)) {
  return forbidden('Anda tidak memiliki akses ke pengaturan');
}
```

Part 2: In `app/api/admin/settings/[key]/route.ts` PATCH, keep the superadmin-only restriction to prevent owner from writing.

---

## BUG-09 — Shipments page: filter includes `processing` status orders that aren't ready to ship
**File:** `app/(admin)/admin/shipments/page.tsx`  
**Severity:** MEDIUM — confusing for warehouse, shows orders not yet packed

**What's wrong:**  
The shipments page queries:
```ts
where: and(
  isNull(orders.trackingNumber),
  eq(orders.deliveryMethod, 'delivery'),
  or(
    eq(orders.status, 'processing'),
    eq(orders.status, 'packed')
  )
)
```
`processing` orders haven't been packed yet — they shouldn't appear on the shipments/tracking page. The warehouse sees orders they can't ship yet.

**Fix:**  
Remove `processing` from the filter — only `packed` orders are ready to receive a tracking number:
```ts
where: and(
  isNull(orders.trackingNumber),
  eq(orders.deliveryMethod, 'delivery'),
  eq(orders.status, 'packed')
)
```

---

## BUG-10 — Field dashboard (packing queue): `PATCH` skips `processing` step in a single tx but the second UPDATE may not see first UPDATE
**File:** `app/api/admin/field/packing-queue/route.ts`  
**Severity:** MEDIUM — race condition risk in the packing queue

**What's wrong:**  
The PATCH handler does two sequential status updates inside a single transaction:
```ts
// First: paid → processing
await tx.update(orders).set({ status: 'processing' }).where(and(eq(orders.id, orderId), eq(orders.status, 'paid')));

// Then: processing → packed
await tx.update(orders).set({ status: 'packed' }).where(and(eq(orders.id, orderId), eq(orders.status, 'processing')));
```
The second UPDATE uses `eq(orders.status, 'processing')` as a condition. In PostgreSQL, within the same transaction, the first UPDATE's result IS visible to subsequent queries. This works correctly in practice.

However, there is no check that the second UPDATE actually succeeded (affected 1 row). If the first UPDATE somehow didn't find the row (e.g., order was concurrently modified between the two queries), the second UPDATE silently does nothing and returns `{ orderId, status: 'packed' }` as if it succeeded.

**Fix:**  
Add a `.returning()` on the second UPDATE and verify it affected a row:
```ts
const [packed] = await tx
  .update(orders)
  .set({ status: 'packed', updatedAt: new Date() })
  .where(and(eq(orders.id, orderId), eq(orders.status, 'processing')))
  .returning({ id: orders.id });

if (!packed) {
  throw new Error('PACK_FAILED_STATUS_CHANGED');
}
```

---

## BUG-11 — Field inventory adjust: inventory page calls `/api/admin/field/inventory/adjust` but there are TWO adjust endpoints with different schemas
**File:** `app/(admin)/admin/inventory/InventoryClient.tsx` calls `POST /api/admin/field/inventory/adjust`  
**File:** `app/api/admin/field/inventory/adjust/route.ts` (POST — requires `reason` field)  
**File:** `app/api/admin/field/inventory/route.ts` (PATCH — optional `note` field)  
**Severity:** MEDIUM — InventoryClient sends `{ variantId, delta, reason }` to the POST endpoint

**What's wrong:**  
`InventoryClient.tsx` sends:
```ts
body: JSON.stringify({
  variantId: variant.id,
  delta,
  reason: 'Inline adjustment from inventory page',
})
```
This matches the POST `/api/admin/field/inventory/adjust` schema (which requires `reason`). That endpoint exists and is correct.

The confusion is the PATCH on `/api/admin/field/inventory` also adjusts stock but uses a different schema (`note` optional). These two endpoints do the same thing with slightly different request bodies. This is redundant but not broken per se. 

**Action needed:** No immediate fix, but document that the POST `/adjust` endpoint is the canonical one and the PATCH on the base route should be deprecated or removed.

---

## BUG-12 — Admin order detail: pickup orders show the order number as pickup code, but `pickupCode` column in DB is always null
**File:** `app/(admin)/admin/orders/[id]/page.tsx`  
**File:** `app/api/admin/field/pickup-queue/route.ts`  
**Severity:** LOW — cosmetic but inconsistent

**What's wrong:**  
The admin order detail page correctly shows `order.orderNumber` as the pickup code display (which is fine). But the `orders.pickupCode` database column was intended to store a dedicated pickup code and is never populated.

**Fix:**  
When creating pickup orders (in `checkout/initiate/route.ts`), set `pickupCode = orderNumber`:
```ts
await tx.insert(orders).values({
  ...orderData,
  pickupCode: deliveryMethod === 'pickup' ? orderNumber : null,
})
```
This makes `pickupCode` match the display so warehouse field apps querying by `pickupCode` work correctly.

---

## BUG-13 — Admin orders search: `email` field search uses `recipientEmail` but field name in search UI says "email"
**File:** `app/(admin)/admin/orders/OrdersClient.tsx`  
**Severity:** INFO — works correctly, just needs documentation clarity

The search placeholder says "Cari no. pesanan, nama, email..." which correctly maps to `orderNumber ILIKE`, `recipientName ILIKE`, `recipientEmail ILIKE`. No bug — just confirm the correct field names are being searched.

---

## BUG-14 — Tracking queue GET: only returns `packed` + `delivery` + `trackingNumber IS NULL` — but ShipmentsClient shows already-shipped orders if tracking was saved separately
**File:** `app/api/admin/field/tracking-queue/route.ts`  
**Severity:** LOW — tracking queue correctly filters for untracked packed orders

The tracking queue GET is correct: `status = packed AND deliveryMethod = delivery AND trackingNumber IS NULL`.

**However** — the ShipmentsClient page (`/admin/shipments`) shows `processing OR packed` orders (BUG-09 above). Once BUG-09 is fixed (only showing `packed`), the Shipments page and Tracking Queue will show the same data. Consider removing one of the two views or clearly differentiating their purpose.
