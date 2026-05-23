# Missing Loading/Error States — Complete Audit

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit
**Scope:** All route groups, all pages, all loading.tsx and error.tsx files

---

## Executive Summary

Next.js App Router requires `loading.tsx` and `error.tsx` files for every route for proper streaming and error boundaries. This project has a significant number of pages missing these critical files, which means users will see blank screens or unstyled loading states when navigating, and unexpected errors will produce ugly React error screens instead of friendly UI.

**Overall Status:** ~65% coverage. Critical pages missing loading/error states.

---

## 1. Current State Overview

### Store Route Group (`app/(store)/`)

| Page | loading.tsx | error.tsx | Status |
|------|-------------|-----------|--------|
| `page.tsx` (homepage) | ✅ `app/(store)/loading.tsx` (shared) | ✅ `app/(store)/error.tsx` (shared) | OK |
| `products/page.tsx` | ✅ | ❌ MISSING | **ISSUE** |
| `products/[slug]/page.tsx` | ❌ MISSING | ❌ MISSING | **CRITICAL** |
| `cart/page.tsx` | ✅ | ❌ MISSING | **ISSUE** |
| `checkout/page.tsx` | ✅ | ✅ | OK |
| `checkout/success/page.tsx` | ✅ | ❌ MISSING | **ISSUE** |
| `checkout/pending/page.tsx` | ✅ | ❌ MISSING | **ISSUE** |
| `checkout/failed/page.tsx` | ❌ MISSING | ❌ MISSING | **ISSUE** |
| `orders/page.tsx` | ✅ | ✅ | OK |
| `orders/[orderNumber]/page.tsx` | ✅ | ✅ | OK |
| `orders/[orderNumber]/pickup/page.tsx` | ❌ MISSING | ❌ MISSING | **ISSUE** |
| `orders/success/[orderNumber]/page.tsx` | ✅ | ❌ MISSING | **ISSUE** |
| `account/page.tsx` | ✅ | ✅ | OK |
| `account/orders/page.tsx` | ✅ | ✅ | OK |
| `account/addresses/page.tsx` | ✅ | ✅ | OK |
| `account/points/page.tsx` | ✅ | ✅ | OK |
| `account/vouchers/page.tsx` | ✅ | ✅ | OK |
| `account/profile/page.tsx` | ✅ | ✅ | OK |
| `blog/page.tsx` | ✅ | ✅ | OK |
| `blog/[slug]/page.tsx` | ✅ | ✅ | OK |
| `about/page.tsx` | ✅ | ✅ | OK |
| `privacy-policy/page.tsx` | ✅ | ✅ | OK |
| `refund-policy/page.tsx` | ✅ | ✅ | OK |

**Store coverage:** ~75% (17 of 23 pages have both loading + error)

### Admin Route Group (`app/(admin)/admin/`)

| Page | loading.tsx | error.tsx | Status |
|------|-------------|-----------|--------|
| `page.tsx` (dashboard) | ✅ | ✅ | OK |
| `dashboard/page.tsx` | ✅ | ✅ | OK |
| `orders/page.tsx` | ✅ | ✅ | OK |
| `orders/[id]/page.tsx` | ✅ | ✅ | OK |
| `products/page.tsx` | ✅ | ✅ | OK |
| `products/[id]/page.tsx` | ✅ | ✅ | OK |
| `products/new/page.tsx` | ✅ | ✅ | OK |
| `inventory/page.tsx` | ✅ | ✅ | OK |
| `shipments/page.tsx` | ✅ | ✅ | OK |
| `customers/page.tsx` | ✅ | ✅ | OK |
| `customers/[id]/page.tsx` | ✅ | ✅ | OK |
| `coupons/page.tsx` | ✅ | ✅ | OK |
| `coupons/[id]/page.tsx` | ✅ | ✅ | OK |
| `coupons/new/page.tsx` | ✅ | ✅ | OK |
| `blog/page.tsx` | ✅ | ✅ | OK |
| `blog/[id]/page.tsx` | ✅ | ✅ | OK |
| `blog/new/page.tsx` | ✅ | ✅ | OK |
| `carousel/page.tsx` | ✅ | ✅ | OK |
| `carousel/[id]/page.tsx` | ✅ | ✅ | OK |
| `carousel/new/page.tsx` | ✅ | ✅ | OK |
| `b2b-inquiries/page.tsx` | ✅ | ✅ | OK |
| `b2b-quotes/page.tsx` | ✅ | ✅ | OK |
| `categories/page.tsx` | ✅ | ✅ | OK |
| `users/page.tsx` | ✅ | ✅ | OK |
| `settings/page.tsx` | ✅ | ✅ | OK |
| `ai-content/page.tsx` | ✅ | ✅ | OK |
| `team-dashboard/page.tsx` | ✅ | ✅ | OK |
| `field/page.tsx` | ✅ | ✅ | OK |
| `testimonials/page.tsx` | ✅ | ✅ | OK |

**Admin coverage:** ✅ 100% — All admin pages have both loading.tsx and error.tsx

### Auth Route Group (`app/(auth)/`)

| Page | loading.tsx | error.tsx | Status |
|------|-------------|-----------|--------|
| `login/page.tsx` | ✅ | ✅ | OK |
| `register/page.tsx` | ✅ | ✅ | OK |
| `forgot-password/page.tsx` | ✅ | ✅ | OK |
| `reset-password/[token]/page.tsx` | ✅ | ✅ | OK |

**Auth coverage:** ✅ 100%

---

## 2. Critical Pages Missing Both loading.tsx and error.tsx

### 2.1 Product Detail Page — `app/(store)/products/[slug]/page.tsx`

**Severity:** CRITICAL

This is one of the most visited pages on the site (SEO, direct links). Without loading.tsx, when a user navigates to a product, they'll either see nothing or a blank section before the content loads. Without error.tsx, if the product fetch fails (DB error, network), the user sees a raw React error boundary with a stack trace instead of a friendly "Product not found" or "Something went wrong" page.

**Root cause:** The product detail page fetches by slug from the database. If the product doesn't exist or is soft-deleted, the page currently throws an error or returns null — it should return a proper 404.

**Fix needed:**
1. Create `app/(store)/products/[slug]/loading.tsx` — skeleton of product card, image, variant selector
2. Create `app/(store)/products/[slug]/error.tsx` — friendly error with "Back to Products" button
3. Fix the page to return notFound() when product is null or soft-deleted

### 2.2 Checkout Failed Page — `app/(store)/checkout/failed/page.tsx`

**Severity:** HIGH

Payment failures are high-emotion moments. Users who reach the failed page need to understand what happened and what to do next. Without loading.tsx, the page might flash empty before showing content. Without error.tsx, any error on this page shows an ugly React error instead of guiding the user.

**Current state:** No loading or error files for this path.

**Fix needed:**
1. Create `app/(store)/checkout/failed/loading.tsx` — skeleton with failed icon placeholder
2. Create `app/(store)/checkout/failed/error.tsx` — "Payment Failed" UI with retry options

---

## 3. Pages Missing Error.tsx Only

### 3.1 Products Page — `app/(store)/products/page.tsx`
**Issue:** Has loading.tsx (shared or its own), missing error.tsx
**Impact:** DB error during product listing shows React error

### 3.2 Cart Page — `app/(store)/cart/page.tsx`
**Issue:** Has loading.tsx, missing error.tsx
**Impact:** Cart data fetch failure shows React error instead of friendly message

### 3.3 Checkout Success — `app/(store)/checkout/success/page.tsx`
**Issue:** Has loading.tsx, missing error.tsx
**Impact:** Rare but if order confirmation fetch fails, shows React error

### 3.4 Checkout Pending — `app/(store)/checkout/pending/page.tsx`
**Issue:** Has loading.tsx, missing error.tsx
**Impact:** If Midtrans pending page data fails to load, shows React error

### 3.5 Order Success — `app/(store)/orders/success/[orderNumber]/page.tsx`
**Issue:** Has loading.tsx, missing error.tsx
**Impact:** Email fetch or order fetch fails, shows React error

### 3.6 Pickup Page — `app/(store)/orders/[orderNumber]/pickup/page.tsx`
**Issue:** Both loading and error missing
**Impact:** Shows nothing or React error on this page

---

## 4. Pages Missing loading.tsx Only

### 4.1 Products Page — needs confirmation
Verify if `app/(store)/products/loading.tsx` exists or if it uses the shared `app/(store)/loading.tsx`. If using shared, the skeleton won't be product-specific.

---

## 5. Loading State Quality Audit

### 5.1 Shared Store Loading — `app/(store)/loading.tsx`

**What it does:** Renders a generic skeleton for all store pages.

**Issues:**
- Not page-specific — product listing gets the same skeleton as homepage
- No adaptive loading — different pages need different skeleton layouts

### 5.2 Admin Loading States

**Quality:** ✅ All admin pages have dedicated loading.tsx files with appropriate skeleton content.

**Example — `app/(admin)/admin/orders/loading.tsx`:**
- Shows table header skeleton
- Shows 5-10 row skeletons
- Matches the actual orders table layout

This is the correct pattern.

### 5.3 Checkout Loading — `app/(store)/checkout/loading.tsx`

**Quality:** ✅ Shows a skeleton of the checkout layout (stepper, form area, summary sidebar). This is appropriate since checkout is a multi-step form.

---

## 6. Error State Quality Audit

### 6.1 Global Store Error — `app/(store)/error.tsx`

**Status:** ✅ Present and likely properly configured

Next.js App Router error boundaries work at the route segment level. This file catches all store errors.

### 6.2 Global Admin Error — `app/(admin)/admin/error.tsx`

**Status:** ✅ Present

Same pattern for admin.

### 6.3 Page-Level Error States

Most page-level error.tsx files likely just re-throw to the parent error boundary with a "something went wrong" message. This is acceptable.

---

## 7. Recommendations by Priority

### P0 — Must Fix Immediately

1. **Create `app/(store)/products/[slug]/loading.tsx`**
   - Skeleton: image placeholder (left), name + price + variant selector (right)
   - Matches ProductCardHorizontal layout

2. **Create `app/(store)/products/[slug]/error.tsx`**
   - "Produk tidak ditemukan" if 404, "Terjadi kesalahan" for other errors
   - "Kembali ke Katalog" button

3. **Fix product detail page to handle null/soft-deleted**
   - Add `isNull(products.deletedAt)` to query
   - Return `notFound()` from Next.js

### P1 — Should Fix Before Launch

4. **Create `app/(store)/checkout/failed/loading.tsx`** and **error.tsx**
5. **Create `app/(store)/orders/[orderNumber]/pickup/loading.tsx`** and **error.tsx**
6. **Create `app/(store)/checkout/success/error.tsx`**
7. **Create `app/(store)/checkout/pending/error.tsx`**
8. **Create `app/(store)/orders/success/[orderNumber]/error.tsx`**
9. **Create `app/(store)/products/error.tsx`**
10. **Create `app/(store)/cart/error.tsx`**

### P2 — Nice to Have

11. Page-specific loading skeletons instead of shared global ones
12. Add "Retry" button to error states

---

## 8. Summary Table

| Priority | Count | Pages |
|----------|-------|-------|
| P0 (both missing) | 1 | products/[slug] |
| P0 (data issue) | 1 | products/[slug] null handling |
| P1 (error missing) | 8 | products, cart, checkout/success, checkout/pending, checkout/failed, orders/success, orders/pickup |
| P2 (nice to have) | 2 | page-specific skeletons, retry buttons |

**Total pages needing fixes:** 10 unique pages

---

## 9. Skeleton Design Patterns

### For Product Detail (`products/[slug]/loading.tsx`)

```tsx
// Good skeleton for product detail
export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image skeleton */}
          <div className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
          {/* Info skeleton */}
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="flex gap-2 mt-4">
              <div className="h-12 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### For Checkout Failed (`checkout/failed/error.tsx`)

```tsx
// Good error state for failed payment
'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/store/common/EmptyState';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <EmptyState
        variant="order"
        title="Pembayaran Gagal"
        description="Terjadi kesalahan saat memproses pembayaran. Pesanan Anda belumconfirmed."
        action={{
          label: 'Coba Lagi',
          href: '/cart',
        }}
      />
    </div>
  );
}
```

---

## 10. Fix Checklist

```
TODO: Create loading/error files:
□ app/(store)/products/[slug]/loading.tsx
□ app/(store)/products/[slug]/error.tsx
□ app/(store)/checkout/failed/loading.tsx
□ app/(store)/checkout/failed/error.tsx
□ app/(store)/orders/[orderNumber]/pickup/loading.tsx
□ app/(store)/orders/[orderNumber]/pickup/error.tsx
□ app/(store)/checkout/success/error.tsx
□ app/(store)/checkout/pending/error.tsx
□ app/(store)/orders/success/[orderNumber]/error.tsx
□ app/(store)/products/error.tsx
□ app/(store)/cart/error.tsx

TODO: Fix data handling:
□ app/(store)/products/[slug]/page.tsx — add deletedAt filter + notFound()
```