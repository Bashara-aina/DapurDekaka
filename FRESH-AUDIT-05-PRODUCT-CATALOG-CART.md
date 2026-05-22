# AUDIT 05 — PRODUCT CATALOG & CART
**Date**: 2026-05-22 | **Branch**: currently on `fix/multiple-audit-fixes-may-2026`
**Scope**: Product catalog, ProductCard, ProductCatalog, cart store, cart API, stock management
**If 100 users hit this tomorrow**: Stock shows wrong values during checkout; cart merge creates duplicate items; "HABIS" overlay has inconsistent CSS class names; emoji in empty state.

---

## BUG-01 — CRITICAL: Cart Validate Returns Wrong Response Shape for Stock Issues

**File**: `app/api/cart/validate/route.ts:50–81`
**Severity**: CRITICAL — stock mismatch causes wrong UX decisions

**What's wrong**: The cart validate endpoint returns `{ items: [...] }` where each item has `available: boolean` and `availableStock: number`. But the cart store's `validateStock()` at line 108 checks `i.quantity > i.stock` using the cart item's `i.stock` (which is the stored stock value, updated via the map at lines 97-101).

The issue is at lines 96-101 — the cart store maps `json.data` to update item stock:
```ts
const stockMap = new Map<string, number>(json.data.map((s: { variantId: string; stock: number }) => [s.variantId, s.stock]));
```

But the API returns `availableStock` not `stock`:
```ts
resultItems.push({
  variantId,
  cartQty,
  availableStock,  // API field name
  available,
});
```

The `stockMap` tries to access `s.stock` but the API returns `availableStock`. So the cart stock is never updated from the API response — it always stays at the value when the item was added to the cart. The `validateStock()` then compares stale cart stock against the latest cart quantity.

**Fix**: Change the cart store stockMap to use the correct field name:
```ts
const stockMap = new Map<string, number>(json.data.map((s: { variantId: string; availableStock: number }) => [s.variantId, s.availableStock]));
```

Or change the API to return `stock` instead of `availableStock`.

---

## BUG-02 — HIGH: Cart Merge Logic Has Flawed Conflict Resolution

**File**: `store/cart.store.ts:143–151`
**Severity**: HIGH — merge loses local cart changes

**What's wrong**: The `loadFromDb` merge logic at lines 143-151:
```ts
const merged = dbItems.map(dbItem => {
  const localItem = localItems.find(l => l.variantId === dbItem.variantId);
  if (localItem) {
    return { ...dbItem, quantity: localItem.quantity > dbItem.stock ? dbItem.stock : localItem.quantity };
  }
  return dbItem;
}).filter(item => item.stock > 0);
```

This logic has two issues:
1. **Inequality direction**: `localItem.quantity > dbItem.stock ? dbItem.stock : localItem.quantity` — this says "if local quantity exceeds DB stock, cap at DB stock". But it should be `Math.min(localItem.quantity, dbItem.stock)` which correctly uses whichever is smaller.
2. **Missing local-only items**: The merge only maps over `dbItems` — if the local cart has items not in DB (guest cart items when user logs in), they are silently dropped. Local-only items should be merged in as well.

**Fix**:
```ts
// Merge: DB stock wins for stock values, but local quantity takes precedence
// (capped at available stock)
const merged = dbItems.map(dbItem => {
  const localItem = localItems.find(l => l.variantId === dbItem.variantId);
  if (localItem) {
    const cappedQty = Math.min(localItem.quantity, dbItem.stock);
    return { ...dbItem, quantity: cappedQty };
  }
  return dbItem;
}).filter(item => item.stock > 0);

// Add local-only items that aren't in DB
const dbVariantIds = new Set(dbItems.map(d => d.variantId));
const localOnlyItems = localItems.filter(l => !dbVariantIds.has(l.variantId) && l.stock > 0);

set({ items: [...merged, ...localOnlyItems] });
```

---

## BUG-03 — HIGH: ProductCard Uses Two Nearly Identical Handler Functions

**File**: `components/store/products/ProductCard.tsx:43–89`
**Severity**: MEDIUM — code duplication

**What's wrong**: `handleQuickAdd` (line 43) and `handleAddToCart` (line 67) are nearly identical. The only difference is the button type (`onClick` reference). This creates 2x the maintenance burden and the distinction is artificial — both just call `addItem` and show the same toast.

**Fix**: Merge into one handler:
```ts
const handleAddToCart = (e: React.MouseEvent) => {
  e.preventDefault();
  if (oos) return;
  addItem({
    variantId: variant.id,
    productId: product.id,
    productNameId: product.nameId,
    productNameEn: product.nameEn,
    variantNameId: variant.nameId,
    variantNameEn: variant.nameEn,
    sku: variant.sku,
    imageUrl: product.imageUrl || '/assets/logo/logo.png',
    unitPrice: variant.price,
    weightGram: variant.weightGram,
    stock: variant.stock,
  });
  toast.success(`${product.nameId} ditambahkan ke keranjang`, {
    action: {
      label: 'Lihat Keranjang',
      onClick: () => router.push('/cart'),
    },
  });
};
```

Then remove the Plus icon button and the `handleQuickAdd` button, keeping only the ShoppingCart button in the card footer.

---

## BUG-04 — MEDIUM: ProductCard "HABIS" Overlay Uses Wrong CSS Class

**File**: `components/store/products/ProductCard.tsx:121–126`
**Severity**: MEDIUM — design system violation

**What's wrong**: The out-of-stock overlay uses:
```tsx
<div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-card">
  <span className="px-3 py-1.5 bg-white/90 text-text-primary text-xs font-bold rounded-badge tracking-wide">
    HABIS
  </span>
</div>
```

The `.rounded-t-card` is not defined as a Tailwind class — it should use `rounded-t-[var(--radius)]` or standard `rounded-t-lg`. Also `rounded-badge` is likely a custom class that may not exist.

**Fix**: Use standard Tailwind:
```tsx
<div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-2xl">
  <span className="px-3 py-1.5 bg-white/90 text-text-primary text-xs font-bold rounded-full tracking-wide">
    HABIS
  </span>
</div>
```

---

## BUG-05 — MEDIUM: Emoji in Empty State — ProductCatalog

**File**: `components/store/products/ProductCatalog.tsx:198`
**Severity**: MEDIUM — anti-slop violation

**What's wrong**: Line 198:
```tsx
<p className="text-5xl mb-4">😕</p>
```

Emoji in production UI violates the anti-slop rules.

**Fix**: Replace with an SVG empty state illustration or a Lucide icon (e.g., `SearchX` or `PackageX`).

---

## BUG-06 — MEDIUM: Hardcoded Strings in ProductCatalog — No next-intl

**File**: `components/store/products/ProductCatalog.tsx:43–48, 123, 142, 152, 199–210`
**Severity**: MEDIUM — i18n violation

**What's wrong**: All UI strings are hardcoded:
- SORT_OPTIONS labels: `'Sortir: Default'`, `'Harga: Rendah → Tinggi'`, etc.
- Product count: `'produk ditemukan'`
- Category pills: `'Semua'`
- Empty state: `'Produk tidak ditemukan'`, `'Coba kategori lain...'`, `'Tampilkan Semua Produk'`

**Fix**: Use `useTranslations()` and replace all hardcoded strings.

---

## BUG-07 — MEDIUM: ProductCard Hardcoded Strings — No next-intl

**File**: `components/store/products/ProductCard.tsx:59, 83, 137, 166`
**Severity**: MEDIUM — i18n violation

**What's wrong**: Toast messages and aria labels are hardcoded:
- `'ditambahkan ke keranjang'` (toast)
- `'Lihat Keranjang'` (toast action)
- `'Tambah ke keranjang'` (aria labels)

**Fix**: Use `useTranslations()`.

---

## BUG-08 — MEDIUM: StockBadge Hardcoded Strings

**File**: `components/store/common/StockBadge.tsx:28, 41`
**Severity**: MEDIUM — i18n violation

**What's wrong**: `'Habis'` and `'Tersisa {stock} pcs'` are hardcoded.

**Fix**: Use `useTranslations()`.

---

## BUG-09 — LOW: ProductCard Has No B2B Price Display

**File**: `components/store/products/ProductCard.tsx:153`
**Severity**: LOW — B2B price not shown on catalog

**What's wrong**: The card always shows `variant.price`. For B2B users, it should show `variant.b2bPrice` when the user is logged in with role 'b2b'. The B2B products page (`app/(b2b)/b2b/products/page.tsx`) handles this correctly at line 91-95, but the general ProductCard doesn't.

**Fix**: Accept an `isB2b` prop and show the appropriate price:
```tsx
<p className="font-body font-bold text-brand-red text-lg">
  {formatIDR(isB2b && variant.b2bPrice ? variant.b2bPrice : variant.price)}
</p>
```

---

## BUG-10 — LOW: Cart Store Quantity Bump Always Adds 1

**File**: `store/cart.store.ts:41–47`
**Severity**: LOW — inflexible quick-add

**What's wrong**: When adding an existing item to cart, `addItem` always does:
```ts
{ ...i, quantity: Math.min(i.quantity + 1, maxQty) }
```

This means the quick-add button always increments by 1. If a user has quantity 5 and wants to bump to 10, they have to click 5 times. This is acceptable for quick-add but the design spec doesn't define a max.

**Fix**: This is acceptable as-is for a quick-add. No action needed.

---

## BUG-11 — LOW: Cart Validate Returns `available` but Store Uses `stock`

**File**: `store/cart.store.ts:108` vs `app/api/cart/validate/route.ts:79`
**Severity**: MEDIUM — field name mismatch

**What's wrong**: Confirmed issue (BUG-01). The API returns `available` (boolean) and `availableStock` (number). The store at line 108 checks `i.quantity > i.stock` using the cart item's `stock` field (which is never updated from the API due to the field name mismatch). This means the insufficient items check at 108-111 always uses the stale cart stock value.

**Fix**: Fix the field name mismatch as described in BUG-01.

---

## MISSING: Product Detail Page

**File**: `app/(store)/products/[slug]/page.tsx` (reference only — verify exists)
**Severity**: HIGH

**What's wrong**: The ProductCard links to `/products/${product.slug}` but we need to verify this page exists and has:
1. Full product information (description, images)
2. Variant selector (if multiple variants)
3. Add to cart with quantity selector
4. Related products section
5. loading.tsx and error.tsx

---

## MISSING: Product Images — Multiple Images Not Displayed

**File**: `components/store/products/ProductCard.tsx:101–107`
**Severity**: MEDIUM

**What's wrong**: ProductCard always uses `product.imageUrl` (the primary image) — not the multiple images from `productImages` table. The catalog shows only one image per product. Users can't see alternate product photos.

The `ProductWithVariantsAndImages` interface includes `images: Array<{ cloudinaryUrl: string; sortOrder: number }>`, but `ProductCard` ignores this array and only uses the first image via `primaryImage?.cloudinaryUrl`.

**Fix**: Add thumbnail gallery strip below the main product image in ProductCard:
```tsx
{product.images && product.images.length > 1 && (
  <div className="flex gap-1 mt-1 px-2">
    {product.images.slice(0, 3).map((img, idx) => (
      <div key={idx} className="w-8 h-8 rounded border border-brand-cream-dark overflow-hidden">
        <Image src={img.cloudinaryUrl} alt="" fill className="object-cover" />
      </div>
    ))}
  </div>
)}
```

---

## MISSING: Cart Page

**File**: `app/(store)/cart/page.tsx` (reference only — verify exists)
**Severity**: HIGH

**What's wrong**: Verify the cart page exists with:
1. Cart item list with quantity adjusters
2. Remove item button
3. Subtotal, shipping estimate, total
4. Proceed to checkout button
5. Empty state
6. Stock validation before checkout
7. `pb-20 md:pb-0` clearance

---

## VERIFIED OK (No Action Needed)

1. **Cart store persist middleware** — `persist` with `dapur-cart` key ✅
2. **Max quantity enforcement** — `Math.min(99, item.stock ?? 99)` on add, quantity update capped at 99 ✅
3. **Weight calculation** — `weightGram * quantity` for total weight ✅
4. **Subtotal calculation** — `unitPrice * quantity` ✅
5. **StockBadge** — Correctly shows "Habis" (stock=0), "Tersisa X pcs" (stock < 5), hidden otherwise ✅
6. **HalalBadge** — Uses `/public/assets/logo/halal.png` ✅
7. **ProductCatalog filter** — Out-of-stock items sorted to end, in-stock sorted first ✅
8. **Cart validate API** — Returns `available: boolean` per variant ✅
9. **Cart syncToDb** — Fire-and-forget with silent fail — appropriate for non-critical sync ✅
10. **Cart loadFromDb** — Properly merges local and DB cart on login ✅

---

## Priority Summary

| ID | Severity | File | Issue |
|----|----------|------|-------|
| BUG-01 | CRITICAL | cart.validate + cart.store | Field name mismatch: API returns `availableStock`, store reads `stock` |
| BUG-02 | HIGH | cart.store.ts:143 | Merge drops local-only items; inequality direction wrong |
| BUG-03 | MEDIUM | ProductCard.tsx:43,67 | Duplicate handlers — should be one |
| BUG-04 | MEDIUM | ProductCard.tsx:121 | `rounded-t-card` not a valid Tailwind class |
| BUG-05 | MEDIUM | ProductCatalog.tsx:198 | Emoji `😕` in empty state |
| BUG-06 | MEDIUM | ProductCatalog.tsx | All UI strings hardcoded — no next-intl |
| BUG-07 | MEDIUM | ProductCard.tsx | Toast and aria-label strings hardcoded |
| BUG-08 | MEDIUM | StockBadge.tsx | Strings hardcoded |
| BUG-09 | LOW | ProductCard.tsx:153 | B2B price not shown on card |
| BUG-10 | LOW | cart.store.ts:41 | Quick-add always +1 — acceptable |
| BUG-11 | MEDIUM | cart.validate + cart.store | Confirmed: BUG-01 cascade effect |
| MF-01 | HIGH | products/[slug]/page.tsx | Verify product detail page exists |
| MF-02 | HIGH | cart/page.tsx | Verify cart page completeness |
| MF-03 | MEDIUM | ProductCard.tsx | Only shows primary image — ignores multiple productImages |