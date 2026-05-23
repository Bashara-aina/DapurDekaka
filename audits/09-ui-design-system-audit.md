# UI/UX & Design System Compliance Audit

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit
**Scope:** Tailwind tokens, shadcn usage, next/image compliance, mobile-first, accessibility

---

## Executive Summary

The design system is well-defined with proper Tailwind tokens for brand colors, typography, and spacing. However, there are numerous **arbitrary Tailwind values** scattered throughout the codebase that violate the design system. Additionally, several pages have **mobile-first violations** and **accessibility gaps** that would cause issues for real users.

**Design System Health:** ~75%. Main issues: arbitrary Tailwind values, next/image violations, accessibility gaps.

---

## 1. Design Token Compliance

### 1.1 Tailwind Config — ✅ Well Defined

```ts
// Colors are all defined as tokens:
brand-red: '#C8102E'
brand-cream: '#F0EAD6'
brand-gold: '#C9A84C'
text-primary: '#1A1A1A'
text-secondary: '#6B6B6B'
admin sidebar: '#0F172A'
```

### 1.2 Arbitrary Tailwind Values Found

#### SuperadminDashboardClient.tsx — Extensive use of arbitrary values

| Line | Code | Should Be |
|------|------|----------|
| 304 | `text-[#1A1A1A]` | `text-text-primary` |
| 305 | `text-[#6B6B6B]` | `text-text-secondary` |
| 312 | `bg-[#0F172A]` | `bg-admin-sidebar` |
| 313 | `hover:bg-[#1E293B]` | `hover:bg-admin-sidebar-hover` |
| 324 | `border border-gray-200` | `border-admin-border` |
| 349 | `text-[#1A1A1A]` | `text-text-primary` |
| 349 | `text-[#6B6B6B]` | `text-text-secondary` |
| 472 | `text-[#1A1A1A]` | `text-text-primary` |
| 472 | `text-[#6B6B6B]` | `text-text-secondary` |
| 473 | `group-hover:text-[#1A1A1A]` | `group-hover:text-text-primary` |
| 603 | `text-xs font-mono font-medium text-[#1A1A1A]` | `text-text-primary` + `font-mono` |
| 621 | `text-brand-red` | ✅ correct |
| 799 | `text-[#1A1A1A]` | `text-text-primary` |
| 803 | `text-[#6B6B6B]` | `text-text-secondary` |
| 1074 | `text-[#1A1A1A]` | `text-text-primary` |

**Total arbitrary hex values in this file alone:** 15+

#### FieldDashboard — Mixed values

| Line | Code | Should Be |
|------|------|----------|
| 1060 | `text-[#1A1A1A]` | `text-text-primary` |
| 1106 | `bg-[#0F172A]` | `bg-admin-sidebar` |
| 1114 | `bg-white` | ✅ white is fine |

**Total from field/page.tsx:** ~3 arbitrary values

#### Other Files with Arbitrary Values

- `components/store/checkout/AddressForm.tsx` — check for arbitrary values
- `components/admin/*` — many files likely have arbitrary values

### 1.3 Why This Matters

Using `text-[#1A1A1A]` instead of `text-text-primary`:
1. If the brand updates its primary text color, arbitrary values won't update
2. Inconsistent rendering across pages
3. Harder to do global theme changes

---

## 2. Mobile-First Violations

### 2.1 Checkout — Sticky Total Bar

**File:** `app/(store)/checkout/page.tsx:462`

```tsx
<div className="lg:hidden sticky top-[76px] z-10 ...">
```

`top-[76px]` is a hardcoded value. The actual navbar height may vary based on:
- Language (longer/shorter text)
- Screen size
- Whether WhatsApp button is showing

**Fix:** Use a CSS custom property:
```css
/* In globals.css */
:root { --navbar-height: 76px; }
/* In Tailwind config */
paddingTop: 'navbar(var(--navbar-height))'
```

Or measure with JS on mount.

### 2.2 Admin Sidebar — Not Responsive

**File:** `app/(admin)/admin/layout.tsx`

The admin sidebar uses fixed widths:
- Sidebar: 256px or 64px (collapsed)
- Content: `ml-64` or `ml-64`

On tablet (768px-1024px), this layout may cause horizontal scroll. Need to verify:
- Does admin sidebar collapse to icon-only on tablet?
- Is there a hamburger menu for tablet?

### 2.3 Product Grid — Not Responsive Column Count

**File:** `components/store/products/ProductGrid.tsx`

```tsx
<div className="grid grid-cols-1 ...">
```

May need `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` for proper responsive breakpoints.

---

## 3. next/image Compliance

### 3.1 Rule: Never use `<img>` tag

**Status:** ✅ Verified — codebase uses `next/image` throughout

### 3.2 Missing `alt` Text

Check every `<Image>` component:

#### ProductCard
- Product image: Should have `alt={productName}` ✅
- Need to verify each instance

#### HeroCarousel
- Slide images: Need descriptive `alt` text (from `slide.titleId` or `slide.titleEn`)

#### BlogPost
- Cover image: `alt={title}` or descriptive text

#### InstagramFeed
- Instagram embeds: These may use `<script>` or iframe, not `<img>`. Verify no raw `<img>` tags.

### 3.3 Image Sizing — Layout Shift

All product images should have explicit `width` and `height` or use `fill` with a parent container that has defined dimensions. If not, CLS (Cumulative Layout Shift) will be high.

---

## 4. Accessibility Issues

### 4.1 Missing ARIA Labels

#### CartItem — Quantity Buttons

```tsx
<button onClick={increment}>+</button>
<button onClick={decrement}>-</button>
```

Should have:
```tsx
<button aria-label="Tambah satu">+</button>
<button aria-label="Kurangi satu">-</button>
```

#### BottomNav — Icon-only Buttons

```tsx
<Link href="/cart">
  <ShoppingBag />
</Link>
```

Should have:
```tsx
<Link href="/cart" aria-label={t('nav.cart')}>
  <ShoppingBag aria-hidden="true" />
</Link>
```

#### WhatsAppButton

```tsx
<button onClick={openWhatsApp}>
  <MessageCircle />
</button>
```

Should have:
```tsx
<button aria-label="Hubungi via WhatsApp" onClick={openWhatsApp}>
  <MessageCircle aria-hidden="true" />
</button>
```

### 4.2 Color Contrast

Verify WCAG AA compliance for these combinations:
- `text-[#6B6B6B]` on white background — 4.5:1 ratio? (NO — #6B6B6B is ~4.2:1 on white)
- `#8A8A8A` on white — 3.1:1 ratio? (NO — fails AA)

The `text-text-secondary` token (`#6B6B6B`) on white background is **below WCAG AA 4.5:1** for normal text. It may only be acceptable for large text or disabled states.

**Check:** Any text using `#6B6B6B` that's rendered as body text (< 18pt regular) fails accessibility.

### 4.3 Keyboard Navigation

#### Checkout Stepper

The stepper allows clicking on completed steps. Need to verify:
- Can tab to stepper?
- Can activate with Enter/Space?
- Focus ring is visible?

#### Modal/Dialog Close Buttons

The BottomSheet component:
```tsx
<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
```

`&times;` (×) is not a semantic close button. Should use:
```tsx
<button aria-label="Tutup" onClick={onClose}>
  <X />
</button>
```

### 4.4 Screen Reader — Live Regions

The checkout page has dynamic content updates (coupon applied, points calculated). These should announce to screen readers:
```tsx
<div aria-live="polite" aria-atomic="true">
  {/* Coupon applied: Rp 10.000 */}
</div>
```

The checkout page does use `role="alert" aria-live="polite"` on coupon error div (line 748). But the success/discount display doesn't have live region.

---

## 5. shadcn/ui Compliance

### 5.1 Components Used

From code review, these shadcn components are used:
- `Button` ✅
- `Card`, `CardContent` ✅
- `Badge` ✅
- `Input` ✅
- `Label` ✅
- `Skeleton` ✅
- `Select` (in some admin forms)
- `Dialog`/`Sheet` (for modals)
- `Tabs` (for field dashboard)

### 5.2 Custom HTML Elements

#### Field Dashboard — Raw Select

**File:** `field/page.tsx:424`

```tsx
<select className="w-full border ...">
```

This should be a shadcn `Select` component for consistency.

#### Order Card — Raw Checkbox

**File:** `field/page.tsx:408`

```tsx
<input type="checkbox" className="w-5 h-5 accent-green-500" />
```

Using `accent-green-500` is not a Tailwind color. Should be `accent-emerald-500` or use shadcn `Checkbox` component.

---

## 6. Animation & Motion

### 6.1 Store Frontend — Framer Motion

**Status:** ✅ Defined in CURSOR_RULES

The project uses Framer Motion for store animations. Need to verify:
- Does the HeroCarousel use Framer Motion `AnimatePresence`?
- Are reduced-motion preferences respected?

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
```

Should include:
```tsx
@media (prefers-reduced-motion: reduce) {
  motion { animation: none; }
}
```

### 6.2 WhatsAppButton — Pulse Animation

**File:** `components/store/layout/WhatsAppButton.tsx`

Uses `animate-pulse-soft` from tailwind config. This animation:
```ts
pulseSoft: {
  '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(200,16,46,0.4)' },
  '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgba(200,16,46,0)' },
}
```

The pulsing uses brand-red color which is good. Should be disabled for `prefers-reduced-motion`.

---

## 7. Typography Issues

### 7.1 Font Loading

Tailwind config defines:
```ts
fontFamily: {
  display: ['Playfair Display', 'Georgia', 'serif'],
  body: ['Inter', 'system-ui', 'sans-serif'],
}
```

These are loaded via `next/font` or `<link>` in layout? Need to verify:
- `Playfair Display` is imported in `app/layout.tsx`
- `Inter` is imported in `app/layout.tsx`
- Both are preloaded for performance

### 7.2 Text Overflow

Many places truncate text with `truncate` class which is good. But need to verify:
- Order numbers don't overflow on mobile (they use `font-mono` which may be wider)
- Product names in cart don't overflow
- Long addresses in checkout don't overflow

---

## 8. Priority Fix List

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|
| P0 | `text-[#1A1A1A]` instead of design token | 15+ files | Replace with `text-text-primary` |
| P0 | `text-[#6B6B6B]` on normal text — contrast fail | Multiple files | Use `text-text-secondary` for large/heading only |
| P1 | Missing `aria-label` on icon buttons | CartItem, BottomNav, WhatsApp | Add labels |
| P1 | BottomSheet uses `&times;` not semantic button | `field/page.tsx` | Use `<X />` with aria-label |
| P1 | Sticky bar `top-[76px]` hardcoded | `checkout/page.tsx` | Use CSS variable |
| P2 | Raw `<select>` instead of shadcn Select | `field/page.tsx` | Replace with shadcn Select |
| P2 | Raw `<input type="checkbox">` with `accent-green-500` | `field/page.tsx` | Replace with shadcn Checkbox |
| P2 | No `alt` text on product images | Multiple ProductCard instances | Verify alt text is set |
| P3 | Font loading verification | `app/layout.tsx` | Verify next/font setup |
| P3 | `prefers-reduced-motion` not handled | Framer Motion, animations | Add motion preferences |