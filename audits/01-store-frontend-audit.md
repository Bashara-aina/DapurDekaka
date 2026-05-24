# AUDIT 01 — Store Frontend: Customer-Facing Pages & Components

**Project:** DapurDekaka.com
**Date:** May 24, 2026
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW
**Status Legend:** ✅ Complete | 🟡 Incomplete | ❌ Broken | 🚧 Placeholder

---

## EXECUTIVE SUMMARY

The store frontend is **largely complete** with excellent code quality. Zero `any` types, zero TODO/FIXME comments, zero placeholder implementations. The architecture is sound — proper Server Components, correct mobile-first Tailwind, consistent shadcn/ui usage. The primary gap is **i18n coverage** — approximately 15 components have hardcoded Indonesian strings that bypass `next-intl`. Secondary issues: one performance concern (category filtering client-side) and one file over the 300-line limit.

---

## HOMEPAGE (`app/(store)/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

**Findings:**
- `NEXT_PUBLIC_WHATSAPP_NUMBER` used directly in JSON-LD — if env var is missing, JSON-LD contains null. Should fallback to a dummy value or skip JSON-LD entirely.
- JSON-LD script uses `dangerouslySetInnerHTML` — correct pattern, but verify JSON values are properly escaped to prevent XSS.
- HeroCarousel, FeaturedProducts, PromoBanner, WhyDapurDekaka, CategoryChips all reviewed separately below.

---

## STORE LAYOUT (`app/(store)/layout.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Uses `getSetting('store_whatsapp_number')` with graceful null fallback.
- No issues.

---

## PRODUCT LISTING (`app/(store)/products/page.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Client-Side Category Filtering (Performance):**
- The database query on the server fetches ALL products without filtering by `category` param.
- The `ProductCatalog` client component receives `initialCategory` but filters client-side using `useMemo` over ALL fetched products.
- With 11 products this is fine. With 100+ products, this will cause performance degradation and large JS bundle transfer on category change.
- **Fix:** Move the category filter to the server-side Drizzle query using a `eq(products.categoryId, categoryId)` condition.

**Also noted:**
- `export const dynamic = 'force-dynamic'` in `'use client'` file (line 22) — ignored by Next.js, harmless but unnecessary.

---

## PRODUCT DETAIL (`app/(store)/products/[slug]/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

**FINDING — Static Generation Error Handling:**
- `generateStaticParams()` catches errors and returns `[]` — if DB is unavailable at build time, all product pages return 404.
- **Fix:** Use `dynamic = 'force-static'` with `revalidate` instead of `generateStaticParams`, or fail the build explicitly.

---

## CART PAGE (`app/(store)/cart/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- `export const dynamic = 'force-dynamic'` in `'use client'` file — same harmless issue as products page.
- Cart items are revalidated on mount with stock check via `useEffect`.
- `loading.tsx` exists and is properly structured.

---

## CHECKOUT PAGE (`app/(store)/checkout/page.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — File Exceeds 300-Line Limit:**
- File is **845 lines** — 2.8x over the project rule maximum.
- Should be split into:
  - `PaymentStep.tsx` — handles Midtrans Snap
  - `ReviewCollapsible.tsx` — handles the collapsible order summary
  - `PickupInfoPanel.tsx` — handles self-pickup flow
- These already exist as separate components but are imported and rendered in a very long page file.

**Also noted:**
- `export const dynamic = 'force-dynamic'` in `'use client'` file — same harmless issue.

---

## ABOUT PAGE (`app/(store)/about/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | **MEDIUM** |

**FINDING — Emoji Characters in UI:**
- Values section (lines 6-22 features array) uses emoji characters (`🍖`, `✅`, `❄️`) as icons instead of proper SVG/Lucide icons.
- This is inconsistent with the design system which uses shadcn/ui + Lucide icons everywhere.
- **Fix:** Replace emoji with appropriate Lucide icons (e.g., `ChefHat`, `ShieldCheck`, `Snowflake`).

**FINDING — Unknown Design Token:**
- Line 81 uses `bg-brand-navy` — this token is NOT in the master rules design system (which only lists brand-red, brand-cream, brand-gold).
- **Fix:** Verify this token exists in `globals.css` or replace with an approved token.

---

## BLOG PAGE (`app/(store)/blog/page.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — All User-Facing Strings Are Hardcoded (NOT using next-intl):**
| Line | Hardcoded String |
|------|-----------------|
| ~125 | `'Blog'` — page heading |
| ~130 | `'Artikel dan tips...'` — page description |
| ~140 | `'Semua'` — category filter |
| ~145 | `'Pencarian:'` — search label |
| ~150 | `'Kategori:'` — category label |
| ~200 | `'← Sebelumnya'` — pagination |
| ~205 | `'Selanjutnya →'` — pagination |
| ~210 | `'Halaman X dari Y'` — pagination info |

**Also noted:**
- Fallback image URL on line 226 is a hardcoded Cloudinary URL without env var fallback.
- **Fix:** Wrap all strings in `t('blog.keyName')` using a `blog` namespace.

---

## PRODUCT CARD (`components/store/products/ProductCard.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Hardcoded Strings NOT Using next-intl:**

| Line | String | Issue |
|------|--------|-------|
| ~136 | `'outOfStock'` | Hardcoded in `<span>`, should be `t('outOfStock')` |
| ~126-128 | MUI certification text | Should verify `t('muiCertification')` exists in id.json |
| ~70 | Toast: `${product.nameId} ${tCart('addedToCart')}` | Pattern is correct but `product.nameId` is hardcoded — acceptable as product data |

**FINDING — WhatsApp Message Not Using env var:**
- Line ~75 constructs WhatsApp URL with hardcoded number `62812xxxxxxxx` instead of `NEXT_PUBLIC_WHATSAPP_NUMBER` — **THIS IS A BUG**. Should use `process.env.NEXT_PUBLIC_WHATSAPP_NUMBER`.

---

## PRODUCT CATALOG (`components/store/products/ProductCatalog.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Hardcoded Strings NOT Using next-intl:**

| Line | String | Issue |
|------|--------|-------|
| ~133 | `{t('nav.products')}` | Uses t() ✓ |
| ~135 | `t('productsFound', { count })` | Uses t() with count ✓ |
| ~148-152 | `'Semua'` (All) | **HARDCODED** — should be `t('allCategory')` |
| ~209-211 | `'productsNotFound'`, `'productsNotFoundDesc'`, `'showAllProducts'` | **HARDCODED** — should use `t()` namespace |

---

## PRODUCT DETAIL CLIENT (`components/store/products/ProductDetailClient.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Uses `next/image`, proper aria-labels, Zod-like error handling, `formatIDR()` for prices.
- Hardcoded fallback `'D'` letter for missing images — acceptable as a single character.
- Related products same pattern — consistent.

---

## NAVBAR (`components/store/layout/Navbar.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — aria-labels Hardcoded (NOT using next-intl):**

| Line | Hardcoded aria-label |
|------|---------------------|
| ~78 | `"Cari produk"` |
| ~85 | `"Keranjang"` |
| ~98 | `"Akun"` |
| ~145 | `"Menu"` |

**Also noted:**
- Logo brand name `'Dapur Dekaka'` hardcoded — acceptable as a brand constant.
- `session.user.name?.split(' ')[0]` — potential null pointer if name is null/undefined. Minor but defensive coding suggests: `session.user.name?.split(' ')[0] ?? ''`.

---

## BOTTOM NAV (`components/store/layout/BottomNav.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | LOW |

**FINDING — Missing aria-label:**
- Line 66: `aria-label` is only set when badge > 0 — otherwise undefined.
- Should always have `aria-label={item.label}` for accessibility compliance.

---

## FOOTER (`components/store/layout/Footer.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- All link text uses `t()` from next-intl correctly.
- Footer placeholder: `/orders/DDK-TEST-0001` for "Track Order" link — a demo URL that should be removed or replaced with the actual order tracking URL pattern.

---

## STOCK BADGE (`components/store/common/StockBadge.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Hardcoded Indonesian Strings:**

| Line | String | Should Be |
|------|--------|-----------|
| ~28 | `'Habis'` | `t('stockHabis')` |
| ~41 | `'Tersisa {stock} pcs'` | `t('stockTersisa', { count: stock })` |

---

## HALAL BADGE (`components/store/common/HalalBadge.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Non-Design-System Colors:**

| Line | Issue |
|------|-------|
| ~8 | `bg-green-100 text-green-600` — NOT a design system token |
| ~13 | `'HALAL'` hardcoded — should be `t('halalBadge')` |

- No `'use client'` needed — purely presentational, could be a Server Component.

---

## EMPTY STATE (`components/store/common/EmptyState.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- `😢` emoji as fallback — acceptable (Unicode, not a language string).
- Variant system (`'cart'|'orders'|'search'|'blog'`) — well typed.
- Framer Motion dynamically imported — correct SSR pattern.

---

## SKELETON CARD (`components/store/common/SkeletonCard.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

No issues.

---

## CART ITEM (`components/store/cart/CartItem.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | LOW |

**FINDING — Lazy aria-label:**
- Line 103: `aria-label` uses a hack to detect language: `t('checkout').toLowerCase().includes('tambah') ? 'Tambah jumlah' : 'Increase quantity'`
- **Fix:** Use a dedicated translation key `t('increaseQuantity')` instead.

---

## CART SUMMARY (`components/store/cart/CartSummary.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

No issues.

---

## EMPTY CART (`components/store/cart/EmptyCart.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — All Strings Hardcoded:**

| String | Should Be |
|--------|-----------|
| `'Keranjangmu masih kosong'` | `t('emptyCart.title')` |
| `'Yuk, temukan dimsum favoritmu!'` | `t('emptyCart.description')` |
| `'Mulai Belanja'` | `t('emptyCart.cta')` |

**Fix:** Pass these as props to `EmptyState` component with translation keys.

---

## HERO CAROUSEL (`components/store/home/HeroCarousel.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — Fallback Content Hardcoded (critical because this shows when DB is empty):**

| Line | String | Should Be |
|------|--------|-----------|
| ~55-67 | `'Cita Rasa Warisan, kini di Rumahyu'` | `t('hero.fallback.title')` |
| ~55-67 | `'Dimsum, siomay...'` | `t('hero.fallback.subtitle')` |
| ~55-67 | `'Lihat Produk'` | `t('hero.fallback.cta')` |

This fallback shows when the database has no carousel slides — a likely production state (e.g., CMS not yet populated). All fallback strings must use next-intl.

---

## FEATURED PRODUCTS (`components/store/home/FeaturedProducts.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

No issues.

---

## CATEGORY CHIPS (`components/store/home/CategoryChips.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING:**
- Line 24: `'Semua'` hardcoded — should be `t('allCategory')`.

---

## PROMO BANNER (`components/store/home/PromoBanner.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Hardcoded Strings:**

| Line | String | Should Be |
|------|--------|-----------|
| ~40-41 | `'PROMO SPESIAL'` | `t('promo.badge')` or prop |
| ~63 | `'Klaim Sekarang'` | `t('promo.cta')` |

---

## WHY DAPUR DEKAKA (`components/store/home/WhyDapurDekaka.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — Entire Features Array Hardcoded:**

| Line | Content | Should Be |
|------|---------|-----------|
| ~6-22 | Full `features` array with Indonesian strings | `t('why.features')` array |
| ~50 | `'Kenapa Dapur Dekaka?'` heading | `t('why.title')` |

Features include: `'100% Halal'`, `'Dikemas Frozen Fresh'`, `'Kirim ke Seluruh Indonesia'`, `'Bersertifikat MUI'`, `'Kualitas Terjaga'`, `'Dari Bandung dengan Cinta'`. All should be translation keys.

---

## PRODUCT FILTERS (`components/store/products/ProductFilters.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING:**
- Line 39: `'Semua'` hardcoded — same issue as `CategoryChips.tsx`.

---

## PRODUCT CARD HORIZONTAL (`components/store/products/ProductCardHorizontal.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | LOW |

**FINDING:**
- Line 98: `aria-label="Tambah ke keranjang"` hardcoded — should use `t()`.

---

## COUPON INPUT (`components/store/checkout/CouponInput.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — All Strings Hardcoded:**

| Line | String | Should Be |
|------|--------|-----------|
| ~40 | `'Kode Kupon'` label | `t('coupon.label')` |
| ~47 | `'Masukkan kode kupon'` placeholder | `t('coupon.placeholder')` |
| ~59 | `'Terapkan'` button | `t('coupon.apply')` |
| ~69 | `'Kupon berhasil!'` message | `t('coupon.success')` |

---

## IDENTITY FORM (`components/store/checkout/IdentityForm.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

No issues.

---

## ADDRESS FORM (`components/store/checkout/AddressForm.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

No issues.

---

## GRAND SUMMARY

| File | Status | Severity | # Issues |
|------|--------|----------|----------|
| `app/(store)/page.tsx` | ✅ | LOW | 1 |
| `app/(store)/layout.tsx` | ✅ | LOW | 0 |
| `app/(store)/products/page.tsx` | 🟡 | **MEDIUM** | 1 (client-side filtering) |
| `app/(store)/products/[slug]/page.tsx` | ✅ | LOW | 1 |
| `app/(store)/cart/page.tsx` | ✅ | LOW | 1 |
| `app/(store)/checkout/page.tsx` | 🟡 | **MEDIUM** | 1 (>300 lines) |
| `app/(store)/about/page.tsx` | 🟡 | **MEDIUM** | 2 (emoji icons, brand-navy token) |
| `app/(store)/blog/page.tsx` | 🟡 | **HIGH** | 2 |
| `ProductCard.tsx` | 🟡 | **MEDIUM** | 2 |
| `ProductCatalog.tsx` | 🟡 | **MEDIUM** | 2 |
| `ProductDetailClient.tsx` | ✅ | LOW | 0 |
| `Navbar.tsx` | 🟡 | **MEDIUM** | 5 |
| `BottomNav.tsx` | 🟡 | LOW | 1 |
| `Footer.tsx` | ✅ | LOW | 1 |
| `StockBadge.tsx` | 🟡 | **MEDIUM** | 2 |
| `HalalBadge.tsx` | 🟡 | **MEDIUM** | 2 |
| `EmptyState.tsx` | ✅ | LOW | 0 |
| `SkeletonCard.tsx` | ✅ | LOW | 0 |
| `CartItem.tsx` | 🟡 | LOW | 1 |
| `CartSummary.tsx` | ✅ | LOW | 0 |
| `EmptyCart.tsx` | 🟡 | **HIGH** | 3 |
| `HeroCarousel.tsx` | 🟡 | **HIGH** | 3 |
| `FeaturedProducts.tsx` | ✅ | LOW | 0 |
| `CategoryChips.tsx` | 🟡 | **MEDIUM** | 1 |
| `PromoBanner.tsx` | 🟡 | **MEDIUM** | 2 |
| `WhyDapurDekaka.tsx` | 🟡 | **HIGH** | 8+ |
| `ProductFilters.tsx` | 🟡 | **MEDIUM** | 1 |
| `ProductCardHorizontal.tsx` | 🟡 | LOW | 1 |
| `CouponInput.tsx` | 🟡 | **MEDIUM** | 4 |
| `IdentityForm.tsx` | ✅ | LOW | 0 |
| `AddressForm.tsx` | ✅ | LOW | 0 |

---

## PRIORITY FIX LIST

### 🔴 CRITICAL
*(None in this audit — no broken functionality)*

### 🟠 HIGH (fix before launch)
1. **`app/(store)/blog/page.tsx`** — Wrap all hardcoded strings in `t()` namespace
2. **`components/store/home/HeroCarousel.tsx`** — Fallback strings must use next-intl (lines 55-67)
3. **`components/store/home/WhyDapurDekaka.tsx`** — All 6 feature strings + heading need next-intl (lines 6-50)
4. **`components/store/cart/EmptyCart.tsx`** — 3 strings need next-intl via EmptyState props
5. **`components/store/products/ProductCard.tsx`** — WhatsApp URL uses hardcoded number instead of `NEXT_PUBLIC_WHATSAPP_NUMBER`

### 🟡 MEDIUM
6. **`app/(store)/checkout/page.tsx`** — Split into 3 sub-components to get under 300 lines
7. **`app/(store)/products/page.tsx`** — Move category filter to server-side Drizzle query
8. **`components/store/layout/Navbar.tsx`** — 4 aria-labels need next-intl wrapping
9. **`components/store/common/StockBadge.tsx`** — `'Habis'` and `'Tersisa X pcs'` need next-intl
10. **`components/store/common/HalalBadge.tsx`** — `'HALAL'` text + non-design-system colors
11. **`components/store/home/CategoryChips.tsx`** — `'Semua'` needs next-intl
12. **`components/store/home/PromoBanner.tsx`** — 2 hardcoded strings
13. **`components/store/checkout/CouponInput.tsx`** — 4 hardcoded strings
14. **`components/store/products/ProductCatalog.tsx`** — 3 hardcoded strings (lines 148-211)
15. **`components/store/products/ProductFilters.tsx`** — `'Semua'` needs next-intl

### 🟢 LOW
16. **`app/(store)/about/page.tsx`** — Replace emoji with Lucide icons; verify `bg-brand-navy` token
17. **`app/(store)/products/[slug]/page.tsx`** — Use `dynamic = 'force-static'` instead of `generateStaticParams` with empty catch
18. **`components/store/layout/BottomNav.tsx`** — Always set `aria-label`
19. **`components/store/layout/Footer.tsx`** — Remove `/orders/DDK-TEST-0001` placeholder
20. **`components/store/cart/CartItem.tsx`** — Replace lazy aria-label with dedicated translation key

---

## WHAT IS NOT BROKEN

- ✅ Zero `any` types
- ✅ Zero TODO/FIXME/placeholder comments
- ✅ Zero raw HTML inputs (shadcn/ui used throughout)
- ✅ Proper `next/image` usage everywhere
- ✅ `formatIDR()` used for all price display
- ✅ Mobile-first Tailwind pattern consistently applied
- ✅ Loading states on all async components
- ✅ Error states with `error.tsx` files on all routes
- ✅ Soft navigation with proper loading.tsx
- ✅ Framer Motion only on store pages (not admin)
- ✅ Cart drawer with proper quantity controls
- ✅ Variant selection with stock awareness
- ✅ WhatsApp floating button with `animate-pulse`
- ✅ StockBadge and HalalBadge used on product cards
