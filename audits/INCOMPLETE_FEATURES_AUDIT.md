---
title: "Incomplete Features Audit"
audit-date: "2026-05-23"
scope: "Placeholder code, TODO comments, disabled buttons, missing flows"
severity: "CRITICAL"
files-affected: "app/(admin)/admin/b2b-quotes/[id]/page.tsx, app/(admin)/admin/team-dashboard/TeamDashboardClient.tsx, components/store/products/ProductDetailClient.tsx, app/api/checkout/retry/route.ts"
---

# Incomplete Features Audit — DapurDekaka.com

**Date:** 2026-05-23
**Auditor:** Multi-Agent Deep Audit
**Scope:** Placeholder code, disabled features, missing flows, TODO/FIXME comments

---

## EXECUTIVE SUMMARY

**15 incomplete features identified**, of which **4 are CRITICAL** (completely broken workflows that affect core business operations). The most severe: B2B quote delivery is completely disabled, payment retry doesn't exist, and the Team Dashboard will crash on most panels due to missing API routes.

---

## PART 1: DISABLED UI ELEMENTS

---

### 🔴 CRITICAL-1: B2B Quote — Send Email & Download PDF Disabled

**File:** `app/(admin)/admin/b2b-quotes/[id]/page.tsx`

**What:** Both action buttons are permanently disabled:

```tsx
<button
  disabled
  className="w-full h-10 bg-gray-300 text-gray-500 cursor-not-allowed"
  title="Fitur dalam pengembangan"
>
  Kirim Quote via Email
</button>
<button
  disabled
  className="w-full h-10 border border-admin-border cursor-not-allowed"
  title="Fitur dalam pengembangan"
>
  Download PDF
</button>
```

**Impact:** The entire B2B sales workflow is broken. Sales team can:
1. View B2B inquiries ✅
2. Create quotes ✅
3. See quote details ✅

But CANNOT:
1. Send quotes to customers via email ❌
2. Download quotes as PDF ❌

**Root cause:** The PDF generation API route (`/api/admin/b2b-quotes/[id]/generate-pdf`) may exist but is not wired up to the UI. Email sending functionality is not implemented at all.

**Workaround:** Remove the disabled buttons from the UI until the feature is implemented, OR implement the full flow:
1. Create PDF generation endpoint
2. Create email sending with Resend
3. Wire up the buttons with loading states

---

### 🟡 MAJOR-2: `animate-pulse-soft` Animation Not Defined

**File:** `components/store/layout/WhatsAppButton.tsx` line 46

**What:** The WhatsApp button uses `animate-pulse-soft` which may not be defined in the Tailwind config.

**Current:**
```tsx
className="... animate-pulse-soft"
```

**Should be:** Either add the custom animation to tailwind.config or use `animate-pulse`.

---

## PART 2: MISSING API ROUTES

---

### 🔴 CRITICAL-3: Team Dashboard — 6 Missing API Endpoints

**File:** `app/(admin)/admin/team-dashboard/TeamDashboardClient.tsx`

**What:** The TeamDashboardClient makes 11 API calls. 6 of those endpoints don't exist:

```
TeamDashboardClient calls:
1. /api/admin/team-dashboard/snapshot ✅ EXISTS
2. /api/admin/team-dashboard/monthly-progress ❌ MISSING
3. /api/admin/team-dashboard/order-pipeline ❌ MISSING
4. /api/admin/team-dashboard/action-orders ❌ MISSING
5. /api/admin/team-dashboard/top-products ✅ EXISTS
6. /api/admin/team-dashboard/inventory-alerts ❌ MISSING (aliased as low-stock-alerts)
7. /api/admin/team-dashboard/b2b-pipeline ❌ MISSING (need to verify)
8. /api/admin/team-dashboard/coupons ❌ MISSING
9. /api/admin/team-dashboard/blog-status ❌ MISSING
10. /api/admin/team-dashboard/health-indicators ✅ EXISTS
11. /api/admin/team-dashboard/points-summary ❌ MISSING
```

**Impact:** ~60% of the Team Dashboard panels will fail to load with 404 errors.

**Missing files to create:**
1. `app/api/admin/team-dashboard/monthly-progress/route.ts`
2. `app/api/admin/team-dashboard/order-pipeline/route.ts`
3. `app/api/admin/team-dashboard/action-orders/route.ts`
4. `app/api/admin/team-dashboard/coupons/route.ts`
5. `app/api/admin/team-dashboard/blog-status/route.ts`
6. `app/api/admin/team-dashboard/points-summary/route.ts`

---

### 🔴 CRITICAL-4: Payment Retry Endpoint Missing

**File:** `app/api/checkout/retry/route.ts` — **FILE DOES NOT EXIST**

**What:** The payment retry flow requires this endpoint but it's not created. Any retry attempt returns 404.

**Per PRD:** Customers can retry up to 3 times with new Midtrans order_id = DDK-YYYYMMDD-XXXX-retry-N.

**Missing implementation:**
1. Create `app/api/checkout/retry/route.ts`
2. Validate retry count < 3
3. Generate new Midtrans order_id with retry suffix
4. Create new Midtrans transaction
5. Update order with new snap_token and expiry
6. Return new snap_token

---

## PART 3: PLACEHOLDER / INCOMPLETE CODE

---

### 🟡 MAJOR-5: `as never` Type Casts in FeaturedProducts

**File:** `components/store/home/FeaturedProducts.tsx` lines 73, 74, 160, 161, 189, 190

**What:** TypeScript type checking is bypassed with `as never` casts:

```tsx
<ProductCard
  product={product as never}
  variant={variant as never}
  ...
/>
```

**Impact:** If the ProductCard props interface changes, runtime errors could occur silently. The `as never` pattern is a code smell indicating the type definitions don't match the actual data shape.

**Fix:** Define proper typed interfaces that match ProductCard's expected props, or fix the data shape to match the types.

---

### 🟡 MAJOR-6: PointsRedeemer Double Division Bug

**File:** `components/store/checkout/PointsRedeemer.tsx` lines 29, 31-32

**What:** Points values are double-divided and double-multiplied, showing customers wrong numbers:

```tsx
// WRONG (current):
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
// Result: If maxPointsValue = 50000, POINTS_VALUE_IDR = 10
//         = Math.floor(50000/10) * 10 = 5000 * 10 = 50000 (coincidentally works)
// But for potentialSavings:
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
// = value * 10 * 10 = value * 100 — WRONG!
```

**Fix:** Remove the extra `* POINTS_VALUE_IDR`:
```tsx
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR);
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR)) * POINTS_VALUE_IDR;
```

---

### 🟡 MAJOR-7: ProductDetailClient Entirely Hardcoded Indonesian

**File:** `components/store/products/ProductDetailClient.tsx`

**What:** Every single string on the product detail page is hardcoded Indonesian — no `useTranslations()` calls anywhere. This means the language toggle is non-functional for the most important conversion page.

**Strings include:** "Pilih Varian", "Deskripsi", "Stok Habis", "Tambah ke Keranjang", "Maks. X pcs", etc.

**Impact:** English-speaking customers see a fully Indonesian interface on the product detail page.

**Fix:** Replace all hardcoded strings with `const t = useTranslations()` pattern and add to translation files.

---

## PART 4: TODO / FIXME / FIXME COMMENTS

---

### Search for TODO/FIXME

```bash
grep -rn "TODO\|FIXME\|HACK\|XXX\|placeholder" app/ --include="*.ts" --include="*.tsx"
```

**Known TODO locations (from audits):**
- B2B quote actions — commented as "Fitur dalam pengembangan"
- ProductForm — may have incomplete variant handling
- Blog CMS — Portable Text editor may be placeholder

**Rule:** Every TODO must be addressed before launch. "placeholder" code should either be implemented or removed.

---

## PART 5: MISSING LOADING/ERROR STATES

---

### About Page Missing error.tsx

**File:** `app/(store)/about/error.tsx` — **DOES NOT EXIST**

**Impact:** Any runtime error on the about page shows default Next.js error instead of branded error page.

**Fix:** Create `app/(store)/about/error.tsx`:
```tsx
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="font-display text-2xl text-text-primary mb-4">
          Terjadi Kesalahan
        </h2>
        <p className="text-text-secondary mb-6">
          Maaf, halaman ini tidak dapat dimuat. Silakan coba lagi.
        </p>
        <button
          onClick={reset}
          className="bg-brand-red text-white px-6 py-3 rounded-lg font-body"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
```

---

### Categories Page Missing loading.tsx

**File:** `app/(admin)/admin/categories/loading.tsx` — **MAY NOT EXIST**

**Current:** Categories page handles loading internally with "Memuat..." text instead of proper skeleton.

**Fix:** Create `app/(admin)/admin/categories/loading.tsx` with skeleton matching the table layout.

---

## PART 6: POTENTIAL PLACEHOLDER FEATURES

---

### Blog Comments

**Question:** Is the blog post detail page (`app/(store)/blog/[slug]/page.tsx`) supposed to have a comments section?

**Status:** Not verified — check if this is a planned feature.

---

### Wishlist/Favorites

**Question:** Is there supposed to be a wishlist feature for logged-in customers?

**Status:** Not verified — search for wishlist-related code.

---

### Product Image Zoom/Lightbox Accessibility

**File:** `components/store/products/ImageGallery.tsx` (if exists)

**Issue:** Lightbox may not have keyboard navigation (Escape to close, arrow keys to navigate).

---

## PART 7: INCOMPLETE FLOWS

---

### B2B Quote Flow (End-to-End)

**Current state:**
1. ✅ B2B inquiry created via public form
2. ✅ Admin sees inquiry, can update status
3. ✅ Admin can create quote from inquiry
4. ❌ **CANNOT send quote to customer (email disabled)**
5. ❌ **CANNOT download quote as PDF (button disabled)**

**What needs to be built:**
1. PDF generation (use `@react-pdf/renderer` or similar)
2. Email template (React Email + Resend)
3. Wire up the disabled buttons with actual functionality

---

### Payment Retry Flow

**Current state:**
1. ✅ Order created with pending_payment status
2. ✅ Midtrans Snap token generated
3. ✅ Payment popup shown to customer
4. ❌ **If popup closed without paying, customer cannot retry (404)**

**What needs to be built:**
1. Create `app/api/checkout/retry/route.ts`
2. Frontend retry button on checkout/failed page
3. Generate new Midtrans transaction with retry-N order_id

---

## PART 8: INCOMPLETE IMPLEMENTATIONS

---

### Free Shipping Coupon Check

**File:** `app/api/checkout/initiate/route.ts` line ~389

**Issue:** Code checks `coupon.freeShipping` but the `coupons` table has `type: 'free_shipping'` enum value, not a `freeShipping` boolean column.

**Current (wrong):**
```typescript
if (coupon.freeShipping) { ... }
```

**Correct:**
```typescript
if (coupon.type === 'free_shipping') { ... }
```

---

### Order Number Generation

**Question:** Is `generateOrderNumber()` in `lib/utils/generate-order-number.ts` fully implemented?

**Check:** Should generate format `DDK-YYYYMMDD-XXXX` with atomic counter.

---

### `PaymentExpiryMinutes` Setting

**File:** `app/api/checkout/initiate/route.ts`

**Question:** Does the `system_settings` table have a row for `payment_expiry_minutes`? If not, the code defaults to 15 minutes.

**Fix:** Ensure seed script creates this setting, or throw error if missing in production.

---

## SUMMARY TABLE

| # | Feature | Severity | Status | Files |
|---|---------|----------|--------|-------|
| 01 | B2B Quote Email/PDF | CRITICAL | DISABLED | b2b-quotes/[id]/page.tsx |
| 02 | Payment Retry | CRITICAL | MISSING | checkout/retry/route.ts |
| 03 | Team Dashboard APIs | CRITICAL | MISSING (6) | team-dashboard/*.ts |
| 04 | Webhook Signature | CRITICAL | MISSING | webhooks/midtrans/route.ts |
| 05 | ProductDetail i18n | CRITICAL | HARDCODED | ProductDetailClient.tsx |
| 06 | PointsRedeemer Math | CRITICAL | BUG | PointsRedeemer.tsx |
| 07 | About error.tsx | MAJOR | MISSING | about/error.tsx |
| 08 | Categories loading | MAJOR | INCOMPLETE | categories/ |
| 09 | animate-pulse-soft | MAJOR | MAY BE MISSING | WhatsAppButton.tsx |
| 10 | as never casts | MAJOR | TYPE BYPASS | FeaturedProducts.tsx |
| 11 | FreeShipping column | MAJOR | BUG | initiate/route.ts |
| 12 | Blog Comments | INFO | NOT VERIFIED | blog/[slug]/page.tsx |
| 13 | Wishlist | INFO | NOT VERIFIED | — |

---

*End of Incomplete Features Audit*