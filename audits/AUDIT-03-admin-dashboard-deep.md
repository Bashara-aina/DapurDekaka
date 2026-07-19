# AUDIT 03 — Admin Dashboard & CRUD Deep Audit

**Date:** Monday May 25, 2026  
**Auditor:** QA Audit Agent  
**Scope:** Admin layout, all admin pages, all admin API routes, role guards, validation, transactions, soft delete

---

## 🔴 CRITICAL (blocks launch)

### C-01: `courierCode` accepted in shipped status PATCH but NOT in Zod schema
**File:** `app/(admin)/admin/orders/[id]/OrderDetailClient.tsx` line 519
**File:** `app/api/admin/orders/[id]/status/route.ts` lines 21-30

The client sends `courierCode` in the status update body:
```typescript
body: JSON.stringify({
  status: 'shipped',
  trackingNumber,
  courierCode: order?.courierCode, // ← client sends it
```

But the server-side Zod schema does NOT include `courierCode`:
```typescript
const statusUpdateSchema = z.object({
  status: z.enum([...]),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
  cancellationReason: z.string().optional(),
  // courierCode is MISSING
});
```

**Impact:** Warehouse user can send arbitrary `courierCode` values to override what was selected at checkout. This bypasses the cold-chain courier restriction.
**Fix:** Add `courierCode: z.string().optional()` to `statusUpdateSchema`.

---

### C-02: `tracking-queue/route.ts` PATCH — warehouse can set arbitrary courier codes
**File:** `app/api/admin/field/tracking-queue/route.ts` lines 45-95

The `shipSchema` accepts `courierCode` as optional input:
```typescript
const shipSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().min(1, 'Nomor resi harus diisi'),
  trackingUrl: z.string().optional(),
  courierCode: z.string().optional(), // ← anyone can override courier
  courierName: z.string().optional(),
  estimatedDays: z.string().optional(),
});
```

And then applies it directly:
```typescript
if (courierCode) updateData.courierCode = courierCode;
```

**Impact:** Warehouse user can change `courierCode` to a non-cold-chain courier (JNE REG, Pos Indonesia) which violates the business rule.
**Fix:** Remove `courierCode` and `courierName` from `shipSchema` entirely — the courier was already set at checkout and must not be changeable here.

---

### C-03: Warehouse can view ALL orders via direct URL (no server-side ownership check)
**File:** `app/(admin)/admin/orders/[id]/OrderDetailClient.tsx` line 229
**File:** `app/api/admin/orders/[id]/route.ts` (order detail GET)

The `userRole` prop is passed client-side and used to gate UI controls:
```typescript
const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(userRole);
```

But a warehouse user can navigate directly to `/admin/orders/[any-order-id]` and view order details including recipient name, phone, email, and address. The server route `GET /api/admin/orders/[id]` only checks for login + warehouse role — it does NOT verify the order belongs to a warehouse-relevant context.

**Impact:** Warehouse staff can see ALL customer PII (phone, address, email) across all orders, not just their own warehouse queue. Violates least-privilege.
**Fix:** The order detail page should either (a) restrict warehouse to only orders in `packed`/`shipped` status, or (b) return only limited fields for warehouse role (hide recipient contact info).

---

### C-04: Coupon `buy_x_get_y` — no product/variant association enforced
**File:** `app/api/checkout/validate-coupon/route.ts`
**File:** `app/api/admin/coupons/route.ts` lines 85-103

The coupon system supports `buy_x_get_y` type but neither the coupon creation API nor the validation API enforces WHICH products the buy/get applies to. The `applicableProductIds` and `applicableCategoryIds` fields exist in the schema but are never set or validated.

**Impact:** A superadmin could create a "buy 2 get 1 free" coupon thinking it applies to Dimsum Crabstick, but it would incorrectly apply to ALL products in cart.
**Fix:** Add `applicableProductIds` and `applicableCategoryIds` to the coupon schema + UI, then validate at checkout that cart items match these constraints.

---

### C-05: Admin coupon creation uses `serverError()` from wrong helper on validation failure
**File:** `app/api/admin/coupons/route.ts` lines 118-122

```typescript
if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
    { status: 422 }
  );
}
```

Should use the project's `validationError()` helper from `@/lib/utils/api-response` for consistency. Other routes use it; this one doesn't. This is inconsistent error handling.
**Fix:** Import `validationError` and use it here.

---

## 🟡 HIGH (should fix before launch)

### H-01: Per-user coupon usage tracking NOT enforced at API level
**File:** `app/api/checkout/validate-coupon/route.ts`
**File:** `lib/db/schema.ts` (coupons table has `maxUsesPerUser`)

The `CouponForm.tsx` has `maxUsesPerUser` input and the DB schema has the column, but the checkout validation route does NOT check how many times the current user has already used this coupon. The `couponUsageLogs` table may not even exist.

**Impact:** A customer can reuse a single-use coupon unlimited times until the admin notices `usedCount` climbing.
**Fix:** Check `couponUsageLogs` or a `usedCountPerUser` join at validate-coupon time. Create `couponUsageLogs` table if it doesn't exist.

---

### H-02: Bulk delete product — no check for items in active orders
**File:** `app/api/admin/products/bulk/route.ts` lines 50-68

Soft-deleting (archive) a product that has `pending` or `paid` orders will cause those order items to reference a product that effectively no longer exists in the catalog.

**Impact:** Admin archives "Dimsum Crabstick" while 5 orders are pending. Those order detail pages show the product name snapshot but the linked product is gone.
**Fix:** Before soft-delete, check for order_items referencing these product IDs with order status in `['pending_payment', 'paid', 'processing', 'packed', 'shipped']` and warn/block the delete.

---

### H-03: `OrdersClient.tsx` — NEXT_STATUS shortcut bypasses warehouse role intent
**File:** `app/(admin)/admin/orders/OrdersClient.tsx` lines 53-58, 562-569

```typescript
const NEXT_STATUS: Record<string, string> = {
  paid: 'processing',
  processing: 'packed',
  packed: 'shipped',
  shipped: 'delivered',
};
// ...
{NEXT_STATUS[order.status] && (
  <button onClick={() => handleStatusUpdate(NEXT_STATUS[order.status]!)} ...>
```

The list-view quick button always shows the NEXT step for all roles. A warehouse user seeing the list will have a button to "process" (change `paid → processing`) which they shouldn't be able to do. The role guard exists on detail page but NOT in this list quick-action.

**Impact:** Warehouse staff can accidentally or intentionally click "Proses" on paid orders from the list view (though the server does block it).
**Fix:** Filter `NEXT_STATUS` based on `userRole === 'warehouse'` → only show `packed→shipped` in the list view for warehouse role.

---

### H-04: Inventory stock adjust — no validation `delta` sign or bounds
**File:** `app/api/admin/field/inventory/adjust/route.ts` lines 12-19

```typescript
const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int().refine((val) => val !== 0, {
    message: 'Delta tidak boleh nol',
  }),
  reason: z.string().min(1, 'Alasan penyesuaian harus diisi'),
  note: z.string().optional(),
});
```

Only checks `delta !== 0`. A malicious/accidental large positive or negative delta is accepted. The `GREATEST(stock + delta, 0)` guards against negative stock but not against absurd stock values (e.g., adding +999999 to mask a real deficit).

**Impact:** Warehouse staff could set stock to 999999 for all variants, masking real inventory counts.
**Fix:** Add `delta: z.number().int().min(-10000).max(10000)` to cap single adjustment magnitude.

---

### H-05: `admin/orders/[id]/status` — cancellation does NOT use atomic optimistic lock
**File:** `app/api/admin/orders/[id]/status/route.ts` lines 124-137

The `packed→shipped` transition correctly uses optimistic locking:
```typescript
.where(and(
  eq(orders.id, orderId),
  eq(orders.status, currentStatus as OrderStatus),
))
```

But cancellation at lines 151-275 does NOT use the same optimistic lock pattern. It just does a plain `UPDATE`:
```typescript
await tx.update(orders).set(updateData).where(...) // no status check
```

**Impact:** Race condition: two admins click cancel simultaneously on the same order → both succeed, stock restored twice, points restored twice, etc.
**Fix:** Apply the same `and(eq(orders.id, orderId), eq(orders.status, currentStatus))` where clause to the cancellation UPDATE inside the transaction.

---

### H-06: Orders GET — inconsistent response format across routes
**File:** `app/api/admin/orders/route.ts` line 101
**File:** `app/api/admin/products/route.ts` line 74

Orders GET returns:
```typescript
return success({ orders: orderList, pagination: {...} });
```

Products GET returns:
```typescript
return NextResponse.json({ success: true, data: { products: productList, pagination: {...} } });
```

And Coupon GET returns:
```typescript
return success(coupon);
```

**Impact:** Frontend needs different parsers per resource. Inconsistent.
**Fix:** Standardize all to `return success({ data: ..., pagination: {...} })` format.

---

### H-07: `admin/customers/route.ts` — search + role filter mutually exclusive
**File:** `app/api/admin/customers/route.ts` lines 26-36

```typescript
if (search) {
  whereClause = or(like(users.name...), like(users.email...));
} else if (roleFilter) {
  whereClause = eq(users.role, roleFilter...);
} else if (isActiveFilter !== null...) {
  whereClause = eq(users.isActive, isActiveFilter...);
}
```

When searching by name, the role filter is IGNORED. Admin can't find "John in Bandung who is B2B".
**Impact:** Limited search functionality when managing many customers.
**Fix:** Use `and()` to combine conditions when multiple filters are active.

---

### H-08: `admin/products/route.ts` GET — isActive filter combined with AND logic bug
**File:** `app/api/admin/products/route.ts` lines 48-50

```typescript
if (isActive !== null && isActive !== '') {
  conditions.push(eq(products.isActive, isActive === 'true'));
}
```

When `categoryId` AND `isActive` are both set, they correctly get AND'd. But the pattern is fine. Actually — when `search` is set along with `categoryId` AND `isActive`, all three get AND'd. This is correct. **No bug here.** Misread earlier. Skipping.

---

### H-09: OrdersClient — pagination uses URL params but re-renders don't sync state
**File:** `app/(admin)/admin/orders/OrdersClient.tsx` lines 107-123

The component uses `useSearchParams()` for pagination and `useState` for `orders` array. When page changes, `router.push()` updates URL, server re-renders with new data, but `orders` state and `initialOrders` can get out of sync on rapid clicking.
**Impact:** Minor — occasional stale order list on fast pagination.
**Fix:** Use `router.refresh()` after page change OR derive orders entirely from `initialOrders` without local state.

---

### H-10: `ProductForm.tsx` — no server-side revalidation after submit
**File:** `components/admin/products/ProductForm.tsx` lines 206-214

```typescript
async function handleSubmit(data: ProductFormData) {
  const payload = { ...data, descriptionId, descriptionEn, images };
  await onSubmit(payload as ProductFormData);
  // No revalidatePath or router.refresh() call
}
```

After product create/edit, the admin product list page may show stale data until manual refresh.
**Fix:** Call `import { revalidatePath } from 'next/cache'` and `revalidatePath('/admin/products')` after successful submit.

---

## 🟢 MEDIUM (improve when possible)

### M-01: Admin has no skeleton loading for product list
**File:** `app/(admin)/admin/products/page.tsx`

Products list page (server component with `db.query.products.findMany`) has no loading.tsx or streaming skeleton. With 50 products and slow DB query, the page will hang blank.
**Fix:** Add `loading.tsx` at `app/(admin)/admin/products/loading.tsx` with skeleton rows.

---

### M-02: Admin testimonials — no bulk delete or status toggle
**File:** `app/(admin)/admin/testimonials/TestimonialsClient.tsx`

Testimonials can only be added and deleted one-by-one. No bulk disable. For managing 50+ testimonials this is tedious.
**Fix:** Add bulk toggle active/inactive to testimonials.

---

### M-03: `admin/customers/route.ts` — pagination missing explicit column select
**File:** `app/api/admin/customers/route.ts` lines 41-54

```typescript
columns: {
  id: true, name: true, email: true, phone: true, role: true,
  isActive: true, pointsBalance: true, createdAt: true,
},
```

Good — explicit columns. But `updatedAt` is missing from select even though it's likely needed. And the role filter `eq(users.role, roleFilter as 'customer' | 'b2b')` hardcodes customer/b2b — warehouse/owner/superadmin can't be filtered.
**Fix:** Make role filter work for all roles, not just customer/b2b.

---

### M-04: `ProductForm.tsx` — slug auto-generation on name change ignores duplicates
**File:** `components/admin/products/ProductForm.tsx` lines 170-175

```typescript
const handleNameIdChange = (value: string) => {
  form.setValue('nameId', value);
  if (!initialData?.slug) {
    form.setValue('slug', generateSlug(value));
  }
};
```

If the generated slug already exists (another product has it), there's no deduplication check until form submit.
**Fix:** Add async slug uniqueness check on blur or add `-1`, `-2` suffix automatically.

---

### M-05: `FieldDashboardClient.tsx` — uses emoji in UI (☕, 📦, 🚚, 🏠)
**File:** `app/(admin)/admin/field/FieldDashboardClient.tsx`

Lines 256, 271, 276, 278, 395, 982, 1071, 1085, 1092, 1099, 1104 — emojis used throughout.
**Impact:** Works but inconsistent with the shadcn/ui + Lucide icon pattern used everywhere else.
**Fix:** Replace emojis with Lucide icons (Package, Truck, Home, Coffee, etc.).

---

### M-06: `CouponForm.tsx` — no server-side creation audit trail
**File:** `app/api/admin/coupons/route.ts` lines 106-161

Creating a coupon has no `logAdminActivity()` call. When a superadmin creates a coupon, there's no record of WHO created it and WHEN in the admin activity log.
**Fix:** Add `logAdminActivity({ userId: session.user.id, action: 'coupon_create', targetType: 'coupon', targetId: created.id })` after coupon creation.

---

### M-07: Admin B2B quotes — new customer user gets empty `passwordHash`
**File:** `app/api/admin/b2b-quotes/route.ts` line 125

```typescript
const [newUser] = await db.insert(users).values({
  email: body.newCustomer.picEmail,
  name: body.newCustomer.picName,
  passwordHash: '', // no password — they reset via email
  ...
});
```

A user with empty `passwordHash` can still log in if their session is active? This seems intentional (B2B users get invite flow) but the comment "no password — they reset via email" is not implemented — no password reset email is sent to the B2B PIC.
**Fix:** Either (a) send password reset email to new B2B user immediately, or (b) use the same invite flow as `users/invite/route.ts` which creates a password reset token.

---

### M-08: `OrderDetailClient.tsx` — refetches full order after status update (lines 200, 526)
**File:** `app/(admin)/admin/orders/[id]/OrderDetailClient.tsx`

```typescript
const updated = await fetch(`/api/admin/orders/${orderId}`).then(r => r.json());
setOrder(updated.data);
```

Makes a second fetch after every status update. Could use the returned data from the PATCH response directly instead of re-fetching.
**Fix:** Use the PATCH response data directly to update `order` state instead of re-fetching.

---

### M-09: `admin/products/route.ts` POST — no variant creation in same request
**File:** `app/api/admin/products/route.ts` lines 119-203

The `POST /api/admin/products` creates the product record but does NOT create variants. Variants must be created via a separate `PUT /api/admin/products/[id]` or a separate variants endpoint. This means creating a product with variants requires two API calls and creates a race condition (product exists without variants between calls).
**Fix:** Accept `variants` array in the same POST payload and create product+variants in a single transaction.

---

### M-10: `ShipmentsClient.tsx` — no pagination, assumes all packed orders fit in memory
**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx`

With 100 pending shipments, this client renders all at once with no virtual scroll or pagination. On low-end devices this will lag.
**Fix:** Add pagination or virtual scrolling, or add status filter (e.g., show only today's packed orders).

---

## ✅ AUDIT SUMMARY BY AREA

| Area | Status | Critical Issues |
|---|---|---|
| Admin layout + sidebar | ✅ Good | None |
| Orders (list view) | ⚠️ Medium | H-03 (warehouse bypass), M-08 |
| Orders (detail) | 🔴 Critical | C-01 (courierCode), C-03 (PII exposure) |
| Order status update API | 🔴 Critical | C-02 (arbitrary courier), H-05 (race on cancel) |
| Products CRUD | ⚠️ Medium | H-02 (no order check), H-10 (no revalidate), M-09 |
| ProductForm + CouponForm | ✅ Good | C-04 (buy_x_get_y), H-01 (per-user limit), M-04, M-06 |
| Inventory/stock adjust | ⚠️ Medium | H-04 (no delta cap) |
| Customers/Users | ⚠️ Medium | H-07 (filter bug), M-03 |
| Coupons | 🔴 Critical | H-01 (per-user not tracked), C-05 (inconsistent error) |
| Warehouse dashboard | ✅ Good | C-03 partially applies, M-02, M-05, M-10 |
| B2B quotes | ⚠️ Medium | M-07 (empty passwordHash) |
| Blog/Carousel/Testimonials | ✅ Fine | M-01, M-02 |
| Role guards (API level) | ⚠️ Medium | Warehouse can view all order details |
| Transaction usage | ✅ Good | H-05 is the only gap |
| Zod validation coverage | ⚠️ Medium | C-01, C-02 are critical gaps |
| API response consistency | ⚠️ Medium | H-06 — orders and products differ |
| Soft delete | ✅ Good | Properly implemented |
| Loading/error pages | ⚠️ Medium | Most pages have them, products listing doesn't |

---

## 🔒 SECURITY CHECKLIST

| Check | Status |
|---|---|
| All admin routes check auth session | ✅ |
| Role guard on every API route | ⚠️ Partial — warehouse can access more than intended |
| Zod validation on all mutations | ⚠️ Missing courierCode in status update |
| No raw SQL | ✅ |
| No exposed server keys | ✅ |
| Soft delete for products/users | ✅ |
| Stock deduction uses GREATEST + affected rows check | ✅ |
| Order status uses optimistic lock | ⚠️ Cancel path missing it |
| Coupon per-user limit enforced | ❌ Not implemented |
| Courier code changeable by warehouse | ❌ C-02 — critical |

---

## RECOMMENDED FIX ORDER (launch blocking)

1. **C-02** — Remove `courierCode` from tracking-queue PATCH schema + stop accepting it in orders status update
2. **C-01** — Add `courierCode` to `statusUpdateSchema` as optional but validate against ALLOWED_COURIERS
3. **C-03** — Restrict warehouse role to only orders in packed/shipped status in order detail GET
4. **C-04** — Add `applicableProductIds` + `applicableCategoryIds` to coupon + validate at checkout
5. **H-05** — Add optimistic lock to cancellation path in orders status update
6. **H-01** — Implement per-user coupon usage tracking
7. **H-04** — Add delta magnitude cap to inventory adjust
