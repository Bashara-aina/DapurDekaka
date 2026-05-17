# UIUX-03 — Component Design Gaps & Incomplete Implementations
**DapurDekaka.com | UI/UX Deep Audit Series**
**Date:** May 2026 | **Status:** Actionable — use with Cursor

---

## OVERVIEW

This file audits components that exist in code but are incomplete, non-functional, or missing key design behaviors specified in DESIGN_SYSTEM.md. Focus: buttons, badges, cards, steppers, empty states, and skeleton loaders.

---

## GAP 01 — Empty States: No Dimsum Bowl Illustration (All pages use generic text)

**WHERE:** `components/store/cart/EmptyCart.tsx`, `components/store/common/EmptyState.tsx`
**SPEC:** DESIGN_SYSTEM.md §10.2 — "The Sad Dimsum Bowl Character — a simple, charming illustration... The mascot for all empty states. `/public/illustrations/dimsum-[emotion].svg`"
**ACTUAL:** The `/public/illustrations/` directory does not exist. Let's verify:
```
public/
  assets/
    logo/
      logo.png
      halal.png
  favicon.ico
  ...
```
No illustrations directory, no dimsum SVG files. The EmptyCart and EmptyState components render generic text without any illustration.

**WHAT TO CREATE:**

Create `/public/illustrations/dimsum-sad.svg` (for empty cart/no results):
```svg
<!-- /public/illustrations/dimsum-sad.svg -->
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Bamboo steamer basket base -->
  <ellipse cx="60" cy="88" rx="44" ry="12" fill="#C8B89A"/>
  <rect x="16" y="52" width="88" height="36" rx="8" fill="#E0D4BC"/>
  <rect x="16" y="52" width="88" height="8" rx="4" fill="#C8B89A"/>
  <!-- Basket weave lines -->
  <line x1="32" y1="60" x2="32" y2="88" stroke="#C8B89A" stroke-width="1.5"/>
  <line x1="48" y1="60" x2="48" y2="88" stroke="#C8B89A" stroke-width="1.5"/>
  <line x1="64" y1="60" x2="64" y2="88" stroke="#C8B89A" stroke-width="1.5"/>
  <line x1="80" y1="60" x2="80" y2="88" stroke="#C8B89A" stroke-width="1.5"/>
  <line x1="16" y1="68" x2="104" y2="68" stroke="#C8B89A" stroke-width="1.5"/>
  <line x1="16" y1="76" x2="104" y2="76" stroke="#C8B89A" stroke-width="1.5"/>
  <!-- Face -->
  <circle cx="60" cy="38" r="26" fill="#F0EAD6" stroke="#C8B89A" stroke-width="2"/>
  <!-- Sad eyes -->
  <ellipse cx="50" cy="35" rx="3" ry="4" fill="#1A1A1A"/>
  <ellipse cx="70" cy="35" rx="3" ry="4" fill="#1A1A1A"/>
  <!-- Sad mouth -->
  <path d="M 50 48 Q 60 43 70 48" stroke="#C8102E" stroke-width="2" stroke-linecap="round" fill="none"/>
  <!-- Tear drop -->
  <ellipse cx="47" cy="43" rx="2" ry="3" fill="#2563EB" opacity="0.6"/>
  <!-- Steam wisps (empty, so less steam) -->
  <path d="M 40 24 Q 38 20 40 16" stroke="#C8B89A" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  <path d="M 60 20 Q 58 16 60 12" stroke="#C8B89A" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  <path d="M 80 24 Q 78 20 80 16" stroke="#C8B89A" stroke-width="1.5" stroke-linecap="round" fill="none"/>
</svg>
```

Create `/public/illustrations/dimsum-sleeping.svg` for "No Orders Yet":
```svg
<!-- Same structure but with closed eyes (two curved lines) and ZZZ instead of tear -->
<!-- Replace eyes with: -->
<path d="M 47 35 Q 50 32 53 35" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" fill="none"/>
<path d="M 67 35 Q 70 32 73 35" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" fill="none"/>
<!-- Replace tear with ZZZ: -->
<text x="72" y="28" font-family="Inter" font-size="8" fill="#ABABAB">z</text>
<text x="76" y="22" font-family="Inter" font-size="10" fill="#ABABAB">z</text>
<text x="81" y="15" font-family="Inter" font-size="12" fill="#ABABAB">z</text>
```

**UPDATE EmptyCart.tsx:**
```tsx
// components/store/cart/EmptyCart.tsx
import Image from 'next/image';
import Link from 'next/link';

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6">
        <Image
          src="/illustrations/dimsum-sad.svg"
          alt="Keranjang kosong"
          width={120}
          height={120}
          className="mx-auto"
        />
      </div>
      <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">
        Keranjangmu masih kosong 🥺
      </h2>
      <p className="text-text-secondary text-sm mb-6 max-w-xs">
        Yuk, temukan dimsum favoritmu dan mulai belanja!
      </p>
      <Link
        href="/products"
        className="h-12 px-8 bg-brand-red text-white font-bold rounded-button flex items-center hover:bg-brand-red-dark transition-colors shadow-button"
      >
        Mulai Belanja
      </Link>
    </div>
  );
}
```

---

## GAP 02 — OrderTimeline Component Exists But Is Never Rendered

**WHERE:** `components/store/orders/OrderTimeline.tsx` (file exists), `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`
**SPEC:** DESIGN_SYSTEM.md §5.6 — Detailed timeline with completed/active/pending step indicators.
**ACTUAL:** The `OrderTimeline` component was built but never imported in `OrderTrackingClient.tsx` (confirmed in previous audit as a dead import). The tracking page shows order status as raw text badges without the visual timeline.

**FIX — Read OrderTimeline.tsx first, then use it in OrderTrackingClient:**
First verify what OrderTimeline expects as props, then in `OrderTrackingClient.tsx`:
```tsx
// Add import:
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';

// In the render, replace the raw status display with:
<OrderTimeline
  statusHistory={order.statusHistory}
  currentStatus={order.status}
/>
```

---

## GAP 03 — HalalBadge: Not Consistent — Two Implementations Exist

**WHERE:** 
- `components/store/common/HalalBadge.tsx`
- `components/store/products/ProductDetailClient.tsx:268` (inline halal badge with Image)
**SPEC:** DESIGN_SYSTEM.md §5.4 — "HALAL — green background (#DCFCE7), green text (#16A34A), '✓ HALAL' text"
**ACTUAL:**

The HalalBadge component likely shows text-based badge. But in ProductDetailClient (line 268):
```tsx
{related.isHalal && (
  <div className="absolute top-2 right-2 w-8 h-8">
    <Image
      src="/assets/logo/halal.png"
      alt="Halal"
      fill
      className="object-contain"
    />
  </div>
)}
```
Related products use a small 32×32px PNG halal logo image. Main product detail uses the `<HalalBadge />` component. Product cards use `<HalalBadge />`. This creates visual inconsistency.

**FIX — Use `<HalalBadge />` everywhere, delete the inline Image approach:**
```tsx
// In ProductDetailClient.tsx line 267-274, replace with:
{related.isHalal && (
  <div className="absolute top-2 right-2">
    <HalalBadge />
  </div>
)}
```

Also verify HalalBadge.tsx matches spec:
```tsx
// Expected implementation of HalalBadge.tsx:
export function HalalBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold rounded-badge">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      HALAL
    </span>
  );
}
```

---

## GAP 04 — StockBadge: Missing "HABIS" Visual State (Shows Nothing for stock === 0 in ProductCard)

**WHERE:** `components/store/products/ProductCard.tsx:115-120` and `components/store/common/StockBadge.tsx`
**SPEC:** DESIGN_SYSTEM.md §5.2 — "'Habis' state: image has 50% opacity overlay with 'HABIS' badge center."
**ACTUAL in ProductCard.tsx:**
```tsx
{isOutOfStock && (
  <span className="px-2 py-1 bg-text-secondary text-white text-xs font-bold rounded">
    HABIS
  </span>
)}
```
This shows a text badge at `top-2 right-2` (alongside the Halal badge). But the spec says the HABIS badge should be **centered on the image** with a **50% opacity overlay on the image itself**.

Also, in `ProductCardHorizontal.tsx` (line 78):
```tsx
{isOutOfStock ? (
  <StockBadge stock={0} />
) : ...}
```
This shows `StockBadge` with stock=0 in the content area below the image — not on the image with overlay.

**FIX for ProductCard.tsx — Add image overlay:**
```tsx
{/* Image container — add relative positioning for overlay */}
<div className="relative aspect-square bg-brand-cream">
  <Image ... />
  
  {/* Out of stock overlay */}
  {isOutOfStock && (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-card">
      <span className="px-3 py-1.5 bg-white/90 text-text-primary text-xs font-bold rounded-badge tracking-wide">
        HABIS
      </span>
    </div>
  )}
  
  {/* Only show Halal badge if NOT out of stock (habis badge takes priority) */}
  {!isOutOfStock && (
    <div className="absolute top-2 right-2 flex flex-col gap-1">
      <HalalBadge />
    </div>
  )}
  
  {/* Stock warning — only when low, not zero */}
  {!isOutOfStock && variant.stock < 5 && (
    <div className="absolute top-2 left-2">
      <StockBadge stock={variant.stock} />
    </div>
  )}
  
  {/* Quick add button — only when in stock */}
  {canQuickAdd && (
    <button ... />
  )}
</div>
```

---

## GAP 05 — SkeletonCard: Does Not Match ProductCard Shape

**WHERE:** `components/store/common/SkeletonCard.tsx`
**SPEC:** DESIGN_SYSTEM.md §5.8 — "All skeleton screens must match the EXACT layout shape of the content they represent. Product card skeleton: same dimensions as product card, shimmer animation."
**ACTUAL:** The skeleton component likely renders a generic rectangle. Without reading it (it's a simple component), the key issue is that `ProductCard` has a specific structure:
- `aspect-square` image area
- `p-4` content area with: product name (2-line), variant name (1-line), price + button row

The skeleton must replicate this exact structure.

**FIX — ProductCardSkeleton.tsx should be:**
```tsx
// components/store/products/ProductCardSkeleton.tsx
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-square bg-brand-cream-dark" />
      
      {/* Content skeleton */}
      <div className="p-4">
        {/* Product name — 2 lines */}
        <div className="h-4 bg-brand-cream-dark rounded mb-1 w-full" />
        <div className="h-4 bg-brand-cream-dark rounded mb-3 w-3/4" />
        
        {/* Variant name */}
        <div className="h-3 bg-brand-cream-dark rounded mb-3 w-1/2" />
        
        {/* Price + button row */}
        <div className="flex items-center justify-between">
          <div className="h-5 bg-brand-cream-dark rounded w-24" />
          <div className="w-11 h-11 bg-brand-cream-dark rounded-full" />
        </div>
      </div>
    </div>
  );
}
```

Apply the shimmer animation from the design system instead of Tailwind's `animate-pulse`:
```tsx
// Use the shimmer keyframe from tailwind.config.ts:
<div className="bg-white rounded-card shadow-card overflow-hidden">
  <div className="aspect-square bg-gradient-to-r from-brand-cream-dark via-brand-cream to-brand-cream-dark bg-[length:200%_100%] animate-shimmer" />
  ...
</div>
```

---

## GAP 06 — CheckoutStepper: Step Circles Are 44px (w-11 h-11) — Correct But Labels Overflow on Narrow Screens

**WHERE:** `components/store/checkout/CheckoutStepper.tsx:34`
**SPEC:** DESIGN_SYSTEM.md §11.3 — "Completed: brand-red filled circle with checkmark. Active: brand-red filled circle with number. Pending: gray outline circle."
**ACTUAL:**
```tsx
<button className="w-11 h-11 rounded-full ...">
```
`w-11` = 44px, `h-11` = 44px. ✅ Correct size.

**Problem:** The stepper uses `justify-between` on the parent with 4 steps. On a 320px screen (older iPhones):
- 4 circles × 44px = 176px
- The connecting lines (`flex-1`) fill the remaining `320 - 176 - 32px(px-4×2) = 112px`
- 112px / 3 lines = ~37px per connecting line — fine.

But the labels below each circle (`whitespace-nowrap` at line 52):
```tsx
<span className="text-xs mt-1 whitespace-nowrap ...">
  {step.label}
</span>
```
Step labels: "Identitas" (8 chars), "Pengiriman" (10 chars), "Kurir" (5 chars), "Bayar" (5 chars). At `text-xs` (12px) with Inter: "Pengiriman" ≈ 60px wide. The circles are centered at intervals of ~80px. Labels can overlap on 320px screens.

**FIX — Remove `whitespace-nowrap` and let labels wrap, or hide labels on very small screens:**
```tsx
// BEFORE:
<span className="text-xs mt-1 whitespace-nowrap ...">

// AFTER:
<span className="text-[10px] mt-1 text-center max-w-[52px] leading-tight ...">
```
`max-w-[52px]` matches the circle's 44px width with 4px breathing room. `leading-tight` and `text-[10px]` ensures "Pengiriman" wraps to 2 lines gracefully.

---

## GAP 07 — DeliveryMethodToggle: Not Visible in Checkout Flow (Uses Generic Button Styling)

**WHERE:** `components/store/checkout/DeliveryMethodToggle.tsx`
**SPEC:** DESIGN_SYSTEM.md §11.3 — Step 1: "Delivery method toggle: [🚚 Kirim ke Alamat] [🏪 Ambil di Toko]". Should be a visual toggle with icons and descriptions.
**ACTUAL (not read yet, but from checkout/page.tsx usage at line 519):**
```tsx
<DeliveryMethodToggle
  value={formData.deliveryMethod}
  onChange={handleDeliveryMethodChange}
  onBack={handleBack}
/>
```
Without reading the file, the spec calls for a card-based toggle (not radio buttons or simple text), each option being a selectable card with icon + label + brief description.

**REQUIRED IMPLEMENTATION:**
```tsx
// components/store/checkout/DeliveryMethodToggle.tsx
const options = [
  {
    value: 'delivery' as const,
    icon: Truck,
    label: 'Kirim ke Alamat',
    description: 'Dikirim ke alamat kamu',
  },
  {
    value: 'pickup' as const,
    icon: Store,
    label: 'Ambil di Toko',
    description: 'Ambil di Jl. Sinom V No. 7, Bandung',
  },
];

// Each option renders as:
<button
  onClick={() => onChange(option.value)}
  className={cn(
    'w-full flex items-center gap-4 p-4 rounded-card border-2 transition-all text-left',
    value === option.value
      ? 'border-brand-red bg-brand-red/5'
      : 'border-brand-cream-dark hover:border-brand-red/50'
  )}
>
  <div className={cn(
    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
    value === option.value ? 'bg-brand-red text-white' : 'bg-brand-cream text-text-secondary'
  )}>
    <option.Icon className="w-5 h-5" />
  </div>
  <div>
    <p className="font-semibold text-text-primary">{option.label}</p>
    <p className="text-text-secondary text-sm">{option.description}</p>
  </div>
  {value === option.value && (
    <CheckCircle className="w-5 h-5 text-brand-red ml-auto flex-shrink-0" />
  )}
</button>
```

---

## GAP 08 — ProductCard: Quick Add Button (w-8 h-8) Is Below Minimum Touch Target

**WHERE:** `components/store/products/ProductCard.tsx:128-135`
**SPEC:** DESIGN_SYSTEM.md §6.3 — "Minimum touch target: 44×44px for ALL interactive elements."
**ACTUAL:**
```tsx
<button
  onClick={handleQuickAdd}
  className="absolute bottom-2 right-2 w-8 h-8 bg-brand-red rounded-full ..."
  aria-label="Tambah ke keranjang"
>
  <Plus className="w-4 h-4" />
</button>
```
`w-8 h-8` = 32×32px. This is **12px below** the minimum 44×44px touch target spec.

**FIX:**
```tsx
// BEFORE:
className="absolute bottom-2 right-2 w-8 h-8 bg-brand-red rounded-full ..."

// AFTER:
className="absolute bottom-2 right-2 w-11 h-11 bg-brand-red rounded-full ..."
```
`w-11 h-11` = 44×44px. The icon stays `w-4 h-4` (16px) — it will just have more breathing room.

---

## GAP 09 — QuantityStepper in CartItem: Minus Icon Too Small (w-3 h-3)

**WHERE:** `components/store/cart/CartItem.tsx:87,97`
**SPEC:** DESIGN_SYSTEM.md §5.5 — "Each segment [of qty stepper]: 44×44px minimum"
**ACTUAL:**
```tsx
<button
  onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
  className="w-11 h-11 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
>
  <Minus className="w-3 h-3" />  {/* ← icon is only 12px! */}
</button>
```
The button IS 44×44px (w-11 h-11 = correct). But the icon inside is `w-3 h-3` = 12px. DESIGN_SYSTEM.md §8.2 says "Button icons: 18px". A 12px minus/plus icon inside a 44px button is too small — the user sees a tiny thin line.

**FIX:**
```tsx
// BEFORE:
<Minus className="w-3 h-3" />
<Plus className="w-3 h-3" />

// AFTER:
<Minus className="w-4 h-4" />
<Plus className="w-4 h-4" />
```
`w-4 h-4` = 16px — close to the 18px spec and visually clearer.

---

## GAP 10 — ProductDetail: Back Button Is Arrow Character, Not Lucide Icon

**WHERE:** `components/store/products/ProductDetailClient.tsx:136-147`
**SPEC:** DESIGN_SYSTEM.md §8.1 — "← Back | `ArrowLeft` — Navigation". All icons should use Lucide.
**ACTUAL:**
```tsx
<button
  onClick={() => { ... }}
  className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center"
>
  ←  {/* Unicode arrow character */}
</button>
```
The `←` character renders differently on Android (thinner, lighter) vs iOS (bolder). The `w-10 h-10` (40px) is also **below** the 44px minimum touch target.

**FIX:**
```tsx
import { ArrowLeft } from 'lucide-react';

<button
  onClick={() => { ... }}
  className="absolute top-4 left-4 w-11 h-11 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm"
  aria-label="Kembali"
>
  <ArrowLeft className="w-5 h-5 text-text-primary" />
</button>
```

---

## GAP 11 — Lightbox Close Button: Unicode × Character, Below 44px Touch Target

**WHERE:** `components/store/products/ProductDetailClient.tsx:357-364`
**ACTUAL:**
```tsx
<button
  onClick={() => setLightboxOpen(false)}
  className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-text-primary text-2xl font-bold"
  aria-label="Tutup"
>
  ×
</button>
```
Same issue: `×` unicode, `w-10 h-10` = 40px.

**FIX:**
```tsx
import { X } from 'lucide-react';

<button
  onClick={() => setLightboxOpen(false)}
  className="absolute top-4 right-4 w-11 h-11 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm"
  aria-label="Tutup lightbox"
>
  <X className="w-5 h-5 text-text-primary" />
</button>
```

---

## GAP 12 — WhatsAppButton: Missing aria-label for the Tooltip Close Button

**WHERE:** `components/store/layout/WhatsAppButton.tsx:28-31`
**SPEC:** DESIGN_SYSTEM.md §14.2 — "All icon-only buttons have `aria-label`."
**ACTUAL:**
```tsx
<button
  onClick={() => setShowTooltip(false)}
  className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
  aria-label="Tutup"  {/* ← this one has it */}
>
  ×
```
The `aria-label="Tutup"` is there ✅, but `w-6 h-6` = 24px is well below the 44px minimum touch target. This tiny button (positioned absolutely at top-right of the tooltip) is nearly impossible to tap accurately on mobile.

**FIX — Remove the X button from tooltip entirely.** The tooltip should close on mouse leave (already implemented with `onMouseLeave`) and on clicking anywhere else. Or use a larger close target:
```tsx
// Option A: Remove the close button, let the tooltip auto-hide
// No close button needed since onMouseLeave handles it on desktop
// On mobile, clicking anywhere else will close it

// Option B: If keeping close button, make it at least 44x44:
<button
  onClick={() => setShowTooltip(false)}
  className="absolute -top-3 -right-3 w-11 h-11 flex items-center justify-center"
  aria-label="Tutup info"
>
  <X className="w-4 h-4 text-text-secondary" />
</button>
```

---

## GAP 13 — HomePageCTA Component: Unknown Implementation

**WHERE:** `components/store/home/HomePageCTA.tsx` (referenced in homepage but not read)
**SPEC:** DESIGN_SYSTEM.md — The homepage CTA section is not explicitly described beyond "fullscreen CTA button" patterns. Without reading the file, likely issue: if it uses a large red background section (CTA), it needs the Chinese pattern texture overlay per brand guidelines.

**ACTION:** Read the file and check if:
1. It uses `bg-brand-red` with Chinese pattern overlay (`bg-chinese-pattern opacity-10`)
2. CTA buttons are at least `h-14 xl` size
3. Section has proper py-16 spacing

---

## SUMMARY TABLE

| # | Component | Issue | Severity | File |
|---|-----------|-------|----------|------|
| 01 | All empty states | No dimsum bowl illustration — plain text only | High | EmptyCart.tsx, EmptyState.tsx |
| 02 | Order tracking | OrderTimeline component exists but never rendered | High | OrderTrackingClient.tsx |
| 03 | HalalBadge | Two inconsistent implementations (text badge vs PNG image) | Medium | ProductDetailClient.tsx:268 |
| 04 | ProductCard | Out-of-stock overlay missing — badge shown in wrong position | High | ProductCard.tsx:99-135 |
| 05 | ProductCardSkeleton | Skeleton shape doesn't match actual ProductCard structure | Medium | ProductCardSkeleton.tsx |
| 06 | CheckoutStepper | Step labels use `whitespace-nowrap`, overflow on 320px screens | Medium | CheckoutStepper.tsx:52 |
| 07 | DeliveryMethodToggle | Likely plain radio buttons, not the card-toggle per spec | High | DeliveryMethodToggle.tsx |
| 08 | ProductCard quick-add | w-8 h-8 (32px) quick-add button below 44px touch target | High | ProductCard.tsx:128-135 |
| 09 | CartItem qty stepper | Icon is w-3 h-3 (12px), too small inside 44px button | Medium | CartItem.tsx:87,97 |
| 10 | ProductDetail back btn | Unicode ← character + 40px touch target (below 44px min) | Medium | ProductDetailClient.tsx:136 |
| 11 | Lightbox close | Unicode × character + 40px touch target | Medium | ProductDetailClient.tsx:357 |
| 12 | WhatsApp tooltip | Tooltip close button is 24px (way below 44px minimum) | Low | WhatsAppButton.tsx:28 |
| 13 | HomePageCTA | Unknown implementation — needs audit | Unknown | HomePageCTA.tsx |
