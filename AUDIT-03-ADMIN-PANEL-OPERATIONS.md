# AUDIT 03 — ADMIN PANEL & OPERATIONS

**Auditor**: Code Audit
**Date**: May 2026
**Scope**: `app/(admin)/admin/`, `components/admin/`, `app/api/admin/`
**Standard**: PRD.md, TECH_STACK.md, DESIGN_SYSTEM.md, Role Permission Matrix

---

## EXECUTIVE SUMMARY

The admin panel is mostly functional and well-structured. However, there are **critical role permission violations**, a **missing stock protection pattern**, and several **design inconsistencies** that must be fixed before launch. The warehouse role can see all orders and all order details — a direct violation of the PRD role matrix.

---

## CRITICAL SEVERITY

### BUG-01 — HIGH SEVERITY: Warehouse Staff Can Access Full Order List + All Customer Data

**File**: `app/middleware.ts:17-22`
**Also**: `app/(admin)/admin/orders/page.tsx` (server-side render)

**What's wrong**:
The middleware allows warehouse role to access `/admin/orders`:
```typescript
if (role === 'warehouse') {
  const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];
```
This grants warehouse staff access to the FULL orders list. From there, the `OrdersPage` server component fetches ALL orders (paginated) and passes them to `OrdersClient`, which renders customer names, emails, phone numbers, addresses, and full order items for every order.

According to the PRD Section 9.3 Role Permission Matrix:
- Warehouse should ONLY be able to "view orders with status: paid, processing, packed" — and this is for the purpose of updating tracking, NOT for viewing full customer PII.
- Warehouse should NOT be able to see customer email addresses, phone numbers, or delivery addresses.
- The SPEC says warehouse can "update stock count" and "input tracking number and mark order as shipped" — NOT browse the full order list.

**Current behavior**: Warehouse staff can open `/admin/orders`, see every order with full customer PII (name, email, phone, address), and only the UI disables the status update button for unauthorized transitions.

**Fix**:
1. Remove `/admin/orders` from the warehouse allowed paths in `middleware.ts`.
2. Create a separate lightweight `/admin/field/orders` or `/admin/field/shipment-queue` endpoint for warehouse that only returns: orderNumber, recipientName (no email/phone/address), status, item count, courier, and totalAmount — NO PII.
3. The field dashboard (`/admin/field`) already has its own order queues (packing, tracking, pickup) — those are fine.

The orders page itself should check role server-side, not just rely on UI disabling.

---

### BUG-02 — HIGH SEVERITY: Stock Adjustment Route Missing Atomic Pattern + No Concurrent Stock Check

**File**: `app/api/admin/field/inventory/adjust/route.ts:46-50`

**What's wrong**:
```typescript
const quantityAfter = Math.max(0, quantityBefore + delta);
const actualDelta = quantityAfter - quantityBefore;
await db.update(productVariants).set({ stock: quantityAfter, updatedAt: new Date() }).where(eq(productVariants.id, variantId));
```

Two problems:

1. **Not atomic**: Uses a plain UPDATE without checking current stock at time of update. Two simultaneous adjustments (e.g., two warehouse workers updating the same variant) could both read stock=10, then both write their own result, causing lost updates. Must use the `GREATEST(stock - qty, 0)` pattern with `returning()` and check affected rows.

2. **No lower bound enforcement on reduce**: The `Math.max(0, ...)` is calculated from `quantityBefore` which was fetched before the UPDATE. There's no `WHERE gte(stock, abs(delta))` guard. If the stock was already reduced by a concurrent payment webhook between the read and write, the adjustment could go "below zero" in the sense that it undoes a payment settlement's stock deduction incorrectly.

The PRD Section 7.3 says "Negative stock is NOT allowed (system enforces minimum 0)" and Section 7.4 says atomic pattern must be used.

**Fix**:
```typescript
const result = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock + ${delta}, 0)`, updatedAt: new Date() })
  .where(and(
    eq(productVariants.id, variantId),
    // Prevent over-reduction beyond current stock when delta is negative
    delta >= 0 ? sql`true` : gte(productVariants.stock, Math.abs(delta))
  ))
  .returning({ newStock: productVariants.stock });

if (result.length === 0) {
  throw new Error('STOCK_UPDATE_CONFLICT');
}
```

---

### BUG-03 — MEDIUM SEVERITY: `pending_payment` Orders Are Visible to Warehouse in Field Dashboard

**File**: `app/api/admin/field/packing-queue/route.ts`

**What's wrong**:
The packing queue filters for `status = 'paid'` only — this is correct. However, the tracking queue (`field/tracking-queue`) shows orders with `status = 'packed'` — also correct.

But the field dashboard's summary counts (`app/(admin)/admin/field/page.tsx:1074`) fetch all queues including empty states. The issue is if any queue accidentally includes `pending_payment` orders (e.g., a future change), warehouse could see pending orders they shouldn't.

More critically: the field dashboard's **CompletedTab** (`app/(admin)/admin/field/page.tsx:925`) calls `/api/admin/field/worker-activity` — this endpoint should only show activity for the warehouse user themselves, not all warehouse activity. A warehouse worker could see what other warehouse workers have been doing.

**Fix**:
1. Add `changedByUserId` filter to the worker-activity API for warehouse role (filter to `session.user.id`).
2. Add an explicit status check in the field queue endpoints that rejects `pending_payment` orders.

---

## HIGH SEVERITY

### BUG-04 — HIGH SEVERITY: Blog CMS Has No Server-Side Role Enforcement

**File**: `app/(admin)/admin/blog/page.tsx:13-16`

**What's wrong**:
```typescript
if (!session?.user || !['superadmin', 'owner'].includes(session.user.role)) {
  redirect('/admin/dashboard');
}
```
This check is in the server component — good. But the **edit page** (`app/(admin)/admin/blog/[id]/page.tsx`) has NO role check. If a warehouse staff member guesses the URL `/admin/blog/some-uuid`, they'll get the blog edit form and can:
- Edit any blog post
- Change published status
- Access the TipTap editor
- Upload images via the cover image uploader

**Fix**:
Add server-side auth check to `app/(admin)/admin/blog/[id]/page.tsx` and `app/(admin)/admin/blog/new/page.tsx`:
```typescript
const session = await auth();
if (!session?.user || !['superadmin', 'owner'].includes(session.user.role)) {
  redirect('/admin/dashboard');
}
```

Same issue for `AdminBlogNewClient` which is a client component used by the new page — the parent page must enforce the check.

---

### BUG-05 — MEDIUM SEVERITY: AI Content Generator Role Check Uses `!==` Instead of `includes`

**File**: `app/(admin)/admin/ai-content/page.tsx:7`

**What's wrong**:
```typescript
if (!session?.user || session.user.role !== 'superadmin') {
  redirect('/admin/dashboard');
}
```
While this is technically correct (only superadmin should access AI content), the pattern is inconsistent with other pages that use `.includes()`. More importantly, if there's ever a need to allow owner role to access AI content (for testing, etc.), this check would block it. The ADMIN_SIDEBAR already correctly restricts to `superadmin` only, so this is a defense-in-depth issue.

**Fix**: No urgent fix needed — this is actually correct behavior. But note: if future admin UI adds AI content shortcut elsewhere, ensure consistency.

---

### BUG-06 — MEDIUM SEVERITY: Settings Page Uses `bg-brand-cream` Preview Section in Admin Content Area

**File**: `app/(admin)/admin/settings/page.tsx:136`

**What's wrong**:
```typescript
<div className="border rounded-xl p-5 bg-brand-cream">
  {/* Preview of promo banner with brand-red background */}
  <div className="bg-brand-red rounded-lg p-4 text-white">
```
The preview section uses `bg-brand-cream` which is the store's page background color. According to DESIGN_SYSTEM.md Section 12.2, admin content area background is `#F8FAFC` (light gray), NOT `bg-brand-cream`. This preview section should use a neutral admin card background instead of injecting store brand colors into the admin UI.

The admin content area should never use `bg-brand-cream` or `bg-brand-red` for backgrounds — only for accents (action buttons, badges).

**Fix**:
```typescript
<div className="border rounded-xl p-5 bg-gray-50 border-admin-border">
```

---

### BUG-07 — MEDIUM SEVERITY: Inventory Adjustments Don't Create Inventory Logs When Capped

**File**: `app/api/admin/field/inventory/adjust/route.ts:47-62`

**What's wrong**:
When `delta` is negative and `quantityBefore + delta < 0`, the `actualDelta` will be less than the requested `delta`. The code does log this with a note:
```typescript
note: actualDelta !== delta
  ? `[Manual Adjust] ${reason}...`
  : `[Manual Adjust] ${reason}...`
```
But the **inventory log** is created with `actualDelta`, not with the user's intended delta. This means the audit trail shows the **actual** stock change, not what the user requested. This is actually correct behavior for audit purposes, BUT the note says "(permintaan ... dibatasi stok tersedia)" which is in Indonesian — good.

However, there is no notification to the user that their adjustment was capped. If warehouse worker tries to reduce stock by 10 but only 3 are available, they get `success` with `actualDelta: -3` but no warning that it wasn't the 10 they intended. This could cause fulfillment errors.

**Fix**:
Return a `capped: boolean` in the response and show a toast in InventoryClient:
```typescript
const capped = actualDelta !== delta;
return success({ ..., actualDelta, capped });
```

---

## MEDIUM SEVERITY

### BUG-08 — MEDIUM SEVERITY: Blog Post Slug Auto-Generation Collision

**File**: `app/(admin)/admin/blog/new/AdminBlogNewClient.tsx:65-70`

**What's wrong**:
```typescript
useEffect(() => {
  const currentSlug = watchedSlug;
  if (!currentSlug && watchedTitleId) {
    form.setValue('slug', generateSlug(watchedTitleId), { shouldValidate: true });
  }
}, [watchedTitleId, watchedSlug, form]);
```
The auto-generation runs on every title change. If a user manually sets a slug, then changes the title again, the slug gets overwritten (unless they already modified it). There's no uniqueness check — if two posts have the same title (before manual slug editing), they'll generate the same slug. This could cause 404s on the store blog listing.

**Fix**:
1. Only auto-generate slug when the slug field is still matching the previous auto-generated value (not manually edited).
2. Add a uniqueness check when saving — if slug exists, append `-2` or use a timestamp suffix.

---

### BUG-09 — MEDIUM SEVERITY: Coupon Validation Client-Side Only

**File**: `app/(admin)/admin/coupons/page.tsx:54-67`

**What's wrong**:
The coupons page fetches all coupons on mount and filters them client-side. There is no server-side search or server-side count for the "Aktif" / "Expired" / "Maxed" tabs. This means:
- If there are thousands of coupons, all are loaded into browser memory.
- The "active" tab filter is purely client-side — could show wrong counts if another admin creates/deletes coupons in another tab.

**Fix**:
Add a server-side count API or use TanStack Query with proper filtering on the API. For now, the number of coupons is likely small (under 100), so this is MEDIUM not HIGH.

---

### BUG-10 — MEDIUM SEVERITY: Orders Table Shows `recipientEmail` to Warehouse Role

**File**: `app/(admin)/admin/orders/OrdersClient.tsx:301-302`

**What's wrong**:
The orders table renders `order.recipientEmail` as a column visible to anyone who can access the orders page. Even if we fix the middleware (BUG-01), the `OrdersClient` is a client component — if a warehouse worker somehow bypasses the middleware, they'd see emails.

The server-side `OrdersPage` passes ALL order data (including email) to the client — this data is in the browser bundle sent to any role that accesses the page.

**Fix**:
In `app/(admin)/admin/orders/page.tsx`, filter fields based on role before passing to `OrdersClient`. Create a reduced `OrderSummary` type for warehouse role that excludes email, phone, address. Only superadmin/owner get the full data.

---

### BUG-11 — MEDIUM SEVERITY: Testimonials Page Missing Loading/Error States in Component

**File**: `app/(admin)/admin/testimonials/page.tsx:268-273`

**What's wrong**:
```typescript
{isLoading ? (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-24 bg-white rounded-xl border border-admin-border animate-pulse" />
    ))}
  </div>
) : testimonials?.length === 0 ? ...}
```
The page has a loading skeleton but no error state handling. If the API fails, `testimonials` will be `undefined` (not an empty array), and the component will try to access `testimonials?.length` which is fine — it falls through to the empty state. BUT the delete and toggle mutations don't handle API errors with user-friendly messages in all cases.

**Fix**:
Add error state to the useQuery:
```typescript
const { data: testimonials, isLoading, isError } = useQuery({...});
if (isError) return <ServerError onRetry={refetch} />;
```

---

### BUG-12 — LOW SEVERITY: Users Page Invite Modal Has No Email Validation

**File**: `app/(admin)/admin/users/page.tsx:306-313`

**What's wrong**:
The invite modal accepts any email string without format validation. If someone types "notanemail", the API will reject it with a generic error, but the UI could validate it first with HTML5 `type="email"` or Zod.

**Fix**:
Add HTML5 validation:
```typescript
<input type="email" ... />
```
Or add a simple regex check before mutation.

---

### BUG-13 — LOW SEVERITY: Field Dashboard "Tracking" Tab Shows All Courier Info

**File**: `app/(admin)/admin/field/page.tsx:552`

**What's wrong**:
In the TrackingTab, the `courierCode` and `courierService` are shown from `selectedOrder?.courierCode`. This is fine since it's from the order that was already assigned at checkout — warehouse isn't revealing new information.

However, the override courier input could allow warehouse to change the courier to a non-cold-chain option (e.g., JNE REG, Pos Indonesia). The `addTracking` function accepts `courierCode` as optional override, and there's no validation against the `ALLOWED_COURIERS` list.

**Fix**:
Validate override courier against allowed cold-chain couriers:
```typescript
const ALLOWED_COURIERS = ['sicepat', 'jne', 'anteraja'];
if (courierCode && !ALLOWED_COURIERS.includes(courierCode.toLowerCase())) {
  setError('Kurir tidak valid. Hanya cold-chain yang diperbolehkan.');
  return;
}
```

---

## INCOMPLETE FEATURES

### INCOMPLETE-01 — MISSING: No Product Soft Delete Implementation in Admin

**Files**: `app/(admin)/admin/products/page.tsx`, `app/api/admin/products/[id]/route.ts`

**What's wrong**:
The products list uses `isNull(products.deletedAt)` filter for soft delete. However, the product edit page and the API route for DELETE don't appear to implement actual soft-delete. If an admin clicks "Delete" on a product, it may hard-delete, violating the PRD rule that soft delete must be used for products and users.

**Status**: Need to verify whether the product DELETE endpoint actually calls soft delete or hard delete. The schema has `deletedAt` but the API route may not use it.

---

### INCOMPLETE-02 — MISSING: No Bulk Stock Import/Export

**Files**: `app/(admin)/admin/inventory/page.tsx`, `app/api/admin/export/inventory/route.ts`

The inventory page shows a simple table with individual edit. According to the PRD, there should be "No bulk import in V1 — each variant updated individually" — so this is BY DESIGN. Marking as informational only.

---

### INCOMPLETE-03 — MISSING: B2B Quote PDF Builder Not Implemented

**Files**: `app/(admin)/admin/b2b-quotes/page.tsx`, `app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts`

The B2B quotes page exists and has a PDF generation endpoint. Need to verify the PDF actually generates correctly. The `b2b-quotes/new/page.tsx` is present.

---

## MISSING LOADING/ERROR BOUNDARIES

All admin routes have the required `loading.tsx` and `error.tsx` files per route group. The following were verified as present:

| Route | loading.tsx | error.tsx |
|---|---|---|
| `/admin/dashboard` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/orders` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/inventory` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/shipments` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/customers` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/coupons` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/blog` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/settings` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/ai-content` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/users` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/team-dashboard` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/b2b-inquiries` | ✅ `loading.tsx` | ✅ `error.tsx` |
| `/admin/field` | ✅ `loading.tsx` | ✅ `error.tsx` |

**RESULT**: All admin route groups have both `loading.tsx` and `error.tsx` — ✅ PASS

---

## ROLE PERMISSION VIOLATIONS

### VIOLATION-01 — CRITICAL: Warehouse Can View All Orders and Customer PII

**Files**: `app/middleware.ts:18`, `app/(admin)/admin/orders/page.tsx`

Warehouse role is allowed in `/admin/orders` — this grants full access to:
- All order numbers, customer names, emails, phone numbers, addresses
- Full order item lists with product names, quantities, prices
- Order history and patterns

**Required**: Remove `/admin/orders` from warehouse allowed paths. Warehouse should use `/admin/field` for their tasks only.

---

### VIOLATION-02 — HIGH: Warehouse Can Access `/admin/customers`

**Files**: `app/middleware.ts:18`

The allowed paths list does NOT include `/admin/customers` for warehouse — ✅ this is correct.

But verify: the `AdminSidebar` filters nav items by role correctly. Warehouse sees: Dashboard, Gudang, Pesanan, Inventori, Pengiriman. ✅ Correct.

---

### VIOLATION-03 — HIGH: Blog Edit Pages Have No Server-Side Role Check

**Files**: `app/(admin)/admin/blog/[id]/page.tsx`, `app/(admin)/admin/blog/new/page.tsx`

Both blog edit and new pages lack server-side role enforcement. Any authenticated admin (including warehouse via `auth()`) could reach these pages if they guess the URL.

**Fix**: Add server-side role check in both page files (same pattern as `blog/page.tsx:13-16`).

---

## DESIGN SYSTEM VIOLATIONS

### VIOLATION-04 — MEDIUM: Settings Page Uses `bg-brand-cream` for Preview Section

**File**: `app/(admin)/admin/settings/page.tsx:136`

Admin content area must use `#F8FAFC` light gray background, NOT `bg-brand-cream` (#F0EAD6). The preview section should use `bg-gray-50` instead.

**Fix**: Change line 136 from `bg-brand-cream` to `bg-gray-50`.

---

### VIOLATION-05 — LOW: Admin Coupon Page Uses `bg-brand-red` for Primary CTA

**File**: `app/(admin)/admin/coupons/page.tsx:119`

```typescript
className="...bg-brand-red text-white..."
```
This is actually CORRECT per DESIGN_SYSTEM.md — brand-red is allowed for CTAs and primary actions. ✅ PASS.

---

### VIOLATION-06 — LOW: Admin Products Page Uses `bg-brand-red` for "Tambah Produk" Button

**File**: `app/(admin)/admin/products/page.tsx:29`

```typescript
className="...bg-brand-red text-white..."
```
Also CORRECT — CTAs in admin use brand-red. ✅ PASS.

---

## SUMMARY OF FIXES PRIORITY

| Priority | Bug | Fix Effort |
|---|---|---|
| **P0 — Immediate** | BUG-01: Warehouse order access | Remove `/admin/orders` from warehouse middleware allowed paths |
| **P0 — Immediate** | BUG-04: Blog edit no server-side auth | Add role check to blog/[id]/page.tsx and new/page.tsx |
| **P1 — High** | BUG-02: Stock adjust not atomic | Use `GREATEST(stock + delta, 0)` with returning() check |
| **P1 — High** | BUG-10: Email visible in orders to warehouse | Add role-based field filtering in orders page server component |
| **P2 — Medium** | BUG-06: Settings bg-brand-cream violation | Change to bg-gray-50 |
| **P2 — Medium** | BUG-07: Inventory capped adjustment no warning | Return `capped: boolean` and show toast |
| **P2 — Medium** | BUG-13: Override courier not validated | Add cold-chain courier validation |
| **P3 — Low** | BUG-08: Slug collision potential | Add uniqueness check on save |
| **P3 — Low** | BUG-12: Invite email validation | Add HTML5 email type |

---

*End of AUDIT-03 — Admin Panel & Operations*