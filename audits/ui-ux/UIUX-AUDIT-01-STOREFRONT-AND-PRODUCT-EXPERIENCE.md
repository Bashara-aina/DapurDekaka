# UI/UX AUDIT 01 — Storefront & Product Discovery Experience

**Scope:** Homepage, Product Listing, Product Detail Page, Cart  
**Priority:** Critical = 🔴 | High = 🟠 | Medium = 🟡 | Polish = 🟢

---

## SUMMARY OF ISSUES

| # | Issue | Priority | File |
|---|-------|----------|------|
| 01 | Product detail has no quantity sync when variant changes | 🔴 | ProductDetailClient.tsx |
| 02 | Add-to-Cart gives zero feedback — no animation, no count update on mobile | 🔴 | ProductDetailClient.tsx |
| 03 | Sticky bottom bar overlaps BottomNav on mobile by 80px, partially hidden | 🔴 | ProductDetailClient.tsx |
| 04 | Cart "Hapus Semua" has no confirmation dialog — instant destructive action | 🔴 | cart/page.tsx |
| 05 | Category chips on homepage are not scrollable on mobile — overflow hidden | 🟠 | CategoryChips.tsx |
| 06 | Product listing: no empty state when filters return zero results | 🟠 | ProductCatalog.tsx |
| 07 | Product card has no Add-to-Cart shortcut — must open detail first | 🟠 | ProductCard.tsx |
| 08 | Product detail: back button uses `router.back()` — breaks if navigated directly | 🟠 | ProductDetailClient.tsx |
| 09 | Out-of-stock variants are disabled but still visually selected if user lands there | 🟠 | ProductDetailClient.tsx |
| 10 | Cart page login banner is present but checkout redirect is missing callbackUrl | 🟠 | cart/page.tsx |
| 11 | Product image gallery: main image has no zoom or lightbox on tap | 🟡 | ProductDetailClient.tsx |
| 12 | Product description uses raw text (no markdown/HTML rendering) | 🟡 | ProductDetailClient.tsx |
| 13 | Related products are capped at 4 with no "Lihat Semua" link to category | 🟡 | ProductDetailClient.tsx |
| 14 | Homepage hero CTA "Jelajahi Produk" duplicates the nav — not personalized | 🟡 | page.tsx |
| 15 | Loading skeletons on products/page.tsx don't match actual card dimensions | 🟢 | ProductCardSkeleton.tsx |
| 16 | Cart empty state has no product suggestion — dead end | 🟢 | EmptyCart.tsx |

---

## DETAILED FINDINGS

---

### 🔴 01 — Quantity Not Reset When Variant Changes
**File:** `components/store/products/ProductDetailClient.tsx:72`

**Problem:** `quantity` state is initialized to `1` and never resets when `selectedVariantIndex` changes. If a user selects a variant with only 2 units, sets qty to 2, then switches to a variant with 1 unit, the stepper still shows 2 — a technically invalid state. The `handleAddToCart` doesn't cap it either.

**Fix:**
```tsx
// After: setSelectedVariantIndex(i)
// Add:
setQuantity(1);
```
Also cap quantity in the stepper at `selectedVariant.stock`.

---

### 🔴 02 — Zero Feedback After Add-to-Cart
**File:** `components/store/products/ProductDetailClient.tsx:81-97`

**Problem:** `handleAddToCart` calls `addItem()` and silently returns. There is no:
- Toast notification ("Ditambahkan ke keranjang!")
- Cart count badge animation
- Button state change (brief "Ditambahkan ✓")

On mobile this means users repeatedly tap thinking nothing happened, causing cart duplicates.

**Fix:**
```tsx
const handleAddToCart = () => {
  if (isOutOfStock || !selectedVariant) return;
  addItem({ ... }, quantity); // Pass quantity
  toast.success(`${product.nameId} ditambahkan ke keranjang`, {
    action: { label: 'Lihat Keranjang', onClick: () => router.push('/cart') }
  });
};
```

---

### 🔴 03 — Sticky Bottom Bar Hidden by BottomNav on Mobile
**File:** `components/store/products/ProductDetailClient.tsx:271`

**Problem:** The sticky bottom bar is positioned `bottom-20 md:bottom-0`. The BottomNav component is `h-16` (64px) + safe area. `bottom-20` = 80px which should clear it, BUT the product page also has `pb-24` on the scroll container. This creates a gap on some devices and on iOS with home indicator the BottomNav is taller (safe-area-inset). On some phones the Add-to-Cart button is half-hidden.

**Fix:** Use dynamic safe-area spacing:
```tsx
// Change class:
"fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0"
```
Also add `pb-[calc(6rem+env(safe-area-inset-bottom))]` to the page container for iOS.

---

### 🔴 04 — Cart "Hapus Semua" Has No Confirmation
**File:** `app/(store)/cart/page.tsx:87-97`

**Problem:** The "Hapus Semua" button directly calls `clearCart()` with no confirmation. Accidental taps are permanent (Zustand + localStorage). This is especially bad on mobile where mis-taps happen frequently.

**Fix:** Add a confirmation dialog before clearing:
```tsx
const handleClearCart = () => {
  if (!confirm('Hapus semua item dari keranjang?')) return;
  clearCart();
};
```
Or better — use a Sheet/Dialog component for a mobile-friendly confirmation.

---

### 🟠 05 — Category Chips Not Scrollable on Mobile
**File:** `components/store/home/CategoryChips.tsx`

**Problem:** The category chips section has no horizontal scroll on mobile. If there are more than 4-5 categories, they wrap to multiple rows, taking excessive vertical space and looking broken. Standard UX for this pattern is a horizontally scrollable row with `overflow-x-auto`.

**Fix:**
```tsx
<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-4 -mx-4">
  {/* chips */}
</div>
```
Add `scrollbar-hide` utility or `[&::-webkit-scrollbar]:hidden`.

---

### 🟠 06 — Product Listing: No Empty State for Zero Results
**File:** `components/store/products/ProductCatalog.tsx` (or equivalent)

**Problem:** When a user filters by category and no products match, the grid simply renders empty — no message, no illustration, no suggestion to clear filters. This is a dead end.

**Fix:** After the products map, add:
```tsx
{products.length === 0 && (
  <div className="col-span-full py-16 text-center">
    <p className="text-4xl mb-4">😕</p>
    <h3 className="font-display text-lg font-semibold mb-2">Produk tidak ditemukan</h3>
    <p className="text-text-secondary text-sm mb-4">Coba kategori lain atau hapus filter</p>
    <button onClick={clearFilters} className="...">Tampilkan Semua Produk</button>
  </div>
)}
```

---

### 🟠 07 — Product Card: No Quick Add-to-Cart
**File:** `components/store/products/ProductCard.tsx`

**Problem:** Every product requires a full page navigation to add to cart. For products with a single variant, this is unnecessary friction. Shopee/Tokopedia shows a `+` button overlay on the card that adds immediately.

**Fix:** Add a floating `+` button on the product card that adds the first active variant with qty=1 directly. Show a toast. Only show if the product has exactly 1 active variant with stock > 0.

```tsx
{hasSingleVariant && (
  <button
    onClick={(e) => { e.preventDefault(); addToCart(); }}
    className="absolute bottom-2 right-2 w-8 h-8 bg-brand-red rounded-full flex items-center justify-center text-white shadow-lg"
    aria-label="Tambah ke keranjang"
  >
    <Plus className="w-4 h-4" />
  </button>
)}
```

---

### 🟠 08 — Back Button Uses `router.back()` — Breaks on Direct URL
**File:** `components/store/products/ProductDetailClient.tsx:119-124`

**Problem:** The back button calls `router.back()`. If a user navigates directly to a product URL (via a shared link, SEO, WhatsApp), `router.back()` has no history and does nothing (or navigates to a blank page on some browsers).

**Fix:** 
```tsx
const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/products');
  }
};
```
Also consider replacing the custom button with a `<Link href="/products">` for better SEO and right-click support.

---

### 🟠 09 — Out-of-Stock Variant Remains "Selected" Without Warning
**File:** `components/store/products/ProductDetailClient.tsx:71-77`

**Problem:** `selectedVariantIndex` defaults to `0`. If the first variant is out of stock, the UI shows it as selected (highlighted in red button border) but disabled. There's no auto-skip to the first available variant. The user sees an out-of-stock product with no guidance.

**Fix:** Initialize `selectedVariantIndex` to the index of the first in-stock variant:
```tsx
const defaultVariantIndex = product.variants.findIndex(v => v.stock > 0 && v.isActive);
const [selectedVariantIndex, setSelectedVariantIndex] = useState(Math.max(0, defaultVariantIndex));
```
Also show "Varian ini habis, pilih varian lain" message below the variant selector if the selected one is OOS.

---

### 🟠 10 — Cart Login Banner: Checkout Link Missing callbackUrl
**File:** `app/(store)/cart/page.tsx:115-116`

**Problem:** The login link in the cart banner points to `/login` without a `callbackUrl` parameter. After login, the user lands at `/account` instead of back at `/cart`, losing their cart session context (though the cart persists in localStorage, the UX is jarring).

**Fix:**
```tsx
<Link href="/login?callbackUrl=/cart">Masuk</Link>
<Link href="/register?callbackUrl=/cart">Daftar</Link>
```

---

### 🟡 11 — No Image Zoom / Lightbox on Product Detail
**File:** `components/store/products/ProductDetailClient.tsx:102-115`

**Problem:** Tapping the product image does nothing. For food products, customers want to zoom in to see texture/packaging details. This is a standard e-commerce feature that builds purchase confidence.

**Fix:** On image tap, open a full-screen lightbox. Can use a simple CSS transform or a lightweight library. Minimum: clicking the main image should open it in a `<dialog>` with close button, or scale with CSS `transform: scale()` transition.

---

### 🟡 12 — Product Description: Plain Text, No Rich Formatting
**File:** `components/store/products/ProductDetailClient.tsx:201-208`

**Problem:** `descriptionId` is rendered with `whitespace-pre-line` but no HTML/markdown support. Admin may write descriptions with bullet points, bold text, etc. in Tiptap (the blog editor) but the product description field doesn't support it. The result is a wall of plain text.

**Fix:** If product descriptions are plain text, format them more intelligently. At minimum, detect newlines and convert to `<br>`. Better: add a simple markdown renderer (`react-markdown`) for product descriptions, or allow rich text in the ProductForm admin editor.

---

### 🟡 13 — Related Products: No "Lihat Semua" Category Link
**File:** `components/store/products/ProductDetailClient.tsx:213-268`

**Problem:** Related products show only 4 items with no link to view all products in the same category. This misses upsell opportunities and leaves mobile users with no path forward after viewing related items.

**Fix:** Add a link to the category below the related products grid:
```tsx
{product.category && (
  <Link href={`/products?category=${product.category.slug}`} className="...">
    Lihat semua {product.category.nameId} →
  </Link>
)}
```

---

### 🟡 14 — Homepage CTA Is Generic, Not Personalized
**File:** `app/(store)/page.tsx:182-197`

**Problem:** The bottom CTA section ("Siap Mencicipi Kelezatan Dapur Dekaka?") always shows regardless of user state. For logged-in users who have already purchased, a better CTA would be "Pesan Lagi" or "Lihat Pesanan Terbaru". For logged-out users, it could show a points-earning teaser.

**Fix:** Make the CTA a client component that reads session state and renders differently:
- Logged out: current content
- Logged in, no orders: "Mulai Belanja, Kumpulkan Poin"  
- Logged in, has orders: "Pesan Lagi — Poin kamu: X"

---

### 🟢 15 — Skeleton Cards Don't Match Actual Card Dimensions
**File:** `components/store/products/ProductCardSkeleton.tsx`

**Problem:** The loading skeleton has a fixed aspect ratio that doesn't match the actual ProductCard layout. This causes a visible "pop" / layout shift (CLS) when real cards load, especially on slow connections.

**Fix:** Measure actual card dimensions (aspect-square image + ~80px text area) and mirror exactly in skeleton. Add `aspect-square` to the skeleton image placeholder.

---

### 🟢 16 — Empty Cart: Dead End with No Product Suggestions
**File:** `components/store/cart/EmptyCart.tsx`

**Problem:** The empty cart state shows an icon and a "Mulai Belanja" button but offers no product suggestions. Users who accidentally cleared the cart have no idea what to add back.

**Fix:** Add a "Produk Populer" section with 4 featured products below the empty state button. These can be statically imported as a Server Component alongside the cart page, or fetched client-side after the empty state renders.

---

## IMPLEMENTATION PRIORITY ORDER

1. **🔴 03** — Fix mobile bottom bar hiding (CSS, 5 min)
2. **🔴 04** — Add cart clear confirmation (UI, 10 min)
3. **🔴 02** — Add cart feedback toast (10 min)
4. **🔴 01** — Reset quantity on variant change (5 min)
5. **🟠 08** — Fix back button (5 min)
6. **🟠 09** — Auto-select first in-stock variant (10 min)
7. **🟠 10** — Fix cart login links (2 min)
8. **🟠 05** — Fix category chip scroll (10 min)
9. **🟠 06** — Add empty state for zero products (15 min)
10. **🟠 07** — Add quick add-to-cart on card (20 min)
