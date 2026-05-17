# UIUX-04 — Mobile UX, Interactions & Animation Gaps
**DapurDekaka.com | UI/UX Deep Audit Series**
**Date:** May 2026 | **Status:** Actionable — use with Cursor

---

## OVERVIEW

This file audits mobile-specific UX patterns: touch targets, scroll behavior, gesture support, micro-interactions, loading states, and animation implementation gaps. Dapur Dekaka's primary customers are Indonesian mobile shoppers — every pixel here is revenue.

---

## BUG 01 — Mobile Navbar: Hamburger Menu Has No Close-on-Outside-Click

**WHERE:** `components/store/layout/Navbar.tsx:114-137`
**SPEC:** DESIGN_SYSTEM.md §7.3 — "Drawer/sheet open: slides from right (300ms ease-out)." The mobile menu should close when user taps outside it.
**ACTUAL:**
```tsx
{mobileMenuOpen && (
  <div className="absolute top-14 left-0 right-0 bg-white border-b border-brand-cream-dark shadow-lg z-40">
    <nav className="p-4 space-y-1">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={() => setMobileMenuOpen(false)}  {/* closes on link click ✅ */}
          className="block py-3 px-4 ..."
        >
```
**Problems:**
1. No backdrop overlay — user cannot close menu by tapping outside
2. No animation — spec says "slides" (translate animation), but the menu just appears instantly with `{mobileMenuOpen && ...}` conditional rendering
3. Menu stays open when route changes (navigate to same page with fragment, etc.)

**FIX:**
```tsx
// Add backdrop + animation + close on outside click:
{mobileMenuOpen && (
  <>
    {/* Backdrop */}
    <div
      className="fixed inset-0 bg-black/20 z-30"
      onClick={() => setMobileMenuOpen(false)}
      aria-hidden="true"
    />
    {/* Menu — add slide-down animation */}
    <div className="absolute top-14 left-0 right-0 bg-white border-b border-brand-cream-dark shadow-lg z-40 animate-slide-up">
      <nav className="p-4 space-y-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center"
          >
            {link.label}
          </Link>
        ))}
        <hr className="my-2 border-brand-cream-dark" />
        <Link
          href="/account"
          onClick={() => setMobileMenuOpen(false)}
          className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center"
        >
          Akun Saya
        </Link>
      </nav>
    </div>
  </>
)}
```
Note: `min-h-[44px] flex items-center` ensures all mobile menu items meet the 44px touch target.

---

## BUG 02 — Mobile Navbar: No Active State Indicator on Desktop Nav Links

**WHERE:** `components/store/layout/Navbar.tsx:37-45`
**SPEC:** DESIGN_SYSTEM.md §6.2 — "Active: brand-red underline."
**ACTUAL:**
```tsx
{NAV_LINKS.map((link) => (
  <Link
    key={link.href}
    href={link.href}
    className="text-text-primary hover:text-brand-red font-medium transition-colors"
    // NO active state!
  >
    {link.label}
  </Link>
))}
```
There is no `usePathname()` call and no active state styling. All nav links look the same regardless of which page you're on.

**FIX:**
```tsx
// Add usePathname hook:
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  // ...
  
  // In nav links:
  {NAV_LINKS.map((link) => {
    const isActive = link.href === '/' 
      ? pathname === '/' 
      : pathname.startsWith(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          'font-medium transition-colors relative pb-0.5',
          isActive 
            ? 'text-brand-red after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-red after:rounded-full'
            : 'text-text-primary hover:text-brand-red'
        )}
      >
        {link.label}
      </Link>
    );
  })}
```

---

## BUG 03 — CategoryChips: No Active State Reflecting Current Page

**WHERE:** `components/store/home/CategoryChips.tsx:26`
**SPEC:** DESIGN_SYSTEM.md §11.1 — "Active: brand-red background, cream text. Inactive: cream background, brand-red text."
**ACTUAL:**
```tsx
export function CategoryChips({ categories, activeSlug }: CategoryChipsProps) {
```
The component accepts `activeSlug` prop but on the homepage (`app/(store)/page.tsx`), it's called as:
```tsx
<CategoryChips categories={allCategories} />
```
No `activeSlug` prop is passed! So the "Semua" chip will never be shown as active even when you're on the homepage (which shows all products). The prop exists but is never used from the homepage.

**FIX in `app/(store)/page.tsx`:**
```tsx
// Pass the active slug (none means "all"):
<CategoryChips categories={allCategories} activeSlug={undefined} />
// This makes "Semua" chip appear active (correct for homepage).

// On products page, pass the current category:
// (in app/(store)/products/page.tsx, read searchParams.category)
<CategoryChips categories={allCategories} activeSlug={categorySlug} />
```

---

## BUG 04 — Add-to-Cart: No Visual Feedback Animation (Cart Icon Bounce Missing)

**WHERE:** `components/store/products/ProductCard.tsx:57-64`, `components/store/layout/Navbar.tsx:65`
**SPEC:** DESIGN_SYSTEM.md §7.3 — "Add to Cart Animation: Button text changes to 'Ditambahkan ✓' → flashes brand-red-dark for 100ms → Cart icon does quick scale(1.3)→scale(1) bounce → Cart count badge updates with scale animation. Duration: 600ms total."
**ACTUAL:**
```tsx
const handleQuickAdd = (e: React.MouseEvent) => {
  e.preventDefault();
  if (isOutOfStock) return;
  addItem({ ... });
  toast.success(`${product.nameId} ditambahkan ke keranjang`, {
    action: { label: 'Lihat Keranjang', onClick: () => router.push('/cart') },
  });
};
```
Only a toast notification is shown. No button animation, no cart icon bounce, no badge scale.

**FIX — Add button feedback state:**
```tsx
// In ProductCard.tsx:
const [justAdded, setJustAdded] = useState(false);

const handleQuickAdd = (e: React.MouseEvent) => {
  e.preventDefault();
  if (isOutOfStock || justAdded) return;
  addItem({ ... });
  setJustAdded(true);
  setTimeout(() => setJustAdded(false), 1200);
  toast.success(`${product.nameId} ditambahkan ke keranjang`, {
    action: { label: 'Lihat Keranjang', onClick: () => router.push('/cart') },
  });
};

// Button visual:
<button
  onClick={handleAddToCart}
  disabled={isOutOfStock}
  className={cn(
    'h-11 w-11 rounded-full flex items-center justify-center transition-all duration-150',
    justAdded
      ? 'bg-success text-white scale-95'
      : isOutOfStock
        ? 'bg-text-disabled text-white cursor-not-allowed'
        : 'bg-brand-red text-white hover:bg-brand-red-dark active:scale-95'
  )}
  aria-label={justAdded ? 'Ditambahkan!' : 'Tambah ke keranjang'}
>
  {justAdded ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
</button>
```

The cart icon bounce in the navbar is harder to implement without global state. A simpler approach: when `totalItems` changes, briefly add a CSS class that scales the cart icon:
```tsx
// In Navbar.tsx — track previous total and add animation on change:
const [cartBounce, setCartBounce] = useState(false);
const prevTotal = useRef(totalItems);

useEffect(() => {
  if (totalItems > prevTotal.current) {
    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 500);
  }
  prevTotal.current = totalItems;
}, [totalItems]);

// Cart link icon:
<ShoppingCart className={cn('w-5 h-5 transition-transform', cartBounce && 'scale-125')} />
```

---

## BUG 05 — HeroCarousel: No Swipe Gesture Support on Mobile

**WHERE:** `components/store/home/HeroCarousel.tsx`
**SPEC:** DESIGN_SYSTEM.md §11.1 — "Embla carousel, autoplay 5s, loop. Swipe gesture on mobile."
**ACTUAL:** The carousel uses manual `setCurrentSlide` with `setInterval` for autoplay. There is NO touch/swipe gesture support. On mobile, users cannot swipe the hero banner — they must tap the navigation dots (which are small and at the very bottom of the viewport).

**FIX — Add touch gesture support:**
```tsx
// In HeroCarousel.tsx — add touch handlers:
const touchStartX = useRef<number>(0);
const touchEndX = useRef<number>(0);

const handleTouchStart = (e: React.TouchEvent) => {
  touchStartX.current = e.targetTouches[0].clientX;
};

const handleTouchEnd = (e: React.TouchEvent) => {
  touchEndX.current = e.changedTouches[0].clientX;
  const diff = touchStartX.current - touchEndX.current;
  if (Math.abs(diff) > 50) { // 50px threshold
    if (diff > 0) {
      nextSlide(); // swipe left → next
    } else {
      setCurrentSlide((prev) => (prev - 1 + activeSlides.length) % activeSlides.length); // swipe right → prev
    }
  }
};

// Add to the section element:
<section
  className="relative h-[50vh] md:h-[70vh] bg-brand-red overflow-hidden"
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
>
```

Also enlarge the navigation dots for easier tapping:
```tsx
// BEFORE: w-2.5 h-2.5 dots
<button
  className={`w-2.5 h-2.5 rounded-full transition-all ...`}
  // SPEC says: "Navigation dots: bottom-center, cream dots (active = brand-red, larger)"
  
// AFTER: Increase to w-3 h-3 (12px), active extends to w-10 (40px):
<button
  className={cn(
    'h-3 rounded-full transition-all touch-manipulation',
    index === currentSlide ? 'w-10 bg-brand-red' : 'w-3 bg-white/60 hover:bg-white/80'
  )}
```

---

## BUG 06 — HeroCarousel: Navigation Dots Are White Instead of Spec Color

**WHERE:** `components/store/home/HeroCarousel.tsx:137-141`
**SPEC:** DESIGN_SYSTEM.md §11.1 — "Navigation dots: cream dots (active = brand-red, larger)."
**ACTUAL:**
```tsx
className={`w-2.5 h-2.5 rounded-full transition-all ${
  index === currentSlide
    ? 'bg-white w-8'   // ← active is WHITE (should be brand-red)
    : 'bg-white/50 hover:bg-white/70'  // ← inactive is white/50
}`}
```
Active dot is WHITE. Spec says active should be `brand-red`. The dots appear ON TOP of a full-screen image with a dark overlay, so white would be more visible, but spec is explicit. Given the dark overlay (`from-black/70`), brand-red dots might be hard to see against the overlay.

**COMPROMISE FIX — Use white for the carousel context (accessibility over strict spec):**
The spec appears to be written for a different slide type (promo banner with cream background). For the full-bleed photo carousel with dark overlay, white is actually more accessible.

**Keep white dots, but fix the active state color and increase size:**
```tsx
className={cn(
  'h-2.5 rounded-full transition-all duration-300 touch-manipulation',
  index === currentSlide
    ? 'w-8 bg-white'          // Keep white for contrast on dark overlay
    : 'w-2.5 bg-white/50 hover:bg-white/75'
)}
```
The correct spec change: when the carousel IS on a cream/light background (Type 2 promo slide), switch to brand-red. Add a `dotColor` prop to `HeroCarousel` or use slide `type` to determine dot color.

---

## BUG 07 — Product Detail Page: No Scroll-to-Cart Behavior After Add-to-Cart

**WHERE:** `components/store/products/ProductDetailClient.tsx` — sticky bottom bar behavior
**SPEC:** DESIGN_SYSTEM.md §6.5 — "Appears when user scrolls past the main add-to-cart button." The sticky bottom bar should only show when the primary button is scrolled out of view.
**ACTUAL:** Looking at the ProductDetailClient, there is NO primary add-to-cart button in the product info section. The ONLY add-to-cart button is in the **sticky bottom bar at the bottom**. The sticky bar is always visible — not conditionally shown after scrolling past a button.

Per spec:
1. Product info section should have a visible add-to-cart button
2. When user scrolls DOWN past it, the sticky bar appears
3. When user scrolls back UP, the sticky bar hides

**FIX — Add a primary add-to-cart button in the product info card, and make the sticky bar conditional:**
```tsx
// In ProductDetailClient.tsx — add button to the product info section:
{/* After the stock badge (line 222) */}
<button
  id="main-add-to-cart"
  onClick={handleAddToCart}
  disabled={isOutOfStock}
  className={cn(
    'mt-4 w-full h-12 flex items-center justify-center gap-2 font-bold rounded-button transition-colors',
    isOutOfStock
      ? 'bg-text-disabled text-white cursor-not-allowed'
      : 'bg-brand-red text-white hover:bg-brand-red-dark'
  )}
>
  <ShoppingCart className="w-5 h-5" />
  {isOutOfStock ? 'Stok Habis' : 'Tambah ke Keranjang'}
</button>

// Add IntersectionObserver to show/hide sticky bar:
const [showStickyBar, setShowStickyBar] = useState(false);
useEffect(() => {
  const target = document.getElementById('main-add-to-cart');
  if (!target) return;
  const observer = new IntersectionObserver(
    ([entry]) => setShowStickyBar(!entry.isIntersecting),
    { threshold: 0 }
  );
  observer.observe(target);
  return () => observer.disconnect();
}, []);

// Make sticky bar conditional:
{showStickyBar && (
  <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:hidden left-0 right-0 bg-white border-t border-brand-cream-dark p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] animate-slide-up">
    ...
  </div>
)}
```

---

## BUG 08 — Cart Page: No Confirm Dialog Uses Native `confirm()` — Blocks UI

**WHERE:** `app/(store)/cart/page.tsx:90`
**SPEC:** DESIGN_SYSTEM.md §7.3 — "Modal open: scale(0.95) → scale(1) + fade (250ms)." Confirmation should use a brand-consistent dialog, not native browser confirm.
**ACTUAL:**
```tsx
<button
  onClick={() => {
    if (confirm('Hapus semua item dari keranjang?')) {  // ← Native browser dialog
      clearCart();
    }
  }}
```
`window.confirm()` blocks the JS thread and shows a native OS dialog that:
1. Looks completely off-brand (Android shows Chrome dialog, iOS shows Safari dialog)
2. Cannot be styled
3. Blocks all animations and transitions

**FIX — Use a Sheet or Dialog from the existing `components/ui/dialog.tsx`:**
```tsx
// Import dialog:
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// Add state:
const [showClearConfirm, setShowClearConfirm] = useState(false);

// Button:
<button
  onClick={() => setShowClearConfirm(true)}
  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-button transition-colors"
>
  <Trash2 className="w-4 h-4" />
  Hapus Semua
</button>

{/* Dialog */}
<Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle className="font-display">Hapus Semua Item?</DialogTitle>
    </DialogHeader>
    <p className="text-text-secondary text-sm">
      Semua item akan dihapus dari keranjang. Tindakan ini tidak bisa dibatalkan.
    </p>
    <DialogFooter className="flex gap-3">
      <button
        onClick={() => setShowClearConfirm(false)}
        className="flex-1 h-11 border border-brand-cream-dark rounded-button font-medium"
      >
        Batal
      </button>
      <button
        onClick={() => { clearCart(); setShowClearConfirm(false); }}
        className="flex-1 h-11 bg-brand-red text-white rounded-button font-bold"
      >
        Hapus
      </button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## BUG 09 — Checkout: "Kembali ke Kurir" Back Link Has No Minimum Touch Target

**WHERE:** `app/(store)/checkout/page.tsx:782-786`
**ACTUAL:**
```tsx
<button
  type="button"
  onClick={handleBack}
  className="text-sm text-text-secondary hover:underline mb-4 text-left"
>
  ← Kembali ke Kurir
</button>
```
This is a plain text link with no padding. Its tap area is exactly the text width (~120px) by text height (~20px). Far below the 44px minimum height.

**FIX:**
```tsx
<button
  type="button"
  onClick={handleBack}
  className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4 min-h-[44px]"
>
  <ArrowLeft className="w-4 h-4" />
  Kembali
</button>
```

---

## BUG 10 — Testimonials: Carousel Navigation Arrows Are Hidden Behind Content on Narrow Screens

**WHERE:** `components/store/home/Testimonials.tsx:92-106`
**ACTUAL:**
```tsx
<div className="relative max-w-2xl mx-auto">
  <div className="overflow-hidden">
    ...
  </div>
  {/* Navigation arrows — positioned absolutely outside the overflow-hidden container */}
  <button
    onClick={prev}
    className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full ..."
  >
  <button
    onClick={next}
    className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full ..."
  >
```
The arrows are `left-0` and `right-0` of the `max-w-2xl mx-auto` container. On screens narrower than 672px (the `max-w-2xl` = 672px), the container fills the full width including `px-4` from the parent section. The arrows at `left-0 / right-0` will be right at the edge of the section padding (16px from viewport edge), making the left arrow partially clip under the section's `px-4` padding.

Also `w-10 h-10` = 40px — below 44px minimum.

**FIX:**
```tsx
// Move arrows outside the overflow container and into the parent relative container:
<div className="relative max-w-2xl mx-auto px-10">  {/* Add horizontal padding for arrows */}
  <div className="overflow-hidden rounded-card">
    ...
  </div>
  <button
    onClick={prev}
    className="absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-white rounded-full shadow flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
    aria-label="Testimoni sebelumnya"
  >
    <ChevronLeft className="w-5 h-5" />
  </button>
  <button
    onClick={next}
    className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-white rounded-full shadow flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
    aria-label="Testimoni berikutnya"
  >
    <ChevronRight className="w-5 h-5" />
  </button>
</div>
```

---

## BUG 11 — Checkout: Mobile Sticky Total Bar Appears ABOVE the Sticky Stepper Header

**WHERE:** `app/(store)/checkout/page.tsx:462-466`
**ACTUAL:**
```tsx
{/* FIX 11: Mobile sticky total bar */}
<div className="lg:hidden sticky top-[76px] z-10 ...">
  <span className="text-text-secondary">{items...} item</span>
  <span className="font-bold text-brand-red">{formatIDR(totalAmount)}</span>
</div>

{/* Header with stepper */}
<div className="bg-white border-b sticky top-0 z-10">
  <div className="container mx-auto px-4 py-4">
    <h1>Checkout</h1>
    <CheckoutStepper ... />
  </div>
</div>
```
The order matters. The sticky total bar comes FIRST in the DOM before the stepper header. With both using `sticky top-0/top-76px z-10`:
- On initial load: stepper header sticks at top-0, total bar at top-76px
- When stepper header scrolls: total bar moves to fill top-0... but both are `z-10` so overlap is unpredictable
- The total bar's `top-[76px]` assumes the header is exactly 76px tall, which is **wrong** (header = py-4 (32px) + h1 text (28px) + mt-4 (16px) + stepper (44px) + labels (~16px) = ~136px on mobile)

**FIX — Remove the mobile total bar entirely (information is redundant):**
```tsx
// Delete lines 462-465:
// The cart summary sidebar already shows the total.
// On mobile, the payment button ALSO shows the total: "Bayar Sekarang — Rp XXX"
// Three places showing the same number is not helpful.
```

If keeping the total bar, fix it:
```tsx
// Move it INSIDE the checkout container, NOT as a separate sticky, but as a fixed position bar:
// Position it just above the mobile bottom nav using 'fixed' not 'sticky':
<div className="lg:hidden fixed bottom-20 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-brand-cream-dark px-4 py-2 flex justify-between items-center">
  <span className="text-text-secondary text-xs">{items.reduce((a, i) => a + i.quantity, 0)} item</span>
  <span className="font-bold text-brand-red">{formatIDR(totalAmount)}</span>
</div>
```
This places the summary BAR just above the BottomNav (which is fixed bottom-0 h-20 = 80px). The checkout step "Bayar Sekarang" button is inside the main content and scrollable — this persistent total is the only fixed reference.

---

## BUG 12 — PromoBanner: Coupon Code Not Copyable

**WHERE:** `components/store/home/PromoBanner.tsx:30-32`
**SPEC:** DESIGN_SYSTEM.md §11.1 PromoBanner — "Coupon code displayed in pill badge". Common UX: coupon codes should be tap-to-copy.
**ACTUAL:**
```tsx
<span className="inline-block px-6 py-2 bg-white text-brand-red font-mono font-bold rounded-lg text-lg md:text-xl mb-6">
  {promoCode}
</span>
```
Plain display span, not interactive. Users on mobile must manually select the text (hard) and copy it.

**FIX — Make it tap-to-copy:**
```tsx
'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// In PromoBanner:
const [copied, setCopied] = useState(false);

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback: select the text
  }
};

// Replace the span:
<button
  onClick={handleCopy}
  className="inline-flex items-center gap-2 px-6 py-2 bg-white text-brand-red font-mono font-bold rounded-lg text-lg md:text-xl mb-6 hover:bg-brand-cream transition-colors active:scale-95"
  aria-label={`Salin kode kupon ${promoCode}`}
>
  {promoCode}
  {copied ? (
    <Check className="w-5 h-5 text-success" />
  ) : (
    <Copy className="w-4 h-4 opacity-60" />
  )}
</button>
```

---

## SUMMARY TABLE

| # | Component | Issue | Severity | File |
|---|-----------|-------|----------|------|
| 01 | Mobile navbar | No close-on-outside-click, no animation on hamburger menu | High | Navbar.tsx:114 |
| 02 | Desktop navbar | No active state on nav links | Medium | Navbar.tsx:37 |
| 03 | CategoryChips | `activeSlug` prop not passed from homepage | Medium | page.tsx:249 |
| 04 | Add-to-Cart | No visual feedback — no button animation, no cart bounce | High | ProductCard.tsx:57-64 |
| 05 | HeroCarousel | No swipe gesture support | High | HeroCarousel.tsx |
| 06 | HeroCarousel | Navigation dots are white (active should be brand-red per spec) | Low | HeroCarousel.tsx:137 |
| 07 | ProductDetail | Sticky bottom bar always visible (should show after scrolling past btn) | Medium | ProductDetailClient.tsx:304 |
| 08 | Cart | `window.confirm()` used for delete — native, off-brand, blocks UI | High | cart/page.tsx:90 |
| 09 | Checkout | Back link 20px tall — far below 44px touch target | Medium | checkout/page.tsx:782 |
| 10 | Testimonials | Nav arrows w-10 (40px), can clip at screen edge on mobile | Medium | Testimonials.tsx:92 |
| 11 | Checkout | Mobile sticky total bar z-index and offset conflict with stepper | High | checkout/page.tsx:462 |
| 12 | PromoBanner | Coupon code not tap-to-copy | Medium | PromoBanner.tsx:30 |
