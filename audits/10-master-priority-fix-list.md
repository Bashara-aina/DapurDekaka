# AUDIT 10 — Master Priority Fix List: All Issues Ranked by Severity

**Project:** DapurDekaka.com
**Date:** May 24, 2026
**Total Issues Found:** 67 across 10 audit areas
**Use this file as the master checklist for Cursor to fix everything**

---

## HOW TO USE THIS FILE

For each issue below:
1. Find the file path and line/context
2. Use Cursor to open the file
3. Apply the fix described
4. Mark as done in this document

Issues are grouped by severity. Fix in order.

---

## 🔴 CRITICAL — Fix Immediately (5 NEW issues from deep-dive agents)

### CR1: Price Tampering — Midtrans item_details Uses Client Price
**File:** `app/api/checkout/initiate/route.ts` line ~704
**Problem:** `item_details` sent to Midtrans uses `item.unitPrice` from client payload, not the server-fetched price. Could allow underpaying if price changes between cart and checkout.
**Fix:** Use the `unitPrice` variable from the server-side loop (line 152), not `item.unitPrice` from client.

---

### CR2: Only 3 of 5 Couriers Implemented (J&T + Rex Missing)
**File:** `lib/constants/couriers.ts`
**Problem:** `ALLOWED_COURIERS` has only sicepat, jne, anteraja — missing J&T and Rex per master rules.
**Fix:** Add `{ id: 'jnt', name: 'J&T', service: 'FROZEN' }` and `{ id: 'rex', name: 'Rex', service: 'FROZEN' }`. Update `api/shipping/cost/route.ts` to query all 5.

---

### CR3: Admin Layout Has No Server-Side Auth Check
**File:** `app/(admin)/admin/layout.tsx`
**Problem:** No server-side session check — anyone authenticated sees brief flash of admin UI before client redirect fires.
**Fix:** Add `const session = await auth()` + `redirect('/login')` if no session. Check role server-side before rendering.

---

### CR4: Users Page — Client-Side Role Only (Role Elevation Risk)
**File:** `app/(admin)/admin/users/UsersClient.tsx`
**Problem:** (1) Role dropdown includes superadmin — can be changed via inspect element. (2) Server API has no role check on role update — warehouse can elevate themselves. (3) Password shown in plaintext toast.
**Fix:** Remove superadmin from dropdown. Add server-side role check to role update API. Never show password in toast.

---

### CR5: Bulk Products — Any Action Accepted + Hard Delete
**File:** `app/api/admin/products/bulk/route.ts`
**Problem:** Invalid `action` strings silently do nothing. `DELETE` hard deletes instead of soft deleting.
**Fix:** Validate action against `['enable', 'disable', 'archive']` + return error for unknown. Replace hard delete with `deletedAt` soft delete.

---

### CR6: ProductForm Allows Rp 0 Price
**File:** `components/admin/products/ProductForm.tsx`
**Problem:** No minimum price validation — product could be created with Rp 0 price.
**Fix:** Add `z.number().int().min(1000, 'Harga minimal Rp 1.000')` to price Zod schema.

---

## 🟠 HIGH — Fix Before Launch (17 issues)

### H1: Rate Limiting Disabled in Production
**File:** `lib/utils/rate-limit.ts`
**Problem:** If Upstash Redis is not configured in production, rate limiting silently returns without enforcing limits. No crash, no failure signal.
**Fix:**
```typescript
// Add startup validation — throw if Upstash not configured in production
if (process.env.NODE_ENV === 'production' && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)) {
  throw new Error('Rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production');
}
```
**Also:** Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to production environment variables in Vercel.

---

### H2: Coupon Validation Missing Rules 8 & 9
**File:** `app/api/checkout/validate-coupon/route.ts`
**Problem:** Rules for `applicable_product_ids` and `applicable_category_ids` are NOT checked. A coupon restricted to "Dimsum Crabstick" can be applied to an order with only "Lumpia".
**Fix:** Copy the implementation from `app/api/coupons/validate/route.ts` lines 99-127 which already does this correctly. Specifically:
1. Add `applicableProductIds` check (lines 99-110 in coupons/validate route)
2. Add `applicableCategoryIds` check (lines 113-127 in coupons/validate route)

---

### H3: No Rate Limit on validate-coupon Route
**File:** `app/api/checkout/validate-coupon/route.ts`
**Problem:** No `withRateLimit` wrapper — coupon codes can be enumerated/brute-forced at high speed.
**Fix:** Add `withRateLimit` wrapper:
```typescript
const { rateLimit, handler } = withRateLimit({
  max: 10,
  window: '60 s',
});

export const POST = rateLimit(handler, async (req) => { /* ... */ });
```

---

### H4: Hardcoded WhatsApp Number in ProductCard
**File:** `components/store/products/ProductCard.tsx` line ~75
**Problem:** WhatsApp URL uses hardcoded `62812xxxxxxxx` instead of `NEXT_PUBLIC_WHATSAPP_NUMBER` env var.
**Fix:** Replace hardcoded number with `process.env.NEXT_PUBLIC_WHATSAPP_NUMBER`

---

### H5: Blog Page All Strings Hardcoded (not using next-intl)
**File:** `app/(store)/blog/page.tsx`
**Problem:** ~8 hardcoded strings: 'Blog' heading, 'Artikel dan tips...', 'Semua', 'Pencarian:', 'Kategori:', pagination strings.
**Fix:** Wrap all strings in `t('blog.keyName')` using a `blog` namespace. Add these keys to `i18n/messages/id.json`:
```json
"blog": {
  "title": "Blog",
  "description": "Artikel dan tips memasak...",
  "all": "Semua",
  "search": "Pencarian:",
  "category": "Kategori:",
  "previous": "← Sebelumnya",
  "next": "Selanjutnya →",
  "pageOf": "Halaman {current} dari {total}"
}
```

---

### H6: HeroCarousel Fallback Hardcoded (shows when DB is empty)
**File:** `components/store/home/HeroCarousel.tsx` lines 55-67
**Problem:** When no carousel slides exist (likely in production CMS), fallback shows hardcoded Indonesian strings.
**Fix:** All fallback strings must use next-intl:
```tsx
title={slides.length === 0 ? t('hero.fallback.title') : slides[currentIndex].title}
subtitle={slides.length === 0 ? t('hero.fallback.subtitle') : slides[currentIndex].subtitle}
ctaText={slides.length === 0 ? t('hero.fallback.cta') : slides[currentIndex].ctaText}
```
Add to `i18n/messages/id.json`:
```json
"hero": {
  "fallback": {
    "title": "Cita Rasa Warisan, Kini di Rumahmu",
    "subtitle": "Dimsum, siomay, bakso, lumpia — 100% halal, dikirim segar ke seluruh Indonesia",
    "cta": "Lihat Produk"
  }
}
```

---

### H7: WhyDapurDekaka Entire Features Array Hardcoded
**File:** `components/store/home/WhyDapurDekaka.tsx` lines 6-50
**Problem:** The entire `features` array (6 items) plus the section heading 'Kenapa Dapur Dekaka?' are all hardcoded Indonesian strings.
**Fix:**
1. Add to `id.json`:
```json
"why": {
  "title": "Kenapa Dapur Dekaka?",
  "features": [
    { "icon": "shield-check", "title": "100% Halal", "desc": "Sertifikat MUI & halalan" },
    { "icon": "snowflake", "title": "Dikemas Frozen Fresh", "desc": "Dikirim dengan cold chain" },
    { "icon": "truck", "title": "Kirim ke Seluruh Indonesia", "desc": "Pengiriman cepat & aman" },
    { "icon": "award", "title": "Bersertifikat", "desc": "Standar food safety" },
    { "icon": "star", "title": "Kualitas Terjaga", "desc": "Bahan pilihan premium" },
    { "icon": "heart", "title": "Dari Bandung dengan Cinta", "desc": "Resep warisan keluarga" }
  ]
}
```
2. In WhyDapurDekaka.tsx, replace hardcoded array with:
```tsx
const features = t('why.features', { returnObjects: true }) as Array<{icon: string; title: string; desc: string}>;
```
3. Replace emoji icons with Lucide icons matching the `icon` key

---

### H8: EmptyCart All Strings Hardcoded
**File:** `components/store/cart/EmptyCart.tsx`
**Problem:** 'Keranjangmu masih kosong', 'Yuk, temukan dimsum favoritmu!', 'Mulai Belanja' are all hardcoded.
**Fix:** Pass these as props to the `EmptyState` component with translation keys from `id.json`:
```json
"emptyCart": {
  "title": "Keranjangmu masih kosong",
  "description": "Yuk, temukan dimsum favoritmu!",
  "cta": "Mulai Belanja"
}
```

---

### H9: Missing Soft Delete Cascade — Product Variants
**File:** `lib/db/schema.ts` — products + product_variants relation
**Problem:** Soft-deleting a product does NOT hide its variants. Queries joining products with variants must always filter `products.deleted_at IS NULL` manually.
**Fix:** Document in code comments and ensure ALL query paths filter soft-deleted records. Create a tracking checklist of all query paths that must filter `deleted_at IS NULL`.

---

### H10: Missing Soft Delete Cascade — Categories → Products
**File:** `lib/db/schema.ts` — categories + products relation
**Problem:** Soft-deleting a category leaves orphaned `categoryId` references on products.
**Fix:** Same as H9 — document and track all query paths that must filter categories with `deleted_at IS NULL` before joining.

---

### H11: Warehouse Role Access to Order Details
**File:** `app/middleware.ts` lines 40+
**Problem:** Warehouse role can access `/admin/orders/[id]` which exposes all order data including item names, prices, customer PII.
**Fix:** Either:
1. Restrict warehouse to only `/admin/inventory` and `/admin/shipments` (not `/admin/orders/*`)
2. Or implement city-based filtering where warehouse only sees orders for their assigned city

---

### H12: Checkout Page Exceeds 300-Line Limit
**File:** `app/(store)/checkout/page.tsx`
**Problem:** File is 845 lines — 2.8x over the project rule maximum.
**Fix:** Split into these sub-components:
- `PaymentStep.tsx` — Midtrans Snap handling
- `ReviewCollapsible.tsx` — Collapsible order summary
- `PickupInfoPanel.tsx` — Self-pickup flow
- `CheckoutAddressStep.tsx` — Address form step
- `CheckoutCouponStep.tsx` — Coupon + points step

---

### H13: Product Listing Client-Side Category Filtering
**File:** `app/(store)/products/page.tsx`
**Problem:** All products are fetched server-side regardless of selected category; filtering happens client-side with `useMemo`. With many products, this causes performance issues.
**Fix:** Move the category filter to the server-side Drizzle query:
```typescript
// In the server component, filter by category
const conditions = [eq(products.isActive, true)];
if (categorySlug) {
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, categorySlug),
  });
  if (category) conditions.push(eq(products.categoryId, category.id));
}
```

---

### H14: blog/page.tsx — Hardcoded Heading + All Pagination Strings
**File:** `app/(store)/blog/page.tsx` lines ~125-210
**Problem:** 'Blog' heading hardcoded; all pagination helper strings hardcoded.
**Fix:** See H5 for full fix. Add keys to `id.json` and use `t('blog.key')` throughout.

---

### H15: Missing Translation Keys — ~20 keys referenced but not in id.json/en.json
**Files:** Multiple — see Audit 07 for full list
**Problem:** The following keys are referenced in components but DO NOT exist in `i18n/messages/id.json`:
- `productsNotFound`, `productsNotFoundDesc`, `showAllProducts` (ProductCatalog.tsx)
- `stockHabis`, `stockTersisa` (StockBadge.tsx)
- `increaseQuantity` (CartItem.tsx)
- `allCategory` (CategoryChips.tsx, ProductFilters.tsx)
- `promo.badge`, `promo.cta` (PromoBanner.tsx)
- `why.title`, `why.features` (WhyDapurDekaka.tsx)
- `hero.fallback.*` (HeroCarousel.tsx)
- `emptyCart.*` (EmptyCart.tsx)
- `coupon.*` (CouponInput.tsx)

**Fix:** Add all these keys to `i18n/messages/id.json` with proper Indonesian strings. Mirror them in `en.json`.

---

### H16: ProductCatalog — 3 Hardcoded Strings + Missing Translation Keys
**File:** `components/store/products/ProductCatalog.tsx` lines ~148-211
**Problem:** 'Semua' button label, and 'productsNotFound', 'productsNotFoundDesc', 'showAllProducts' all hardcoded.
**Fix:** Add keys to `id.json` and use `t()` throughout.

---

### H17: ProductCard — 2 Hardcoded Strings
**File:** `components/store/products/ProductCard.tsx` lines ~126-136
**Problem:** `'outOfStock'` hardcoded in span; MUI certification text hardcoded.
**Fix:** Use `t('outOfStock')` and verify `t('muiCertification')` exists in `id.json`.

---

## 🟡 MEDIUM — Fix When Convenient (27 issues)

### M1: Shipping Cost Non-Standard Response Format
**File:** `app/api/shipping/cost/route.ts` lines 66-70, 115-119
**Problem:** Error/empty responses return `{ services: [], message, whatsappUrl }` instead of `{ success: true, data: { ... } }`.
**Fix:** Wrap all return values in `success()` helper:
```typescript
return success({ services: [], message, whatsappUrl });
```

---

### M2: Health Check Non-Standard Response Format
**File:** `app/api/health/route.ts` line 25-32
**Problem:** Returns `{ status, checks, timestamp }` instead of `{ success, data }`. Acceptable for monitoring endpoints but inconsistent.
**Fix:** Add a comment explaining why this endpoint breaks convention (monitoring tools expect `{ status }` format).

---

### M3: Create-Transaction Expiry Hardcoded to 15 Minutes
**File:** `lib/midtrans/create-transaction.ts` line 46
**Problem:** Expiry duration is hardcoded instead of reading from `getSetting('payment_expiry_minutes')`.
**Fix:**
```typescript
const expiryMinutes = await getSetting('payment_expiry_minutes', '15');
const expiry = Math.min(parseInt(expiryMinutes, 10), 15); // cap at 15 for Midtrans
```

---

### M4: AUTH_SECRET Not Validated at Startup
**File:** `lib/auth/config.ts`
**Problem:** No check that AUTH_SECRET exists and has minimum 32-character length.
**Fix:**
```typescript
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('AUTH_SECRET must be set and at least 32 characters long');
}
```

---

### M5: 5x console.error Violations in Auth Routes
**Files:**
- `app/(auth)/login/page.tsx` line 105
- `app/api/auth/forgot-password/route.ts` lines 61, 71
- `app/api/auth/reset-password/route.ts` line 57
- `app/api/auth/cart/route.ts` line 74
- `app/api/auth/merge-cart/route.ts` line 80

**Problem:** `console.error` used in production code — violates rule "no console.log in production".
**Fix:** Replace all with `logger.error`:
```typescript
import { logger } from '@/lib/utils/logger';
// ...
logger.error('[auth/login] Cart merge failed', { error: err });
```

---

### M6: merge-cart Missing Zod Validation
**File:** `app/api/auth/merge-cart/route.ts` line 25
**Problem:** Incoming `CartItem` array uses TypeScript interface for type assertion only, not runtime Zod validation. Malformed body could cause unexpected behavior.
**Fix:** Add Zod schema:
```typescript
const CartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
const MergeCartSchema = z.object({ items: z.array(CartItemSchema) });
```

---

### M7: admin/coupons/route.ts — Inconsistent Error Helpers + console.error
**File:** `app/api/admin/coupons/route.ts` lines 14-17, 20-23, 29-31, 33-36, 143-146, 32, 175
**Problem:** GET handler uses raw `NextResponse.json` for auth/role errors instead of `unauthorized()` / `forbidden()` / `serverError()` helpers; duplicate code check uses raw 409 instead of `conflict()`; console.error violations.
**Fix:**
1. Replace raw `NextResponse.json` with helper functions
2. Replace `console.error` with `logger.error`

---

### M8: admin/products/route.ts — Inconsistent Error Helpers
**File:** `app/api/admin/products/route.ts` lines 14-17, 21-24, 30-32
**Problem:** Same pattern as M7 — GET handler uses raw `NextResponse.json`.
**Fix:** Replace with `unauthorized()` / `forbidden()` / `serverError()` helpers.

---

### M9: About Page Uses Emoji Instead of Icons
**File:** `app/(store)/about/page.tsx` lines 6-22
**Problem:** Values section uses emoji characters (`🍖`, `✅`, `❄️`) as icons instead of Lucide icons — inconsistent with design system.
**Fix:** Replace emoji with Lucide icons. Suggested mapping:
- `🍖` → `ChefHat`
- `✅` → `ShieldCheck`
- `❄️` → `Snowflake`
- `🚚` → `Truck`
- `🏆` → `Award`
- `❤️` → `Heart`

---

### M10: About Page Unknown Design Token `bg-brand-navy`
**File:** `app/(store)/about/page.tsx` line 81
**Problem:** `bg-brand-navy` is NOT in the approved design system tokens (brand-red, brand-cream, brand-gold).
**Fix:** Either:
1. Verify this token exists in `globals.css` and document it
2. Replace with an approved token like `bg-slate-800` or `bg-brand-red`

---

### M11: Product Detail — Static Generation Error Handling
**File:** `app/(store)/products/[slug]/page.tsx` `generateStaticParams()`
**Problem:** If DB is unavailable at build time, returns `[]` causing all product pages to 404.
**Fix:** Use `export const dynamic = 'force-static'` with `revalidate` instead of `generateStaticParams` with empty catch.

---

### M12: 30+ console.error Violations Across Admin API Routes
**Files:** Multiple admin API routes
**Problem:** Widespread use of `console.error` instead of `logger.error` in production code.
**Fix:** Run a global find/replace:
```bash
# In each affected file, replace:
console.error('[admin/', pattern, err);
# With:
logger.error('[admin/', pattern, { error: err });
```

---

### M13: ProductFilters — 'Semua' Hardcoded
**File:** `components/store/products/ProductFilters.tsx` line 39
**Fix:** Use `t('allCategory')` from next-intl.

---

### M14: CategoryChips — 'Semua' Hardcoded
**File:** `components/store/home/CategoryChips.tsx` line 24
**Fix:** Use `t('allCategory')` from next-intl.

---

### M15: PromoBanner — 2 Hardcoded Strings
**File:** `components/store/home/PromoBanner.tsx` lines 40-41, 63
**Fix:** 'PROMO SPESIAL' → `t('promo.badge')`; 'Klaim Sekarang' → `t('promo.cta')`

---

### M16: StockBadge — 2 Hardcoded Strings
**File:** `components/store/common/StockBadge.tsx` lines 28, 41
**Fix:** 'Habis' → `t('stockHabis')`; 'Tersisa {stock} pcs' → `t('stockTersisa', { count: stock })`

---

### M17: HalalBadge — Non-Design-System Colors + Hardcoded Text
**File:** `components/store/common/HalalBadge.tsx` lines 8, 13
**Fix:**
1. Replace `bg-green-100 text-green-600` with a design system color or CSS variable
2. 'HALAL' → `t('halalBadge')`

---

### M18: Navbar — 4 Hardcoded aria-labels
**File:** `components/store/layout/Navbar.tsx` lines 78, 85, 98, 145
**Fix:** Replace hardcoded Indonesian aria-labels with `t()` calls:
- `"Cari produk"` → `t('navbar.search')`
- `"Keranjang"` → `t('navbar.cart')`
- `"Akun"` → `t('navbar.account')`
- `"Menu"` → `t('navbar.menu')`

---

### M19: CouponInput — 4 Hardcoded Strings
**File:** `components/store/checkout/CouponInput.tsx` lines 40, 47, 59, 69
**Fix:** Add to `id.json` under `coupon` namespace and use `t()`.

---

### M20: BottomNav — Missing aria-label When Badge = 0
**File:** `components/store/layout/BottomNav.tsx` line 66
**Fix:** Always set `aria-label={item.label}` regardless of badge count.

---

### M21: CartItem — Lazy aria-label Hack
**File:** `components/store/cart/CartItem.tsx` line 103
**Problem:** `aria-label` uses `t('checkout').toLowerCase().includes('tambah')` to decide between 'Tambah jumlah' or 'Increase quantity' — this is fragile.
**Fix:** Create a dedicated translation key `t('increaseQuantity')` and use it directly.

---

### M22: Footer — Placeholder Order Tracking URL
**File:** `components/store/layout/Footer.tsx` line 41
**Problem:** `/orders/DDK-TEST-0001` is a fake placeholder URL.
**Fix:** Remove the placeholder or point to `/orders` (order tracking entry page).

---

### M23: ProductCardHorizontal — Hardcoded aria-label
**File:** `components/store/products/ProductCardHorizontal.tsx` line 98
**Fix:** `"Tambah ke keranjang"` → `t('addToCart')` or `t('product.addToCart')`

---

### M24: Upload Route — console.error Violation
**File:** `app/api/upload/route.ts` line 46
**Fix:** Replace `console.error` with `logger.error`

---

### M25: Package.json — Missing `engines` Field
**File:** `package.json`
**Problem:** No Node.js version constraint — team members could use different versions.
**Fix:** Add:
```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

---

### M26: Package.json — Potential Duplicate Zod
**File:** `package.json`
**Problem:** `zod` may appear twice (direct dependency and via `@hookform/resolvers`).
**Fix:** Check and remove duplicate entry.

---

### M27: Guest Order Retry Auth Check Potential Bypass
**File:** `app/api/checkout/retry/route.ts` lines 41-45
**Problem:** For guest orders, both `session.user.id` and `order.userId` are null — `null !== null` is false so the subsequent role check determines access. Needs verification that guests can't access other guests' orders.
**Fix:** Verify that guest orders are identifiable only by order number + email, and that the auth check correctly prevents cross-guest access.

---

## 🟢 LOW — Fix When Touching the File (23 issues)

### L1: About Page Emoji → Lucide Icons (see M9)
### L2: Verify bg-brand-navy Token (see M10)
### L3: Product Detail Static Generation (see M11)
### L4: All admin API routes console.error → logger.error (see M12)
### L5: ProductFilters 'Semua' → next-intl (see M13)
### L6: CategoryChips 'Semua' → next-intl (see M14)
### L7: PromoBanner 2 strings → next-intl (see M15)
### L8: StockBadge 2 strings → next-intl (see M16)
### L9: HalalBadge colors + text → next-intl (see M17)
### L10: Navbar 4 aria-labels → next-intl (see M18)
### L11: CouponInput 4 strings → next-intl (see M19)
### L12: BottomNav aria-label always set (see M20)
### L13: CartItem aria-label dedicated key (see M21)
### L14: Footer placeholder URL removed (see M22)
### L15: ProductCardHorizontal aria-label → next-intl (see M23)
### L16: Upload route console.error → logger.error (see M24)
### L17: Package.json engines field (see M25)
### L18: Package.json duplicate zod (see M26)
### L19: Guest retry auth verification (see M27)
### L20: Reorder Flow — "Beli Lagi" Verification
**Files:** `app/(store)/account/orders/[orderId]/page.tsx`
**Problem:** The reorder button exists but the full flow (add to cart + stock check + discontinued product handling) needs verification.
**Fix:** Test the reorder flow end-to-end with a real order.

### L21: B2B Quote PDF Generation
**File:** `app/(admin)/admin/b2b/page.tsx`
**Problem:** `@react-pdf/renderer` implementation not audited.
**Fix:** Generate a test PDF quote and verify it includes all line items, pricing, terms, and validity period.

### L22: Order Pending Page — Countdown Timer
**File:** `app/(store)/orders/pending/[orderNumber]/page.tsx`
**Problem:** Should show countdown timer to payment expiry but not verified.
**Fix:** Verify timer is displayed and updates in real-time.

### L23: Retry FIFO Race Condition (Documented, Not Critical)
**File:** `app/api/checkout/retry/route.ts` lines 103-120
**Problem:** Documented race condition where concurrent retries could double-spend FIFO points.
**Fix:** Consider adding a `lockedAt` timestamp or version field to `pointsHistory.consumedAt` to prevent concurrent consumption of the same earn record. Low priority.

---

## SUMMARY

| Severity | Count | Files Affected |
|----------|-------|----------------|
| 🔴 CRITICAL | 6 | 5 unique files |
| 🟠 HIGH | 17 | 13 unique files |
| 🟡 MEDIUM | 27 | 19 unique files |
| 🟢 LOW | 23 | 15 unique files |
| **TOTAL** | **73** | **~38 unique files** |

**Note:** 6 critical issues added from deep-dive audit agents (agents 2 and 3). Original 67 count updated to 73.

---

## QUICK WINS (can be done in < 30 minutes each)

1. Fix H2 + H3: Add rate limit + fix coupon validation in `app/api/checkout/validate-coupon/route.ts`
2. Fix H5: Add blog translation keys to `i18n/messages/id.json` — 8 keys
3. Fix H8: Add emptyCart translation keys to `id.json` — 3 keys
4. Fix M4: Add AUTH_SECRET validation to `lib/auth/config.ts`
5. Fix M5: Replace 5 console.error with logger.error in auth routes
6. Fix M1: Wrap shipping cost returns in `success()` helper
7. Fix H12: Start splitting `app/(store)/checkout/page.tsx` (845 lines → 300 max)

---

## WHAT IS WORKING WELL (preserve these patterns)

- ✅ Atomic stock operations with `GREATEST` + `returning` check
- ✅ Optimistic locking on status changes
- ✅ Snapshot on order_items
- ✅ Idempotency everywhere (initiate, webhook, cron)
- ✅ FIFO points redemption
- ✅ Webhook signature first (before any processing)
- ✅ Email non-blocking (`.catch()` or fire-and-forget)
- ✅ Transaction wrapping for all multi-table mutations
- ✅ Zod validation on both client and server
- ✅ Rate limiting on sensitive routes
- ✅ UUID primary keys everywhere
- ✅ Integer IDR for all monetary values
- ✅ Soft delete on products/users
- ✅ next/image everywhere
- ✅ shadcn/ui components only (no raw HTML)
- ✅ Mobile-first Tailwind
- ✅ Loading + error states on all routes