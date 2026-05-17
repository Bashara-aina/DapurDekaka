# UIUX-01 — Layout, Spacing & Grid System Audit
**DapurDekaka.com | UI/UX Deep Audit Series**
**Date:** May 2026 | **Status:** Actionable — use with Cursor

---

## OVERVIEW

This file audits all layout-level issues: container padding, section spacing, page margins, grid structure, and bottom navigation safe-area handling. Every issue has a **WHERE** (file + line), **SPEC** (what DESIGN_SYSTEM.md says), **ACTUAL** (what the code does), and **FIX** (exact change needed).

---

## BUG 01 — Store Layout: Missing Bottom Safe Area for Content Pages

**WHERE:** `app/(store)/layout.tsx:13`
**SPEC:** DESIGN_SYSTEM.md §4.4 — "All pages must account for the 80px bottom navigation bar on mobile. Bottom: `pb-safe` plus 80px"
**ACTUAL:**
```tsx
<main className="min-h-screen pb-20 md:pb-0">{children}</main>
```
`pb-20` = 80px, which is correct for the navbar itself. BUT there is **zero safe-area-inset-bottom** handling. On iPhone notch models (iPhone X+), content at the very bottom gets clipped under the system home indicator bar.

**FIX:** Change to:
```tsx
<main className="min-h-screen pb-20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
  {children}
</main>
```
Also add to `<html>` or `<body>` in `app/layout.tsx`:
```tsx
// In app/layout.tsx, add to the <body> className:
<body className="font-body antialiased bg-brand-cream text-text-primary [--safe-area-inset-bottom:env(safe-area-inset-bottom)]">
```

---

## BUG 02 — Cart Page: Double Bottom Padding Creates Huge Empty Space

**WHERE:** `app/(store)/cart/page.tsx:80`
**SPEC:** Content pages should have `pb-20` from the store layout wrapper (already applied to `<main>`).
**ACTUAL:**
```tsx
<div className="min-h-screen bg-brand-cream pb-32">
```
The store layout already adds `pb-20` to `<main>`. The cart page adds another `pb-32` (128px) inside that — so mobile users get **208px** of empty space at the bottom. Desktop gets 128px of unnecessary padding since `md:pb-0` is on main but `pb-32` is inside.

**FIX:** Remove `pb-32` from the cart page root div. The layout already handles bottom clearance:
```tsx
// BEFORE
<div className="min-h-screen bg-brand-cream pb-32">

// AFTER
<div className="min-h-screen bg-brand-cream">
```
For the empty cart state at line 70, same fix:
```tsx
// BEFORE
<div className="min-h-screen bg-brand-cream">

// AFTER  
<div className="min-h-screen bg-brand-cream">  ← already fine, leave as-is
```

---

## BUG 03 — Checkout Page: Sticky Header Overlap on Scroll

**WHERE:** `app/(store)/checkout/page.tsx:462–488`
**SPEC:** DESIGN_SYSTEM.md §11.3 — Stepper stays visible. The sticky total bar spec was not in DESIGN_SYSTEM but was added as "FIX 11" in code.
**ACTUAL:**
```tsx
{/* FIX 11: Mobile sticky total bar */}
<div className="lg:hidden sticky top-[76px] z-10 bg-white border-b border-brand-cream-dark px-4 py-2 flex justify-between text-sm">

{/* Header with stepper */}
<div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
```
**Two issues:**
1. Both the stepper header and the "mobile sticky total bar" are `sticky` with `z-10`. They overlap because the total bar uses `top-[76px]` but the header height is actually ~88px on mobile (py-4 + h1 + mt-4 + stepper = ~88px, not 76px).
2. The header itself has `z-10` but the mobile navbar also has `z-50`. If user scrolls fast, the sticky header can render beneath the navbar.

**FIX:**
```tsx
// Change navbar z-index strategy:
// In components/store/layout/Navbar.tsx (mobile header, line 82):
<header className="md:hidden sticky top-0 z-40 bg-white border-b border-brand-cream-dark">

// In checkout page header (line 468):
<div className="bg-white border-b border-brand-cream-dark sticky top-14 md:top-16 z-30">

// In the mobile total bar (line 462):
// Remove this entirely — it conflicts and the info is already in the sidebar
// If keeping it, fix top offset:
<div className="lg:hidden sticky top-[calc(3.5rem+var(--checkout-header-height,88px))] z-20 ...">
```

---

## BUG 04 — Container Padding Inconsistency: px-4 vs px-6 vs container mx-auto

**WHERE:** Multiple files — this is systemic
**SPEC:** DESIGN_SYSTEM.md §4.2:
```
.container { padding: 0 16px (mobile) / 0 24px (md) / 0 32px (lg) }
```
**ACTUAL (inconsistent across files):**

| File | Class Used | Actual Behavior |
|------|-----------|-----------------|
| `components/store/home/FeaturedProducts.tsx:43` | `py-8 px-4 container mx-auto` | `px-4` + `container` → double padding (container adds its own padding) |
| `components/store/home/WhyDapurDekaka.tsx:41` | `py-12 px-4 bg-white` + inner `container mx-auto` | `px-4` on section + `container` on inner div → **16px outer + container's own padding = 32px total on mobile** |
| `components/store/home/PromoBanner.tsx:17` | `py-6 px-4 container mx-auto` | Same double-padding issue |
| `components/store/home/CategoryChips.tsx:34` | `overflow-x-auto px-4 pb-2 mx-4` | `mx-4` adds ANOTHER 16px margin on top of `px-4` |
| `components/store/home/InstagramFeed.tsx:20` | `py-12 px-4 bg-brand-cream` + `container mx-auto` | Double padding |
| `components/store/layout/Footer.tsx:7` | `container mx-auto px-6` | Correct — px-6 only on the container |
| `app/(store)/cart/page.tsx:104` | `px-4 py-4 container mx-auto` | Double padding again |

**ROOT CAUSE:** Next.js doesn't have a default `.container` class; Tailwind's `container` by itself only sets `max-width`. But `container mx-auto` adds no padding on its own. The real issue is developers writing `px-4 container mx-auto` thinking they need both, when they should either use ONLY `container mx-auto` with padding inside, OR use a custom `.section-container` utility.

**FIX — Define a reusable pattern in `globals.css`:**
```css
@layer components {
  .section-container {
    @apply container mx-auto px-4 md:px-6 lg:px-8;
    max-width: 1280px;
  }
}
```

**Then fix each file:**
```tsx
// FeaturedProducts.tsx line 43 — BEFORE:
<section className="py-8 px-4 container mx-auto">
// AFTER:
<section className="py-8 section-container">

// WhyDapurDekaka.tsx — BEFORE:
<section className="py-12 px-4 bg-white">
  <div className="container mx-auto">
// AFTER:
<section className="py-12 bg-white">
  <div className="section-container">

// PromoBanner.tsx line 17 — BEFORE:
<section className="py-6 px-4 container mx-auto">
// AFTER:
<section className="py-6 section-container">

// CategoryChips.tsx line 34 — BEFORE:
className="flex gap-2 overflow-x-auto px-4 pb-2 mx-4 scrollbar-hide..."
// AFTER (no mx-4 — px-4 already gives the indent):
className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide..."

// cart/page.tsx line 104 — BEFORE:
<div className="px-4 py-4 container mx-auto">
// AFTER:
<div className="section-container py-4">
```

---

## BUG 05 — ProductDetailClient: Sticky Bottom Bar Position Breaks on Mobile

**WHERE:** `components/store/products/ProductDetailClient.tsx:304`
**SPEC:** DESIGN_SYSTEM.md §6.5 — "Bottom: 80px (above bottom nav)"
**ACTUAL:**
```tsx
<div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-white border-t border-brand-cream-dark p-4 pb-[calc(1rem+env(safe-area-inset-bottom))">
```
**Two bugs:**
1. **Missing closing bracket** on `pb-[...]` class — the string is malformed: `pb-[calc(1rem+env(safe-area-inset-bottom))"` has a `"` instead of `]"`. This will silently fail and Tailwind will generate no pb class.
2. **`md:bottom-0`** means on desktop the sticky bar sits AT the very bottom of the screen behind any footer or page content. It should be `md:hidden` since desktop has no bottom nav and the add-to-cart button is visible in the product info card.

**FIX:**
```tsx
// BEFORE:
<div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-white border-t border-brand-cream-dark p-4 pb-[calc(1rem+env(safe-area-inset-bottom))">

// AFTER:
<div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:hidden left-0 right-0 bg-white border-t border-brand-cream-dark p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
```

---

## BUG 06 — Homepage Root Div: bg-brand-cream Creates Mismatched Section Backgrounds

**WHERE:** `app/(store)/page.tsx:232`
**SPEC:** DESIGN_SYSTEM.md §11.1 — Sections alternate between `bg-white` and `bg-brand-cream`. The page root should be transparent/neutral.
**ACTUAL:**
```tsx
<div className="bg-brand-cream">
  <HeroCarousel ... />       {/* h-[50vh] bg-brand-red — fine */}
  <CategoryChips ... />      {/* py-4 — inherits bg-brand-cream from parent */}
  <FeaturedProducts ... />   {/* py-8 — inherits bg-brand-cream from parent */}
  <PromoBanner ... />        {/* bg-brand-red card — fine */}
  <WhyDapurDekaka />        {/* bg-white — fine, overrides */}
  <InstagramFeed />          {/* bg-brand-cream — redundant with parent */}
  <Testimonials />           {/* bg-white — fine */}
  <HomePageCTA />            {/* unknown */}
</div>
```
`FeaturedProducts` (line 43: `py-8 px-4 container mx-auto`) has NO background color and inherits `bg-brand-cream` from the page wrapper. But the section should be `bg-surface-off` (#FAFAF8) or `bg-white` to create contrast/separation from the cream sections.

**FIX:**
```tsx
// In app/(store)/page.tsx — change wrapper to bg-surface-off (or remove bg entirely and let each section define its own):
<div className="bg-surface-off">

// OR remove background from wrapper and let each section own it:
<div>
  <HeroCarousel ... />
  <section className="bg-brand-cream py-4"><CategoryChips ... /></section>
  <section className="bg-white py-8"><FeaturedProducts ... /></section>
  <PromoBanner ... />    {/* already has own bg */}
  <WhyDapurDekaka />    {/* already has bg-white */}
  <InstagramFeed />      {/* already has bg-brand-cream */}
  <Testimonials />       {/* already has bg-white */}
  <HomePageCTA />
</div>
```

---

## BUG 07 — FeaturedProducts Mobile: Card Width 160px (w-40) Is Too Narrow

**WHERE:** `components/store/home/FeaturedProducts.tsx:152`
**SPEC:** DESIGN_SYSTEM.md §11.1 §6 — "Horizontal scroll, 2.5 cards visible, peek effect." On a 390px screen (iPhone 14), 2.5 cards = ~156px each. The card content (product name + price) needs at least 140px of text width.
**ACTUAL:**
```tsx
<MotionFn.div key={product.id} variants={itemVariants} className="w-40 flex-shrink-0">
```
`w-40` = 160px. This IS close to spec, but `ProductCard` inside has `p-4` (16px padding × 2 = 32px) leaving only **128px** for text content. The Playfair Display product name at 16px will overflow with 1 line at 128px text width, causing `line-clamp-2` to truncate almost every product name to 1 character per line visually.

**FIX:** Increase to `w-44` (176px) for a better text area:
```tsx
// BEFORE:
<MotionFn.div key={product.id} variants={itemVariants} className="w-40 flex-shrink-0">

// AFTER:
<MotionFn.div key={product.id} variants={itemVariants} className="w-44 flex-shrink-0">
```
Also reduce ProductCard padding from `p-4` to `p-3` when used in horizontal scroll context. Pass a `compact` prop:
```tsx
// In ProductCard.tsx, add:
interface ProductCardProps {
  // ...existing
  compact?: boolean;
}
// Change content div:
<div className={cn('p-4', compact && 'p-3')}>
```

---

## BUG 08 — Related Products Grid on Product Detail: 2-col Grid Too Tight on Small Phones

**WHERE:** `components/store/products/ProductDetailClient.tsx:243`
**SPEC:** DESIGN_SYSTEM.md §5.2 — Product card minimum comfortable width for horizontal variant is 120px image + content. For vertical variant (used in related), aspect-square image + p-3 content needs ~155px minimum.
**ACTUAL:**
```tsx
<div className="grid grid-cols-2 gap-3">
```
On a 360px screen (Samsung Galaxy A series, very common in Indonesia): `(360 - 16 - 16 - 12) / 2 = 158px` per card. The image is `aspect-square` = 158×158px. The product name at 14px font in a 158px container with `p-3` (12px padding × 2) = 134px text width. Fine, but the price at `font-bold text-sm text-brand-red mt-1` will wrap on longer product names.

**BETTER FIX — no grid change needed, but add min-width protection:**
```tsx
// BEFORE:
<div className="grid grid-cols-2 gap-3">

// AFTER:
<div className="grid grid-cols-2 gap-3 min-w-0">
  {/* Inside each card, ensure text truncation: */}
  <p className="text-sm font-medium text-text-primary line-clamp-2 leading-tight">
```
The `line-clamp-1` in the current implementation (line 280) is too aggressive — it clips at 1 line for narrow cards. Change to `line-clamp-2` with `leading-tight` to allow wrapping while still limiting height.

---

## BUG 09 — Checkout Container: No Max Width on Mobile, Content Stretches

**WHERE:** `app/(store)/checkout/page.tsx:489`
**SPEC:** DESIGN_SYSTEM.md §4.2 — content max-width 1280px.
**ACTUAL:**
```tsx
<div className="container mx-auto px-4 py-6">
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
```
This is correct on desktop. But on very wide Android tablets in landscape (1024px), `lg:grid-cols-3` kicks in without the two-column form area having a meaningful max-width on the left 2 columns. The form inputs stretch to fill enormous width on landscape tablets.

**FIX:**
```tsx
// In the main form area div (line 492):
// BEFORE:
<div className="lg:col-span-2">

// AFTER:
<div className="lg:col-span-2 max-w-2xl">
```

---

## BUG 10 — Footer: Mobile Bottom Padding pb-32 Creates 128px Dead Space

**WHERE:** `components/store/layout/Footer.tsx:6`
**SPEC:** Footer should sit above the BottomNav which is 80px tall. So `pb-20` is needed on mobile for the footer to clear the fixed nav.
**ACTUAL:**
```tsx
<footer className="bg-[#1A1A1A] text-brand-cream/80 pt-12 pb-32 md:pb-12">
```
`pb-32` = 128px. The bottom nav is `h-20` = 80px. So there's **48px of unnecessary dead space** on mobile at the bottom of the footer. This pushes the copyright text into a dead zone the user sees before the bottom nav.

**FIX:**
```tsx
// BEFORE:
<footer className="bg-[#1A1A1A] text-brand-cream/80 pt-12 pb-32 md:pb-12">

// AFTER:
<footer className="bg-[#1A1A1A] text-brand-cream/80 pt-12 pb-24 md:pb-12">
```
`pb-24` = 96px gives `80px (nav) + 16px (breathing room)` which is correct.

---

## BUG 11 — Footer: No "Tentang Kami" Link Despite Being Specified in DESIGN_SYSTEM

**WHERE:** `components/store/layout/Footer.tsx` — Menu section (lines 15-29)
**SPEC:** DESIGN_SYSTEM.md §11.1 Footer spec: `[Produk] [Blog] [B2B] [Tentang Kami]`
**ACTUAL:**
```tsx
<ul className="space-y-2 text-sm">
  <li><Link href="/products">Produk</Link></li>
  <li><Link href="/blog">Blog</Link></li>
  <li><Link href="/b2b">B2B</Link></li>
  {/* Missing: Tentang Kami */}
</ul>
```
The "About Us" page exists at `app/(store)/about/page.tsx` but is not linked in the footer.

**FIX:**
```tsx
<ul className="space-y-2 text-sm">
  <li><Link href="/products" className="hover:text-brand-cream">Produk</Link></li>
  <li><Link href="/blog" className="hover:text-brand-cream">Blog</Link></li>
  <li><Link href="/b2b" className="hover:text-brand-cream">B2B</Link></li>
  <li><Link href="/about" className="hover:text-brand-cream">Tentang Kami</Link></li>
</ul>
```

---

## BUG 12 — Blog Page Not in Main Navigation

**WHERE:** `components/store/layout/Navbar.tsx:12-17` and `components/store/layout/BottomNav.tsx:27-39`
**SPEC:** DESIGN_SYSTEM.md §6.2: Desktop nav: `Beranda | Produk | Blog | B2B`. §6.1 Bottom nav: main pages.
**ACTUAL Desktop nav:** Blog IS included (line 16: `{ href: '/blog', label: 'Blog' }`). ✅
**ACTUAL Bottom nav:** Blog is **NOT** in the bottom nav items array. The bottom nav shows: Beranda, Produk, Cart, (conditionally B2B), Akun, WA. Blog is hidden on mobile entirely.

**FIX — Add Blog to BottomNav or swap WA to a static position:**
The WhatsApp link in BottomNav (line 34) is incorrect per spec — spec says WA should be a floating button (§5.7), not a bottom nav tab. The floating WA button already exists in `WhatsAppButton.tsx`. Remove WA from BottomNav and add Blog:

```tsx
// In BottomNav.tsx, change navItems:
const navItems = [
  { href: '/', icon: '🏠', label: t('home') },
  { href: '/products', icon: '📦', label: t('products') },
  { href: '/blog', icon: '📝', label: 'Blog' },
  { href: '/cart', icon: '🛒', label: t('cart'), badge: totalItems },
  { href: '/account', icon: '👤', label: t('account') },
  // REMOVE the WA tab — WhatsAppButton component handles this already
];
```

---

## SUMMARY TABLE

| # | Component | Issue | Severity | Lines |
|---|-----------|-------|----------|-------|
| 01 | store layout | No `env(safe-area-inset-bottom)` | High | layout.tsx:13 |
| 02 | Cart page | Double bottom padding (pb-32 + pb-20 from layout) | Medium | cart/page.tsx:80 |
| 03 | Checkout | Two sticky headers with wrong z-index and offset | High | checkout/page.tsx:462-488 |
| 04 | All sections | `px-4 container mx-auto` double-padding pattern | Medium | systemic |
| 05 | ProductDetail | Malformed CSS calc + md:bottom-0 on sticky bar | High | ProductDetailClient.tsx:304 |
| 06 | Homepage | bg-brand-cream on wrapper eliminates section contrast | Low | page.tsx:232 |
| 07 | Featured | w-40 too narrow for product card content | Medium | FeaturedProducts.tsx:152 |
| 08 | Related products | line-clamp-1 too aggressive at 2-col on 360px | Low | ProductDetailClient.tsx:280 |
| 09 | Checkout | Form inputs stretch on landscape tablet | Low | checkout/page.tsx:492 |
| 10 | Footer | pb-32 adds 48px unnecessary dead space on mobile | Low | Footer.tsx:6 |
| 11 | Footer | Missing "Tentang Kami" link | Low | Footer.tsx:15-29 |
| 12 | BottomNav | Blog missing, WA tab should be floating button | High | BottomNav.tsx:27-39 |
