# AUDIT 02 — ADMIN DASHBOARD
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** `app/(admin)/admin/`, `components/admin/`
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## 🔴 CRITICAL

### C-01: Client-Side Auth Check on Customers Pages — Page Content Exposed Before Redirect

**Files:**
- `app/(admin)/admin/customers/page.tsx` lines 22–26
- `app/(admin)/admin/customers/[id]/page.tsx` lines 77–82

```typescript
useEffect(() => {
 requireRole(['superadmin', 'owner']).catch(() => {
 window.location.href = '/'; // ← client-side redirect
 });
}, []);
```

**Issue:** Auth check runs after page renders. The HTML of the customers list/detail page is sent to the browser and briefly visible before the redirect fires. A warehouse role user could potentially see customer data during this flash. This is a data exposure vulnerability.

**CRITICAL ACTION:** Convert both pages to Server Components. Add `await requireRole(['superadmin', 'owner'])` at the top of the async server component function. Remove the `useEffect` client-side redirect entirely.

```typescript
// customers/page.tsx — convert to async server component
import { requireRole } from '@/lib/auth/require-admin';

export default async function CustomersPage() {
 await requireRole(['superadmin', 'owner']);
 // rest of server component
}
```

**Status:** Both pages currently `'use client'` — must be converted to Server Component wrappers with client sub-components.

---

### C-02: Client-Side Auth Check on Orders Detail Page — Order Data Exposed

**File:** `app/(admin)/admin/orders/[id]/page.tsx`

**Issue:** The page is `'use client'` with no server-side auth protection. Anyone who navigates to `/admin/orders/[id]` can see full order details including addresses, email, phone. The `canUpdateStatus` check at line 222 is client-side only and does not prevent the page from rendering.

**CRITICAL ACTION:** Add server-side `requireRole` check in a parent Server Component wrapper, or add middleware protection for `/admin/orders/[id]`.

---

### C-03: Missing `loading.tsx` and `error.tsx` for Products New Page

**File:** `app/(admin)/admin/products/new/`

**Issue:** Per CURSOR_RULES.md Section 8: every route group must have `loading.tsx` and `error.tsx`. The `products/new/` directory has neither.

**CRITICAL ACTION:** Create both files. The `loading.tsx` should show a skeleton matching the `ProductForm` layout. The `error.tsx` should use the admin error pattern.

---

### C-04: Products Page — No Role Check at All

**File:** `app/(admin)/admin/products/page.tsx`

**Issue:** `products/page.tsx` has no `requireRole` call. Any logged-in user (including customer role) can see the product list with all pricing data, stock levels, and product details.

**CRITICAL ACTION:** Add `await requireRole(['superadmin', 'owner'])` at the top of the server component.

---

### C-05: Products [id] Edit Page — No Role Check

**File:** `app/(admin)/admin/products/[id]/page.tsx`

**Issue:** The edit page has no auth guard. Any logged-in user can access `/admin/products/[uuid]` and view/edit product data.

**CRITICAL ACTION:** Add `await requireRole(['superadmin', 'owner'])` to a server component wrapper.

---

### C-06: Customers API Route — Verify Soft Delete Filter

**File:** `app/api/admin/customers/route.ts` (not directly audited, referenced by customers pages)

**Issue:** The customers page queries `/api/admin/customers` (no soft-delete filter visible in page code). The `users` table has `deletedAt` column per schema, but the page code shows no `isNull(users.deletedAt)` filter. Need to verify the API route applies soft-delete filtering.

**CRITICAL ACTION:** Audit `/api/admin/customers/route.ts` and ensure all customer queries filter `WHERE deleted_at IS NULL`.

---

## 🟠 HIGH

### H-01: Products Loading Skeleton Mismatch — Shows Cards, Renders Table

**File:** `app/(admin)/admin/products/loading.tsx`, lines 10–14

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {/* Skeleton renders 9 cards */}
</div>
```

**Issue:** The loading skeleton is a grid of 9 cards, but the actual `ProductsClient.tsx` renders a **table**. The visual feedback doesn't match the real UI.

**Expected:** Change skeleton to show table row placeholders (like `OrdersLoading.tsx` does).

**Action:** Rewrite `products/loading.tsx` to show table row skeletons.

---

### H-02: Orders List — Status Filter Accepts Any String

**File:** `app/(admin)/admin/orders/page.tsx` lines 24–30

```typescript
const whereClause = sql`
 ${statusFilter ? sql`${orders.status} = ${statusFilter}` : sql`true`}
`;
```

**Issue:** `statusFilter` is used as raw string in SQL. An invalid value like `status=foobar` runs `WHERE status = 'foobar'` and silently returns zero rows. No validation that the status is a known enum value.

**Expected:** Validate against `['pending_payment','paid','processing','packed','shipped','delivered','cancelled','refunded']` before building the query.

**Action:** Add status validation before the query construction.

---

### H-03: CouponEditClient Race Condition — `couponId` in Closure

**File:** `app/(admin)/admin/coupons/[id]/CouponEditClient.tsx`, lines 36–53, 55–85

**Issue:** `couponId` is stored in React state and captured in `handleSubmit` closure. If the component re-renders for any reason during submission, the closure could reference a stale value. More critically, `fetchCoupon` depends on `[couponId, router]` — if either changes, the effect re-runs, potentially re-triggering the fetch while a submit is in flight.

**Expected:** Pass `couponId` as a stable prop from the server component, or use `use(params)` from next/navigation to get the ID directly in the client component without state.

**Action:** Refactor to get `couponId` from `params` (Next.js 15 async params pattern) instead of state.

---

### H-04: All `alert()` Calls in Admin Client Components

**Files:**
- `app/(admin)/admin/coupons/[id]/CouponEditClient.tsx` lines 46, 81
- `app/(admin)/admin/coupons/new/CouponNew.tsx` lines 39, 41

**Issue:** Uses browser `alert()` for error feedback. The rest of the admin pages use `toast` from sonner. Inconsistent with project conventions.

**Action:** Replace all `alert()` calls with `toast.error()` from sonner.

---

### H-05: CouponEditClient — No Loading/Error Skeleton

**File:** `app/(admin)/admin/coupons/[id]/CouponEditClient.tsx` lines 87–92

**Issue:** When `loading` is true, returns plain `<div className="p-6">Loading...</div>`. No shimmer skeleton. Same for null data.

**Action:** Add proper skeleton components for loading and empty states.

---

### H-06: BlogEditClient — Unused `useSession` Import + `form` in useEffect deps

**File:** `app/(admin)/admin/blog/[id]/BlogEditClient.tsx` lines 15, 115

**Issue 1:** `import { useSession } from 'next-auth/react';` — imported but never used.
**Issue 2:** `form` (from `useForm`) is in the `useEffect` dependency array. `form` is stable — adding it to deps can cause infinite re-render loops if the form triggers the effect.

**Action:** Remove `useSession` import. Remove `form` from the dependency array on line 115.

---

### H-07: BlogNewClient — Unused `useSession` Import

**File:** `app/(admin)/admin/blog/new/BlogNewClient.tsx` line 15

**Action:** Remove `useSession` import.

---

### H-08: InquiryStatusUpdate — Silent Error Swallow

**File:** `components/admin/b2b/InquiryStatusUpdate.tsx` lines 33–39

**Issue:** Catch block is empty. If PATCH fails, user gets no feedback — the UI silently reverts to the previous state without explanation.

**Action:** Add `toast.error('Gagal mengupdate status. Silakan coba lagi.')` in the catch block.

---

### H-09: B2BInquiryStatusClient — `console.error` in Production

**File:** `app/(admin)/admin/b2b-inquiries/B2BInquiryStatusClient.tsx` lines 39, 43

**Action:** Remove `console.error` or replace with toast feedback.

---

### H-10: Settings Page — Client-Side Auth Check (Should Be Server Component)

**File:** `app/(admin)/admin/settings/page.tsx` lines 34–38

**Issue:** Settings page uses `'use client'` with `useEffect(() => { requireRole(...).catch(() => { window.location.href = '/' }) })`. This is the same fragile pattern as C-01. Settings page should be a Server Component.

**Action:** Convert to Server Component with `await requireRole(['superadmin'])`. Extract only the interactive inline-editing rows into a separate client component.

---

### H-11: Settings Page — Plain Text Loading Fallback

**File:** `app/(admin)/admin/settings/page.tsx` line 127

**Issue:** `return <div className="p-6 text-gray-500">Memuat...</div>;` — plain text, not a skeleton.

**Action:** Create `app/(admin)/admin/settings/loading.tsx` with proper skeleton.

---

### H-12: Users Page — Plain Text Loading Fallback

**File:** `app/(admin)/admin/users/page.tsx` line 158

**Action:** Create `app/(admin)/admin/users/loading.tsx` with proper skeleton.

---

### H-13: Users Page — Raw `<select>` Instead of shadcn/ui Select

**File:** `app/(admin)/admin/users/page.tsx` lines 202–212, 323–333

**Issue:** Uses native `<select>` for role editing and role selection in invite modal. Project rules mandate shadcn/ui components.

**Action:** Replace with shadcn/ui `Select` component.

---

### H-14: Testimonials — Raw `<textarea>` Instead of shadcn/ui Textarea

**File:** `app/(admin)/admin/testimonials/page.tsx` lines 213–226

**Action:** Replace all native `<textarea>` elements with shadcn/ui `Textarea` component.

---

### H-15: Blog Edit Pages — Raw `<textarea>` Instead of shadcn/ui Textarea

**Files:**
- `app/(admin)/admin/blog/[id]/BlogEditClient.tsx` lines 213–226
- `app/(admin)/admin/blog/new/BlogNewClient.tsx` lines 175–188

**Action:** Replace with shadcn/ui `Textarea` component in both files.

---

### H-16: Coupon Form — `isActive` Toggle Missing on Create

**File:** `app/(admin)/admin/coupons/new/CouponNew.tsx` line 55

**Issue:** `CouponForm` is called without an `isActive` prop, defaulting to `true`. There's no UI toggle to create a coupon as inactive. Admins must create active, then edit to deactivate.

**Action:** Add an `isActive` toggle/checkbox to the `CouponNewClient` form.

---

### H-17: Blog API — `categoryId` vs `blogCategoryId` Field Name Mismatch

**File:** `app/api/admin/blog/route.ts` line 21

**Issue:** CreatePostSchema uses `categoryId` but `BlogNewClient` sends `blogCategoryId` (BlogNewClient.tsx line 90). The API silently ignores `blogCategoryId` and sets `categoryId` to undefined/default.

**Action:** Align field names — change schema to use `blogCategoryId` to match client, or change client to send `categoryId`.

---

## 🟡 MEDIUM

### M-01: Duplicate Status Update on B2B Inquiry Detail

**File:** `app/(admin)/admin/b2b-inquiries/[id]/page.tsx` lines 93, 117

**Issue:** Two different components render and both PATCH to the same endpoint (`/api/admin/b2b-inquiries/${inquiryId}`). `B2BInquiryStatusClient` uses a `<select>` in the table row; `InquiryStatusUpdate` uses `<Button>` row below. Both modify `inquiry.status`. Concurrent updates from both could cause race conditions.

**Action:** Remove the inline `<select>` from the table row in the listing page. Keep only the sidebar `InquiryStatusUpdate` as the single source of truth for status updates.

---

### M-02: CouponForm — Native `<select>` for Type

**File:** `components/admin/coupons/CouponForm.tsx` lines 111–119

**Action:** Replace with shadcn/ui `Select` component.

---

### M-03: CarouselForm — Native `<select>` for Type

**File:** `components/admin/carousel/CarouselForm.tsx` lines 88–96

**Action:** Replace with shadcn/ui `Select` component.

---

### M-04: CouponForm — Missing `applicableProductIds` and `applicableCategoryIds` UI

**File:** `components/admin/coupons/CouponForm.tsx` lines 45–64

**Issue:** Coupon validation rules 8 and 9 support `applicableProductIds` and `applicableCategoryIds`, but the admin CRUD form has no UI to set these restrictions. Admins cannot create product-specific or category-specific coupons.

**Action:** Add product and category multi-select UI to `CouponForm`. This is a known gap — flag for future implementation or add immediately if critical.

---

### M-05: CouponForm — No Validation Cap on Percentage Discount

**File:** `components/admin/coupons/CouponForm.tsx` line 52

**Issue:** `discountValue: z.number().int().nonnegative().optional()` — no max cap. Values like `150` for percentage type would pass Zod validation.

**Action:** Add a `superRefine` or separate `percentageDiscountSchema` to enforce max 100 for `type: 'percentage'`.

---

### M-06: B2B Inquiry Detail — No Loading Skeleton

**File:** `app/(admin)/admin/b2b-inquiries/[id]/page.tsx` lines 27–34

**Issue:** `getInquiry(id)` is called directly without a Suspense boundary or loading indicator.

**Action:** Create `app/(admin)/admin/b2b-inquiries/[id]/loading.tsx`.

---

### M-07: Testimonials — No Route-Level Loading.tsx

**File:** `app/(admin)/admin/testimonials/page.tsx` (no sibling loading.tsx)

**Action:** Create `app/(admin)/admin/testimonials/loading.tsx`.

---

### M-08: Shipments Page — `colSpan` Mismatch on Empty State

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx` line 170

**Issue:** `<td colSpan={6}>` but the table has 7 `<th>` elements in thead. Should be `colSpan={7}`.

**Action:** Fix to `colSpan={7}`.

---

### M-09: OrdersClient — TRANSITIONS Map Incomplete

**File:** `app/(admin)/admin/orders/OrdersClient.tsx` lines 53–57

**Issue:** `TRANSITIONS` map only includes `paid`, `processing`, `shipped`. Missing `packed → shipped` transition.

**Action:** Add `packed: [{ status: 'shipped', label: 'Kirim' }]` to the TRANSITIONS map.

---

### M-10: Customers Detail — Order Status Shows Raw String, Not Label

**File:** `app/(admin)/admin/customers/[id]/page.tsx` lines 286–288

```tsx
<span className={`... ${STATUS_COLORS[order.status] || '...'}`}>
 {order.status} {/* ← raw string */}
</span>
```

**Issue:** Shows `pending_payment` instead of `Menunggu Pembayaran`. `STATUS_LABELS` map exists but is not used.

**Action:** Use `{STATUS_LABELS[order.status] ?? order.status}`.

---

### M-11: Coupon List — `formatIDR(minOrderAmount)` Handles Null

**File:** `app/(admin)/admin/coupons/page.tsx` line 76

**Issue:** `formatIDR(coupon.minOrderAmount)` — if `minOrderAmount` is null, would produce "Rp NaN".

**Action:** Guard with `?? 0`: `formatIDR(coupon.minOrderAmount ?? 0)`.

---

### M-12: Inline `style` Override on B2B Status Select

**File:** `app/(admin)/admin/b2b-inquiries/page.tsx` lines 56–57

```tsx
style={{ backgroundColor: 'inherit' }}
```

**Action:** Move to a CSS class instead of inline style.

---

### M-13: Users Page — Hardcoded `#0F172A` Instead of Design Token

**File:** `app/(admin)/admin/users/page.tsx` lines 169, 351

**Issue:** Uses hardcoded `bg-[#0F172A]` and similar — not using design system tokens. Project rules say never use arbitrary Tailwind values.

**Action:** Use CSS variable or class for admin sidebar color.

---

### M-14: Blog Category Selector Missing from Forms

**Files:**
- `app/(admin)/admin/blog/[id]/BlogEditClient.tsx`
- `app/(admin)/admin/blog/new/BlogNewClient.tsx`

**Issue:** `blogCategoryId` is in the form schema and submitted on form submit, but the UI has no category selector. Admins can't set the category when creating/editing blog posts.

**Action:** Add a category selector (dropdown or searchable select) to both blog forms.

---

### M-15: Inventory Client — `estimatedDays` is Freeform Text

**File:** `app/(admin)/admin/inventory/InventoryClient.tsx` line 482

**Issue:** `placeholder="2-3 hari"` — no validation, can be any string. Field is semantically a number estimate.

**Action:** Consider `type="text"` or add format validation.

---

### M-16: OrdersClient — ILIKE Search Without Index Consideration

**File:** `app/(admin)/admin/orders/page.tsx` lines 26–30

**Issue:** `ILIKE` on `recipientName`, `recipientEmail`, `orderNumber` without knowing if indexes exist. Could be slow on large order tables.

**Action:** Ensure composite index exists on `(status, recipientName)` or use a full-text search approach.

---

### M-17: Products Client — Bulk Delete Uses Native `confirm()`

**File:** `app/(admin)/admin/products/ProductsClient.tsx` line 71

**Issue:** `confirm()` is browser native dialog, not styled modal. Inconsistent with the styled dialog used elsewhere (e.g., Points Adjust modal).

**Action:** Replace with a styled confirmation modal component.

---

### M-18: Order Detail — Plain Text `←` for Back Button

**File:** `app/(admin)/admin/orders/[id]/page.tsx` line 234

**Issue:** Uses `←` plain text instead of `ChevronLeft` from lucide-react like other admin pages.

**Action:** Replace with `ChevronLeft` icon component.

---

## 🟢 LOW

### L-01: InquiryStatusUpdate — Button Variant + ClassName Mix

**File:** `components/admin/b2b/InquiryStatusUpdate.tsx` line 51

**Action:** Consider using conditional className only without mixing variant states.

### L-02: Shipping Cost Weight Unit Naming Confusion

**File:** `app/api/shipping/cost/route.ts` line 61

**Note:** `weightInKg` is actually in grams (already divided by 100), but the name implies kilograms. Clearer naming would prevent future bugs.

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | `customers/page.tsx`, `customers/[id]/page.tsx` | Client-side auth — page HTML exposed before redirect | Convert to Server Component + await requireRole |
| C-02 | 🔴 CRITICAL | `orders/[id]/page.tsx` | Client-side auth — order data exposed | Add server-side requireRole or middleware |
| C-03 | 🔴 CRITICAL | `products/new/` | Missing loading.tsx + error.tsx | Create both files |
| C-04 | 🔴 CRITICAL | `products/page.tsx` | No role check — any logged-in user can see products | Add requireRole(['superadmin', 'owner']) |
| C-05 | 🔴 CRITICAL | `products/[id]/page.tsx` | No auth guard on edit page | Add server-side requireRole |
| C-06 | 🔴 CRITICAL | `api/admin/customers/route.ts` | Verify soft delete filter on customers | Audit and fix query |
| H-01 | 🟠 HIGH | `products/loading.tsx` | Skeleton shows cards, UI renders table | Rewrite to table row skeletons |
| H-02 | 🟠 HIGH | `orders/page.tsx:24` | Status filter accepts any string — silent failure | Add status enum validation |
| H-03 | 🟠 HIGH | `CouponEditClient.tsx:36` | `couponId` in state — race condition on submit | Get from params directly, not state |
| H-04 | 🟠 HIGH | `CouponEditClient.tsx:46,81`, `CouponNew.tsx:39,41` | `alert()` instead of `toast` | Replace with toast.error() |
| H-05 | 🟠 HIGH | `CouponEditClient.tsx:87` | No loading/error skeleton | Add skeleton components |
| H-06 | 🟠 HIGH | `BlogEditClient.tsx:15,115` | Unused useSession import + form in useEffect deps | Remove import, remove form from deps |
| H-07 | 🟠 HIGH | `BlogNewClient.tsx:15` | Unused useSession import | Remove import |
| H-08 | 🟠 HIGH | `InquiryStatusUpdate.tsx:33` | Silent error swallow — no toast on failure | Add toast.error() in catch |
| H-09 | 🟠 HIGH | `B2BInquiryStatusClient.tsx:39,43` | console.error in production | Remove or use toast |
| H-10 | 🟠 HIGH | `settings/page.tsx:34` | Client-side auth — should be Server Component | Convert to server component |
| H-11 | 🟠 HIGH | `settings/page.tsx:127` | Plain text loading fallback | Create loading.tsx with skeleton |
| H-12 | 🟠 HIGH | `users/page.tsx:158` | Plain text loading fallback | Create loading.tsx with skeleton |
| H-13 | 🟠 HIGH | `users/page.tsx:202` | Raw `<select>` instead of shadcn/ui Select | Replace with Select component |
| H-14 | 🟠 HIGH | `testimonials/page.tsx:213` | Raw `<textarea>` instead of shadcn/ui Textarea | Replace with Textarea |
| H-15 | 🟠 HIGH | `BlogEditClient.tsx:213`, `BlogNewClient.tsx:175` | Raw `<textarea>` instead of shadcn/ui Textarea | Replace with Textarea |
| H-16 | 🟠 HIGH | `CouponNew.tsx:55` | No isActive toggle on create form | Add isActive checkbox |
| H-17 | 🟠 HIGH | `api/admin/blog/route.ts:21` | categoryId vs blogCategoryId mismatch | Align field names |
| M-01 | 🟡 MEDIUM | `b2b-inquiries/[id]/page.tsx:93,117` | Duplicate status update components | Remove inline select, keep sidebar |
| M-02 | 🟡 MEDIUM | `CouponForm.tsx:111` | Native `<select>` | Replace with shadcn/ui Select |
| M-03 | 🟡 MEDIUM | `CarouselForm.tsx:88` | Native `<select>` | Replace with shadcn/ui Select |
| M-04 | 🟡 MEDIUM | `CouponForm.tsx:45` | Missing applicableProductIds/categoryIds UI | Add product/category selector |
| M-05 | 🟡 MEDIUM | `CouponForm.tsx:52` | No max cap on percentage discount | Add superRefine for 1-100 |
| M-06 | 🟡 MEDIUM | `b2b-inquiries/[id]/page.tsx` | No loading skeleton | Create loading.tsx |
| M-07 | 🟡 MEDIUM | `testimonials/page.tsx` | No route-level loading.tsx | Create loading.tsx |
| M-08 | 🟡 MEDIUM | `ShipmentsClient.tsx:170` | colSpan 6 but 7 columns | Fix to colSpan={7} |
| M-09 | 🟡 MEDIUM | `OrdersClient.tsx:53` | Missing packed→shipped transition | Add to TRANSITIONS map |
| M-10 | 🟡 MEDIUM | `customers/[id]/page.tsx:286` | Raw status string shown, not label | Use STATUS_LABELS |
| M-11 | 🟡 MEDIUM | `coupons/page.tsx:76` | formatIDR with possible undefined minOrderAmount | Add ?? 0 guard |
| M-12 | 🟡 MEDIUM | `b2b-inquiries/page.tsx:56` | Inline style override | Move to CSS class |
| M-13 | 🟡 MEDIUM | `users/page.tsx:169,351` | Hardcoded #0F172A | Use design token |
| M-14 | 🟡 MEDIUM | `BlogEditClient.tsx`, `BlogNewClient.tsx` | blogCategoryId in schema but no UI | Add category selector |
| M-15 | 🟡 MEDIUM | `InventoryClient.tsx:482` | Freeform estimatedDays text | Add validation |
| M-16 | 🟡 MEDIUM | `orders/page.tsx:26` | ILIKE search performance on large tables | Add index or full-text search |
| M-17 | 🟡 MEDIUM | `ProductsClient.tsx:71` | Native confirm() for bulk delete | Replace with styled modal |
| M-18 | 🟡 MEDIUM | `orders/[id]/page.tsx:234` | Plain text `←` for back button | Use ChevronLeft icon |
| L-01 | 🟢 LOW | `InquiryStatusUpdate.tsx:51` | Variant + className mix | Use className only |
| L-02 | 🟢 LOW | `shipping/cost/route.ts:61` | Confusing weight unit naming | Rename to weightInGrams |

**Total: 6 CRITICAL · 17 HIGH · 18 MEDIUM · 2 LOW**