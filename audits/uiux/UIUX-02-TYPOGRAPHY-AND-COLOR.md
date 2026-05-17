# UIUX-02 — Typography & Color System Audit
**DapurDekaka.com | UI/UX Deep Audit Series**
**Date:** May 2026 | **Status:** Actionable — use with Cursor

---

## OVERVIEW

This file audits deviations from the type scale, font usage rules, color system, and color contrast across the store. Every issue has **WHERE**, **SPEC**, **ACTUAL**, and **FIX**.

---

## BUG 01 — BottomNav Uses Emoji Icons Instead of Lucide Icons

**WHERE:** `components/store/layout/BottomNav.tsx:28-38`
**SPEC:** DESIGN_SYSTEM.md §8.1 — "Use **Lucide React** exclusively — consistent, tree-shakeable." §6.1 — Bottom nav: "icon (24px) + label (10px Inter)". Icon colors: "Active: brand-red icon + label. Inactive: gray icon + label."
**ACTUAL:**
```tsx
const navItems = [
  { href: '/', icon: '🏠', label: t('home') },
  { href: '/products', icon: '📦', label: t('products') },
  { href: '/cart', icon: '🛒', label: t('cart'), badge: totalItems },
  { href: '/account', icon: '👤', label: t('account') },
  { href: `https://wa.me/...`, icon: '💬', label: 'WA', external: true },
];
```
Emojis render differently on Android vs iOS (Samsung's 📦 looks completely different from Apple's). They also cannot be colored with CSS — the "active state brand-red" for emoji is **impossible**, so the active state only changes the text label color, not the icon.

**FIX — Replace all emoji icons with Lucide:**
```tsx
// In BottomNav.tsx — add imports:
import { Home, Package, ShoppingCart, User, FileText } from 'lucide-react';

// Change navItems to use components:
const navItems = [
  { href: '/', Icon: Home, label: t('home') },
  { href: '/products', Icon: Package, label: t('products') },
  { href: '/blog', Icon: FileText, label: 'Blog' },
  { href: '/cart', Icon: ShoppingCart, label: t('cart'), badge: totalItems },
  { href: '/account', Icon: User, label: t('account') },
];

// In the render, replace the emoji <span> with:
<item.Icon
  className={cn(
    'w-6 h-6 transition-colors',
    isActive ? 'text-brand-red' : 'text-text-secondary'
  )}
  strokeWidth={isActive ? 2.5 : 2}
/>
```

---

## BUG 02 — ProductCard: Product Name Uses Wrong Font Size (No size specified)

**WHERE:** `components/store/products/ProductCard.tsx:141`
**SPEC:** DESIGN_SYSTEM.md §5.2 — "Product name: Playfair Display Medium, 16px" on product cards.
**ACTUAL:**
```tsx
<h3 className="font-display font-medium text-text-primary line-clamp-2 mb-1">
  {product.nameId}
</h3>
```
No explicit font size! `font-display` sets the font family but the size defaults to whatever the parent/browser default is. In most contexts this will be 16px, but it's not guaranteed and depends on context. The card is used in multiple contexts (featured section where it's in a `w-40` wrapper, related products section, etc.).

**FIX:**
```tsx
// BEFORE:
<h3 className="font-display font-medium text-text-primary line-clamp-2 mb-1">

// AFTER:
<h3 className="font-display font-medium text-base text-text-primary line-clamp-2 mb-1 leading-snug">
```
`text-base` = 16px, `leading-snug` = 1.375 (better for Playfair Display which has long ascenders).

---

## BUG 03 — ProductCard: Variant Name Text is Inverted (text-text-secondary but no size)

**WHERE:** `components/store/products/ProductCard.tsx:143`
**SPEC:** DESIGN_SYSTEM.md §3.2 — "text-xs = 12px, 400 weight — Captions, metadata"
**ACTUAL:**
```tsx
<p className="text-text-secondary text-xs mb-3">{variant.nameId}</p>
```
This is actually correct! ✅ But `mb-3` (12px margin) below a 12px caption before the price seems excessive. The price section then has a `flex items-center justify-between` which creates a visual disconnect.

**MINOR IMPROVEMENT:**
```tsx
// Change mb-3 to mb-2:
<p className="text-text-secondary text-xs mb-2">{variant.nameId}</p>
```

---

## BUG 04 — WhyDapurDekaka: Icon Uses Emoji Instead of Lucide, Wrong Size

**WHERE:** `components/store/home/WhyDapurDekaka.tsx:7-14` and `:60`
**SPEC:** DESIGN_SYSTEM.md §8.2 — "Feature section icons: 48px". §8.1 — Use Lucide React exclusively. The icon container spec is `w-14 h-14 md:w-16 md:h-16` (56-64px).
**ACTUAL:**
```tsx
const features = [
  { icon: '✓', title: '100% Halal', ... },
  { icon: '❄️', title: 'Dikemas Frozen Fresh', ... },
  { icon: '🚚', title: 'Kirim ke Seluruh Indonesia', ... },
];
// Rendered as:
<span className="text-2xl md:text-3xl">{feature.icon}</span>
```
**Problems:**
1. `✓` (checkmark text) is not an emoji — it renders as Unicode text character that looks different on each system
2. Emoji icons can't be styled with brand-red color
3. `text-2xl` = 24px, `text-3xl` = 30px. The container is 56-64px but the icon is only 24-30px — massive dead space around a tiny icon

**FIX:**
```tsx
// Add imports:
import { CheckCircle, Snowflake, Truck } from 'lucide-react';

const features = [
  {
    Icon: CheckCircle,
    title: '100% Halal',
    description: 'Bersertifikat dan terjamin kehalalannya',
  },
  {
    Icon: Snowflake,
    title: 'Dikemas Frozen Fresh',
    description: 'Kualitas terjaga sampai tujuan',
  },
  {
    Icon: Truck,
    title: 'Kirim ke Seluruh Indonesia',
    description: 'Dari Bandung untuk Nusantara',
  },
];

// In the render:
<div className="w-14 h-14 md:w-16 md:h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
  <feature.Icon className="w-7 h-7 md:w-8 md:h-8 text-brand-red" strokeWidth={1.5} />
</div>
```

---

## BUG 05 — HeroCarousel: Title Font Size Jump is Too Aggressive

**WHERE:** `components/store/home/HeroCarousel.tsx:56` and `:94`
**SPEC:** DESIGN_SYSTEM.md §3.2 — Mobile headings should be "70% of desktop sizes". Desktop is `display-2xl` (72px = text-6xl) → mobile should be ~50px (`text-5xl`). §11.1 hero: "3rem mobile / 60px desktop".
**ACTUAL:**
```tsx
<h1 className="font-display text-3xl md:text-6xl font-bold text-white mb-3 whitespace-pre-line">
```
`text-3xl` = 30px (mobile) → `text-6xl` = 60px (desktop). That's a **2× jump** between mobile and desktop. At the md breakpoint (768px), the title goes from tiny to huge with nothing in between.

**FIX — add an intermediate size:**
```tsx
// BEFORE:
<h1 className="font-display text-3xl md:text-6xl font-bold text-white mb-3 whitespace-pre-line">

// AFTER:
<h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 whitespace-pre-line leading-tight">
```
Also add `leading-tight` — Playfair Display at large sizes needs tight line-height or the `whitespace-pre-line` split will create too much vertical space between lines.

---

## BUG 06 — Cart Page Header: Uses font-display but is Missing text-* Size

**WHERE:** `app/(store)/cart/page.tsx:83`
**SPEC:** DESIGN_SYSTEM.md §3.2 — Page headers should be `display-md` (36px) or `display-sm` (30px).
**ACTUAL:**
```tsx
<h1 className="font-display text-2xl font-bold">Keranjang</h1>
```
`text-2xl` = 24px = `display-xs`. This is undersized for a page title. The DESIGN_SYSTEM specifies `display-xs` (24px) only for "Card titles, widget headers". A main page title should be `display-sm` (30px) at minimum.

**FIX:**
```tsx
// BEFORE:
<h1 className="font-display text-2xl font-bold">Keranjang</h1>

// AFTER:
<h1 className="font-display text-2xl md:text-3xl font-bold">Keranjang</h1>
```
This gives 24px on mobile (where space is limited) and 30px on desktop.

---

## BUG 07 — Checkout Header Uses Same Undersized Title

**WHERE:** `app/(store)/checkout/page.tsx:470`
**ACTUAL:**
```tsx
<h1 className="font-display text-xl font-bold">Checkout</h1>
```
`text-xl` = 20px. This is even smaller than the cart page title. These are the most critical pages in the conversion funnel — their titles should not look subordinate.

**FIX:**
```tsx
<h1 className="font-display text-xl md:text-2xl font-bold">Checkout</h1>
```

---

## BUG 08 — ProductDetail: h1 is 2xl (24px) — Same Level as Cart Header

**WHERE:** `components/store/products/ProductDetailClient.tsx:182`
**SPEC:** DESIGN_SYSTEM.md §11.2 — "Product name: Playfair Display, display-xs, bold". `display-xs` = 24px. This IS to spec.
**ACTUAL:**
```tsx
<h1 className="font-display text-2xl font-bold text-text-primary mt-1">
  {product.nameId}
</h1>
```
✅ Correct font size. But missing `leading-tight` — Playfair Display Bold at 24px with Indonesian product names (which tend to be 3-5 words) will have incorrect line-height (Tailwind's `text-2xl` uses `line-height: 2rem` = 32px, but Playfair Display at 24px looks better at 1.2 = 28.8px).

**FIX:**
```tsx
<h1 className="font-display text-2xl font-bold text-text-primary mt-1 leading-tight">
```

---

## BUG 09 — Testimonials: Quote Text Missing Playfair Display Italic

**WHERE:** `components/store/home/Testimonials.tsx:80`
**SPEC:** DESIGN_SYSTEM.md §11.1 — "Quote in italic Playfair Display"
**ACTUAL:**
```tsx
<p className="text-text-primary mb-4 italic">&quot;{t.contentId}&quot;</p>
```
Uses `italic` but does NOT set `font-display`. The `italic` modifier on Inter (the body font) looks different from Playfair Display italic, which has actual optical italic cuts that feel more editorial and heritage-brand appropriate.

**FIX:**
```tsx
// BEFORE:
<p className="text-text-primary mb-4 italic">&quot;{t.contentId}&quot;</p>

// AFTER:
<p className="font-display text-text-primary mb-4 italic text-base leading-relaxed">&quot;{t.contentId}&quot;</p>
```

---

## BUG 10 — FeaturedProducts Section: Heading is text-xl/text-2xl but Should Be display-sm

**WHERE:** `components/store/home/FeaturedProducts.tsx:47-50`
**SPEC:** DESIGN_SYSTEM.md §3.2 — "display-sm = 30px, Playfair Display — Sub-section headlines." §11.1 — "Section title: 'Produk Unggulan' (Playfair Display, Display-sm)."
**ACTUAL:**
```tsx
<h2 className="font-display text-xl md:text-2xl font-semibold text-text-primary">
  Produk Unggulan
</h2>
```
`text-xl` = 20px mobile, `text-2xl` = 24px desktop. Both are below the `display-sm` = 30px spec for section headlines. This makes the homepage look lower-quality.

**FIX:**
```tsx
// BEFORE:
<h2 className="font-display text-xl md:text-2xl font-semibold text-text-primary">

// AFTER:
<h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary">
```
`text-2xl` = 24px mobile (reasonable given viewport), `text-3xl` = 30px desktop = `display-sm` per spec.

Also fix the same issue in:
- `WhyDapurDekaka.tsx:47` → change `text-xl md:text-2xl` to `text-2xl md:text-3xl`
- `Testimonials.tsx:62` → same fix
- `InstagramFeed.tsx` heading → same fix

---

## BUG 11 — CartItem: Price Color Mixed with Text Size Issues

**WHERE:** `components/store/cart/CartItem.tsx:63`
**ACTUAL:**
```tsx
<p className="font-body font-bold text-brand-red text-sm md:text-base mt-1">
  {formatIDR(item.unitPrice)}
```
The unit price (price per 1 item) is shown as `text-sm` on mobile. But the subtotal row at the bottom:
```tsx
<span className="font-body font-bold text-brand-red text-sm md:text-base">
  {formatIDR(item.unitPrice * item.quantity)}
</span>
```
Both use the same visual weight. The subtotal (the more important number) should be visually larger/bolder than the unit price to create hierarchy.

**FIX — Create visual hierarchy between unit price and subtotal:**
```tsx
// Unit price (line 63) — make it secondary:
<p className="font-body font-medium text-text-secondary text-xs md:text-sm mt-1">
  {formatIDR(item.unitPrice)} / item
</p>

// Subtotal (line 107-110) — keep bold brand-red but make it slightly larger:
<div className="bg-brand-cream px-4 py-2 flex items-center justify-between">
  <span className="text-text-secondary text-xs md:text-sm">Subtotal</span>
  <span className="font-body font-bold text-brand-red text-base md:text-lg">
    {formatIDR(item.unitPrice * item.quantity)}
  </span>
</div>
```

---

## BUG 12 — Footer: Link Hover State Is Wrong Color (hover:text-brand-cream on brand-cream text)

**WHERE:** `components/store/layout/Footer.tsx:19,27,38,48`
**SPEC:** DESIGN_SYSTEM.md §11.1 Footer — "Links: cream/60%, hover cream/100%". Starting state is `text-brand-cream/80`, hover should be `text-brand-cream` (100% opacity).
**ACTUAL:**
```tsx
<Link href="/products" className="hover:text-brand-cream">Produk</Link>
```
The base footer text is `text-brand-cream/80` (from the `<footer>` wrapper). The hover adds `text-brand-cream` (100%). This IS correct behavior — but the Tailwind `hover:text-brand-cream` overwrites the `/80` opacity modifier completely, which is fine. ✅

However, the **transition** is missing:
```tsx
// BEFORE:
<Link href="/products" className="hover:text-brand-cream">Produk</Link>

// AFTER:
<Link href="/products" className="hover:text-brand-cream transition-colors duration-150">Produk</Link>
```
Apply `transition-colors duration-150` to all footer links.

---

## BUG 13 — PromoBanner: Hardcoded "PROMO 10% OFF" Label

**WHERE:** `components/store/home/PromoBanner.tsx:23`
**SPEC:** The PromoBanner receives `promoCode`, `promoTitle`, `promoSubtitle` as props from DB settings — fully dynamic. But the badge label is hardcoded.
**ACTUAL:**
```tsx
<span className="inline-block px-4 py-1 bg-white/20 text-white rounded-pill text-sm font-semibold mb-4">
  PROMO 10% OFF
</span>
```
This "PROMO 10% OFF" badge is hardcoded and will always show "10% OFF" even when the actual promo is a different discount type (free shipping, buy-X-get-Y, etc.).

**FIX — Add a `promoLabel` prop:**
```tsx
// In PromoBanner component:
interface PromoBannerProps {
  promoCode?: string;
  promoTitle?: string;
  promoSubtitle?: string;
  promoLabel?: string;  // NEW
}

export function PromoBanner({
  promoCode = 'SELAMATDATANG',
  promoTitle = 'Untuk pembelian pertama kamu',
  promoSubtitle = 'Gunakan kode:',
  promoLabel = 'PROMO SPESIAL',  // default
}: PromoBannerProps) {
  // ...
  <span className="...">
    {promoLabel}
  </span>
```

In `app/(store)/page.tsx`, fetch the label from system settings:
```tsx
const promoLabel = settings.find(s => s.key === 'PROMO_LABEL')?.value ?? 'PROMO SPESIAL';
// Pass as <PromoBanner promoLabel={promoLabel} ... />
```

---

## BUG 14 — CartSummary: "Total" Line Uses text-lg But Inconsistent With Checkout Total

**WHERE:** `components/store/cart/CartSummary.tsx:80`
**ACTUAL:**
```tsx
<span className="font-body font-bold text-brand-red text-lg">{formatIDR(total)}</span>
```
In checkout page (`page.tsx:793-794`), the payment button shows:
```tsx
`Bayar Sekarang — ${formatIDR(totalAmount)}`
```
In the OrderSummaryCard sidebar, the total will have its own styling. Three different places show the total price with three different visual treatments, causing visual inconsistency across the checkout funnel.

**FIX — Standardize: total always uses `text-xl font-bold text-brand-red` with IDR format:**
```tsx
// CartSummary.tsx line 80:
<span className="font-body font-bold text-brand-red text-xl">{formatIDR(total)}</span>

// Payment button (checkout/page.tsx:793):
// Keep as is — button text format is intentional.
// But add a separate total display line above the button:
<div className="flex justify-between items-center mb-4 p-3 bg-brand-cream rounded-lg">
  <span className="font-semibold text-text-primary">Total Pembayaran</span>
  <span className="font-body font-bold text-brand-red text-xl">{formatIDR(totalAmount)}</span>
</div>
```

---

## BUG 15 — Missing text-text-muted Class (Used but Not Defined)

**WHERE:** `components/store/cart/CartSummary.tsx:61`
**ACTUAL:**
```tsx
<span className="font-medium text-text-muted text-xs">Masukkan alamat</span>
```
`text-text-muted` is NOT defined in `tailwind.config.ts`. The config only has:
- `text.primary: '#1A1A1A'`
- `text.secondary: '#6B6B6B'`
- `text.disabled: '#ABABAB'`
- `text.inverse: '#FFFFFF'`

`text-text-muted` will silently produce no color styling — the text will inherit whatever parent color is set.

**FIX — Replace with the correct token:**
```tsx
// BEFORE:
<span className="font-medium text-text-muted text-xs">Masukkan alamat</span>

// AFTER:
<span className="font-medium text-text-disabled text-xs">Masukkan alamat</span>
```
`text-disabled` (#ABABAB) is the appropriate token for placeholder/inactive text.

---

## SUMMARY TABLE

| # | Component | Issue | Severity | File |
|---|-----------|-------|----------|------|
| 01 | BottomNav | Emoji icons — not colorable, not Lucide, renders differently per OS | High | BottomNav.tsx:28-38 |
| 02 | ProductCard | Product name missing explicit `text-base` size | Medium | ProductCard.tsx:141 |
| 03 | ProductCard | `mb-3` below caption is too large | Low | ProductCard.tsx:143 |
| 04 | WhyDapurDekaka | Emoji icons, wrong size, not colorable | High | WhyDapurDekaka.tsx:7-14 |
| 05 | HeroCarousel | Text-3xl → text-6xl is too big a jump, missing `leading-tight` | Medium | HeroCarousel.tsx:56,94 |
| 06 | Cart | Page h1 is text-2xl, should be text-2xl md:text-3xl | Low | cart/page.tsx:83 |
| 07 | Checkout | Page h1 is text-xl, too small | Low | checkout/page.tsx:470 |
| 08 | ProductDetail | h1 missing `leading-tight` for Playfair Display | Low | ProductDetailClient.tsx:182 |
| 09 | Testimonials | Quote text missing `font-display italic` | Medium | Testimonials.tsx:80 |
| 10 | All sections | Section headings are text-xl/2xl, should be text-2xl/3xl | High | Multiple files |
| 11 | CartItem | Unit price and subtotal have same visual weight — no hierarchy | Medium | CartItem.tsx:63,107 |
| 12 | Footer | Links missing `transition-colors` | Low | Footer.tsx:19,27,38,48 |
| 13 | PromoBanner | "PROMO 10% OFF" hardcoded, not dynamic | Medium | PromoBanner.tsx:23 |
| 14 | CartSummary | Total price inconsistently sized across funnel | Medium | CartSummary.tsx:80 |
| 15 | CartSummary | `text-text-muted` class doesn't exist in tailwind config | High | CartSummary.tsx:61 |
