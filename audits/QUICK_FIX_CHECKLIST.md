---
title: "Quick Fix Checklist — All Bugs by File & Line"
audit-date: "2026-05-23"
scope: "Every bug found with exact file:line references and one-line fix"
severity: "CRITICAL"
files-affected: "ALL FILES"
---

# Quick Fix Checklist — All Bugs by File & Line

**Date:** 2026-05-23
**Purpose:** One-page quick reference for fixing every bug. Sorted by file path for easy lookup.

---

## HOW TO USE THIS CHECKLIST

1. Open each file in your IDE
2. Navigate to the line number
3. Apply the fix exactly as described
4. Test the affected flow before moving on

---

## 🚨 CRITICAL FIXES (Do First)

---

### [1] `app/api/webhooks/midtrans/route.ts` — ADD SIGNATURE VERIFICATION

**Priority:** #1 — Payment fraud vulnerability

**Add at the VERY TOP of the webhook handler (before any processing):**

```typescript
export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Verify Midtrans signature FIRST
    const signature = request.headers.get('x-midtrans-signature');
    if (!signature) {
      console.error('[webhook/midtrans] Missing signature header');
      return Response.json({ error: 'Missing signature' }, { status: 401 });
    }

    const rawBody = await request.text();
    const expectedHash = crypto.createHash('sha512')
      .update(process.env.MIDTRANS_SERVER_KEY + rawBody)
      .digest('hex');

    if (signature !== expectedHash) {
      console.error('[webhook/midtrans] Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    // Continue with rest of handler...
```

---

### [2] `app/api/checkout/initiate/route.ts` line ~611 — FIX `order` UNDEFINED

**Priority:** #2 — B2B Net-30 orders crash when awarding points

**Change:**
```typescript
if (userId && order.pointsEarned > 0) {
  const earnedPoints = order.pointsEarned;
```

**To:**
```typescript
if (userId && created.pointsEarned > 0) {
  const earnedPoints = created.pointsEarned;
```

The variable is `created` (from the INSERT result), not `order`.

---

### [3] `app/api/checkout/initiate/route.ts` lines 258-285 — ADD STOCK VALIDATION FOR BUY X GET Y

**Priority:** #4 — Free items can push stock negative

**In the Buy X Get Y coupon block, after filtering qualifying variants:**

```typescript
// Current (WRONG):
const selectedVariants = qualifyingVariants.slice(0, getQty);

// Fixed:
const selectedVariants = qualifyingVariants
  .filter(v => v.stock > 0)  // Only in-stock variants
  .slice(0, getQty);

if (selectedVariants.length < getQty) {
  logger.warn('[checkout/initiate] BuyXGetY: insufficient stock for free items', {
    requested: getQty,
    available: selectedVariants.length,
  });
  // Optionally: reject the coupon or proceed with available items
  throw new ApiError(422, `Stok tidak mencukupi untuk item gratis. Hanya ${selectedVariants.length} item tersedia.`);
}
```

---

### [4] `app/api/checkout/initiate/route.ts` line ~389 — FIX FREE SHIPPING CHECK

**Priority:** HIGH — Free shipping coupons don't work

**Change:**
```typescript
// WRONG:
if (coupon.freeShipping) { ... }

// CORRECT:
if (coupon.type === 'free_shipping') { ... }
```

The schema uses `type: 'free_shipping'` enum, not a `freeShipping` boolean.

---

### [5] `app/api/checkout/initiate/route.ts` — FIX POINTS DEDUCTION OUTSIDE TRANSACTION

**Priority:** HIGH — Users lose points on failed orders

**Move the points deduction INSIDE the transaction, OR create a pending deduction record that gets converted on commit. This is a larger fix — see the Payment Flow Audit for full details.**

**Quick workaround:** Wrap the entire order creation + points deduction in one transaction.

---

### [6] `components/store/checkout/PointsRedeemer.tsx` lines 29, 31-32 — FIX DOUBLE DIVISION

**Priority:** CRITICAL — Customers see wrong point values

**Change lines 29, 31-32:**

```typescript
// Line 29 — Change FROM:
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
// TO:
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR);

// Line 31 — Keep AS IS (already correct):
const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;

// Line 32 — Change FROM:
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
// TO:
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR)) * POINTS_VALUE_IDR;
```

---

### [7] `components/store/products/ProductDetailClient.tsx` — ADD I18N

**Priority:** CRITICAL — Entire page hardcoded Indonesian

**This is the largest fix.** Every string must be wrapped in `t()` calls. Use the search-and-replace approach:

1. Add `const t = useTranslations('ProductDetail');` at the top of the component
2. Replace all Indonesian strings with `t('key')` format
3. Add all keys to `i18n/messages/id.json` and `i18n/messages/en.json`

Example replacements:
- `"Pilih Varian"` → `t('variant.select')`
- `"Tambah ke Keranjang"` → `t('cart.add')`
- `"Stok Habis"` → `t('stock.out')`
- `"Deskripsi"` → `t('description')`

---

## 🔴 HIGH PRIORITY FIXES

---

### [8] `app/(admin)/admin/dashboard/SuperadminDashboardClient.tsx` — FIX ordersDelta

**Change:**
```typescript
// FROM:
ordersDelta: weekOrders[0]?.count && weekRevenue[0]?.total
  ? 0
  : 0,

// TO:
ordersDelta: weekOrders[0]?.count
  ? Math.round(((todayOrders[0]?.count ?? 0) - weekOrders[0].count) / weekOrders[0].count * 100)
  : 0,
```

---

### [9] `app/api/shipping/cost/route.ts` — FIX RAJAONGKIR ORIGIN CITY

**Issue:** RajaOngkir Starter only supports origin city 501 (Jakarta). If settings have Bandung (23), shipping cost fails.

**Fix options:**
1. Hardcode origin city to 501 for Starter tier
2. Document that Starter only works with Jakarta origin
3. Upgrade to RajaOngkir Pro (paid) to support any city

**Quick fix (add comment and fallback):**
```typescript
// RajaOngkir Starter only supports Jakarta (501). Use 501 as fallback.
const originCity = originCityId === '501' ? originCityId : '501';
```

---

### [10] `app/api/coupons/validate/route.ts` — FIX GUEST BYPASS

**Issue:** `max_uses_per_user` always passes for guests (userId null)

**Quick fix:** For guest checkouts, reject coupons with `max_uses_per_user` limit:

```typescript
// After finding the coupon, before per-user check:
if (!userId && coupon.maxUsesPerUser) {
  return Response.json({
    success: false,
    error: 'Coupon ini tidak dapat digunakan untuk guest checkout',
  }, { status: 422 });
}
```

---

### [11] `app/api/coupons/validate/route.ts` — ADD RATE LIMITING

**Issue:** Coupon codes can be brute-forced

**Add rate limiting to the validate endpoint:**

```typescript
import { withRateLimit } from '@/lib/utils/rate-limit';

export async function POST(req: NextRequest) {
  return withRateLimit(req, async () => {
    // ... existing code
  }, { max: 10, windowMs: 60000 }); // 10 attempts per minute
}
```

---

## 🟡 MAJOR FIXES

---

### [12] `components/store/cart/CartItem.tsx` lines 54-59 — REPLACE `<img>` TAG

**Change:**
```tsx
// FROM:
<img src={item.imageUrl} alt={item.productName} className="w-20 h-20 rounded-lg object-cover" />

// TO:
import Image from 'next/image';
<Image src={item.imageUrl} alt={item.productName} width={80} height={80} className="w-20 h-20 rounded-lg object-cover" />
```

---

### [13] `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` lines 244-248 — REPLACE `<img>` TAG

**Same fix as [12] — replace raw `<img>` with Next.js `<Image>` component.**

---

### [14] `components/store/home/FeaturedProducts.tsx` lines 73, 74, 160, 161, 189, 190 — REMOVE `as never`

**Replace `as never` casts with proper typed interfaces matching ProductCard props.**

---

### [15] `components/store/layout/WhatsAppButton.tsx` line 46 — FIX ANIMATION CLASS

**Change:**
```tsx
// FROM:
className="... animate-pulse-soft"

// TO (if not defined in tailwind):
className="... animate-pulse"

// OR add animate-pulse-soft to tailwind.config.ts:
module.exports = {
  theme: {
    extend: {
      animation: {
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
};
```

---

### [16] `app/(store)/about/error.tsx` — CREATE MISSING FILE

**Create the file with:**

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

### [17] `app/api/shipping/cost/route.ts` — RENAME `weightInKg` VARIABLE

**Change variable name from `weightInKg` to `weightInGrams` for clarity:**

```typescript
// FROM:
const weightInKg = Math.ceil(billableWeight / 100) * 100;

// TO:
const weightInGrams = Math.ceil(billableWeight / 100) * 100;
// And update all references to weightInKg throughout the file
```

Add comment: `// RajaOngkir Starter expects weight in grams`

---

### [18] `app/(admin)/admin/b2b-quotes/[id]/page.tsx` — REMOVE DISABLED BUTTONS

**Remove or comment out the disabled "Kirim Quote via Email" and "Download PDF" buttons:**

```tsx
{/* TEMPORARILY REMOVED - Feature in development */}
{/* <button disabled ...>Kirim Quote via Email</button> */}
{/* <button disabled ...>Download PDF</button> */}
```

**OR implement the full feature.**

---

## 🟠 MEDIUM PRIORITY FIXES

---

### [19] `app/(admin)/admin/team-dashboard/TeamDashboardClient.tsx` — CREATE 6 MISSING API ROUTES

**Create these files:**
1. `app/api/admin/team-dashboard/monthly-progress/route.ts`
2. `app/api/admin/team-dashboard/order-pipeline/route.ts`
3. `app/api/admin/team-dashboard/action-orders/route.ts`
4. `app/api/admin/team-dashboard/coupons/route.ts`
5. `app/api/admin/team-dashboard/blog-status/route.ts`
6. `app/api/admin/team-dashboard/points-summary/route.ts`

See Team Dashboard audit for the expected return shape of each endpoint.

---

### [20] `app/(admin)/admin/categories/loading.tsx` — CREATE LOADING STATE

**Create skeleton matching the categories table layout.**

---

### [21] `app/(admin)/admin/b2b-inquiries/[id]/loading.tsx` — CREATE LOADING STATE

**Create loading skeleton for the b2b inquiry detail page.**

---

### [22] `lib/db/schema.ts` — ADD DATABASE CONSTRAINTS

**Run these SQL migrations (after verifying no existing violations):**

```sql
-- Prevent negative stock
ALTER TABLE product_variants ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);

-- Ensure midtransOrderId is unique
ALTER TABLE orders ADD CONSTRAINT orders_midtrans_order_id_unique UNIQUE (midtrans_order_id);

-- Index for FIFO points expire query
CREATE INDEX idx_points_history_expire_candidates
ON points_history (user_id, type, is_expired, consumed_at, expires_at)
WHERE type = 'earn' AND is_expired = false AND consumed_at IS NULL;

-- Case-insensitive email unique index
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));
```

---

## 🟢 MINOR FIXES

---

### [23] `components/store/products/ProductCatalog.tsx` lines 135, 214, 217, 223 — ADD I18N

**Replace hardcoded strings with `t()` calls:**
- `"Produk tidak ditemukan"` → `t('catalog.empty')`
- `"Filter"` → `t('catalog.filter')`
- `"Hapus filter"` → `t('catalog.filterClear')`
- `"Urutkan"` → `t('catalog.sort')`

---

### [24] `components/store/products/ProductDetailClient.tsx` lines 166-167 — FIX EMOJI PLACEHOLDER

**Replace emoji 🥟 with a styled SVG or Next.js Image placeholder:**

```tsx
// FROM:
{!variant.imageUrl && <span className="text-4xl">🥟</span>}

// TO:
{!variant.imageUrl && (
  <div className="w-full h-full bg-brand-cream-dark flex items-center justify-center">
    <span className="text-brand-red text-2xl font-display">D</span>
  </div>
)}
```

---

### [25] `components/store/layout/BottomNav.tsx` line 34 — FIX DUPLICATE ICON

**Change B2B tab icon from `Package` to something unique (e.g., `Building2`):**

```tsx
// FROM:
{ href: '/b2b/account', Icon: Package, label: 'B2B' }

// TO:
{ href: '/b2b/account', Icon: Building2, label: 'B2B' }
```

---

### [26] `components/store/layout/Navbar.tsx` line 76 — FIX EMPTY SEARCH LINK

**Change:**
```tsx
// FROM:
href="/products?q="

// TO:
href="/products"
```

---

### [27] `components/store/checkout/DeliveryMethodToggle.tsx` line 72 — HARDCODED ADDRESS

**Move pickup address to system_settings:**
- Add `store_address` and `store_city` keys to settings table
- Fetch and display dynamically

---

### [28] `app/(store)/checkout/page.tsx` line 77 — HARDCODED STORE HOURS

**Change from hardcoded defaults to fetched from settings:**

```tsx
// FROM:
const storeHours = 'Senin - Sabtu, 08.00 - 17.00 WIB';

// TO:
const storeHours = settings.storeHours || 'Senin - Sabtu, 08.00 - 17.00 WIB';
```

---

## 📋 MASTER FIX TRACKING TABLE

| # | File | Line(s) | Bug | Fix One-Liner | Priority |
|---|------|---------|-----|---------------|----------|
| 01 | webhooks/midtrans/route.ts | TOP | No signature verification | Add SHA-512 hash check | 🚨 CRITICAL |
| 02 | checkout/initiate/route.ts | ~611 | `order` undefined | Use `created` instead | 🚨 CRITICAL |
| 03 | checkout/initiate/route.ts | 258-285 | Buy X Get Y no stock check | Filter `stock > 0` | 🚨 CRITICAL |
| 04 | checkout/initiate/route.ts | ~389 | `freeShipping` column wrong | Use `type === 'free_shipping'` | 🔴 HIGH |
| 05 | checkout/initiate/route.ts | points flow | Points outside transaction | Wrap in transaction | 🔴 HIGH |
| 06 | PointsRedeemer.tsx | 29,31-32 | Double division | Remove extra `* 10` | 🚨 CRITICAL |
| 07 | ProductDetailClient.tsx | ALL | Hardcoded Indonesian | Add `t()` calls | 🚨 CRITICAL |
| 08 | SuperadminDashboardClient.tsx | ordersDelta | Always 0 | Real delta calc | 🔴 HIGH |
| 09 | shipping/cost/route.ts | origin city | Starter only 501 | Fallback to 501 | 🔴 HIGH |
| 10 | coupons/validate/route.ts | per-user | Guest bypass | Reject guests | 🔴 HIGH |
| 11 | coupons/validate/route.ts | TOP | No rate limit | Add 10/min limit | 🔴 HIGH |
| 12 | CartItem.tsx | 54-59 | Raw `<img>` | Use Next Image | 🟡 MAJOR |
| 13 | OrderTrackingClient.tsx | 244-248 | Raw `<img>` | Use Next Image | 🟡 MAJOR |
| 14 | FeaturedProducts.tsx | 73,74,160,161,189,190 | `as never` | Proper types | 🟡 MAJOR |
| 15 | WhatsAppButton.tsx | 46 | Wrong animation class | Use animate-pulse | 🟡 MAJOR |
| 16 | about/error.tsx | MISSING | No error boundary | Create file | 🟡 MAJOR |
| 17 | shipping/cost/route.ts | variable name | `weightInKg` misleading | Rename to `weightInGrams` | 🟡 MAJOR |
| 18 | b2b-quotes/[id]/page.tsx | disabled btns | B2B workflow broken | Remove or implement | 🚨 CRITICAL |
| 19 | team-dashboard/*.ts | 6 files | Missing APIs | Create 6 endpoints | 🚨 CRITICAL |
| 20 | categories/loading.tsx | MISSING | No loading state | Create skeleton | 🟠 MEDIUM |
| 21 | b2b-inquiries/[id]/loading.tsx | MISSING | No loading state | Create skeleton | 🟠 MEDIUM |
| 22 | lib/db/schema.ts | stock col | No CHECK constraint | Add `CHECK (stock >= 0)` | 🟠 MEDIUM |
| 23 | ProductCatalog.tsx | 135,214,217,223 | Hardcoded strings | Add `t()` calls | 🟢 MINOR |
| 24 | ProductDetailClient.tsx | 166-167 | Emoji placeholder | SVG placeholder | 🟢 MINOR |
| 25 | BottomNav.tsx | 34 | Duplicate Package icon | Use Building2 | 🟢 MINOR |
| 26 | Navbar.tsx | 76 | Empty `?q=` param | Remove `?q=` | 🟢 MINOR |
| 27 | DeliveryMethodToggle.tsx | 72 | Hardcoded address | Fetch from settings | 🟢 MINOR |
| 28 | checkout/page.tsx | 77 | Hardcoded hours | Fetch from settings | 🟢 MINOR |

---

*End of Quick Fix Checklist*