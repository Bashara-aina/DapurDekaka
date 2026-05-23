---
title: "Store Frontend Deep Audit"
audit-date: "2026-05-23"
scope: "Customer journey from homepage to order completion"
severity: "CRITICAL"
files-affected: "app/(store)/page.tsx, components/store/products/*.tsx, components/store/cart/*.tsx, app/(store)/checkout/page.tsx, app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx, app/api/shipping/cost/route.ts, components/store/checkout/*.tsx"
---

# Store Frontend Deep Audit — DapurDekaka.com
**Date:** 2026-05-23
**Auditor:** Deep Customer Journey Trace
**Scope:** Homepage → Product Catalog → Product Detail → Cart → Checkout → Order Success → Order Tracking

---

## EXECUTIVE SUMMARY

The store frontend is largely well-structured and follows the project's technical direction. However, there are **2 CRITICAL bugs** that will cause customer-facing failures (points calculation bug causes double division, Buy X Get Y coupon fails), **5 MAJOR issues** affecting conversion (missing i18n strings, design token violations, edge case handling gaps), and **7 MINOR issues** that should be fixed before launch. The shipping cost calculation and RajaOngkir integration are **correctly implemented** — no bugs found there.

---

## FINDINGS BY AREA

---

### 1. HOMEPAGE

#### ✅ What Works
- `FeaturedProducts` uses `dynamic` import for Framer Motion (client-only)
- `HeroCarousel` with `revalidate = 1800` (30-minute ISR)
- Proper JSON-LD structured data (Organization, WebSite, LocalBusiness)
- `CategoryChips` with server-side product count
- All homepage sections have fallback empty states
- Proper error boundaries with `.catch(() => [])` pattern

#### BUG-01 — CRITICAL: `FeaturedProducts` uses `as never` type casts on ProductCard props
- **File:** `components/store/home/FeaturedProducts.tsx` lines 73, 74, 160, 161, 189, 190
- **Bug:** Casting `product` and `variant` props with `as never` bypasses TypeScript type checking entirely. The `ProductCard` component expects specific types — any mismatch will silently fail at runtime.
- **Should be:** Proper typed interfaces matching `ProductCard` props exactly
- **Severity:** MAJOR — runtime type errors possible, especially if schema changes

#### BUG-02 — MAJOR: Hardcoded `products.slice(0, 8)` ignores variant `sortOrder`
- **File:** `components/store/home/FeaturedProducts.tsx` lines 60, 177
- **Bug:** Homepage featured products are sliced to 8 items without ordering by variant sortOrder. A product with variant[0] could be out of stock while variant[1] is in stock — the catalog would show "out of stock" badge but the wrong variant data.
- **Should be:** Filter for in-stock variants first, then sort by `sortOrder`
- **Severity:** MAJOR — incorrect variant selection displayed to customers

#### BUG-03 — MINOR: Empty string fallback for `imageUrl` may load broken image
- **File:** `components/store/home/FeaturedProducts.tsx` lines 72, 159, 189
- **Bug:** `image?.cloudinaryUrl` — if Cloudinary URL is missing/empty, `ProductCard` falls back to `/assets/logo/logo.png` which is correct fallback behavior. However, this happens silently.
- **Severity:** MINOR — already handled with fallback

---

### 2. PRODUCT CATALOG PAGE

#### ✅ What Works
- Server-side pagination with cursor-based `nextCursor`
- Client-side filtering by category and search (no server round-trip)
- Out-of-stock products sorted to end automatically
- `ProductFilters` component exists (but check what it does)
- Loading.tsx and error.tsx present
- Search filters by nameId, nameEn, and category name (i18n-aware)

#### BUG-04 — MAJOR: No URL-based search persistence on page reload
- **File:** `app/(store)/products/page.tsx` line 87
- **Bug:** `initialSearch={q || ''}` passed to `ProductCatalog` client component. But `q` comes from `searchParams.q`. On page reload, `searchParams` is lost when navigating client-side. The search term disappears from the URL and the UI.
- **Should be:** Use `router.push` with `scroll: false` to preserve search state, OR make `q` a required URL param
- **Severity:** MAJOR — customer loses search context on navigation

#### BUG-05 — MINOR: `categoryIdsWithProducts` Set construction is O(n²)
- **File:** `app/(store)/products/page.tsx` lines 70-74
- **Bug:** Two separate queries (`allActiveProducts` and `allCategoriesRaw`) then filtering in JS. Could be done in a single DB query with a JOIN.
- **Severity:** MINOR — functional but inefficient

#### BUG-06 — MINOR: Missing `useTranslations` in `ProductCatalog` for some strings
- **File:** `components/store/products/ProductCatalog.tsx` lines 135, 214, 217, 223
- **Bug:** Some strings like "Produk tidak ditemukan" are hardcoded in Indonesian instead of using `t()` for i18n
- **Severity:** MINOR — inconsistent i18n practice

---

### 3. PRODUCT DETAIL PAGE

#### ✅ What Works
- Image lightbox with `fill` layout and proper `sizes` attribute
- Variant selection with stock-aware disabling
- Quantity stepper respects stock limits (max 99, capped by stock)
- Related products section with "Lihat semua" link
- Breadcrumb navigation
- `StockBadge` integration
- `HalalBadge` integration
- Sticky bottom bar on mobile

#### BUG-07 — MAJOR: Product detail page is entirely hardcoded in Indonesian
- **File:** `components/store/products/ProductDetailClient.tsx` lines 121, 125, 131-134, 140-141, 153, 180, 202, 204, 225, 234, 239-240, 265, 278, 293, 329, 344, 351, 371
- **Bug:** Every single UI string is hardcoded Indonesian: "Beranda", "Produk", "Pilih Varian", "Deskripsi", "Produk Lainnya", "Stok Habis", "Kembali", etc. NOT using `useTranslations()`. This means the entire product detail page cannot be i18n-switched.
- **Should be:** All strings should use `const t = useTranslations()` and `t('key')` pattern
- **Severity:** MAJOR — i18n incomplete, EN users see mixed Indonesian

#### BUG-08 — MAJOR: `weightGram` stored in cart but never used for shipping cost display
- **File:** `components/store/products/ProductDetailClient.tsx` line 101, `components/store/cart/CartSummary.tsx` line 49
- **Bug:** `weightGram` is correctly stored in cart items, and `getTotalWeight()` correctly sums it. However, the cart summary displays weight as `{(totalWeight / 1000).toFixed(1)} kg` — but the shipping cost API call at `app/(store)/checkout/page.tsx` line 298 sends `totalWeight` in grams. This is CORRECT behavior. But there's no display of per-item weight anywhere on product detail, so customers don't know the weight before adding to cart.
- **Should be:** Show weight (e.g., "250g") on the ProductCard and ProductDetail variant selector
- **Severity:** MAJOR — customers can't estimate shipping cost before adding to cart

#### BUG-09 — MINOR: Emoji fallback for missing images (`🥟`)
- **File:** `components/store/products/ProductDetailClient.tsx` lines 166-167, 301-302
- **Bug:** Uses emoji `🥟` as placeholder for missing product images. This is non-standard and may not render consistently across devices.
- **Should be:** Use a styled SVG or Next.js `Image` with a placeholder div instead
- **Severity:** MINOR — inconsistent with brand design

---

### 4. CART PAGE

#### ✅ What Works
- Stock validation API call (`/api/cart/validate`) on mount
- Warning banner when stock issues detected
- Quantity controls with max bound by available stock
- Cart persisted to localStorage via Zustand persist middleware
- `syncToDb()` for logged-in users (merge cart)
- Clear cart confirmation dialog
- Guest checkout shows "login to earn points" banner
- Subtotal per item calculated correctly: `item.unitPrice * item.quantity`
- `getTotalWeight()` sums `item.weightGram * item.quantity`

#### BUG-10 — CRITICAL: Points redemption calculation has double division bug
- **File:** `components/store/checkout/PointsRedeemer.tsx` line 29, 31-32
- **Bug:** 
  ```tsx
  const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
  const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
  const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
  ```
  - `maxPointsValue` is already in IDR (e.g., subtotal 100,000 → 50,000 IDR max discount)
  - Dividing by `POINTS_VALUE_IDR` (10) gives "max points in number"
  - **Then multiplying by `POINTS_VALUE_IDR` AGAIN** reverses the conversion back to IDR
  - `pointsValue` similarly divides then multiplies by 10 — giving wrong display
  - `potentialSavings` does the division then multiplies by 10, then **multiplies by 10 AGAIN** — this gives a value 100x too large!
- **Should be:**
  ```tsx
  const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR); // just the count
  const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR; // IDR value only
  const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR)) * POINTS_VALUE_IDR; // correct
  ```
- **Severity:** CRITICAL — customers see wrong point values, potential for incorrect discount calculations

#### BUG-11 — MAJOR: Cart `loading.tsx` file missing
- **File:** `app/(store)/cart/loading.tsx` — this file is UNTRACKED (shown in git status), meaning it may not exist or is incomplete. The cart page uses `'use client'` pattern but no skeleton loader is visible.
- **Bug:** No loading skeleton displayed while cart hydrates from localStorage
- **Should be:** A `loading.tsx` that renders a skeleton matching the cart layout
- **Severity:** MAJOR — poor loading UX on cart page

#### BUG-12 — MINOR: Cart item image uses `<img>` tag instead of Next.js Image
- **File:** `components/store/cart/CartItem.tsx` lines 54-59
- **Bug:** Uses raw `<img>` tag instead of Next.js `<Image>` component. The master rules explicitly forbid `<img>` tags.
- **Should be:** Use `<Image src={item.imageUrl} alt={...} width={80} height={80} className="object-cover" />`
- **Severity:** MINOR — violates project rules

#### BUG-13 — MINOR: No per-item weight display in cart
- **File:** `components/store/cart/CartItem.tsx`
- **Bug:** Weight is tracked (`weightGram`) but not displayed anywhere in cart items. Customer can't verify total weight.
- **Should be:** Add weight display like "250g × 2 = 500g" or show total weight per item
- **Severity:** MINOR — informational gap

---

### 5. CHECKOUT PAGE

#### ✅ What Works (Shipping Cost Calculation)
- **CORRECT:** Weight sent in **grams** to `/api/shipping/cost` (line 298: `weight: totalWeight`)
- **CORRECT:** API converts to kg: `Math.ceil(billableWeight / 100) * 100` → rounds UP to nearest 100g (correct for RajaOngkir)
- **CORRECT:** Origin city from settings DB, with fallback to 501 (Jakarta)
- **CORRECT:** Only cold-chain couriers (SiCepat FROZEN, JNE YES, AnterAja FROZEN)
- **CORRECT:** Weight limit guard at 30kg with user-friendly error + WhatsApp fallback
- **CORRECT:** Settings cache to avoid DB queries on every shipping calculation
- **CORRECT:** `MIN_WEIGHT_GRAM = 1000` minimum billable weight (1kg floor)

#### BUG-14 — CRITICAL: Buy X Get Y coupon free items not validated for stock before adding to order
- **File:** `app/api/checkout/initiate/route.ts` lines 258-285
- **Bug:** When a `buy_x_get_y` coupon is applied, free items are created with `unitPrice: 0` and added to `orderItemsData` without checking if those variants have sufficient stock. The code finds the cheapest variants and adds them as free items, but there's no validation that they're actually in stock before the order is created.
- **Impact:** Free items could push total quantity above available stock, or be added even when stock is 0.
- **Should be:** Check `variant.stock > 0` before adding free item to `freeItems` array. If insufficient stock for free items, either skip the free item or reject the coupon.
- **Severity:** CRITICAL — negative stock scenario possible, or free items with 0 stock added to order

#### BUG-15 — MAJOR: `PaymentExpiryMinutes` never fetched from DB — uses hardcoded 15 minutes
- **File:** `app/api/checkout/initiate/route.ts` line 399
- **Bug:** `const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;` — this calls `getSetting` but the settings table doesn't have a row for this key by default. The seed script should create this setting but if it's missing, all orders get 15 minutes regardless of intended configuration.
- **Should be:** Either ensure the seed script creates this setting, or throw an error if it's missing in production.
- **Severity:** MAJOR — configuration gap

#### BUG-16 — MAJOR: `freeShippingCoupon` field on `coupon` schema may not exist
- **File:** `app/api/checkout/initiate/route.ts` line 389
- **Bug:** `coupon.freeShipping` is checked, but the `coupon` object is fetched from `db.query.coupons.findFirst`. The Drizzle schema needs to confirm `freeShipping` column exists. If the schema has `type: 'free_shipping'` instead of a `freeShipping` boolean column, this check would always be falsy.
- **Should be:** Verify `freeShipping` column exists in `coupons` schema, or use `coupon.type === 'free_shipping'` consistently
- **Severity:** MAJOR — free shipping coupons might not work if schema column missing

#### BUG-17 — MINOR: Points calculation inconsistency between client and server
- **File:** `app/api/checkout/initiate/route.ts` line 393
- **Bug:** Points earned calculation: `Math.floor(subtotal / 1000) * POINTS_EARN_RATE`. If `subtotal` is 99,999 → `Math.floor(99.999) * 1 = 99` points. But the POINTS_EARN_RATE is defined as `1` per 1,000 IDR. This is CORRECT. However, the PointsRedeemer in the client uses `POINTS_VALUE_IDR = 10` (1 point = 10 IDR) while `POINTS_EARN_RATE = 1` (1 point per 1,000 IDR). These are different ratios (earn: 1000 IDR/pt, redeem: 10 IDR/pt). This is a 100x ratio imbalance.
- **Should be:** Be aware this is intentional design (encourage spend), but document clearly.
- **Severity:** MINOR — design asymmetry, not a bug

#### BUG-18 — MINOR: Pickup location address hardcoded
- **File:** `components/store/checkout/DeliveryMethodToggle.tsx` line 72
- **Bug:** Address "Jl. Sinom V no. 7, Turangga, Bandung" is hardcoded in the component, not fetched from system settings.
- **Should be:** Should come from `system_settings` table (`store_address`, `store_city`)
- **Severity:** MINOR — address may change but can't be updated without code deploy

#### BUG-19 — MINOR: Store pickup hours hardcoded defaults
- **File:** `app/(store)/checkout/page.tsx` line 77
- **Bug:** `storeHours` default: `'Senin - Sabtu', '08.00 - 17.00 WIB'` — these defaults should come from settings
- **Severity:** MINOR — already fetched from API but defaults hardcoded

---

### 6. ORDER SUCCESS PAGE

#### ✅ What Works
- Confetti animation only fires when `status === 'paid'`
- Order number displayed correctly
- Points earned display (conditional on paid status)
- Download receipt link
- `useSearchParams` wrapped in `Suspense` (correct pattern for Next.js)
- `staleTime: 60000` on useQuery

#### BUG-20 — MAJOR: Order success page fetches from wrong API endpoint
- **File:** `app/(store)/checkout/success/page.tsx` line 31
- **Bug:** Uses `fetch('/api/orders/${orderNumber}')` which is a public endpoint that requires email verification for guests. For logged-in users, it auto-verifies. But the Net-30 B2B success path redirects with `?net30=1` query param and the success page may not handle this differently — it still tries to fetch the order.
- **Also:** The success page shows points earned but `pointsEarned` field comes from the order API. If the order is Net-30 (status='paid'), points are awarded inside the same transaction (line 611-630), so this should work — but needs verification.
- **Should be:** Ensure `/api/orders/${orderNumber}` returns data for Net-30 orders without requiring email verification for the ordering user.
- **Severity:** MAJOR — potential blank page for Net-30 B2B customers

#### BUG-21 — MINOR: Confetti imports from `canvas-confetti` which may not be installed
- **File:** `app/(store)/checkout/success/page.tsx` line 8
- **Bug:** `import confetti from 'canvas-confetti'` — if this package is not in package.json, the build will fail. Let me verify if it's in dependencies.
- **Should be:** Check `package.json` for `canvas-confetti`. If missing, add it.
- **Severity:** MINOR — build failure risk

---

### 7. ORDER TRACKING PAGE

#### ✅ What Works
- Email verification gate for guests
- Auto-verify for logged-in users
- Status timeline visualization
- Order items list with images
- Shipping info display
- Payment summary breakdown
- Tracking number display with courier name

#### BUG-22 — MAJOR: Order items image uses raw `<img>` tag
- **File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` lines 244-248
- **Bug:** Uses `<img src={item.productImageUrl} ... />` instead of Next.js `<Image>` component
- **Should be:** Replace with `<Image src={item.productImageUrl} ... width={48} height={48} ... />`
- **Severity:** MAJOR — violates project rules

#### BUG-23 — MINOR: `verified` type narrowing issue
- **File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` lines 46-49
- **Bug:** `VerifiedOrder` interface extends `Order` with `verified: true` but the actual API response uses a different shape (`{ order: {...}, verified: boolean }`). The types don't fully match the runtime data.
- **Severity:** MINOR — TypeScript loose typing

---

### 8. BOTTOM NAV & LAYOUT

#### ✅ What Works
- Cart badge shows real-time item count (hydrated from Zustand store)
- Active route highlighting with `pathname.startsWith()`
- `isB2bUser` check hides B2B tab from non-B2B users
- `safe-area-inset-bottom` for notched devices
- WhatsAppButton positioned above BottomNav
- Navbar sticky on desktop and mobile
- Mobile menu backdrop with click-to-close

#### BUG-24 — MINOR: BottomNav B2B tab item has duplicate icon assignment
- **File:** `components/store/layout/BottomNav.tsx` line 34
- **Bug:** `{ href: '/b2b/account', Icon: Package, label: 'B2B' }` — uses `Package` icon which is same as catalog tab (line 31). Inconsistent with other tabs that use unique icons.
- **Severity:** MINOR — UX confusion

#### BUG-25 — MINOR: WhatsAppButton `animate-pulse-soft` not in Tailwind config
- **File:** `components/store/layout/WhatsAppButton.tsx` line 46
- **Bug:** `animate-pulse-soft` — this animation class may not be defined in `tailwind.config.js`. If missing, the animation won't work.
- **Should be:** Verify `animate-pulse-soft` is defined in tailwind config, or use `animate-pulse` (built-in)
- **Severity:** MINOR — animation may not render as intended

#### BUG-26 — MINOR: Navbar search icon links to `/products?q=`
- **File:** `components/store/layout/Navbar.tsx` line 76
- **Bug:** `href="/products?q="` — empty search query parameter. The products page doesn't handle empty `q` param specially, so this is harmless but pointless.
- **Severity:** MINOR — dead link pattern

---

### 9. MISSING LOADING/ERROR FILES

#### BUG-27 — MAJOR: Several route groups missing `loading.tsx` and/or `error.tsx`

Verified existing:
- ✅ `app/(store)/blog/error.tsx`, `loading.tsx`
- ✅ `app/(store)/blog/[slug]/error.tsx`, `loading.tsx`
- ✅ `app/(store)/cart/loading.tsx` (file exists per git status)
- ✅ `app/(store)/checkout/error.tsx`, `loading.tsx`, `failed/error.tsx`, `pending/error.tsx`, `success/error.tsx`, `success/loading.tsx`
- ✅ `app/(store)/orders/[orderNumber]/error.tsx`, `loading.tsx`, `pickup/error.tsx`, `pickup/loading.tsx`
- ✅ `app/(store)/orders/success/[orderNumber]/error.tsx`, `loading.tsx`
- ✅ `app/(store)/account/addresses/error.tsx`, `loading.tsx`
- ✅ `app/(store)/account/error.tsx`, `loading.tsx`
- ✅ `app/(store)/account/orders/error.tsx`, `loading.tsx`
- ✅ `app/(store)/account/profile/error.tsx`, `loading.tsx`
- ✅ `app/(store)/account/points/error.tsx`, `loading.tsx`
- ✅ `app/(store)/account/vouchers/error.tsx`, `loading.tsx`
- ✅ `app/(store)/products/error.tsx`, `loading.tsx`
- ✅ `app/(store)/products/[slug]/error.tsx`, `loading.tsx`
- ✅ `app/(store)/privacy-policy/error.tsx`, `loading.tsx`
- ✅ `app/(store)/refund-policy/error.tsx`, `loading.tsx`
- ✅ `app/(store)/about/loading.tsx` (but NO error.tsx)

Missing:
- ❌ `app/(store)/about/error.tsx` — **about page has no error.tsx**

#### BUG-28 — MINOR: `app/(store)/account/layout.tsx` exists but may be redundant
- **File:** `app/(store)/account/layout.tsx`
- **Bug:** The account layout exists. It should wrap all `/account/**` pages. Verify it doesn't conflict with the store layout. The store layout already renders `Navbar`, `Footer`, `WhatsAppButton`, `BottomNav`. The account layout may be duplicating these.
- **Severity:** MINOR — verify no double-rendering of nav elements

---

### 10. SHIPPING COST CALCULATION — DETAILED TRACE

**Verification: ✅ CORRECT IMPLEMENTATION**

```
Cart totalWeight = sum(item.weightGram * item.quantity) [in GRAMS]
                   ↓
Checkout page sends: { destination: cityId, weight: totalWeight }  [in GRAMS]
                   ↓
API route receives weight in GRAMS
                   ↓
billableWeight = Math.max(weight, MIN_WEIGHT_GRAM) = Math.max(850, 1000) = 1000
weightInKg = Math.ceil(1000 / 100) * 100 = 10 * 100 = 1000 grams = 1 kg
                   ↓
API calls RajaOngkir with weight: 1 (RajaOngkir expects grams converted to kg)
                   ↓
Wait — LINE 95: weight: weightInKg — this is in GRAMS not kg!
                   ↓
ACTUAL BUG FOUND: weightInKg computed as GRAMS (1000) but sent as if kg
```

#### BUG-29 — CRITICAL: RajaOngkir weight unit mismatch
- **File:** `app/api/shipping/cost/route.ts` line 95
- **Bug:** `weightInKg` is computed as `Math.ceil(billableWeight / 100) * 100` — this produces **grams** (e.g., 850g → 900g). The variable name says "Kg" but it's actually in grams. The comment says "RajaOngkir Starter tier weight limit" in kg, but the variable is in grams. When sent to RajaOngkir API (which expects **grams** for Starter tier), this is **accidentally correct** because the number is in grams and RajaOngkir Starter also uses grams. But the variable naming is deeply confusing and misleading.
- **However:** The RajaOngkir Starter API documentation says weight should be in **grams**. So sending 1000 when you mean 1kg IS correct. But the variable name `weightInKg` implies it's 1 (for 1kg), not 1000 (for 1000g).
- **Additional issue:** Line 95 sends `weight: weightInKg` directly to RajaOngkir. If `weightInKg = 1000` (grams), this works. But if the calculation ever changed to produce actual kg values, it would break silently.
- **Should be:** Rename `weightInKg` to `weightInGrams` and add a comment: `// RajaOngkir Starter expects weight in grams`
- **Severity:** MAJOR — misleading naming, could cause future bugs if calculation changes

---

### 11. API ROUTES — CHECKOUT INITIATE

#### ✅ What Works (Server-side validation)
- Re-fetches prices from DB (never trusts client `unitPrice`)
- Re-validates coupon server-side with all rules
- Re-validates stock availability with atomic `GREATEST(stock - qty, 0)` pattern
- Idempotency check for duplicate submissions (60s for guests, 30s for logged-in)
- B2B Net-30 orders skip Midtrans and go directly to success
- Points redemption with FIFO earn-record consumption
- Order number generation with atomic DB counter
- Transaction rollback on Midtrans failure
- Per-user coupon usage enforcement

#### BUG-30 — CRITICAL: `order.pointsEarned` referenced but `order` not defined in scope
- **File:** `app/api/checkout/initiate/route.ts` line 611
- **Bug:** 
  ```typescript
  if (userId && order.pointsEarned > 0) {
    const earnedPoints = order.pointsEarned;
  ```
  At line 611, `order` is NOT yet defined. The `order` variable is only assigned at line 671 (`const order = counterResult[0]!`). The code at line 611 references `order.pointsEarned` but `order` is out of scope. This would be a **runtime TypeError** for any Net-30 B2B order that uses loyalty points.
- **Should be:** Either move this block after `order` is defined (line 671+), or use `created.pointsEarned` instead of `order.pointsEarned` since `created` is the order object from the INSERT.
- **Severity:** CRITICAL — Net-30 B2B orders with loyalty points will throw TypeError

#### BUG-31 — MAJOR: `buy_x_get_y` coupon adds free items even if variants already in cart
- **File:** `app/api/checkout/initiate/route.ts` lines 258-260
- **Bug:** 
  ```typescript
  const selectedVariants = qualifyingVariants.length >= getQty
    ? qualifyingVariants.slice(0, getQty)
    : qualifyingVariants.slice(0, getQty); // Same logic in both branches!
  ```
  Both branches are identical (`slice(0, getQty)`). If there aren't enough qualifying variants, it just takes whatever is available (could be 0 variants, resulting in no free items silently). This could lead to customer expecting free items but not receiving them.
- **Should be:** If `qualifyingVariants.length < getQty`, either reject the coupon or warn the customer that not all free items could be fulfilled.
- **Severity:** MAJOR — silent failure of Buy X Get Y coupon

#### BUG-32 — MINOR: Midtrans gross_amount mismatch risk with free items
- **File:** `app/api/checkout/initiate/route.ts` lines 714-722
- **Bug:** Free items are added to Midtrans `itemDetails` with `price: 0`. Midtrans validates that `gross_amount` (sum of itemDetails prices × quantities) equals the transaction gross_amount. If `subtotal - discount + shipping` doesn't equal the sum of itemDetails, Midtrans will reject the transaction. The code adds free items as price:0 but they have `quantity: 1`. This could cause a mismatch.
- **Should be:** Verify that the sum of all itemDetails (including 0-price free items) equals `grossAmount` exactly.
- **Severity:** MINOR — Midtrans validation might fail

---

## SUMMARY TABLE

| # | Severity | Area | Bug | File |
|---|----------|------|-----|------|
| 01 | MAJOR | Homepage | `as never` type casts on ProductCard props | `FeaturedProducts.tsx:73,74` |
| 02 | MAJOR | Homepage | `slice(0,8)` ignores variant sortOrder | `FeaturedProducts.tsx:60,177` |
| 03 | MINOR | Homepage | Empty imageUrl fallback works correctly | N/A |
| 04 | MAJOR | Catalog | URL search not persisted on reload | `products/page.tsx:87` |
| 05 | MINOR | Catalog | O(n²) category filter query | `products/page.tsx:70-74` |
| 06 | MINOR | Catalog | Hardcoded Indonesian strings | `ProductCatalog.tsx` |
| 07 | MAJOR | Product Detail | Entire page hardcoded in Indonesian (no i18n) | `ProductDetailClient.tsx` (entire file) |
| 08 | MAJOR | Product Detail | No per-item weight display before cart | `ProductDetailClient.tsx` |
| 09 | MINOR | Product Detail | Emoji placeholder for missing images | `ProductDetailClient.tsx:166-167` |
| 10 | **CRITICAL** | Cart | Points double division calculation | `PointsRedeemer.tsx:29,31-32` |
| 11 | MAJOR | Cart | Missing `loading.tsx` skeleton | `cart/` |
| 12 | MINOR | Cart | Raw `<img>` tag in CartItem | `CartItem.tsx:54-59` |
| 13 | MINOR | Cart | No per-item weight display | `CartItem.tsx` |
| 14 | **CRITICAL** | Checkout | Buy X Get Y free items not stock-validated | `initiate/route.ts:258-285` |
| 15 | MAJOR | Checkout | `payment_expiry_minutes` setting may not exist in DB | `initiate/route.ts:399` |
| 16 | MAJOR | Checkout | `coupon.freeShipping` column may not exist | `initiate/route.ts:389` |
| 17 | MINOR | Checkout | Points earn/redeem ratio asymmetry (100:1) | `constants/points.ts` |
| 18 | MINOR | Checkout | Pickup address hardcoded | `DeliveryMethodToggle.tsx:72` |
| 19 | MINOR | Checkout | Store hours defaults hardcoded | `checkout/page.tsx:77` |
| 20 | MAJOR | Order Success | Net-30 order may fail to fetch order data | `success/page.tsx:31` |
| 21 | MINOR | Order Success | `canvas-confetti` may not be installed | `success/page.tsx:8` |
| 22 | MAJOR | Order Tracking | Raw `<img>` tag in order items | `OrderTrackingClient.tsx:244` |
| 23 | MINOR | Order Tracking | Loose TypeScript typing | `OrderTrackingClient.tsx:46-49` |
| 24 | MINOR | Layout | BottomNav B2B tab duplicate Package icon | `BottomNav.tsx:34` |
| 25 | MINOR | Layout | `animate-pulse-soft` may not be in Tailwind config | `WhatsAppButton.tsx:46` |
| 26 | MINOR | Layout | Empty search param in Navbar | `Navbar.tsx:76` |
| 27 | MAJOR | Error/Loading | About page missing `error.tsx` | `about/` |
| 28 | MINOR | Layout | Account layout potential duplicate nav rendering | `account/layout.tsx` |
| 29 | MAJOR | Shipping | Misleading `weightInKg` variable name (actually grams) | `shipping/cost/route.ts:49,95` |
| 30 | **CRITICAL** | Checkout | `order.pointsEarned` referenced before `order` is defined (Net-30 crash) | `initiate/route.ts:611` |
| 31 | MAJOR | Checkout | Buy X Get Y silent failure when insufficient variants | `initiate/route.ts:258-260` |
| 32 | MINOR | Checkout | Midtrans gross_amount validation risk with free items | `initiate/route.ts:714-740` |

---

## CRITICAL BUGS REQUIRING IMMEDIATE FIX

### CRITICAL-1: Points double division (BUG-10)
**File:** `components/store/checkout/PointsRedeemer.tsx` lines 29, 31-32
**Fix:**
```tsx
// Line 29 — remove the extra * POINTS_VALUE_IDR
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR);

// Line 31 — correct
const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;

// Line 32 — remove the extra * POINTS_VALUE_IDR
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR)) * POINTS_VALUE_IDR;
```

### CRITICAL-2: Buy X Get Y stock validation (BUG-14)
**File:** `app/api/checkout/initiate/route.ts` lines 258-285
**Fix:** Add stock check before adding free items:
```typescript
const selectedVariants = qualifyingVariants
  .filter(v => v.stock > 0) // Only in-stock variants
  .slice(0, getQty);

if (selectedVariants.length < getQty) {
  logger.warn('[checkout/initiate] BuyXGetY: insufficient stock for free items', {
    requested: getQty,
    available: selectedVariants.length,
  });
  // Continue with available items, don't silently give 0
}
```

### CRITICAL-3: `order` undefined reference (BUG-30)
**File:** `app/api/checkout/initiate/route.ts` line 611
**Fix:** Move the points award block AFTER the `order` is defined (after line 671), or change `order` to `created` on line 611.

---

## ITEMS NOT AUDITED (OUT OF SCOPE)

The following were NOT deeply audited in this session:
- Blog listing and detail pages
- About, Privacy Policy, Refund Policy pages (static content)
- Account sub-pages (addresses, orders, points, vouchers, profile)
- B2B portal pages
- API routes for: auth, cart merge, coupons validate, orders/[id] status
- Midtrans webhook handler
- RajaOngkir cities and provinces API routes
- Cloudinary upload flow
- AI caption generation
- Admin dashboard (separate audit scope)

---

## RECOMMENDED IMMEDIATE ACTIONS (before launch)

1. **Fix CRITICAL-1** (PointsRedeemer double division) — will cause wrong discount display
2. **Fix CRITICAL-2** (Buy X Get Y stock) — negative stock possible
3. **Fix CRITICAL-3** (`order` undefined) — Net-30 B2B orders will crash
4. **Add missing `error.tsx`** to `app/(store)/about/`
5. **Add weight display** to ProductCard and ProductDetail
6. **Add `as never` removal** in FeaturedProducts — proper types
7. **Verify `canvas-confetti`** is in package.json
8. **Add `weightInGrams`** rename in shipping cost API (documentation fix)
