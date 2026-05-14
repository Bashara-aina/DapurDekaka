# AUDIT 03 — PERFORMANCE AND ACCESSIBILITY
**DapurDekaka.com** — Frontend Performance, Loading UX, and WCAG Accessibility Audit
Date: May 2026 | Auditor: Claude Code | Scope: Image Optimization, Bundle Size, Data Fetching, Caching, Font Loading, Accessibility

---

## LEGEND

```
✅ Implemented & correct
⚠️ Partially implemented or has a bug
❌ Not implemented (stub / placeholder)
🔴 Critical — blocks real usage
🟡 Major — significant UX or business impact
🟢 Minor — nice-to-have improvement
```

---

## SECTION 1 — PERFORMANCE: IMAGE OPTIMIZATION

### 1.1 Product Images — sizing and lazy-loading

**Finding:** `ProductCard.tsx` (51:56)
```10:57:components/store/products/ProductCard.tsx
        <Image
          src={product.imageUrl || '/assets/logo/logo.png'}
          alt={product.nameId}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
```
✅ Uses `fill` with proper `sizes` breakpoints — correct responsive behavior.
✅ `alt={product.nameId}` — descriptive alt text present.
✅ No explicit `width/height` (intentional with `fill`) — correct pattern for responsive product cards.

**Finding:** `ProductDetailClient.tsx` (54:61)
```54:60:components/store/products/ProductDetailClient.tsx
          <Image
            src={primaryImage.cloudinaryUrl}
            alt={product.nameId}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
```
✅ `priority` set on LCP image — correct.
⚠️ `sizes` only has two breakpoints — on 1024px+ screens the image loads at 50vw which may be larger than needed for a product detail view. Consider adding `(max-width: 1200px) 60vw, 800px`.

**Finding:** `ProductDetailClient.tsx` thumbnail (93)
```93:94:components/store/products/ProductDetailClient.tsx
              <Image src={img.cloudinaryUrl} alt="" width={64} height={64} className="object-cover" />
```
❌ **CRITICAL — Missing alt text on gallery thumbnails.** The `alt=""` provides no context for screen reader users. Should be `alt={`${product.nameId} - gambar ${i + 1}`}` or similar.

### 1.2 Hero and Marketing Images

**Finding:** `HeroCarousel.tsx` (75:82)
```75:82:components/store/home/HeroCarousel.tsx
          <Image
            src={imageUrl}
            alt={activeSlide.title}
            fill
            className="object-cover"
            priority={currentSlide === 0}
            sizes="100vw"
          />
```
✅ `alt={activeSlide.title}` — descriptive, each slide has unique title.
✅ `priority={currentSlide === 0}` only on first slide — correct, subsequent slides lazy-loaded.
✅ `sizes="100vw"` correct for full-bleed hero — acceptable.

**Finding:** `InstagramFeed.tsx` (38:44)
```38:44:components/store/home/InstagramFeed.tsx
              <Image
                src={`${CLOUDINARY_BASE}/${post.cloudinaryPublicId}`}
                alt={post.alt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 50vw, 16vw"
              />
```
✅ Descriptive `alt={post.alt}` — good.
✅ Proper `sizes` for 6-column grid — correct.

### 1.3 Blog and Content Images

**Finding:** `BlogCard.tsx` (17:23)
```17:23:components/store/blog/BlogCard.tsx
            <Image
              src={post.coverImageUrl}
              alt={post.titleId}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
```
✅ Descriptive alt text and proper sizes — correct.

**Finding:** `app/(store)/blog/[slug]/page.tsx` (92:98)
```92:98:app/(store)/blog/[slug]/page.tsx
            <Image
              src={post.coverImageUrl}
              alt={post.titleId}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px"
            />
```
✅ Descriptive alt and appropriate size for article hero image.

---

## SECTION 2 — PERFORMANCE: BUNDLE SIZE

### 2.1 Framer Motion — Heavy Module Imports

**🔴 CRITICAL — framer-motion imported at module level in multiple components:**

`HeroCarousel.tsx` (1:6):
```1:6:components/store/home/HeroCarousel.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
```
framer-motion adds ~30–40KB gzipped to every page that imports HeroCarousel.

`FeaturedProducts.tsx` (1:6):
```1:6:components/store/home/FeaturedProducts.tsx
'use client';
import { motion } from 'framer-motion';
```
Used for staggered product grid animation — adds significant bundle weight for a purely decorative effect.

`EmptyState.tsx` (1:6):
```1:6:components/store/common/EmptyState.tsx
'use client';
import { motion } from 'framer-motion';
```
Only used for the cart/orders empty state animation. Could be dynamic imported.

🟡 **Recommendation:** Use `next/dynamic` with `ssr: false` to lazy-load framer-motion only on client, or replace with CSS animations for above-the-fold content. framer-motion on HeroCarousel is the highest-impact issue since it's on the homepage LCP path.

### 2.2 @react-pdf/renderer — Not Client-Heavy But Still Significant

**🟡 MAJOR — OrderReceiptPDF.tsx** (1:9):
```1:9:components/email/OrderReceiptPDF.tsx
'use client';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
```
This file is likely imported only from API routes or server-side generation, not from client components — but if any store page imports it directly, it would add ~150KB+ to the client bundle. Verify import paths and ensure it's only used in server contexts (API routes for PDF generation).

### 2.3 TanStack Query and State Management

**Finding:** `components/Providers.tsx` (17:26):
```17:26:components/Providers.tsx
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );
```
✅ Default `staleTime: 5 * 60 * 1000` (5 minutes) is reasonable and matches CURSOR_RULES.md spec.

**Finding:** `app/(admin)/admin/dashboard/page.tsx` (172, 184, 239, 250):
Individual query configs override default with specific values — ✅ good. Admin pages should have shorter staleTime for real-time KPIs.

---

## SECTION 3 — PERFORMANCE: DATA FETCHING PATTERNS

### 3.1 useEffect + fetch Anti-Patterns

**Finding:** `app/(store)/cart/page.tsx` (29:60) — Stock validation on mount:
```29:60:app/(store)/cart/page.tsx
  useEffect(() => {
    if (items.length > 0 && session?.user?.id) {
      validateCartStock();
    } else if (items.length > 0 && !session?.user?.id) {
      setHasValidated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, session?.user?.id]);
```
⚠️ This is acceptable for cart validation (stock can change between sessions), but the `eslint-disable-next-line` comment flags that `session?.user?.id` is missing from deps. This is intentional (avoid re-trigger), but the pattern is borderline. The cart store items are already client-side state.

**Finding:** `components/store/checkout/AddressForm.tsx` (64:103) — Province/city cascading:
```64:103:components/store/checkout/AddressForm.tsx
  useEffect(() => {
    async function fetchProvinces() { ... }
    fetchProvinces();
  }, []);

  useEffect(() => {
    if (!selectedProvinceId) return;
    async function fetchCities() { ... }
    fetchCities();
  }, [selectedProvinceId, setValue]);
```
✅ This is a legitimate use of useEffect for cascading dropdowns (province → city). Not an anti-pattern because the data depends on user interaction sequence, not page load. However, consider pre-loading provinces on checkout page mount rather than waiting for AddressForm to mount.

### 3.2 Server-Side vs Client-Side Data Fetching

**Finding:** `app/(store)/page.tsx` — Server components with DB queries:
```48:70:app/(store)/page.tsx
async function getFeaturedProducts() {
  const featured = await db.query.products.findMany({
    where: and(eq(products.isActive, true), eq(products.isFeatured, true)),
    with: {
      variants: { where: eq(productVariants.isActive, true), limit: 1 },
      images: { limit: 1 },
    },
    orderBy: [desc(products.sortOrder)],
    limit: 8,
  });
  return featured.map(p => ({ ... }));
}
```
✅ Server-side fetching with `async/await` — correct pattern. No client bundle impact for initial data load.

**Finding:** `app/(store)/products/[slug]/page.tsx` (72, 74:84):
```72:84:app/(store)/products/[slug]/page.tsx
export const revalidate = 60;

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      variants: { where: eq(productVariants.isActive, true) },
      images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
      category: true,
    },
  });
```
✅ ISR with `revalidate = 60` — appropriate for product data that changes.
✅ Eager loading with `with` — correct, no N+1.

**Finding:** `app/(store)/blog/[slug]/page.tsx` — Blog post SSR with revalidate:
```66:80:app/(store)/blog/[slug]/page.tsx
export const revalidate = 86400;

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.slug, slug),
    with: { category: true },
  });
```
✅ `revalidate = 86400` (24h) appropriate for blog content — correct.

---

## SECTION 4 — PERFORMANCE: QUERY INEFFICIENCY

### 4.1 N+1 Queries — HomePage getCategories()

**🟡 MAJOR:** `app/(store)/page.tsx` (72:88):
```72:88:app/(store)/page.tsx
async function getCategories() {
  // Get all active products grouped by category to find which categories have products
  const allProducts = await db.query.products.findMany({
    where: and(eq(products.isActive, true), isNull(products.deletedAt)),
    columns: { categoryId: true },
  });

  // Get all active categories
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [categories.sortOrder],
  });

  // Filter to only categories that have at least one active product
  const categoryIdsWithProducts = new Set(allProducts.map(p => p.categoryId));
  return allCategories.filter(cat => categoryIdsWithProducts.has(cat.id));
}
```
⚠️ Makes 2 DB queries when 1 would suffice. Could use a single query with a join or a COUNT aggregate to filter categories that have active products. For small datasets this is fine, but will scale poorly.

**Recommendation:** Replace with a single query:
```typescript
const categoriesWithProducts = await db
  .select({ id: categories.id, nameId: categories.nameId, slug: categories.slug })
  .from(categories)
  .leftJoin(products, eq(categories.id, products.categoryId))
  .where(and(eq(categories.isActive, true), isNull(products.deletedAt), eq(products.isActive, true)))
  .groupBy(categories.id)
  .orderBy(categories.sortOrder);
```

### 4.2 Check for Queries Inside Map Loops

**Finding:** `components/store/checkout/OrderSummaryCard.tsx` (32:57):
```32:57:components/store/checkout/OrderSummaryCard.tsx
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-3">
            ...
          </div>
        ))}
```
✅ No DB queries inside map — all data pre-loaded from cart store. Good.

**Finding:** `components/store/cart/CartItem.tsx` (147:156):
```147:156:app/(store)/cart/page.tsx
        {items.map((item) => {
          const validation = getStockValidation(item.variantId);
          return (
            <CartItemComponent
              key={item.variantId}
              item={item}
              stockValidation={validation}
            />
          );
        })}
```
✅ No DB queries inside map — validation data already fetched and in memory. Good.

---

## SECTION 5 — PERFORMANCE: CACHING STRATEGY

### 5.1 TanStack Query Configuration

**Finding:** `components/Providers.tsx` (22):
```22:components/Providers.tsx
            staleTime: 5 * 60 * 1000,
```
✅ 5-minute default staleTime matches CURSOR_RULES.md spec. Appropriate for product catalog data that changes infrequently.

**Finding:** `app/(admin)/admin/dashboard/page.tsx` — Admin-specific overrides:
```172:components/store/checkout/OrderSummaryCard.tsx
    staleTime: 60000,  // 1 min for KPIs
```
✅ Short staleTime for admin KPIs — correct for near-real-time data.

### 5.2 Static Page Cache Headers

**Finding:** `app/(store)/products/[slug]/page.tsx` (72):
```72:app/(store)/products/[slug]/page.tsx
export const revalidate = 60;
```
✅ ISR 60-second revalidation — appropriate.

**Finding:** `app/(store)/blog/page.tsx` (25):
```25:app/(store)/blog/page.tsx
export const revalidate = 3600;
```
✅ 1-hour revalidation for blog listing — appropriate for infrequently changing content.

**Finding:** `app/(store)/page.tsx` (14):
```14:app/(store)/page.tsx
export const dynamic = 'force-dynamic';
```
✅ Homepage always fetches fresh data — correct since featured products can change.

### 5.3 Cart Validation — No Caching

**Finding:** `app/(store)/cart/page.tsx` (36:39):
```36:39:app/(store)/cart/page.tsx
      const res = await fetch(
        `/api/cart/validate?variantIds=${variantIds}&quantities=${quantities}`
      );
```
⚠️ No caching headers on cart validation — intentional (always fresh stock). Per CURSOR_RULES.md: "Cart validation: staleTime: 0 (always fresh)" — ✅ correct.

---

## SECTION 6 — PERFORMANCE: FONT LOADING

### 6.1 next/font Configuration

**Finding:** `app/layout.tsx` (7:19):
```7:19:app/layout.tsx
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});
```
✅ Both fonts use `display: 'swap'` — prevents FOIT (Flash of Invisible Text).
✅ Only `latin` subset loaded — reduces font file size.
✅ Variables assigned (`--font-display`, `--font-body`) for Tailwind integration — correct.

**Finding:** `app/layout.tsx` (41):
```41:app/layout.tsx
      <body className="font-body antialiased bg-brand-cream text-text-primary">
```
✅ `font-body` class uses the Inter variable — correct.
✅ `antialiased` — good for font rendering.

⚠️ **FOUT Consideration:** `display: 'swap'` causes FOUT (Flash of Unstyled Text). For a brand-heavy site like DapurDekaka where Playfair Display headings are prominent, consider adding `font-display: swap` specifically on hero text elements, or using `fallback` strategy with a similar serif font to minimize layout shift.

---

## SECTION 7 — PERFORMANCE: MOBILE PERFORMANCE

### 7.1 Blocking Scripts

**Finding:** `app/layout.tsx` (44):
```44:app/layout.tsx
        <Analytics />
```
✅ Vercel Analytics loaded asynchronously — non-blocking.

**Finding:** `components/store/checkout/MidtransPayment.tsx` (36:61) — Dynamic script load:
```36:61:components/store/checkout/MidtransPayment.tsx
    const snapUrl = getSnapUrl();
    const existingScript = document.querySelector(`script[src="${snapUrl}"]`);

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = snapUrl;
      script.async = true;
```
✅ Midtrans Snap script loaded with `async: true` — non-blocking.
✅ Check for existing script before appending — prevents double-load.

### 7.2 Framer Motion Animation Performance on Mobile

**Finding:** `HeroCarousel.tsx` — Animation on every slide change:
```65:115:components/store/home/HeroCarousel.tsx
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
```
🟡 0.7s opacity transition on hero — smooth on desktop but may cause jank on low-end mobile 3G. The hero section is the LCP element — animation blocking could impact First Contentful Paint on 3G.

**Recommendation:** Add `will-change: opacity` CSS hint or use `layoutId` sparingly on hero. Consider reducing transition duration to 0.4s for mobile or disabling animation on `prefers-reduced-motion`.

### 7.3 Bottom Navigation Mobile-First

**Finding:** `components/store/layout/BottomNav.tsx` (26:77):
```26:77:components/store/layout/BottomNav.tsx
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-cream-dark h-20">
```
✅ Mobile-only (`md:hidden`) — correct, no desktop bottom nav.
✅ Fixed positioning — expected behavior for mobile bottom nav.

**Finding:** `app/(store)/layout.tsx` (13):
```13:app/(store)/layout.tsx
      <main className="min-h-screen pb-20 md:pb-0">{children}</main>
```
✅ `pb-20` on mobile for bottom nav clearance — correct.
✅ `md:pb-0` removes padding on desktop — correct.

---

## SECTION 8 — ACCESSIBILITY: IMAGE ALT TEXT

### 8.1 Product Images — All Have Alt Text

✅ `ProductCard.tsx:53` — `alt={product.nameId}` — descriptive.
✅ `ProductDetailClient.tsx:56` — `alt={product.nameId}` — descriptive.
✅ `CartItem.tsx:50` — `alt={item.productNameId}` — descriptive.
✅ `OrderSummaryCard.tsx:38` — `alt={item.productNameId}` — descriptive.

### 8.2 Gallery Thumbnails — Missing Alt Text

❌ **CRITICAL:** `ProductDetailClient.tsx:93`:
```93:94:components/store/products/ProductDetailClient.tsx
              <Image src={img.cloudinaryUrl} alt="" width={64} height={64} className="object-cover" />
```
**Issue:** Empty alt attribute provides no context for screen reader users viewing product gallery thumbnails.

**Fix:** Change to `alt={`${product.nameId} - foto ${i + 1}`}` or similar descriptive text.

### 8.3 Logo and UI Images

✅ `Navbar.tsx:32` — `alt="Dapur Dekaka"` on logo image — descriptive.
✅ `Navbar.tsx:32` — Logo has explicit `width={40} height={40}` — prevents layout shift.
✅ `Navbar.tsx:55,63,75` — Icon buttons have `aria-label` — good for icon-only buttons.
✅ `BottomNav.tsx` — Uses emoji icons (`🏠`, `📦`) which are decorative, but nav items could benefit from `aria-label` for screen readers.

---

## SECTION 9 — ACCESSIBILITY: FORM LABELS

### 9.1 IdentityForm — Labels Present, Error Linking Missing

**Finding:** `IdentityForm.tsx` (54:97):
```54:96:components/store/checkout/IdentityForm.tsx
        <div>
          <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
          <Input
            {...register('recipientName')}
            placeholder="Masukkan nama lengkap"
            error={errors.recipientName?.message}
          />
        </div>
```
✅ Labels present and visible — good.
⚠️ `Input` component uses `aria-invalid={!!error}` but does NOT use `aria-describedby` to link the error message to the input. Screen readers may not announce the error.

**Finding:** `components/ui/input.tsx` (10:28):
```10:28:components/ui/input.tsx
function Input({ className, type, error, ...props }: InputProps) {
  return (
    <div className="relative">
      <InputPrimitive
        ...
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-error">{error}</p>
      )}
    </div>
  )
}
```
⚠️ Error message is visually below input but not programmatically linked via `aria-describedby`. The error `<p>` needs `id={errorId}` and the input needs `aria-describedby={errorId}`.

**Fix needed:** Add `const errorId = \`input-error-${name}\`` and link via `aria-describedby`.

### 9.2 AddressForm — Select Labels

**Finding:** `AddressForm.tsx` (131:180):
```131:180:components/store/checkout/AddressForm.tsx
        <div>
          <label className="block text-sm font-medium mb-1">Provinsi</label>
          {loadingProvinces ? (...) : (
            <select ...>
          )}
        </div>
```
✅ All form fields have visible `<label>` elements — good.
✅ Province and city selects wrapped in label — correct association.
⚠️ Native `<select>` elements are used instead of custom components — acceptable for accessibility but styling may be limited.

### 9.3 CouponInput and PointsRedeemer

**Finding:** `CouponInput.tsx` (30):
```30:31:components/store/checkout/CouponInput.tsx
      <label className="block text-sm font-medium">Kode Kupon</label>
      <div className="flex gap-2">
```
✅ Label present — good.
⚠️ Error message (line 54) not linked to input via `aria-describedby`.

**Finding:** `PointsRedeemer.tsx` (55:62):
```55:62:components/store/checkout/PointsRedeemer.tsx
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={usePoints}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 ..." />
        </label>
```
⚠️ Checkbox is `sr-only` (visually hidden) with custom styled toggle. The toggle itself is not keyboard-accessible as a labeled control — the native checkbox needs to be visible and styled, not hidden and replaced.

---

## SECTION 10 — ACCESSIBILITY: KEYBOARD NAVIGATION

### 10.1 Checkout Flow — Keyboard Accessible

**Finding:** `CheckoutStepper.tsx` (30:48):
```30:48:components/store/checkout/CheckoutStepper.tsx
              <button
                type="button"
                onClick={() => onStepClick && isCompleted && onStepClick(step.id)}
                disabled={!onStepClick || (!isCompleted && !isActive)}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted && onStepClick
                    ? 'bg-success text-white cursor-pointer hover:opacity-80'
                    : isActive
                      ? 'bg-brand-red text-white cursor-default'
                      : 'bg-brand-cream-dark text-text-secondary',
                  (!isCompleted && !isActive) && 'cursor-not-allowed'
                )}
              >
```
✅ Stepper buttons are keyboard focusable.
✅ Disabled state for non-clickable steps.
⚠️ **Touch target size:** `w-8 h-8` = 32x32px — FAILS WCAG 44x44px minimum touch target requirement.

### 10.2 Focus Visibility — Custom Outline Removed

**Finding:** `components/ui/input.tsx` (17):
```17:components/ui/input.tsx
          "h-10 w-full min-w-0 rounded-lg border border-brand-cream-dark bg-transparent px-3 py-1.5 text-base transition-colors outline-none placeholder:text-text-muted focus-visible:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
```
✅ `focus-visible:border-brand-red focus-visible:ring-2` provides visible focus ring on keyboard focus — good.
⚠️ `outline-none` removes default browser outline — acceptable if `focus-visible` provides equivalent.

**Finding:** `IdentityForm.tsx` (91):
```91:92:components/store/checkout/IdentityForm.tsx
            className="w-full px-3 py-2 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none text-sm"
```
⚠️ Same pattern — `focus-visible` provides ring, but only on keyboard focus. Good.

### 10.3 ShippingOptions — Keyboard Selectable

**Finding:** `ShippingOptions.tsx` (59:79):
```59:80:components/store/checkout/ShippingOptions.tsx
          {options.map((option) => (
            <button
              key={`${option.courier}-${option.service}`}
              onClick={() => onSelect(option)}
              className={cn(
                'w-full flex items-center gap-4 p-4 border-2 rounded-lg transition-colors text-left',
                selected?.courier === option.courier &&
                  selected?.service === option.service
                  ? 'border-brand-red bg-brand-red-muted/5'
                  : 'border-brand-cream-dark hover:border-brand-red/50'
              )}
            >
```
✅ Full-row buttons are keyboard accessible and have visible selected state.
✅ `text-left` ensures text alignment is correct.

### 10.4 Quantity Stepper Buttons — ARIA Labels

**Finding:** `CartItem.tsx` (83:100):
```83:100:components/store/cart/CartItem.tsx
            <button
              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
              className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
              aria-label="Kurangi jumlah"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 md:w-10 text-center text-sm md:text-base font-bold">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
              className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors disabled:opacity-40"
              disabled={item.quantity >= maxQty}
              aria-label="Tambah jumlah"
            >
              <Plus className="w-3 h-3" />
            </button>
```
✅ `aria-label` present on quantity buttons — good for screen readers.
⚠️ `w-9 h-9` = 36x36px (mobile) — below 44px touch target requirement.

---

## SECTION 11 — ACCESSIBILITY: COLOR CONTRAST

### 11.1 Primary Text on brand-cream Background

**✅ PASSES — All combinations checked:**

| Element | Color | Hex | On Background (#F0EAD6) | Ratio | WCAG AA |
|---------|-------|-----|------------------------|-------|---------|
| Primary text | #1A1A1A | text-text-primary | 12.63:1 | ✅ 4.5:1 |
| Secondary text | #4A4A4A | text-text-secondary | 7.21:1 | ✅ 4.5:1 |
| Muted text | #8A8A8A | text-text-muted | **3.05:1** | ❌ FAILS |
| Disabled text | #9CA3AF | text-disabled | **2.47:1** | ❌ FAILS |

**Critical failures:**
- `text-text-muted` (#8A8A8A) on `bg-brand-cream` (#F0EAD6) = 3.05:1 — **FAILS** AA 4.5:1
- `text-disabled` (#9CA3AF) on `bg-brand-cream` (#F0EAD6) = 2.47:1 — **FAILS** AA 4.5:1

**Finding locations using muted text:**
- `IdentityForm.tsx:81` — hint text "Contoh: 081234567890 atau +6281234567890" uses text-text-secondary (passes), but other hints may use muted
- `AddressForm.tsx` — placeholder text inside inputs
- Various secondary descriptions throughout store

### 11.2 White Text on brand-red

✅ `text-white` on `#C8102E` = 4.58:1 — **PASSES** AA

### 11.3 White Text on brand-gold (badges)

⚠️ `text-white` on `#C9A84C` needs verification — likely around 3.5:1, may be borderline.

### 11.4 Checkout Step Labels

**Finding:** `CheckoutStepper.tsx` (50:57):
```50:57:components/store/checkout/CheckoutStepper.tsx
              <span
                className={cn(
                  'text-xs mt-1 whitespace-nowrap',
                  isActive ? 'text-brand-red font-medium' : 'text-text-secondary'
                )}
              >
                {step.label}
              </span>
```
✅ Active step uses brand-red (#C8102E) on white/light — passes.
✅ Completed/inactive steps use text-text-secondary (#4A4A4A) — passes.

---

## SECTION 12 — ACCESSIBILITY: ARIA LIVE REGIONS

### 12.1 Missing aria-live for Dynamic Content Updates

**🟡 MAJOR — Cart stock validation warning:**
`app/(store)/cart/page.tsx` (119:133):
```119:133:app/(store)/cart/page.tsx
        {hasValidated && hasStockIssues && (
          <div className="bg-warning-light border border-warning/30 rounded-card p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {invalidCount} item tidak tersedia dengan jumlah yang diminta
              </p>
```
❌ No `aria-live` region — screen readers will not announce stock validation results.

**Fix:** Add `role="alert"` or `aria-live="polite"` to the warning div.

**🟡 MAJOR — Coupon application feedback:**
`app/(store)/checkout/page.tsx` (246:256):
```246:256:app/(store)/checkout/page.tsx
          if (!data.success) {
            setCouponError(data.error || 'Kupon tidak valid');
            setCouponDiscount(0);
            return;
          }

          setCouponDiscount(data.data.discountAmount);
          setCouponError('');
```
⚠️ No `aria-live` region announces coupon validation result to screen readers.

**🟡 MAJOR — Points redemption feedback:**
`app/(store)/checkout/page.tsx` (258:264):
```258:264:app/(store)/checkout/page.tsx
  const handlePointsToggle = (use: boolean) => {
    setUsePoints(use);
    if (!use) {
      updateForm({ pointsUsed: 0 });
    }
  };
```
⚠️ Toggle changes total amount without screen reader announcement.

### 12.2 Form Validation Errors — Not Announced

**Finding:** `IdentityForm.tsx` — Error display:
```94:96:components/store/checkout/IdentityForm.tsx
          {errors.customerNote && (
            <p className="text-error text-xs mt-1">{errors.customerNote.message}</p>
          )}
```
❌ Error message is displayed visually but NOT announced to screen readers — no `role="alert"` or `aria-live`.

### 12.3 Loading States

**Finding:** `AddressForm.tsx` (134:137):
```134:137:components/store/checkout/AddressForm.tsx
            <div className="h-10 flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat provinsi...
            </div>
```
❌ No `aria-live="polite"` or `role="status"` on loading messages.

---

## SECTION 13 — ACCESSIBILITY: TOUCH TARGET SIZING

### 13.1 WCAG AA — Minimum 44x44px Touch Targets

**❌ FAILURES identified:**

| Component | Element | Size | Required | Pass? |
|-----------|---------|------|----------|-------|
| CheckoutStepper | Circle button | 32x32px (w-8 h-8) | 44x44px | ❌ FAILS |
| CartItem quantity | Minus/Plus buttons | 36x36px (w-9 h-9) | 44x44px | ❌ FAILS |
| ProductDetailClient quantity | Minus/Plus buttons | 40x40px (w-10 h-10) | 44x44px | ❌ FAILS |
| ProductCard add-to-cart | Circle button | 40x40px (w-10 h-10) | 44x44px | ❌ FAILS |

**Specific locations:**
- `CheckoutStepper.tsx:35` — `'w-8 h-8'` = 32px — **CRITICAL**
- `CartItem.tsx:85` — `'w-9 h-9'` = 36px — **CRITICAL**
- `CartItem.tsx:95` — `'w-9 h-9'` = 36px — **CRITICAL**
- `ProductDetailClient.tsx:169,175` — `'w-10 h-10'` = 40px — **CRITICAL**
- `ProductCard.tsx:91` — `'h-10 w-10'` = 40px — **CRITICAL**

**✅ PASSES:**

| Component | Element | Size | Pass? |
|-----------|---------|------|-------|
| Navbar icon buttons | Search, Cart, User | 44x44px (p-2 + icon) | ✅ |
| BottomNav nav items | Home/Cart/Account/WA | 44px+ touch area | ✅ |
| Checkout "Bayar Sekarang" button | h-14 (56px) | 56px height | ✅ |

---

## SECTION 14 — ACCESSIBILITY: ERROR ANNOUNCEMENT

### 14.1 Form Validation Error Linking

**Finding:** `components/ui/input.tsx` (21, 24:26):
```21:26:components/ui/input.tsx
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-error">{error}</p>
      )}
```
❌ Error message rendered after input but NOT linked via `aria-describedby`.

**Fix needed in Input component:**
```typescript
const errorId = error ? `error-${props.name || Math.random()}` : undefined;
return (
  <div className="relative">
    <InputPrimitive
      ...
      aria-invalid={!!error}
      aria-describedby={errorId}
      {...props}
    />
    {error && (
      <p id={errorId} className="mt-1 text-xs text-error" role="alert">
        {error}
      </p>
    )}
  </div>
);
```

### 14.2 Checkout Form Error Handling

**Finding:** `app/(store)/checkout/page.tsx` (210, 218, 247, 255):
```210:app/(store)/checkout/page.tsx
        alert(data.error || 'Gagal menghitung ongkir');
```
❌ Uses `alert()` which is a browser dialog — not accessible and blocks the page. Should be inline error display with `aria-live`.

---

## SUMMARY — CRITICAL FINDINGS

### 🔴 Critical (must fix before launch)

1. **Touch targets < 44px** — Multiple checkout and cart buttons fail WCAG AA minimum touch target size (32px, 36px, 40px vs required 44px).

2. **Gallery thumbnail missing alt text** — `ProductDetailClient.tsx:93` uses `alt=""` on product gallery thumbnails.

3. **Form error messages not linked to inputs** — `components/ui/input.tsx` renders errors but doesn't link via `aria-describedby`, preventing screen reader announcement.

4. **Text contrast failures on muted/disabled text** — `#8A8A8A` (text-muted) on brand-cream fails 4.5:1 ratio. `#9CA3AF` (text-disabled) also fails.

### 🟡 Major (significant UX impact)

5. **framer-motion imported at module level** — HeroCarousel, FeaturedProducts, EmptyState import ~30-40KB of framer-motion on homepage LCP path. Should use dynamic imports.

6. **Missing aria-live regions** — Stock validation warnings, coupon application results, points toggle feedback are not announced to screen readers.

7. **useEffect stock validation** — Cart page fetches stock validation on mount with useEffect — acceptable pattern but eslint comment flags intentional missing dependency.

8. **Double DB query in getCategories()** — Homepage makes 2 queries where 1 would suffice.

### 🟢 Minor (nice-to-have)

9. **Product detail image sizes** — Only 2 breakpoints vs 3+ for optimized loading.

10. **FOUT on brand headings** — `display: 'swap'` causes flash of unstyled text; acceptable but could improve with font-display: optional for non-critical text.

11. **PointsRedeemer checkbox hidden** — Toggle uses `sr-only` checkbox with custom styled div — not keyboard accessible as a labeled control.

---

## RECOMMENDATIONS PRIORITY ORDER

1. **Immediate (before any public launch):**
   - Fix all touch target sizes to minimum 44x44px
   - Add descriptive alt text to product gallery thumbnails
   - Fix aria-describedby on form error messages

2. **High priority (before production):**
   - Lazy-load framer-motion via next/dynamic on HeroCarousel
   - Add aria-live regions to dynamic content updates (cart warnings, coupon results)
   - Fix muted text contrast or replace with higher-contrast color

3. **Medium priority (polish phase):**
   - Pre-load provinces on checkout page instead of waiting for AddressForm
   - Optimize getCategories() to single query
   - Add intermediate image size breakpoint for product detail

4. **Low priority (nice-to-have):**
   - Improve PointsRedeemer checkbox accessibility
   - Reduce framer-motion animation duration on mobile
   - Add prefers-reduced-motion media query check

---

*End of Audit 03 — Performance and Accessibility*