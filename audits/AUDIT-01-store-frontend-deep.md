# AUDIT 01 — Store Frontend Deep Audit

**Auditor:** QA Audit (100 Indonesian customers simulate)
**Date:** Monday May 25, 2026
**Scope:** All customer-facing pages in `app/(store)/` and `components/store/`
**Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, next-intl, Framer Motion

---

## 🔴 CRITICAL (blocks launch)

### 1. `HomePageCTA.tsx` — 100% Hardcoded Indonesian Strings
**File:** `components/store/home/HomePageCTA.tsx` — lines 26–36, 48–60, 71–82

Every string in this component is hardcoded Indonesian. It renders different content for guests, logged-in users with cart items, and logged-in users without cart items — all in Indonesian only.

**Hardcoded strings:**
- `"Siap Mencicipi Kelezatan Dapur Dekaka?"`
- `"Pesan sekarang dan nikmati dimsum, siomay, dan bakso premium langsung di rumahmu"`
- `"Jelajahi Produk"`
- `"Lanjutkan Belanja?"`
- `"Kamu punya ${totalItems} item di keranjang. Lanjutkan belanja dan kumpulkan poin!"`
- `"Mau pesan lagi? Yuk jelajahi produk favoritmu."`
- `"Lihat Keranjang"`
- `"Mulai Belanja"`
- `"Mau Pesan Lagi?"`

**Fix:** Add i18n keys to `i18n/messages/id.json` and `en.json` under e.g. `homePageCTA` namespace, then replace all hardcoded strings with `const t = useTranslations('homePageCTA');` calls.

---

### 2. `AccountLayout` — Hardcoded Mixed EN/ID Strings
**File:** `app/(store)/account/layout.tsx` — lines 22–29, 78

`navItems` labels mix English and Indonesian inconsistently. The sign-out button has hardcoded Indonesian `"Keluar"` and `"Memproses..."`.

```22:29:app/(store)/account/layout.tsx
const navItems = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard },
  { href: '/account/orders', label: 'Pesanan', icon: Package },
  { href: '/account/addresses', label: 'Alamat', icon: MapPin },
  { href: '/account/points', label: 'Poin', icon: Gift },
  { href: '/account/vouchers', label: 'Voucher', icon: Ticket },
  { href: '/account/profile', label: 'Profil', icon: User },
];
```

```78:app/(store)/account/layout.tsx
{isSigningOut ? 'Memproses...' : 'Keluar'}
```

**Fix:** Add `accountLayout` keys to i18n files. Make all labels bilingual-aware or use a single language strategy.

---

### 3. `FeaturedProducts.tsx` — Invalid Tailwind Class `section-container`
**File:** `components/store/home/FeaturedProducts.tsx` — lines 55, 106

```55:components/store/home/FeaturedProducts.tsx
<section className="py-8 section-container">
```

```106:components/store/home/FeaturedProducts.tsx
<section className="py-8 section-container">
```

`section-container` is not defined in the Tailwind config. It renders as no-op, meaning sections have no horizontal container constraint and no `max-width`. Content bleeds edge-to-edge on desktop instead of being properly contained.

**Fix:** Replace with `className="py-8 px-4 container mx-auto"` (matching the framer-motion variant version at line 128 which correctly uses `container mx-auto`).

---

### 4. Missing Mobile Bottom Nav Clearance (`pb-20`) on Checkout Result Pages
**Files:**
- `app/(store)/checkout/success/page.tsx` — line 55: `<div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">` — **NO `pb-20`**
- `app/(store)/checkout/failed/page.tsx` — **NO `pb-20`** (page wrapper at line ~92)
- `app/(store)/checkout/pending/page.tsx` — line 275: `<div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">` — **NO `pb-20`**

All three checkout outcome pages use `min-h-screen flex items-center justify-center` which centers content vertically. On mobile with the BottomNav (5rem), the bottom of the card/content could overlap the fixed BottomNav.

**Fix:** Add `pb-24` (extra clearance above BottomNav's `pb-20` + safe area) to the wrapper div on all three pages:
```tsx
<div className="min-h-screen bg-brand-cream flex items-center justify-center p-4 pb-24 md:pb-0">
```

---

### 5. `AccountOrdersPage` — Hardcoded Indonesian Status Filters
**File:** `app/(store)/account/orders/page.tsx` — lines 24–32

```24:32:app/(store)/account/orders/page.tsx
const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'pending_payment', label: 'Menunggu Bayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'packed', label: 'Dikemas' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'delivered', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
];
```

And hardcoded metadata title at line 17:
```17:app/(store)/account/orders/page.tsx
title: 'Pesanan Saya — Dapur Dekaka',
```

**Fix:** Move `STATUS_FILTERS` to a separate client component that uses `useTranslations('account')` or add it to the i18n files. Replace hardcoded metadata title with `getTranslations('metadata')`.

---

## 🟡 HIGH (should fix before launch)

### 6. `Testimonials.tsx` — Hardcoded Indonesian Fallback Strings
**File:** `components/store/home/Testimonials.tsx` — lines 53–58, 76–77

```53:58:components/store/home/Testimonials.tsx
<h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8">
  Kata Mereka yang Sudah Percaya
</h2>
<p className="text-text-secondary text-sm">
  Gagal memuat testimoni. Silakan coba lagi nanti.
</p>
```

```76:77:components/store/home/Testimonials.tsx
<h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8">
  Kata Mereka yang Sudah Percaya
</h2>
```

This component fetches testimonials from an API and has no loading skeleton (it returns `null` during loading). The fallback error state uses hardcoded Indonesian.

**Fix:** Add `testimonials.errorTitle` and `testimonials.errorDesc` to i18n files and use `useTranslations('testimonials')`.

---

### 7. `CartItemComponent` — Incorrect/Inconsistent aria-label for Decrease Button
**File:** `components/store/cart/CartItem.tsx` — line 92

```92:components/store/cart/CartItem.tsx
aria-label={t('cancel')}
```

Uses `t('cancel')` (from `cart` namespace) for the minus/quantity-decrease button. The ProductDetailClient uses `t('decreaseQty')` from `ProductDetail` namespace for the equivalent minus button. This is inconsistent — screen readers will read "cancel" when the user is trying to decrease quantity.

**Fix:** Use `t('decreaseQuantity')` or a consistent label. Add `decreaseQuantity: "Decrease quantity"` / `"Kurangi jumlah"` to the `cart` i18n namespace if not already present.

---

### 8. `ProductCard.tsx` — Duplicate Handler Functions
**File:** `components/store/products/ProductCard.tsx` — lines 54–102

`handleQuickAdd` (lines 54–77) and `handleAddToCart` (lines 79–102) are **identical**. Both call `addItem`, show the same toast, and call `syncIfLoggedIn()`. The only difference is `handleQuickAdd` is called from the small floating `+` button, while `handleAddToCart` is called from the cart icon button at the bottom right — but they do exactly the same thing.

**Fix:** Merge into a single `handleAddToCart` function. Remove `handleQuickAdd` entirely, rename `handleAddToCart`, and pass the same handler to both buttons. This is dead code that increases bundle size and creates confusion.

---

### 9. `CheckoutFailedPage` — Comment Mentions "FIX 8" Workaround
**File:** `app/(store)/checkout/failed/page.tsx` — lines 26–33, 71–73

```26:33:app/(store)/checkout/failed/page.tsx
/**
 * FIX 8 (workaround): Cart store's addItem blocks stock=0 items.
 * On payment failure, we restore items to cart for retry.
 * Since real stock is re-validated server-side at checkout initiation,
 * using a placeholder stock value (999) here is safe — the server will
 * return an error if any items are actually out of stock at retry time.
 * This workaround avoids a deeper cart-store refactor for now.
 */
```

```71:73:app/(store)/checkout/failed/page.tsx
// FIX 8: Use 999 as placeholder stock since cart store blocks stock=0.
// Stock will be re-validated server-side at checkout initiation.
addItem({ ...stock: 999, ... })
```

This is a known workaround that should be tracked. The comment format suggests it's from an audit/fix tracking system ("FIX 8").

**Fix:** Create a proper issue/ticket for this. The cart store should accept `stock: 0` items for retry scenarios, or `addItem` should have a `forceAdd` flag.

---

### 10. `DeliveryMethodToggle` — Hardcoded Courier Names
**File:** `components/store/checkout/DeliveryMethodToggle.tsx`

The delivery description shows `SiCepat FROZEN / JNE YES / AnterAja Frozen` hardcoded in Indonesian. While this describes cold-chain couriers (correct per spec), the string should be in i18n.

---

### 11. `CartSummary.tsx` — Weight Display Has No Thousand separator
**File:** `components/store/cart/CartSummary.tsx` — line 51

```51:components/store/cart/CartSummary.tsx
<span className="font-medium">{(totalWeight / 1000).toFixed(1)} kg</span>
```

`toFixed(1)` produces `"1.5 kg"` — but Indonesian locale uses comma as decimal separator (`1,5 kg`). The `.` decimal format is incorrect for an Indonesian audience. Other prices use `formatIDR()` which handles locale correctly.

**Fix:** Use `formatWeight()` utility or `(totalWeight / 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg'`.

---

### 12. `InstagramFeed` — Hardcoded Instagram URL + `alt` text
**File:** `components/store/home/InstagramFeed.tsx` — lines 30–40, 48

```30:40:components/store/home/InstagramFeed.tsx
href="https://instagram.com/dapurdekaka"
```

Hardcoded Instagram URL appears in multiple places. The `galleryPosts` array also has hardcoded alt text in Indonesian (`"Dimsum premium"`, `"Bakso frozen"`, etc.).

**Fix:** Move Instagram handle to a constant or env variable. Alt texts are acceptable as product descriptions in Indonesian but should ideally be from i18n.

---

### 13. `Footer` — Hardcoded Instagram URL
**File:** `components/store/layout/Footer.tsx` — line 64

```64:components/store/layout/Footer.tsx
href="https://instagram.com/dapurdekaka"
```

Same hardcoded Instagram URL. Also at line 47 in `InstagramFeed.tsx`.

**Fix:** Use `NEXT_PUBLIC_INSTAGRAM_URL` env variable.

---

## 🟢 MEDIUM (improve when possible)

### 14. `ProductCatalog.tsx` — `productsFound` Uses Wrong Namespace
**File:** `components/store/products/ProductCatalog.tsx` — line 135

```135:components/store/products/ProductCatalog.tsx
{t('productsFound', { count: filteredProducts.length })}
```

Uses `t()` from the root (no namespace — `const t = useTranslations()`). The `productsFound` key is in the `metadata` namespace in `en.json`/`id.json`. This works by accident because the root has all namespaces merged, but it's fragile and non-obvious.

**Fix:** Use `const t = useTranslations('metadata')` at line 60 to make the namespace explicit.

---

### 15. `ProductCard.tsx` — MUI Certification Badge Shows Even When `isHalal=false`
**File:** `components/store/products/ProductCard.tsx` — lines 125–129

```125:129:components/store/products/ProductCard.tsx
{product.isHalal && (
  <span className="text-[8px] text-text-disabled bg-white/60 px-1 rounded text-center">
    {t('muiCertification')}
  </span>
)}
```

The MUI certification badge (`muiCertification`) is shown only when `product.isHalal` is true, which is correct. However, the `HalalBadge` component is shown in the same `top-2 right-2` corner area regardless. If both render, they overlap or stack awkwardly. The MUI cert badge is 8px font and barely legible.

**Fix:** Review the badge stacking. Consider removing the tiny MUI cert text badge entirely (the HalalBadge with the MUI logo is sufficient), or merge them.

---

### 16. `WhatsAppButton.tsx` — Uses `animate-pulse-soft` (Custom Animation)
**File:** `components/store/layout/WhatsAppButton.tsx` — line 46

```46:components/store/layout/WhatsAppButton.tsx
className="... animate-pulse-soft ..."
```

`animate-pulse-soft` is a custom Framer Motion animation or Tailwind arbitrary value. Verify this animation is defined in `tailwind.config.ts` or as a Framer Motion variant. If it's a Tailwind arbitrary animation, it's not portable.

**Fix:** Verify the animation definition. If it's a Framer Motion animation, the WhatsApp button needs to be a client component that uses Framer Motion properly (currently it's a client component but doesn't use Framer Motion — this might be a leftover from when it was a Framer Motion component).

---

### 17. `ProductDetailClient.tsx` — Related Products Use `<a>` Instead of `<Link>`
**File:** `components/store/products/ProductDetailClient.tsx` — line 287

```287:components/store/products/ProductDetailClient.tsx
<a key={related.id} href={`/products/${related.slug}`} ...>
```

Uses a raw `<a>` tag instead of Next.js `<Link>` component. This bypasses the App Router's prefetching and client-side navigation. The rest of the codebase uses `<Link>` consistently.

**Fix:** Replace with `<Link href={...} className={...}>`.

---

### 18. `HeroCarousel` — Empty State Fallback Uses `next-intl` but Wrong Namespace
**File:** `components/store/home/HeroCarousel.tsx` — line 31

```31:components/store/home/HeroCarousel.tsx
const t = useTranslations('hero.fallback');
```

But in `en.json`/`id.json`, the structure is:
```277:283:i18n/messages/en.json
"hero": {
  "fallback": {
    "title": "...",
    ...
  }
}
```

The namespace is correct. However, this fallback is only shown when `slides.length === 0`. In production, if the DB carousel table is empty or the API fails, users see the fallback — but it's a static fallback, not a loading state. Consider adding a shimmer/skeleton for the initial load.

---

### 19. `FeaturedProducts.tsx` — Non-Breaking Empty State Display
**File:** `components/store/home/FeaturedProducts.tsx` — lines 53–101

When `MotionComp` is not yet loaded (Framer Motion lazy import), the component renders the non-motion version. When `products.length === 0`, it shows an empty state with different styling. These two conditions interact in a way that could cause layout shift when Framer Motion finally loads.

**Fix:** The lazy import of Framer Motion is fine, but the non-motion empty state (lines 92–98) vs the motion empty state (lines 114–122) have different styling. Make them consistent.

---

### 20. i18n — `metadata.aboutTitle` and `metadata.aboutDescription` Duplicated
**File:** `i18n/messages/en.json` — lines 759–760 and 771–772

```759:772:i18n/messages/en.json
"aboutTitle": "About Us | Dapur Dekaka",
"aboutDescription": "Dapur Dekaka is a premium...",
...
"aboutTitle": "About Us | Dapur Dekaka",
"aboutDescription": "Dapur Dekaka is a premium..."
```

Duplicate keys at the end of the file. `en.json` line 770 also redefines `allCategory` which already exists at line 261. This is valid JSON so it overrides earlier values silently, but it's messy and error-prone.

**Fix:** Deduplicate the metadata section. The last occurrence wins in JSON parsing, so verify the correct values are at the intended keys.

---

### 21. `EmptyState.tsx` — Has `😢` Emoji as Fallback (Anti-Pattern)
**File:** `components/store/common/EmptyState.tsx` — line 99

```99:components/store/common/EmptyState.tsx
<div className="text-6xl mb-4">😢</div>
```

The emoji fallback for non-cart variants (error, surprised) uses a raw emoji. The design system specifies SVG illustrations. The `SadDimsumBowl` SVG exists for cart/orders/search/blog variants, but the fallback for other variants (error, surprised) uses a plain emoji.

**Fix:** Either add an SVG for the error/surprised variants, or use the `SadDimsumBowl` for all variants consistently.

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | 🔴 CRITICAL | `HomePageCTA.tsx` | All strings hardcoded Indonesian |
| 2 | 🔴 CRITICAL | `account/layout.tsx` | Mixed EN/ID hardcoded nav labels |
| 3 | 🔴 CRITICAL | `FeaturedProducts.tsx` | `section-container` not a Tailwind class |
| 4 | 🔴 CRITICAL | `checkout/success|pending|failed/page.tsx` | Missing `pb-20` mobile clearance |
| 5 | 🔴 CRITICAL | `account/orders/page.tsx` | `STATUS_FILTERS` hardcoded Indonesian |
| 6 | 🟡 HIGH | `Testimonials.tsx` | Hardcoded Indonesian fallback/error strings |
| 7 | 🟡 HIGH | `CartItem.tsx:92` | Wrong aria-label `t('cancel')` for decrease button |
| 8 | 🟡 HIGH | `ProductCard.tsx:54-102` | `handleQuickAdd` = `handleAddToCart` (duplicate dead code) |
| 9 | 🟡 HIGH | `checkout/failed/page.tsx:26` | "FIX 8" workaround comment — cart stock=0 blocking |
| 10 | 🟡 HIGH | `DeliveryMethodToggle.tsx` | Hardcoded courier names |
| 11 | 🟡 HIGH | `CartSummary.tsx:51` | Weight decimal uses `.` not `,` (ID locale) |
| 12 | 🟡 HIGH | `InstagramFeed.tsx` | Hardcoded Instagram URL + ID alt text |
| 13 | 🟡 HIGH | `Footer.tsx:64` | Hardcoded Instagram URL |
| 14 | 🟢 MEDIUM | `ProductCatalog.tsx:135` | Implicit root `t()` instead of explicit namespace |
| 15 | 🟢 MEDIUM | `ProductCard.tsx:125` | MUI cert badge overlap with HalalBadge |
| 16 | 🟢 MEDIUM | `WhatsAppButton.tsx:46` | `animate-pulse-soft` animation definition unclear |
| 17 | 🟢 MEDIUM | `ProductDetailClient.tsx:287` | `<a>` instead of `<Link>` for related products |
| 18 | 🟢 MEDIUM | `HeroCarousel.tsx` | No skeleton for initial load state |
| 19 | 🟢 MEDIUM | `FeaturedProducts.tsx` | Inconsistent empty state styling (motion vs non-motion) |
| 20 | 🟢 MEDIUM | `en.json` | Duplicate keys: `aboutTitle`, `aboutDescription`, `allCategory` |
| 21 | 🟢 MEDIUM | `EmptyState.tsx:99` | Raw `😢` emoji instead of SVG illustration |

---

## Pages with `pb-20 md:pb-0` (Mobile Bottom Nav Clearance) ✅

The following pages correctly have `pb-20` (or `pb-24` for pages with sticky bottom bars):

- ✅ `app/(store)/page.tsx` — `pb-20 md:pb-0`
- ✅ `app/(store)/cart/page.tsx` — `pb-20`
- ✅ `app/(store)/checkout/page.tsx` — `pb-24 md:pb-0`
- ✅ `app/(store)/about/page.tsx` — `pb-20 md:pb-12`
- ✅ `app/(store)/blog/page.tsx` — has `pb-20`
- ✅ `app/(store)/blog/[slug]/page.tsx` — has `pb-20`
- ✅ `app/(store)/orders/[orderNumber]/pickup/page.tsx` — has `pb-20`
- ✅ `app/(store)/account/layout.tsx` — `pb-20 md:pb-0`
- ✅ `app/(store)/account/points/page.tsx` — has `pb-20`
- ✅ `app/(store)/account/vouchers/page.tsx` — has `pb-20`
- ✅ `app/(store)/account/addresses/page.tsx` — has `pb-20`

## Pages WITHOUT `pb-20` (Need Review) ⚠️

- ⚠️ `app/(store)/checkout/success/page.tsx` — missing `pb-20` (centered layout, may be intentional)
- ⚠️ `app/(store)/checkout/failed/page.tsx` — missing `pb-20` (centered layout, may be intentional)
- ⚠️ `app/(store)/checkout/pending/page.tsx` — missing `pb-20` (centered layout, may be intentional)
- ⚠️ `app/(store)/products/page.tsx` — **MISSING** `pb-20` — the `ProductCatalog` component has its own `pb-20` internally (line 129), so this is ✅ covered
- ✅ `app/(store)/products/[slug]/page.tsx` — `ProductDetailClient` has `pb-24` (extra for sticky bottom bar)

---

## StockBadge Logic ✅

**File:** `components/store/common/StockBadge.tsx`

```24:50:components/store/common/StockBadge.tsx
if (stock === undefined || stock === 0) {
  // HABIS — gray badge
  return <span className="bg-text-secondary/10 text-text-secondary">...{t('outOfStock')}...</span>
}
if (stock < 5) {
  // TERSISA — orange/warning badge
  return <span className="bg-warning-light text-warning">...{t('remainingStock', { count: stock })}...</span>
}
return null; // Hidden when stock >= 5
```

**Verdict:** ✅ Correct. "Habis" gray, "Tersisa X pcs" orange when stock < 5, hidden otherwise.

---

## HalalBadge ✅

**File:** `components/store/common/HalalBadge.tsx`

Uses SVG checkmark + `t('halal')` from i18n. ✅ Correct.

---

## No TODO/FIXME Comments Found ✅

Grep across `components/store/` returned **no matches** for `TODO`, `FIXME`, `XXX`, or `HACK` comments. Code is clean of placeholder stubs.

---

## Framer Motion Usage ✅

All components using Framer Motion do so via dynamic import (`import('framer-motion').then(m => setMotionComp(m))`) with a synchronous fallback. No blocking imports. ✅ Correct pattern for store components.

---

## formatIDR() Usage ✅

All prices across all examined components use `formatIDR()` from `@/lib/utils/format-currency`. No raw price display found. ✅ Correct.

---

## No `<img>` Tags Found ✅

All image rendering uses `next/image` `<Image>` component with proper `alt` attributes. ✅ Correct.

---

## Priority Fix Order

1. **FIX FIRST** — Items 1, 2, 3, 4, 5 (Critical i18n gaps + broken layout)
2. **FIX SECOND** — Items 6, 7, 8, 9, 10, 11 (High quality issues)
3. **FIX THIRD** — Items 12–21 (Medium polish)
