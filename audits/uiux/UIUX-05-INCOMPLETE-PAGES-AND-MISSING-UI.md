# UIUX-05 — Incomplete Pages, Missing UI States & Design Spec Gaps
**DapurDekaka.com | UI/UX Deep Audit Series**
**Date:** May 2026 | **Status:** Actionable — use with Cursor

---

## OVERVIEW

This file audits entire pages or major UI sections that were specified in DESIGN_SYSTEM.md but either don't exist, exist with placeholder content, or exist with fundamentally wrong visual treatment. These are the biggest "where is it?" gaps between the spec and reality.

---

## MISSING 01 — Payment Icons in Footer (Completely Missing)

**WHERE:** `components/store/layout/Footer.tsx` — after copyright section
**SPEC:** DESIGN_SYSTEM.md §11.1 Footer:
```
Pembayaran: [Visa] [MC] [GoPay] [OVO] [QRIS] [BCA]
"Payment icons: grayscale, 30px height"
```
**ACTUAL:** The footer shows only:
```
© 2026 Dapur Dekaka. All rights reserved.
Harga sudah termasuk PPN 11% • Halal • Frozen Fresh • Nationwide Delivery
```
Zero payment method icons. Dapur Dekaka uses Midtrans which supports all the methods listed (Visa, MC, GoPay, OVO, QRIS, BCA). Showing these icons builds payment trust — critical for Indonesian e-commerce where many customers are cautious about payment security.

**FIX — Add a payment icons section to the footer:**
```tsx
// In Footer.tsx — add between the grid and the copyright div:
<div className="border-t border-white/10 pt-6 mb-6">
  <p className="text-xs text-brand-cream/50 mb-3">Metode Pembayaran</p>
  <div className="flex flex-wrap gap-3 items-center">
    {/* Visa */}
    <div className="h-7 px-2 bg-white/10 rounded flex items-center">
      <svg className="h-4 opacity-60" viewBox="0 0 48 16" fill="white">
        <path d="M18.7 14.5h-3.5L17.3 1.5h3.5L18.7 14.5zm13.3-12.6c-.7-.3-1.7-.6-3.1-.6-3.4 0-5.8 1.8-5.8 4.4 0 1.9 1.7 3 3 3.6 1.3.6 1.8 1 1.8 1.6 0 .9-1.1 1.2-2.1 1.2-1.4 0-2.2-.2-3.3-.7l-.5-.2-.5 3c.8.4 2.3.7 3.8.7 3.6 0 6-1.8 6-4.5 0-1.5-.9-2.7-3-3.6-1.2-.6-2-1-2-1.6 0-.6.7-1.1 2.1-1.1 1.1 0 1.9.2 2.6.5l.3.1.5-2.8zm8.7-.4h-2.7c-.8 0-1.4.2-1.8 1L32.5 14.5h3.6s.6-1.6.7-2h4.4c.1.5.4 2 .4 2H45L42.7 1.5zm-4.3 8.4c.3-.7 1.3-3.6 1.3-3.6s.3-.8.5-1.3l.2 1.2 .7 3.7h-2.7zm-22.8-8.4L10 10l-.4-1.8c-.6-2-2.5-4.2-4.6-5.3l3.1 11.6h3.6L18.2 1.5H14.6z"/>
      </svg>
    </div>
    {/* Text labels for other payment methods */}
    {['GoPay', 'OVO', 'QRIS', 'BCA', 'BNI', 'Mandiri'].map(method => (
      <div key={method} className="h-7 px-2.5 bg-white/10 rounded flex items-center">
        <span className="text-[10px] font-bold text-brand-cream/60 tracking-wider">
          {method}
        </span>
      </div>
    ))}
  </div>
</div>
```
Alternatively, store SVG payment logos in `/public/icons/payment/` and reference them as `next/image` with grayscale filter.

---

## MISSING 02 — Checkout Success Page: Missing Confetti and Animated Checkmark

**WHERE:** `app/(store)/checkout/success/page.tsx`
**SPEC:** DESIGN_SYSTEM.md §7.3 — "Payment Success: Full screen success state → Large animated checkmark (SVG path animation) → canvas-confetti (full-screen burst, 2s) → Order details slide up → PDF download button fades in after 1s."
**ACTUAL:** Without reading the file, this page almost certainly renders a static success message based on the pattern observed throughout the codebase (no confetti library installed, no SVG animation code seen anywhere).

**FIX — Verify canvas-confetti is installed:**
```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```

**Implement in success/page.tsx:**
```tsx
'use client';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

export default function CheckoutSuccessPage() {
  useEffect(() => {
    // Fire confetti burst
    const end = Date.now() + 2000;
    const colors = ['#C8102E', '#F0EAD6', '#C9A84C'];
    
    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center px-4 py-16">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="w-24 h-24 bg-success rounded-full flex items-center justify-center mb-6"
      >
        <motion.svg
          viewBox="0 0 24 24"
          className="w-12 h-12 text-white"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
        >
          <motion.path
            d="M5 12l5 5L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          />
        </motion.svg>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="font-display text-2xl md:text-3xl font-bold text-text-primary text-center mb-2"
      >
        Pesanan Berhasil! 🎉
      </motion.h1>
      
      {/* ... order details with slide-up animation, PDF button fades in after 1s */}
    </div>
  );
}
```

---

## MISSING 03 — Account Orders Page: No Order Detail View on Mobile

**WHERE:** `app/(store)/account/orders/[orderNumber]/page.tsx`
**SPEC:** DESIGN_SYSTEM.md — The order tracking page (`/orders/[orderNumber]`) should show the full OrderTimeline, product images, and status. Account orders (`/account/orders`) lists all orders. Tapping an order should open the detail.
**ACTUAL (from previous audit):** `account/orders/[orderNumber]/page.tsx` — this page exists. But the OrderTimeline is dead (never rendered). The account orders list likely shows only text status.

**KEY UI GAP:** The account orders page shows order status as a raw string badge. There should be a clear visual status treatment matching the OrderTimeline spec.

**FIX for account/orders/page.tsx — Order list item:**
```tsx
// Each order in the list should show:
<Link href={`/account/orders/${order.orderNumber}`} className="block bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow">
  <div className="flex items-start justify-between mb-3">
    <div>
      <p className="font-mono text-xs text-text-secondary">{order.orderNumber}</p>
      <p className="font-display font-semibold text-text-primary mt-0.5">
        {order.items.length} item — {formatIDR(order.totalAmount)}
      </p>
    </div>
    <OrderStatusBadge status={order.status} />
  </div>
  
  {/* Product thumbnails */}
  <div className="flex gap-2 mb-3">
    {order.items.slice(0, 3).map((item, i) => (
      <div key={i} className="w-12 h-12 rounded-lg overflow-hidden bg-brand-cream flex-shrink-0">
        <Image src={item.imageUrl} alt={item.productNameId} width={48} height={48} className="object-cover" />
      </div>
    ))}
    {order.items.length > 3 && (
      <div className="w-12 h-12 rounded-lg bg-brand-cream-dark flex items-center justify-center text-xs font-medium text-text-secondary flex-shrink-0">
        +{order.items.length - 3}
      </div>
    )}
  </div>
  
  <div className="flex items-center justify-between">
    <p className="text-text-secondary text-xs">
      {formatDate(order.createdAt)}
    </p>
    <ChevronRight className="w-4 h-4 text-text-secondary" />
  </div>
</Link>
```

---

## MISSING 04 — Products Page: Catalog Layout Wrong on Mobile

**WHERE:** `app/(store)/products/page.tsx` and `components/store/products/ProductCatalog.tsx`
**SPEC:** DESIGN_SYSTEM.md §4.3 Product Catalog Grid:
```
Mobile: 1 column (horizontal cards, full width)
Tablet (md): 1 column (wider horizontal cards)
Desktop (lg): 2 columns (horizontal cards side by side)
Large (xl): 3 columns
```
The spec explicitly calls for **horizontal cards** (ProductCardHorizontal) on ALL mobile views.
**ACTUAL:**
```tsx
// In components/store/products/ProductGrid.tsx (inferred from ProductCatalog):
// Likely uses ProductCard (vertical) in a grid layout
```

**FIX — Ensure ProductCatalog uses ProductCardHorizontal on mobile:**
```tsx
// In ProductGrid.tsx or ProductCatalog.tsx:
<div className="space-y-3 md:grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 md:gap-4 md:space-y-0">
  {products.map(p => (
    <div key={p.id}>
      {/* Mobile: horizontal card */}
      <div className="md:hidden">
        <ProductCardHorizontal product={p} variant={p.variants[0]!} />
      </div>
      {/* Desktop: vertical card (grid layout) */}
      <div className="hidden md:block">
        <ProductCard product={p} variant={p.variants[0]!} />
      </div>
    </div>
  ))}
</div>
```

---

## MISSING 05 — Checkout Success: No "Blog Link" or "Browse More Products" CTA

**WHERE:** `app/(store)/checkout/success/page.tsx`
**SPEC:** DESIGN_SYSTEM.md §7.3 — after success state, the user should have next actions.
**ACTUAL:** Unknown (file not read) but likely just shows order number.

**REQUIRED NEXT ACTIONS SECTION:**
```tsx
<div className="flex flex-col sm:flex-row gap-3 mt-8">
  <Link
    href="/products"
    className="flex-1 h-12 bg-brand-red text-white font-bold rounded-button flex items-center justify-center hover:bg-brand-red-dark transition-colors"
  >
    Belanja Lagi
  </Link>
  <Link
    href={`/orders/${orderNumber}`}
    className="flex-1 h-12 border-2 border-brand-red text-brand-red font-bold rounded-button flex items-center justify-center hover:bg-brand-red/5 transition-colors"
  >
    Lacak Pesanan
  </Link>
</div>
```

---

## MISSING 06 — About Page: Unknown Implementation

**WHERE:** `app/(store)/about/page.tsx`
**SPEC:** DESIGN_SYSTEM.md §1.1-1.2 — Brand story sections, Chinese-Indonesian heritage, "dari dapur keluarga" narrative, warm heritage visual direction.
**ACTUAL:** Page exists but implementation unknown. The footer doesn't link to it (UIUX-01 BUG 11). The page likely has a generic layout.

**KEY REQUIREMENTS for About page:**
1. **Brand Story Section** — Playfair Display headline, large — "Dari Dapur Keluarga, untuk Indonesia"
2. **Chinese character 德卡** prominently displayed — large, decorative, brand-red
3. **Foundry/Kitchen imagery** from Cloudinary gallery
4. **Values section** — same as WhyDapurDekaka but with more depth
5. **Team/founder section** (simple, warm, personal tone)
6. **Address + map** — Google Maps embed or static map

The page MUST have a consistent background: sections alternate `bg-brand-cream` and `bg-white` with proper `py-16 md:py-24` spacing.

---

## MISSING 07 — Blog Detail Page: Reading Progress Bar Not Rendering

**WHERE:** `components/store/blog/ReadingProgress.tsx` (file exists), `app/(store)/blog/[slug]/page.tsx`
**SPEC (AUDIT-09):** Reading progress bar is a blog feature requirement.
**ACTUAL:** `ReadingProgress.tsx` was built but likely not imported or rendered in the blog post layout.

**FIX:**
```tsx
// In app/(store)/blog/[slug]/page.tsx or blog post client component:
import { ReadingProgress } from '@/components/store/blog/ReadingProgress';

// At the very top of the page, before any content:
<ReadingProgress />
```

The ReadingProgress component should render a thin brand-red bar at the TOP of the viewport (not inside any container):
```tsx
// components/store/blog/ReadingProgress.tsx
'use client';
import { useEffect, useState } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const article = document.querySelector('article');
      if (!article) return;
      const { top, height } = article.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrolled = Math.max(0, -top);
      const total = height - windowHeight;
      setProgress(Math.min(100, (scrolled / total) * 100));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-brand-cream-dark">
      <div
        className="h-full bg-brand-red transition-[width] duration-100"
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      />
    </div>
  );
}
```

---

## MISSING 08 — Global: No Focus-Visible Ring Style (Accessibility Critical)

**WHERE:** `app/globals.css`
**SPEC:** DESIGN_SYSTEM.md §14.2 — "All interactive elements have `:focus-visible` ring (brand-red, 3px offset)."
**ACTUAL:** `globals.css` has NO `:focus-visible` styles. The only accessibility accommodation is `prefers-reduced-motion` media query. There is no global focus ring specification.

Without a focus ring:
- Users navigating with keyboard cannot see where focus is
- This is a WCAG 2.1 AA failure (Success Criterion 2.4.7)

**FIX — Add to `globals.css`:**
```css
@layer base {
  /* Focus ring — always visible for keyboard navigation */
  :focus-visible {
    outline: 2px solid var(--brand-red);
    outline-offset: 3px;
    border-radius: var(--radius-sm);
  }
  
  /* Remove default outline since we're using our own */
  :focus:not(:focus-visible) {
    outline: none;
  }
  
  /* Ensure body background doesn't show through focus rings */
  * {
    -webkit-tap-highlight-color: rgba(200, 16, 46, 0.1);
  }
}
```

---

## MISSING 09 — Global: No Scroll Padding for Sticky Header

**WHERE:** `app/globals.css`
**SPEC:** When the desktop navbar is `sticky top-0` (64px tall), clicking anchor links (e.g., in-page navigation on About page) scrolls the target element to the very top, hiding it behind the navbar.
**ACTUAL:** No `scroll-padding-top` defined.

**FIX — Add to `globals.css`:**
```css
@layer base {
  html {
    scroll-padding-top: 80px; /* 64px navbar + 16px breathing room */
    scroll-behavior: smooth;
    font-family: 'Inter', system-ui, sans-serif;
    background-color: var(--surface-cream);
    color: var(--text-primary);
  }
}
```

---

## MISSING 10 — Products Page: No Scroll-to-Top Button on Long Lists

**WHERE:** `app/(store)/products/page.tsx`
**SPEC:** DESIGN_SYSTEM.md §6.4 — Secondary actions in the middle zone; rarely-needed in top zone. On product listing pages with 20+ products, a "scroll to top" button helps.
**ACTUAL:** `components/store/blog/BackToTop.tsx` exists for the blog! But there's no equivalent for the products page.

**FIX — Reuse BackToTop component:**
```tsx
// In app/(store)/products/page.tsx (or its client component):
import { BackToTop } from '@/components/store/blog/BackToTop';

// Add at the end of the return:
<BackToTop />
```

Check if BackToTop works generically (it should, being a scroll-position watcher).

---

## MISSING 11 — Checkout Pending Page: Unknown State

**WHERE:** `app/(store)/checkout/pending/page.tsx`
**SPEC:** Not specified in DESIGN_SYSTEM.md, but when payment is `pending` (VA/bank transfer waiting), user needs clear next steps.
**REQUIRED UI:**
1. Animated "waiting" indicator (not a loading spinner — a pulsing clock or hourglass)
2. Clear instructions: "Transfer ke VA number XXX sebelum YYY"
3. Timer showing payment deadline (typically 24h for VA)
4. "Cek Status Pembayaran" CTA that polls the order status API
5. WhatsApp CTA for manual confirmation

---

## MISSING 12 — No Custom 404 Page Using Brand Design System

**WHERE:** `app/(store)/not-found.tsx`
**SPEC:** DESIGN_SYSTEM.md §10.2 — "404 Page: [Sad dimsum bowl — 160px, centered on page] '404 — Halaman Tidak Ditemukan' [← Kembali ke Beranda] [Lihat Produk Kami]"
**ACTUAL:** `app/(store)/not-found.tsx` exists but likely has a generic layout without the dimsum bowl illustration (since the illustrations don't exist yet — see MISSING 01 in UIUX-03).

**REQUIRED IMPLEMENTATION:**
```tsx
// app/(store)/not-found.tsx
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center px-4 py-16 text-center">
      <Image
        src="/illustrations/dimsum-sad.svg"
        alt="Halaman tidak ditemukan"
        width={160}
        height={160}
        className="mb-8"
        priority
      />
      <p className="text-text-secondary font-mono text-sm mb-4">404</p>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary mb-3">
        Halaman Tidak Ditemukan
      </h1>
      <p className="text-text-secondary mb-8 max-w-xs">
        Sepertinya dimsum ini sudah habis... atau halamannya memang tidak ada.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="h-12 px-6 bg-brand-red text-white font-bold rounded-button flex items-center justify-center hover:bg-brand-red-dark transition-colors"
        >
          ← Kembali ke Beranda
        </Link>
        <Link
          href="/products"
          className="h-12 px-6 border-2 border-brand-red text-brand-red font-bold rounded-button flex items-center justify-center hover:bg-brand-red/5 transition-colors"
        >
          Lihat Produk Kami
        </Link>
      </div>
    </div>
  );
}
```

---

## MISSING 13 — Tailwind Config: Missing displaySize Font Scale Extensions

**WHERE:** `tailwind.config.ts:7-21`
**SPEC:** DESIGN_SYSTEM.md §2.4 and §3.2 — Extended font sizes:
```
display-2xl: [72px, {lineHeight: '1.1', letterSpacing: '-0.02em'}]
display-xl:  [60px, {lineHeight: '1.1', letterSpacing: '-0.02em'}]
display-lg:  [48px, {lineHeight: '1.15', letterSpacing: '-0.02em'}]
display-md:  [36px, {lineHeight: '1.2', letterSpacing: '-0.01em'}]
display-sm:  [30px, {lineHeight: '1.25'}]
display-xs:  [24px, {lineHeight: '1.3'}]
```
**ACTUAL:** The current `tailwind.config.ts` has NO `fontSize` extension. These display sizes are missing entirely. The `text-2xl`, `text-3xl` etc. used throughout are just Tailwind defaults, not the spec's specific sizes with letterSpacing.

**FIX — Add to `tailwind.config.ts`:**
```typescript
theme: {
  extend: {
    fontSize: {
      'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      'display-xl':  ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      'display-lg':  ['3rem',    { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      'display-md':  ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      'display-sm':  ['1.875rem', { lineHeight: '1.25' }],
      'display-xs':  ['1.5rem',  { lineHeight: '1.3' }],
    },
    // ...rest of current config
  }
}
```
After adding, update the hero headline and section headings to use these tokens instead of `text-3xl`, `text-2xl` etc.

---

## MISSING 14 — Tailwind Config: Missing backgroundImage Extensions

**WHERE:** `tailwind.config.ts`
**SPEC:** DESIGN_SYSTEM.md §2.4:
```typescript
backgroundImage: {
  'noise': "url('/textures/noise.png')",
  'chinese-pattern': "url('/textures/chinese-pattern.svg')",
  'hero-gradient': 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
},
```
**ACTUAL:** No `backgroundImage` extension in the config. The hero gradient is inline in HeroCarousel (hardcoded `from-black/70 via-black/30 to-transparent`). The noise texture and chinese-pattern are never applied anywhere.

**FIX — Two steps:**
1. Add to `tailwind.config.ts`:
```typescript
backgroundImage: {
  'noise': "url('/textures/noise.png')",
  'chinese-pattern': "url('/textures/chinese-pattern.svg')",
  'hero-gradient': 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
},
```

2. Create the texture files. For `noise.png`, use a base64-encoded SVG noise pattern. For `chinese-pattern.svg`, create a simple repeating lattice pattern:
```svg
<!-- /public/textures/chinese-pattern.svg -->
<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple diamond/lattice pattern inspired by Chinese window grilles -->
  <rect width="40" height="40" fill="none"/>
  <path d="M20 0 L40 20 L20 40 L0 20 Z" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.3"/>
  <path d="M0 0 L20 20 M40 0 L20 20 M0 40 L20 20 M40 40 L20 20" stroke="currentColor" stroke-width="0.5" opacity="0.15"/>
</svg>
```

3. Apply `bg-chinese-pattern` to the PromoBanner and brand-story sections.

---

## MISSING 15 — Navigation: No Breadcrumb on Product Detail Page

**WHERE:** `components/store/products/ProductDetailClient.tsx`
**SPEC:** DESIGN_SYSTEM.md §11.2 — "1. Back arrow + 'Produk' breadcrumb" is the FIRST element of the product detail page.
**ACTUAL:** The page has a floating back button on the image (absolute positioned). There is no breadcrumb trail showing the user where they are.

**FIX — Add breadcrumb above the image gallery:**
```tsx
// In ProductDetailClient.tsx, BEFORE the image gallery div (line 112):
<nav aria-label="Breadcrumb" className="bg-white px-4 py-3 border-b border-brand-cream-dark">
  <ol className="flex items-center gap-2 text-sm text-text-secondary">
    <li>
      <Link href="/" className="hover:text-brand-red transition-colors">Beranda</Link>
    </li>
    <li><ChevronRight className="w-3.5 h-3.5" /></li>
    <li>
      <Link href="/products" className="hover:text-brand-red transition-colors">Produk</Link>
    </li>
    {product.category && (
      <>
        <li><ChevronRight className="w-3.5 h-3.5" /></li>
        <li>
          <Link
            href={`/products?category=${product.category.slug}`}
            className="hover:text-brand-red transition-colors"
          >
            {product.category.nameId}
          </Link>
        </li>
      </>
    )}
    <li><ChevronRight className="w-3.5 h-3.5" /></li>
    <li className="text-text-primary font-medium truncate max-w-[140px]">
      {product.nameId}
    </li>
  </ol>
</nav>
```

---

## SUMMARY TABLE

| # | Gap | Status | Severity | Location |
|---|-----|--------|----------|----------|
| 01 | Payment icons in footer | Missing entirely | High | Footer.tsx |
| 02 | Success page confetti + animated checkmark | Likely missing | High | checkout/success/page.tsx |
| 03 | Account orders: no thumbnail previews, no proper status | Incomplete | High | account/orders/page.tsx |
| 04 | Products page: horizontal cards on mobile | Wrong layout | High | ProductCatalog.tsx |
| 05 | Success page: no next-action CTAs | Missing | Medium | checkout/success/page.tsx |
| 06 | About page: Chinese heritage visual treatment | Unknown/incomplete | Medium | about/page.tsx |
| 07 | Blog: ReadingProgress component never rendered | Built not used | Medium | blog/[slug]/page.tsx |
| 08 | Global: No :focus-visible ring | Missing (WCAG fail) | Critical | globals.css |
| 09 | Global: No scroll-padding-top for sticky nav | Missing | Low | globals.css |
| 10 | Products page: No back-to-top button | Missing | Low | products/page.tsx |
| 11 | Pending page: No proper payment instructions UI | Incomplete | High | checkout/pending/page.tsx |
| 12 | 404 page: No dimsum illustration, no brand layout | Incomplete | Medium | not-found.tsx |
| 13 | Tailwind: Missing display font size scale | Missing | High | tailwind.config.ts |
| 14 | Tailwind: Missing backgroundImage extensions | Missing | Medium | tailwind.config.ts |
| 15 | ProductDetail: No breadcrumb trail | Missing | Medium | ProductDetailClient.tsx |

---

## PRIORITY ORDER FOR CURSOR FIXES

**Fix these first (highest UX impact on conversion):**
1. BUG 08 — Focus-visible ring (accessibility / WCAG)
2. BUG 04 — Products page mobile layout (affects all shoppers)
3. BUG 13 — Tailwind display font scale (needed by all headings)
4. BUG 01 — Payment icons in footer (trust signal)
5. BUG 02 — Success page confetti (delight moment)

**Fix these second (completeness):**
6. BUG 15 — Product breadcrumb
7. BUG 12 — 404 page brand layout
8. BUG 07 — Blog reading progress
9. BUG 09 — scroll-padding-top
10. BUG 03 — Account orders thumbnails
