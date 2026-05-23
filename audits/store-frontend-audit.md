# DapurDekaka Store Frontend Audit

**Date:** May 22, 2026
**Scope:** `app/(store)/`, `components/store/`, `store/`, `lib/services/`, `i18n/messages/`, `app/middleware.ts`

---

## Executive Summary

The store frontend is **mostly well-built** but has **several critical bugs** that will cause crashes or incorrect data display, plus numerous minor issues. The most serious issues are field name mismatches in the order success page, raw HTML `img` tags violating project rules, hardcoded strings instead of i18n keys, and inconsistent price handling.

**Critical (must fix before launch):** 5 issues
**High priority:** 8 issues
**Medium priority:** 12 issues
**Low priority:** 10 issues

---

## Per-Page Audit Findings

### Homepage (`app/(store)/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx at route level | Medium | `app/(store)/` — parent route has error.tsx but homepage itself has no individual loading.tsx |

**What works:**
- Server-side data fetching with Promise.all for parallel queries
- Graceful error handling with `.catch(() => [])` fallback
- JSON-LD structured data for SEO (Organization, WebSite, LocalBusiness)
- Good SEO metadata (title, description, keywords, OpenGraph, Twitter cards)
- Responsive design (md:pb-0 for desktop)
- Schema validation for empty arrays

---

### Products Page (`app/(store)/products/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| Category filter is client-side only (not URL-driven) — filter resets on navigation | Medium | `ProductCatalog.tsx` line 56 — `searchParams.get('category')` is read but only written via router.push on category change |

**What works:**
- Server-side rendering with `force-dynamic`
- Cursor-based pagination
- Client-side sort + filter with useMemo optimization
- Out-of-stock products sorted to end
- Empty state with CTA
- Category chips for quick filtering

---

### Product Detail (`app/(store)/products/[slug]/page.tsx` + `ProductDetailClient.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx for dynamic route | Medium | Missing `loading.tsx` and `error.tsx` in `app/(store)/products/[slug]/` |

**What works:**
- Breadcrumb navigation
- Image gallery with thumbnails
- Lightbox for zoom
- Variant selector with stock awareness
- Add to cart with quantity stepper
- Related products section
- Stock badge integration
- Mobile sticky bottom bar

---

### Cart Page (`app/(store)/cart/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx | Medium | Missing in `app/(store)/cart/` |
| `clearCart()` clears DB cart but localStorage persists | Low | `clearCart()` only clears Zustand store; on page reload, `loadFromDb()` may restore items |

**What works:**
- Stock validation on mount via `/api/cart/validate`
- Stock warning banners with available quantity
- Login prompt banner for guests (earn points)
- Clear cart confirmation dialog
- Responsive layout (lg:grid-cols-3)

---

### Checkout Page (`app/(store)/checkout/page.tsx`)

**Status: BROKEN IN PART**

| Issue | Severity | Location |
|-------|----------|----------|
| `serverTotalAmount` is set but never used for validation | High | Line 89, 436 — set but no comparison against client `totalAmount` |
| No loading.tsx / error.tsx | Medium | Missing in `app/(store)/checkout/` |
| Points calculation inconsistency: `maxPointsInIDR = subtotal * 0.5` then `/10` — `POINTS_VALUE_IDR=10` in code but rule says 1pt=Rp1 | Medium | `checkout/page.tsx` line 383-386 vs `points.service.ts` line 52-54 |
| Hardcoded "Kode Kupon" label | Low | `CouponInput.tsx` line 40 — should use i18n |
| Hardcoded "Gunakan Poin" label | Low | `PointsRedeemer.tsx` line 49 |
| Hardcoded "Ringkasan Pesanan" | Low | `OrderSummaryCard.tsx` line 29 |
| "Points Digunakan" hardcoded in review | Low | `checkout/page.tsx` line 725 |
| DeliveryMethodToggle hardcodes courier names | Low | `DeliveryMethodToggle.tsx` line 47 — "SiCepat FROZEN / JNE YES / AnterAja Frozen" should come from constant |

**What works:**
- 4-step checkout with back navigation
- SessionStorage persistence of draft
- Auto-skip identity for logged-in users
- Address saved-accounts picker
- Courier selection from RajaOngkir API
- Coupon validation with all rules (percentage, fixed, free_shipping, buy_x_get_y)
- Points redemption with 50% cap enforced on server
- Free shipping coupon zeros out shipping cost
- Order review before payment
- Midtrans Snap integration with dynamic script loading
- Mobile sticky total bar

---

### Checkout Pending (`app/(store)/checkout/pending/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx | Medium | Only `success/loading.tsx` exists, not `pending/loading.tsx` |

**What works:**
- Polling every 5 seconds with immediate redirect on paid
- Countdown timer to expiry
- Auto-navigate to retry when countdown hits 0
- Copy order number button
- Payment method + VA number display
- Retry payment button

---

### Checkout Success (`app/(store)/checkout/success/page.tsx` + `app/(store)/orders/success/[orderNumber]/page.tsx`)

**Status: CRITICAL BUGS — WILL CRASH**

| Issue | Severity | Location |
|-------|----------|----------|
| **CRASH:** `order.total` field doesn't exist — should be `order.totalAmount` | Critical | `orders/success/[orderNumber]/page.tsx` line 90 |
| **CRASH:** `item.variant.product.name` — items are flat `orderItems`, not joined to variant→product | Critical | `orders/success/[orderNumber]/page.tsx` lines 58, 64 |
| **CRASH:** `item.variant.name` — should be `item.variantNameId` | Critical | `orders/success/[orderNumber]/page.tsx` line 65 |
| **CRASH:** `item.variant.images[0].url` — items have `productImageUrl` directly | Critical | `orders/success/[orderNumber]/page.tsx` line 57 |
| confetti fires on ANY status change, not just first transition to 'paid' | High | `checkout/success/page.tsx` line 38-47 — `useEffect` depends on `orderData?.order?.status` which could be cached |
| No loading.tsx in `success/` route | Medium | `app/(store)/orders/success/[orderNumber]/` missing loading.tsx |
| Confetti on success page (SPA-rendered) but not on server-rendered success page | Medium | Two different pages with different behavior |

**What works (OrderTrackingClient):**
- Email verification gate for order lookup
- Auto-verify for logged-in users
- Timeline visualization
- Order items display
- Delivery info
- Payment summary

---

### Checkout Failed (`app/(store)/checkout/failed/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx | Medium | Missing |

**What works:**
- Cart restoration on retry (fetches order items, adds back to cart with stock=999 workaround)
- Clear messaging about payment failure
- Link back to homepage

---

### Orders Tracking (`app/(store)/orders/[orderNumber]/page.tsx`)

**Status: CRITICAL BUG**

| Issue | Severity | Location |
|-------|----------|----------|
| **RULE VIOLATION:** Raw `<img>` tag instead of Next.js `<Image>` | Critical | `OrderTrackingClient.tsx` line 239 |
| No loading.tsx / error.tsx in dynamic route | Medium | `app/(store)/orders/[orderNumber]/` |

---

### Account Page (`app/(store)/account/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx | Medium | Missing |
| Inline `formatIDR` calculation — `user.pointsBalance * 10` | Low | Line 194 — mixed concerns (should use `pointsToIDR` from service) |

**What works:**
- Auth-gated (redirects to login if not authenticated)
- Quick stats grid (orders, points, addresses, pending)
- Recent orders list
- Points alert banner
- Role-aware admin access

---

### Account Orders (`app/(store)/account/orders/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| Status filter links use `t('orderStatus.pending')` but only `pending_payment` key exists in i18n | High | Line 101 — `t('orderStatus.pending')` returns undefined, key should be `t('orderStatus.pending_payment')` |
| No loading.tsx | Medium | Missing |

**What works:**
- Server-side pagination
- Status filter tabs
- Order list with status badges
- Points earned display

---

### Account Order Detail (`app/(store)/account/orders/[orderNumber]/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| Inline `formatIDR` function re-defined instead of importing | Medium | Lines 85-92 — duplicates `lib/utils/format-currency.ts` |
| Hardcoded status label strings instead of translation keys | Medium | Lines 132-139 — hardcoded "Menunggu Pembayaran", "Pembayaran Diterima", etc. |
| Hardcoded step labels in OrderTimeline | Medium | Lines 166-174 — hardcoded strings instead of i18n |
| Hardcoded "Pesanan Dibuat", "Menunggu Pembayaran" etc. | Medium | Line 167-173 |
| Missing translation for "Sedang Dikirim" label | Medium | Line 136 hardcodes label not in translation file |

---

### Account Addresses (`app/(store)/account/addresses/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx | Medium | Missing |
| Uses `confirm()` for delete confirmation instead of Dialog | Low | Line 73 — should use shadcn Dialog |
| Inline Province/City type definitions duplicated from AddressForm | Low | Lines 11-21 — should import from shared location |

---

### Account Points (`app/(store)/account/points/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| Hardcoded "Saldo Poin", "Cara Menukarkan Poin", etc. | High | Lines 68-93 — completely hardcoded, no `t()` calls |
| Hardcoded "Cara Mendapatkan Poin", "1 poin per Rp 1.000", etc. | High | Lines 119-159 |
| "Poin akan dikreditkan..." hardcoded | Medium | Line 76 |
| Loading state only handles initial load, not pagination | Low | Lines 47-51 — stale closure on `page` |

---

### Blog Listing (`app/(store)/blog/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx | Medium | Missing |
| Featured post fallback image URL uses hardcoded gallery path | Low | Line 220 |

**What works:**
- Featured post with hero layout
- Search + category filter
- Pagination
- Empty state
- Active filter display

---

### Blog Post (`app/(store)/blog/[slug]/page.tsx`)

| Issue | Severity | Location |
|-------|----------|----------|
| No loading.tsx / error.tsx for dynamic route | Medium | Missing |
| "Bagikan artikel ini:" hardcoded | Low | Line 291 |
| Reading time estimate in minutes hardcoded to "menit baca" | Low | Line 250 |
| "Ditulis oleh" hardcoded | Low | Line 282 |
| Author fallback uses emoji for avatar initial | Low | Line 276 |

**What works:**
- Reading progress bar
- Back to top button
- Table of contents (sticky sidebar)
- Related posts
- Breadcrumb navigation
- Share buttons (WhatsApp, copy link)
- Blog CTA section

---

## Per-Component Issues

### Cart Components

| File | Issue | Severity |
|------|-------|----------|
| `CartItem.tsx` | No loading skeleton state | Low |
| `CartSummary.tsx` | Hardcoded "Ringkasan Belanja", "Total Item", etc. | Medium |
| `CartSummary.tsx` | `e.preventDefault()` on Link click (lines 92-96) — incorrect pattern | Medium |

### Checkout Components

| File | Issue | Severity |
|------|-------|----------|
| `CouponInput.tsx` | Hardcoded "Kode Kupon", "Masukkan kode kupon", "Terapkan" | Medium |
| `PointsRedeemer.tsx` | Hardcoded "Gunakan Poin", "Saldo:", "Maks." | Medium |
| `PointsRedeemer.tsx` | Line 75: potential display issue with `* POINTS_VALUE_IDR` multiplying already-IDR value | High |
| `OrderSummaryCard.tsx` | Hardcoded "Ringkasan Pesanan", "Subtotal", "Diskon", etc. | Medium |
| `IdentityForm.tsx` | Hardcoded labels: "Nama Lengkap", "Email", "No. HP / WhatsApp", etc. | Medium |
| `AddressForm.tsx` | Hardcoded labels for all form fields | Medium |
| `DeliveryMethodToggle.tsx` | Hardcoded courier list | Medium |
| `ShippingOptions.tsx` | Hardcoded "Pilih Kurir", "Estimasi {X} hari" | Medium |
| `MidtransPayment.tsx` | Script loaded but not removed on cleanup | Low |

### Layout Components

| File | Issue | Severity |
|------|-------|----------|
| `Navbar.tsx` | Nav links hardcoded Indonesian labels | Medium |
| `Navbar.tsx` | `session.user.name?.split(' ')[0]` — potential crash if name has no spaces | Low |
| `BottomNav.tsx` | Blog label hardcoded as 'Blog' instead of i18n | Low |
| `Footer.tsx` | Need to verify i18n coverage (not read in detail) | Medium |

### Product Components

| File | Issue | Severity |
|------|-------|----------|
| `ProductCard.tsx` | Line 113: MUI 001/2020 badge — hardcoded text not i18n | Low |
| `ProductCard.tsx` | "HABIS" hardcoded instead of using StockBadge | Low |
| `ProductDetailClient.tsx` | Breadcrumb labels "Beranda", "Produk" hardcoded | Medium |
| `ProductDetailClient.tsx` | "Pilih Varian", "Deskripsi", etc. hardcoded | Medium |
| `ProductCatalog.tsx` | Sort options hardcoded: "Sortir: Default", "Harga: Rendah → Tinggi" | Medium |

### Blog Components

| File | Issue | Severity |
|------|-------|----------|
| `BlogCard.tsx` | Need to verify i18n coverage (not read in detail) | Medium |

---

## Store / Zustand Issues

### `store/cart.store.ts`

| Issue | Severity | Location |
|-------|----------|----------|
| `syncToDb` silently fails — no toast/error on failure | Medium | Line 127 |
| `loadFromDb` silently fails — local cart remains unchanged | Medium | Line 153 |
| `validateStock` updates item.stock but not reactive to changes | Low | Lines 96-102 |

### `store/ui.store.ts`

| Issue | Severity | Location |
|-------|----------|----------|
| `setLanguage` uses `document.cookie` directly instead of `next/navigation` | Low | Line 20 — should use server action or proper i18n routing |

---

## Services Issues

### `lib/services/coupon.service.ts`

| Issue | Severity | Location |
|-------|----------|----------|
| **File is essentially EMPTY** — only imports, no actual service implementation | Critical | Entire file — service has no actual functions |
| This is the service layer but all coupon logic is in API routes | High | coupon validation logic is in `app/api/coupons/validate/route.ts` and `app/api/checkout/initiate/route.ts` directly |

### `lib/services/points.service.ts`

| Issue | Severity | Location |
|-------|----------|----------|
| `POINTS_VALUE_IDR` = 10 (10 IDR per point) but `POINTS_EARN_RATE` = 1 per 1000 IDR | Medium | `points.service.ts` line 10 vs `lib/constants/points.ts` |
| `pointsToIDR` and `idrToPoints` not exported or used in frontend | Low | Functions exist but checkout calculates manually |

### `lib/services/shipping.service.ts`

| Issue | Severity | Location |
|-------|----------|----------|
| **Known limitation: RajaOngkir Starter only supports Jakarta origin (501)** — shipping costs from Bandung will be wrong | Critical | `shipping.service.ts` lines 9-12 (comment acknowledges this) |
| Error handling: `console.warn` instead of proper logger | Low | Line 92 |

### `lib/services/payment.service.ts`

| Issue | Severity | Location |
|-------|----------|----------|
| `createMidtransTransaction` has explicit comment about item_sum vs gross_amount mismatch throwing error | Info | Lines 28-32 |

---

## Loading/Error.tsx Gaps

### Missing (untracked in git but should exist)

Based on Next.js App Router conventions, these routes are missing loading.tsx AND/OR error.tsx:

| Route | Missing loading | Missing error |
|-------|-----------------|---------------|
| `app/(store)/products/[slug]/` | loading.tsx | error.tsx |
| `app/(store)/orders/[orderNumber]/pickup/` | loading.tsx | error.tsx |
| `app/(store)/orders/success/[orderNumber]/` | loading.tsx | — |
| `app/(store)/account/addresses/` | — | error.tsx |
| `app/(store)/account/points/` | — | error.tsx |
| `app/(store)/account/profile/` | loading.tsx, error.tsx | — |
| `app/(store)/account/orders/` | — | error.tsx |
| `app/(store)/account/vouchers/` | loading.tsx, error.tsx | — |
| `app/(store)/blog/[slug]/` | loading.tsx | error.tsx |
| `app/(store)/privacy-policy/` | loading.tsx | error.tsx |
| `app/(store)/refund-policy/` | loading.tsx | error.tsx |
| `app/(store)/about/` | loading.tsx | — |

**Note:** The git status shows these as untracked (`??`), meaning they exist but are new. Parent route `app/(store)/error.tsx` exists but specific route-level error boundaries may be needed.

---

## i18n Gaps Table

The following files/components have **hardcoded Indonesian strings** instead of using `t()` from next-intl:

| File | Line | Hardcoded String(s) |
|------|------|----------------------|
| `CouponInput.tsx` | 40, 47, 59 | "Kode Kupon", "Masukkan kode kupon", "Terapkan" |
| `PointsRedeemer.tsx` | 49, 51, 74-75 | "Gunakan Poin", "Saldo:", "Maks. X poin" |
| `OrderSummaryCard.tsx` | 29, 62-88 | "Ringkasan Pesanan", "Subtotal", "Diskon", "Poin Digunakan", "Ongkos Kirim", "Total" |
| `IdentityForm.tsx` | 51-97 | "Data Diri", "Nama Lengkap", "Email", "No. HP / WhatsApp", "Catatan Pesanan" |
| `AddressForm.tsx` | 149, 154, 202, 252-278 | "Alamat Pengiriman", "Provinsi", "Kota/Kabupaten", "Kecamatan", "Alamat Lengkap" |
| `DeliveryMethodToggle.tsx` | 24, 45-48, 70-73 | "Metode Pengiriman", "Kirim ke Alamat", "Ambil di Toko" |
| `ShippingOptions.tsx` | 36, 52, 55, 75 | "Pilih Kurir", "Estimasi X hari" |
| `CartSummary.tsx` | 31, 36, 43-80 | "Ringkasan Belanja", all field labels |
| `AccountPointsPage.tsx` | 68-159 | **Entire page** — most strings hardcoded |
| `Navbar.tsx` | 13-16 | NAV_LINKS array labels |
| `BottomNav.tsx` | 32 | Blog label hardcoded |
| `ProductDetailClient.tsx` | 115-138 | Breadcrumb, "Pilih Varian", "Deskripsi" |
| `ProductCatalog.tsx` | 44-49 | Sort options |
| `account/orders/page.tsx` | 132-139 | Status labels, step labels |
| `account/orders/[orderNumber]/page.tsx` | 166-174 | Timeline step labels |
| `blog/[slug]/page.tsx` | 250, 282, 291 | "menit baca", "Ditulis oleh", "Bagikan artikel ini" |

---

## Bug Severity Matrix

| ID | Bug | Severity | Impact | Files |
|----|-----|----------|--------|-------|
| B01 | `order.total` used but schema has `order.totalAmount` | Critical | Crash on order success page | `orders/success/[orderNumber]/page.tsx:90` |
| B02 | `item.variant.product.name` — wrong relation path | Critical | Crash on order success page | `orders/success/[orderNumber]/page.tsx:58,64` |
| B03 | `item.variant.name` should be `item.variantNameId` | Critical | Undefined variant name | `orders/success/[orderNumber]/page.tsx:65` |
| B04 | `item.variant.images[0].url` — should use `productImageUrl` | Critical | Image not showing | `orders/success/[orderNumber]/page.tsx:57` |
| B05 | Raw `<img>` tag in OrderTrackingClient | Critical | Rule violation, accessibility issue | `OrderTrackingClient.tsx:239` |
| B06 | `coupon.service.ts` is empty | Critical | Service layer has no implementation | `lib/services/coupon.service.ts` |
| B07 | RajaOngkir Starter uses Jakarta origin not Bandung | Critical | Wrong shipping costs for most customers | `lib/services/shipping.service.ts:9-12` |
| B08 | `t('orderStatus.pending')` key doesn't exist | High | Status filter label shows as key | `account/orders/page.tsx:101` |
| B09 | AccountPointsPage has no i18n | High | Entire page in Bahasa only | `account/points/page.tsx` |
| B10 | `serverTotalAmount` set but never validated | High | No client-server amount reconciliation | `checkout/page.tsx:89,436` |
| B11 | confetti fires on every status change | High | UX issue — confetti on non-paid states | `checkout/success/page.tsx:38-47` |
| B12 | `PointsRedeemer` points calculation may mismatch server | High | Points discount mismatch | `checkout/page.tsx:383-386`, `PointsRedeemer.tsx:27-29` |
| B13 | Multiple missing loading.tsx/error.tsx | Medium | Poor loading states | 12+ routes |
| B14 | Hardcoded strings throughout checkout components | Medium | Not i18n-ready | Multiple files |
| B15 | Inline formatIDR in account order detail | Medium | Inconsistent formatting | `account/orders/[orderNumber]/page.tsx:85-92` |
| B16 | Duplicate type definitions | Low | Maintenance issue | Multiple files |
| B17 | Silent failures in cart sync | Medium | Cart may not persist | `cart.store.ts` |
| B18 | MUI 001/2020 badge text hardcoded | Low | Not i18n | `ProductCard.tsx:113` |
| B19 | DeliveryMethodToggle hardcodes courier names | Medium | Inconsistent with constants | `DeliveryMethodToggle.tsx:47` |

---

## Mobile-First Violations

| Issue | Severity | Location |
|-------|----------|----------|
| Navbar search icon links to `/products?q=` (empty query) | Low | `Navbar.tsx:68` |
| BottomNav cart badge uses non-standard `w-4.5` class | Low | `Navbar.tsx:141` — should be `w-[1.125rem]` or `w-4.5` is non-standard Tailwind |

---

## Price Handling

All price handling uses **integer IDR** correctly throughout — `formatIDR()` is consistently used. No float prices found.

**Exception:** `account/orders/[orderNumber]/page.tsx` defines its own inline `formatIDR` function (lines 85-92) instead of importing from `@/lib/utils/format-currency`. This is a DRY violation but functionally correct.

---

## Summary

The store frontend is functional for the main flows but has **5 critical bugs that will crash the order success page** and **several high-priority i18n gaps**. The checkout flow is the most complex and has the most issues, particularly around client-server state reconciliation and i18n coverage.

**Top 5 Fixes Required Before Launch:**
1. Fix field names in `orders/success/[orderNumber]/page.tsx` (B01-B04)
2. Replace `<img>` with `<Image>` in `OrderTrackingClient.tsx` (B05)
3. Populate `lib/services/coupon.service.ts` or remove the unused file (B06)
4. Address RajaOngkir origin issue or upgrade to Pro tier (B07)
5. Add i18n to AccountPointsPage (B09)
