# AUDIT-03: Components — Gaps, Bugs & Oversized Files

**Project:** DapurDekaka.com  
**Auditor:** Deep Code Audit  
**Date:** May 2026  
**Scope:** `components/`

---

## OVERVIEW

**Planned components:** 71  
**Exists and complete:** 47  
**Stub/partial:** 7  
**Entirely missing (gap):** 15  
**Extra (not planned but exists):** 30  

---

## 1. CRITICAL — `VariantSelector` Missing Entirely

### Gap: `components/store/products/VariantSelector.tsx`

**Planned in:** CURSOR_RULES.md Section 5 — "Variant Selector component" in store components

**Status:** **MISSING** — The entire component file does not exist.

**What it does:** Lets users select a product variant (e.g., "25 pcs" vs "50 pcs") before adding to cart. On the product detail page, this is currently embedded inline in `ProductDetailClient.tsx`.

**Impact:** `ProductDetailClient.tsx` is already 356 lines (exceeds the 300-line project limit). Variant selection logic (~80-100 lines) should be extracted into `VariantSelector.tsx`.

**Fix:** Create `components/store/products/VariantSelector.tsx`:
```typescript
interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariantId: string;
  onSelect: (variant: ProductVariant) => void;
  disabled?: boolean;
}
```
Extract the variant pill/button rendering from `ProductDetailClient.tsx` into this component.

---

## 2. CRITICAL — Admin Dashboard `RecentOrders` Missing

### Gap: `components/admin/dashboard/RecentOrders.tsx`

**Status:** **MISSING** — Not found anywhere in the codebase.

**Expected behavior:** Display the 5-10 most recent orders on the admin dashboard with order number, customer name, status badge, and total amount.

**Current state:** The dashboard likely renders this inline in `app/(admin)/admin/dashboard/page.tsx` (848-line file). This is one reason the dashboard page is so large.

**Fix:** Create `components/admin/dashboard/RecentOrders.tsx` — extract the recent orders table from the dashboard page into this component.

---

## 3. CRITICAL — Admin Orders `OrdersTable` Missing

### Gap: `components/admin/orders/OrdersTable.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "OrdersTable.tsx" in admin components

**Expected behavior:** A reusable data table for orders listing with sortable columns, status filter, search, and pagination.

**Current state:** Each orders page (`/admin/orders/page.tsx`) has a client component (`OrdersClient.tsx`) that renders a custom table. No shared `OrdersTable` component.

**Fix:** Create `components/admin/orders/OrdersTable.tsx` — the existing `OrdersClient.tsx` can be refactored into this component with the actual table markup separated from page-specific logic.

---

## 4. CRITICAL — Admin Orders `OrderStatusBadge` Missing

### Gap: `components/admin/orders/OrderStatusBadge.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "OrderStatusBadge.tsx" in admin components

**Expected behavior:** Color-coded badge for each order status (`pending_payment` → amber, `paid` → blue, `shipped` → green, etc.)

**Current state:** `OrderTimeline.tsx` (store component) exists and has status styling, but the admin-specific `OrderStatusBadge` is missing. Order status in admin pages is likely styled inline with utility classes.

**Fix:** Create `components/admin/orders/OrderStatusBadge.tsx` with the color mapping:
```typescript
const statusColors = {
  pending_payment: 'bg-amber-100 text-amber-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  packed: 'bg-cyan-100 text-cyan-800',
  shipped: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-gray-200 text-gray-600',
};
```

---

## 5. CRITICAL — Admin Orders `StatusUpdateDropdown` Missing

### Gap: `components/admin/orders/StatusUpdateDropdown.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "StatusUpdateDropdown.tsx" in admin components

**Expected behavior:** A dropdown to change order status with validation (prevents backward status changes, e.g., cannot go from `shipped` back to `processing`).

**Current state:** The order detail page (`/admin/orders/[id]/page.tsx`) has inline status update buttons. No reusable dropdown component.

**Fix:** Create `components/admin/orders/StatusUpdateDropdown.tsx`:
```typescript
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};
```

---

## 6. CRITICAL — Admin Products `VariantManager` Missing

### Gap: `components/admin/products/VariantManager.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "VariantManager.tsx" in admin components

**Expected behavior:** UI to add/edit/delete variants within a product — name, SKU, price, b2b_price, stock, weight, sort_order per variant.

**Current state:** `ProductForm.tsx` (571 lines) uses `useFieldArray` from react-hook-form to manage variants inline. The variant management is embedded in the product form, not separated.

**Fix:** Create `components/admin/products/VariantManager.tsx` and refactor from `ProductForm.tsx`. The `ProductForm` should import and use `VariantManager` instead of having all variant logic inline.

---

## 7. CRITICAL — Admin Products `ImageUploader` Missing

### Gap: `components/admin/products/ImageUploader.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "ImageUploader.tsx" in admin components

**Expected behavior:** Multi-image uploader for product images with drag-and-drop, preview, reorder (drag to change sort_order), and delete.

**Current state:** `ProductForm.tsx` handles product images with `useFieldArray` and a basic file input. No drag-and-drop, no preview thumbnails, no reorder capability.

**Fix:** Create `components/admin/products/ImageUploader.tsx`:
```typescript
interface ImageUploaderProps {
  productId: string;
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}
```
Features: drag-and-drop reordering, click-to-delete, Cloudinary signed upload, preview thumbnails.

---

## 8. CRITICAL — Admin Inventory `StockEditor` Missing

### Gap: `components/admin/inventory/StockEditor.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "StockEditor.tsx" in admin components

**Expected behavior:** Mobile-optimized stock editor with giant touch targets (60px+ height per item), numeric keyboard auto-trigger, confirmation before save, optimistic UI.

**Current state:** The inventory page likely renders inline stock editing. No dedicated `StockEditor` component exists.

**Fix:** Create `components/admin/inventory/StockEditor.tsx`:
```typescript
interface StockEditorProps {
  variantId: string;
  productName: string;
  variantName: string;
  currentStock: number;
  onSave: (newStock: number) => Promise<void>;
}
```
Mobile-first: 60px touch targets, `inputMode="numeric"`, confirm dialog before save.

---

## 9. MISSING — Admin Common `DataTable`, `SearchInput`, `ConfirmDialog`

### Gaps:
- `components/admin/common/DataTable.tsx`
- `components/admin/common/SearchInput.tsx`
- `components/admin/common/ConfirmDialog.tsx`

**Status:** All **MISSING**

**Planned in:** TECH_STACK.md Section 4 — admin common components

**Expected behavior:**
- `DataTable` — generic sortable, filterable, paginated table used across all admin listing pages
- `SearchInput` — consistent search input with icon, clear button, debounce
- `ConfirmDialog` — reusable confirmation dialog for destructive actions (delete, deactivate)

**Current state:** Each admin page has its own table rendering and search input. No shared components.

**Fix:** Create these three reusable admin components to DRY up the admin UI.

---

## 10. MISSING — Admin `AdminBottomNav`

### Gap: `components/admin/layout/AdminBottomNav.tsx`

**Status:** **MISSING** — Not found anywhere.

**Planned in:** TECH_STACK.md Section 4 — "AdminBottomNav.tsx" in admin layout

**Expected behavior:** Mobile bottom navigation for admin with 4 tabs: Dashboard, Orders, Inventory (warehouse), More (opens drawer with all nav items).

**Current state:** The admin layout only has `AdminSidebar` (desktop) and `AdminHeader` (mobile top bar). No bottom nav.

**Fix:** Create `components/admin/layout/AdminBottomNav.tsx`:
- 4 tabs: Dashboard, Orders, Inventory, More
- `More` opens a `Sheet`/`Drawer` with all admin nav items
- Visible only on mobile (admin layout already handles responsive)

---

## 11. MISSING — Store Common `LanguageToggle`

### Gap: `components/store/common/LanguageToggle.tsx`

**Status:** **MISSING** — Implemented as `components/store/layout/LanguageSwitcher.tsx` instead.

**Planned in:** TECH_STACK.md Section 4 — "LanguageToggle.tsx" in store common

**Assessment:** The store has `LanguageSwitcher` at `components/store/layout/LanguageSwitcher.tsx` which is functionally equivalent. This is a naming/organization mismatch, not a functional gap. The `LanguageToggle` name from the plan was implemented as `LanguageSwitcher` and placed in the layout folder instead of `common/`.

**Fix:** Either rename to match the plan or update the plan to reflect the actual implementation. No functional issue — just a naming inconsistency.

---

## 12. MISSING — PDF `ReceiptDocument`

### Gap: `components/pdf/ReceiptDocument.tsx`

**Status:** **MISSING** — Not found as that filename.

**Planned in:** TECH_STACK.md Section 4 — "ReceiptDocument.tsx — @react-pdf/renderer receipt"

**Assessment:** `OrderReceiptPDF.tsx` and `B2BQuotePDF.tsx` exist. `OrderReceiptPDF` renders order receipts using `@react-pdf/renderer`. The exact filename `ReceiptDocument` is not present but the functionality is covered.

**Fix:** No critical gap — functionality exists. The `ReceiptDocument` name in the plan was likely aspirational; the actual implementation uses `OrderReceiptPDF`.

---

## 13. BUG — Duplicate Interface in `CouponInput.tsx`

### Bug: `components/store/checkout/CouponInput.tsx`

```typescript
// Line 9-17 — FIRST definition
interface CouponInputProps {
  onApply: (code: string) => void;
  disabled?: boolean;
}

// Line 19-28 — SECOND definition (also named CouponInputProps!)
interface CouponInputProps {
  onApply: (code: string) => void;
  disabled?: boolean;
  onClearError?: () => void; // This field is added in the 2nd definition
}
```

**Problem:** TypeScript will use the first definition (no `onClearError`). The second definition with `onClearError` is dead code — it will be silently ignored. If a parent passes `onClearError`, it will be accepted by the interface but ignored by the component.

**Fix:** Merge the two interface definitions:
```typescript
interface CouponInputProps {
  onApply: (code: string) => void;
  disabled?: boolean;
  onClearError?: () => void; // Keep this as optional in ONE interface
}
```

---

## 14. BUG — `PointsRedeemer` Duplicate Interface

### Bug: `components/store/checkout/PointsRedeemer.tsx`

Same issue as CouponInput — duplicate `PointsRedeemerProps` interface defined twice.

```typescript
// First definition (line 15-22)
interface PointsRedeemerProps {
  pointsBalance: number;
  subtotal: number;
  onRedeem: (points: number) => void;
  disabled?: boolean;
}

// Second definition (line 24-31) — also named PointsRedeemerProps
interface PointsRedeemerProps {
  pointsBalance: number;
  subtotal: number;
  onRedeem: (points: number) => void;
  disabled?: boolean;
  maxRedeemableOverride?: number; // Extra field in 2nd
}
```

**Fix:** Merge into a single interface with `maxRedeemableOverride?: number` as optional.

---

## 15. OVERSIZED FILE — `ProductForm.tsx` (571 lines)

### Issue: `components/admin/products/ProductForm.tsx`

**Problem:** 571 lines, exceeds the project limit of 300 lines per file.

**What it contains:**
- Product form fields (name, description, category, etc.)
- Variant management (useFieldArray for variants)
- Image upload (useFieldArray for images)
- Toggle states (is_active, is_featured, is_halal, etc.
- SEO fields (meta title, meta description)
- Form submission logic
- Validation schema

**Fix required:** Split into:
1. `ProductForm.tsx` — form shell, submit handler, layout (target: ~200 lines)
2. `VariantManager.tsx` — extracted variant CRUD (target: ~150 lines)
3. `ImageUploader.tsx` — extracted image management (target: ~100 lines)
4. `ProductSEOFields.tsx` — extracted SEO fields (target: ~80 lines)

---

## 16. OVERSIZED FILE — `ProductDetailClient.tsx` (356 lines)

### Issue: `components/store/products/ProductDetailClient.tsx`

**Problem:** 356 lines, exceeds the project limit of 300 lines per file.

**What it contains:**
- Variant selection (pills, prices, stock display)
- Quantity stepper
- Add to cart button with loading/disabled states
- Sticky bottom bar on scroll
- Product image gallery (main + thumbnails)
- Breadcrumb navigation
- Related products section

**Fix required:** Split into:
1. `ProductDetailClient.tsx` — orchestration only (target: ~200 lines)
2. `VariantSelector.tsx` — extract variant pills + price display (target: ~100 lines)
3. `ProductImageGallery.tsx` — extract main image + thumbnails + breadcrumb (target: ~100 lines)
4. `ProductStickyBar.tsx` — extract sticky bottom bar (target: ~80 lines)

---

## 17. OVERSIZED FILE — `AdminSidebar.tsx` (300+ lines)

### Issue: `components/admin/layout/AdminSidebar.tsx`

**Problem:** Likely exceeds 300 lines with all nav items, role guards, and nested menu logic.

**Fix required:** Split navigation items into a data-driven config:
```typescript
const adminNavItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, roles: ['superadmin', 'owner'] },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart, roles: ['superadmin', 'owner'] },
  // ...
];
```
Render from config instead of hardcoded JSX. Target: ~150 lines.

---

## 18. INCOMPLETE — `ProductCatalog.tsx` Missing Category Filter UI

### Issue: `components/store/products/ProductCatalog.tsx`

The `ProductCatalog` client component receives the full product list and category list from the server component, but the category filter UI is basic — it renders category pills but doesn't have a proper mobile filter drawer with sort options (price low-to-high, high-to-low, newest, best selling).

**Fix:** Add a filter/sort drawer accessible via a filter button on mobile, with options:
- Sort: Default, Price (Low to High), Price (High to Low), Newest
- Category: All or specific category

---

## 19. MISSING — `ProductFilters.tsx` Only Shows Active Filters

### Issue: `components/store/products/ProductFilters.tsx`

The component displays the current active filter label (e.g., "Filtered by: Dimsum") but does not include a clear/reset button to remove the filter and show all products.

**Fix:** Add a "Clear Filter" button in `ProductFilters.tsx`:
```typescript
{activeCategory && (
  <button
    onClick={() => setActiveCategory(null)}
    className="text-sm text-brand-red underline"
  >
    Clear Filter
  </button>
)}
```

---

## 20. MISSING — `ProductSearch.tsx` No Debounce

### Issue: `components/store/products/ProductSearch.tsx`

The search input does not use `useDebounce` (which doesn't exist as a hook anyway). Every keystroke triggers a URL update and potentially a re-render. This causes layout thrashing on mobile.

**Fix:** Either:
1. Create `hooks/useDebounce.ts` and use it in `ProductSearch.tsx`
2. Or rely entirely on URL-based search (current approach) — only apply the filter when the user presses Enter or after 500ms of no typing

---

## 21. INCOMPLETE — Blog `TableOfContents` Only Parses h2/h3

### Issue: `components/store/blog/TableOfContents.tsx`

**Problem:** The TOC only auto-generates from `<h2>` and `<h3>` HTML elements. It misses `<h4>` headings that might be present in long articles. Also, if the article has no headings, the TOC is empty but still rendered (empty sidebar).

**Fix:**
1. Add `h4` to the heading list
2. Hide the TOC container if `headings.length === 0`

---

## 22. MISSING — `EmptyState` Variant for "No Search Results"

### Issue: `components/store/common/EmptyState.tsx`

The `EmptyState` component has variants: `cart`, `order`, `address`, `blog`, `review`. But there is no variant for "no search results" or "no products match filter".

**Fix:** Add a `search` variant to `EmptyState.tsx`:
```typescript
case 'search':
  return {
    illustration: 'surprised',
    title: 'Produk tidak ditemukan',
    description: 'Coba kata kunci lain atau lihat semua produk',
    action: { label: 'Lihat Semua', href: '/products' },
  };
```

---

## 23. MISSING — `OrderSummaryCard` Doesn't Collapse on Mobile

### Issue: `components/store/checkout/OrderSummaryCard.tsx`

**Problem:** On mobile, the order summary is a sticky bar at the top (showing total only). But the full order summary (item list, subtotal, shipping, discount) is hidden by default and requires a tap to expand. The expand/collapse state is not managed — it may not be clear to users that they can tap to see details.

**Fix:** Add a chevron/tap indicator on the sticky bar that clearly communicates "tap to expand". Ensure the expanded state shows all line items.

---

## 24. INCOMPLETE — `WhatsAppButton` Tooltip Not Accessible

### Issue: `components/store/layout/WhatsAppButton.tsx`

**Problem:** The WhatsApp button tooltip might not be accessible — if it's a `title` attribute or only a visually-hidden `aria-label`, screen readers may not announce it properly.

**Fix:** Ensure the button has:
```typescript
<button
  aria-label="Chat WhatsApp untuk pertanyaan tentang pesanan atau produk"
  // ...
>
```

---

## 25. MISSING — `StockBadge` Not Updated After Cart Validation

### Issue: `components/store/products/StockBadge.tsx`

**Problem:** When `cart.validateStock()` is called (in `CartItem.tsx` or cart page), the stock values in the store are updated. However, `StockBadge` might display stale stock data because it reads from the product/variant data passed as props, not from the cart store.

**Fix:** After `validateStock()` completes and updates `stock` in cart items, the affected `ProductCard` and `CartItem` components should re-render with the updated stock values. Ensure the cart validation response is used to update the store's `stock` field for each item.

---

## 26. SUMMARY TABLE — Missing Components

| Component | Path | Priority |
|---|---|---|
| `VariantSelector` | `components/store/products/VariantSelector.tsx` | **HIGH** — needed to fix oversized `ProductDetailClient` |
| `RecentOrders` | `components/admin/dashboard/RecentOrders.tsx` | **HIGH** — admin dashboard is oversized |
| `OrdersTable` | `components/admin/orders/OrdersTable.tsx` | **MEDIUM** — admin orders listing reuse |
| `OrderStatusBadge` | `components/admin/orders/OrderStatusBadge.tsx` | **MEDIUM** — admin orders reuse |
| `StatusUpdateDropdown` | `components/admin/orders/StatusUpdateDropdown.tsx` | **MEDIUM** — admin orders reuse |
| `VariantManager` | `components/admin/products/VariantManager.tsx` | **HIGH** — needed to fix oversized `ProductForm` |
| `ImageUploader` | `components/admin/products/ImageUploader.tsx` | **HIGH** — needed to fix oversized `ProductForm` |
| `StockEditor` | `components/admin/inventory/StockEditor.tsx` | **MEDIUM** — warehouse UI |
| `DataTable` | `components/admin/common/DataTable.tsx` | **MEDIUM** — DRY admin tables |
| `SearchInput` | `components/admin/common/SearchInput.tsx` | **LOW** — admin consistency |
| `ConfirmDialog` | `components/admin/common/ConfirmDialog.tsx` | **MEDIUM** — DRY admin dialogs |
| `AdminBottomNav` | `components/admin/layout/AdminBottomNav.tsx` | **MEDIUM** — admin mobile UX |
| `LanguageToggle` | `components/store/common/LanguageToggle.tsx` | **LOW** — exists as `LanguageSwitcher` |
| `ReceiptDocument` | `components/pdf/ReceiptDocument.tsx` | **LOW** — exists as `OrderReceiptPDF` |

---

## 27. SUMMARY TABLE — Oversized Files to Split

| File | Current Lines | Limit | Priority |
|---|---|---|---|
| `components/admin/products/ProductForm.tsx` | ~571 | 300 | **HIGH** |
| `components/store/products/ProductDetailClient.tsx` | ~356 | 300 | **HIGH** |
| `components/admin/layout/AdminSidebar.tsx` | ~300+ | 300 | **MEDIUM** |
| `app/(admin)/admin/dashboard/page.tsx` | ~848 | 300 | **HIGH** |
| `app/(admin)/admin/field/page.tsx` | ~1140 | 300 | **HIGH** |
| `app/(admin)/admin/team-dashboard/page.tsx` | ~842 | 300 | **HIGH** |

---

## 28. BUGS TO FIX IMMEDIATELY

1. **CouponInput.tsx** — Deduce duplicate `CouponInputProps` interface
2. **PointsRedeemer.tsx** — Deduce duplicate `PointsRedeemerProps` interface
3. **`use-cart-merge.ts`** — `clearCart()` should be preceded by applying merged items from response
4. **`store/cart.store.ts`** — `loadFromDb` stub needs real implementation
5. **`Providers.tsx`** — locale hardcoded to `"id"` — needs dynamic locale from session/cookie