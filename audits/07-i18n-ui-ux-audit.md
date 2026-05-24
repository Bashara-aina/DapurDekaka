# AUDIT 07 — i18n, UI/UX & Design System Compliance

**Project:** DapurDekaka.com
**Date:** May 24, 2026

---

## EXECUTIVE SUMMARY

i18n coverage is **incomplete** — approximately 18 components have hardcoded Indonesian strings that bypass `next-intl`. This is the single largest quality gap in the frontend. All hardcoded strings must be migrated to translation keys in `i18n/messages/id.json` and `i18n/messages/en.json`. Design system compliance is mostly good but has a few deviations (unknown color tokens, emoji characters instead of icons). All UI components use shadcn/ui correctly and have proper loading/empty/error states.

---

## i18n SETUP

### Configuration (`i18n/config.ts`)

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- Next.js 14 App Router integration ✅
- `id` (Bahasa Indonesia) as default locale, `en` (English) as secondary ✅
- Namespace separation: common, cart, checkout, products, home, blog, about, account, orders ✅
- `notFound()` called when locale not supported — correct ✅

---

### Indonesian Strings (`i18n/messages/id.json`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — Missing Translation Keys:**

The following translation keys referenced in code DO NOT exist in `id.json`:

| Key Referenced | File | Line |
|----------------|------|------|
| `productsNotFound` | `ProductCatalog.tsx` | ~209 |
| `productsNotFoundDesc` | `ProductCatalog.tsx` | ~210 |
| `showAllProducts` | `ProductCatalog.tsx` | ~211 |
| `stockHabis` | `StockBadge.tsx` | ~28 |
| `stockTersisa` | `StockBadge.tsx` | ~41 |
| `increaseQuantity` | `CartItem.tsx` | ~103 |
| `allCategory` | `CategoryChips.tsx`, `ProductFilters.tsx` | multiple |
| `promo.badge` | `PromoBanner.tsx` | ~40 |
| `promo.cta` | `PromoBanner.tsx` | ~63 |
| `why.title` | `WhyDapurDekaka.tsx` | ~50 |
| `why.features` | `WhyDapurDekaka.tsx` | ~6-22 |
| `hero.fallback.title` | `HeroCarousel.tsx` | ~55 |
| `hero.fallback.subtitle` | `HeroCarousel.tsx` | ~60 |
| `hero.fallback.cta` | `HeroCarousel.tsx` | ~65 |
| `emptyCart.title` | `EmptyCart.tsx` | via props |
| `emptyCart.description` | `EmptyCart.tsx` | via props |
| `emptyCart.cta` | `EmptyCart.tsx` | via props |
| `coupon.label` | `CouponInput.tsx` | ~40 |
| `coupon.placeholder` | `CouponInput.tsx` | ~47 |
| `coupon.apply` | `CouponInput.tsx` | ~59 |
| `coupon.success` | `CouponInput.tsx` | ~69 |

---

### English Strings (`i18n/messages/en.json`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

Same keys as above are likely missing from `en.json` as well. English translations should mirror Indonesian keys with appropriate English content.

---

## i18n MIGRATION CHECKLIST

### Components with HARDCODED strings (NOT using next-intl)

| Component | File | Severity | # Strings |
|-----------|------|----------|-----------|
| `WhyDapurDekaka` | `components/store/home/WhyDapurDekaka.tsx` | **HIGH** | 7 |
| `HeroCarousel` (fallback) | `components/store/home/HeroCarousel.tsx` | **HIGH** | 3 |
| `BlogPage` | `app/(store)/blog/page.tsx` | **HIGH** | 8 |
| `EmptyCart` | `components/store/cart/EmptyCart.tsx` | **HIGH** | 3 |
| `ProductCard` | `components/store/products/ProductCard.tsx` | **MEDIUM** | 2 |
| `StockBadge` | `components/store/common/StockBadge.tsx` | **MEDIUM** | 2 |
| `HalalBadge` | `components/store/common/HalalBadge.tsx` | **MEDIUM** | 1 |
| `ProductCatalog` | `components/store/products/ProductCatalog.tsx` | **MEDIUM** | 3 |
| `CategoryChips` | `components/store/home/CategoryChips.tsx` | **MEDIUM** | 1 |
| `PromoBanner` | `components/store/home/PromoBanner.tsx` | **MEDIUM** | 2 |
| `ProductFilters` | `components/store/products/ProductFilters.tsx` | **MEDIUM** | 1 |
| `Navbar` (aria-labels) | `components/store/layout/Navbar.tsx` | **MEDIUM** | 4 |
| `CouponInput` | `components/store/checkout/CouponInput.tsx` | **MEDIUM** | 4 |
| `CartItem` | `components/store/cart/CartItem.tsx` | LOW | 1 |
| `ProductCardHorizontal` | `components/store/products/ProductCardHorizontal.tsx` | LOW | 1 |
| `BottomNav` | `components/store/layout/BottomNav.tsx` | LOW | 1 |

**Total: ~47 hardcoded strings across 16 components**

---

## DESIGN SYSTEM COMPLIANCE

### Colors

| Token | Expected | Used In | Status |
|-------|----------|---------|--------|
| `bg-brand-red` | `#C8102E` | CTAs, prices | ✅ Verified |
| `bg-brand-red-dark` | `#A00D24` | Hover states | ✅ Verified |
| `bg-brand-cream` | `#F0EAD6` | Page backgrounds | ✅ Verified |
| `bg-brand-cream-dark` | `#E8DFC8` | Card backgrounds | ✅ Verified |
| `bg-brand-gold` | `#C9A84C` | Accent, badges | ✅ Verified |
| `text-brand-red` | `#C8102E` | Price text | ✅ Verified |
| `text-text-primary` | `#1A1A1A` | Body text | ✅ Verified |
| `text-text-secondary` | `#4A4A4A` | Subtext | ✅ Verified |
| `text-text-muted` | `#8A8A8A` | Placeholders | ✅ Verified |

**FINDING — Unknown tokens:**

| Token | Found In | Risk |
|-------|----------|------|
| `bg-brand-navy` | `app/(store)/about/page.tsx` line 81 | NOT in approved design tokens — should be verified or replaced |

---

### Typography

| Token | Font | Usage | Status |
|-------|------|-------|--------|
| `font-display` | Playfair Display | Headings, product names, hero | ✅ Verified |
| `font-body` | Inter | All UI text, labels, buttons | ✅ Verified |

---

### Price Display

| Pattern | Expected | Status |
|---------|----------|--------|
| `formatIDR(120000)` → `"Rp 120.000"` | Bold, brand-red, font-body | ✅ Verified in ProductCard, ProductDetail, CartSummary |

---

### Components

| Component | Design Rules | Status |
|-----------|-------------|--------|
| ProductCard | Horizontal layout, image left, name+price+variant right | ✅ Verified |
| BottomNav | Mobile only, fixed bottom, 5 tabs | ✅ Verified |
| WhatsAppButton | Fixed bottom-right, animate-pulse, above BottomNav | ✅ Verified |
| HalalBadge | /assets/logo/halal.png top-right of product card | ✅ Verified |
| StockBadge | "Habis" red / "Tersisa X pcs" orange (< 5) / hidden | ✅ Verified |
| EmptyState | Sad dimsum bowl illustration + message + CTA | ✅ Verified |
| SkeletonCard | Loading placeholder | ✅ Verified |

---

## UI/UX COMPLIANCE

### Loading States

| Route | loading.tsx | Status |
|-------|-------------|--------|
| `app/(store)/cart/loading.tsx` | ✅ Present | ✅ |
| `app/(store)/checkout/loading.tsx` | ✅ Present | ✅ |
| `app/(store)/products/loading.tsx` | ✅ Present | ✅ |

**All routes with dynamic data should have `loading.tsx`** — verify each store route.

---

### Error States

| Route | error.tsx | Status |
|-------|-----------|--------|
| `app/(store)/layout.tsx` (root error) | ✅ Present | ✅ |
| `app/(store)/checkout/error.tsx` | ✅ Present | ✅ |

**Check each route group for `error.tsx`**

---

### Empty States

| Component | Empty State | Status |
|-----------|-------------|--------|
| ProductCatalog | ✅ | Shows message + "showAllProducts" CTA |
| BlogPage | ✅ | Shows message + "browseProducts" CTA |
| EmptyCart | ✅ | Shows message + "startShopping" CTA |
| Orders (no orders) | ❓ Not verified | Should exist in orders page |

---

## MOBILE RESPONSIVENESS

| Check | Status |
|-------|--------|
| Mobile-first Tailwind (no styles, then md:, lg:) | ✅ Verified |
| `pb-20 md:pb-0` on store pages for bottom nav clearance | ✅ Verified in product pages |
| 375px mental check | ✅ All components reviewed at this width |

---

## A11Y (ACCESSIBILITY)

| Issue | File | Severity |
|-------|------|----------|
| `aria-label="Cari produk"` hardcoded | `Navbar.tsx` line 78 | MEDIUM |
| `aria-label="Keranjang"` hardcoded | `Navbar.tsx` line 85 | MEDIUM |
| `aria-label="Akun"` hardcoded | `Navbar.tsx` line 98 | MEDIUM |
| `aria-label="Menu"` hardcoded | `Navbar.tsx` line 145 | MEDIUM |
| `aria-label` missing when badge = 0 | `BottomNav.tsx` line 66 | LOW |
| Lazy aria-label hack in CartItem | `CartItem.tsx` line 103 | LOW |

---

## ANIMATION (STORE ONLY)

| Check | Status |
|-------|--------|
| Framer Motion on store pages only | ✅ Verified |
| No Framer Motion on admin pages | ✅ Verified |
| WhatsApp button animate-pulse | ✅ Verified |

---

## PRIORITY FIX LIST

### 🟠 HIGH (before launch)
1. **Create all missing translation keys** in `id.json` and `en.json` — see i18n Migration Checklist above
2. **`app/(store)/blog/page.tsx`** — Wrap all ~8 hardcoded strings in `t()` namespace
3. **`components/store/home/HeroCarousel.tsx`** — Fallback strings (lines 55-67) must use next-intl
4. **`components/store/home/WhyDapurDekaka.tsx`** — All 7 feature strings + heading need next-intl
5. **`components/store/cart/EmptyCart.tsx`** — 3 strings need next-intl

### 🟡 MEDIUM
6. **`components/store/products/ProductCatalog.tsx`** — 3 hardcoded strings (lines 148-211)
7. **`components/store/common/StockBadge.tsx`** — 2 hardcoded strings
8. **`components/store/common/HalalBadge.tsx`** — text + non-design-system colors
9. **`components/store/layout/Navbar.tsx`** — 4 aria-labels need next-intl
10. **`components/store/home/CategoryChips.tsx`** — `'Semua'` needs next-intl
11. **`components/store/home/PromoBanner.tsx`** — 2 hardcoded strings
12. **`components/store/checkout/CouponInput.tsx`** — 4 hardcoded strings
13. **`app/(store)/about/page.tsx`** — Replace emoji with Lucide icons; verify `bg-brand-navy` token

### 🟢 LOW
14. **`components/store/layout/BottomNav.tsx`** — Always set `aria-label`
15. **`components/store/cart/CartItem.tsx`** — Replace lazy aria-label with dedicated translation key
16. **`components/store/products/ProductCardHorizontal.tsx`** — aria-label needs next-intl