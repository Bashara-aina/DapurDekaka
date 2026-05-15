# NEW AUDIT 04 — Frontend & UX
# DapurDekaka.com — Page-by-Page UI Bugs, Component Gaps, Mobile Experience, Performance
**Date:** May 2026 | **Scope:** All 61 pages, 74 components, mobile UX, loading states, accessibility

---

## LEGEND
- ✅ Working correctly
- ⚠️ Works but has UX issue or potential bug
- ❌ Broken or missing
- 🔴 Blocks user task
- 🟡 Noticeable UX degradation
- 🟢 Polish / nice-to-have

---

## 1. CHECKOUT — STEP-BY-STEP UX AUDIT

### 1.1 Stepper Shows Wrong Step Count for Pickup
**Status:** ❌ 🟡  
**File:** `components/store/checkout/CheckoutStepper.tsx`

For delivery orders: 5 steps (Identity → Method → Address → Courier → Payment).  
For pickup orders: 3 steps (Identity → Method → Payment). 

The stepper currently hardcodes step count. When pickup is selected, shipping/courier steps are skipped but the visual stepper still shows them as "upcoming" or "skipped", confusing the user about where they are in the flow.

**Fix:** Pass `steps` array dynamically to `CheckoutStepper` based on `deliveryMethod`:
```tsx
const steps = deliveryMethod === 'pickup'
  ? ['Identitas', 'Metode', 'Pembayaran']
  : ['Identitas', 'Metode', 'Alamat', 'Kurir', 'Pembayaran'];
```

---

### 1.2 "Bayar Sekarang" Button — No Loading State
**Status:** ⚠️ 🟡  
**File:** `app/(store)/checkout/page.tsx`, `components/store/checkout/MidtransPayment.tsx`

After clicking "Bayar Sekarang", the API call to `/api/checkout/initiate` takes 2–5 seconds (DB transaction + Midtrans API call). During this time, there is no loading indicator on the button. The user may click multiple times thinking the first click didn't register.

**Fix:** Set a loading state immediately on click, disable the button, show spinner:
```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handlePayment = async () => {
  setIsSubmitting(true);
  try { await initiateCheckout(...); }
  finally { setIsSubmitting(false); }
};

<button disabled={isSubmitting} onClick={handlePayment}>
  {isSubmitting ? <Spinner /> : 'Bayar Sekarang'}
</button>
```

---

### 1.3 Coupon Applied — Shipping Total Not Updated Reactively
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 1.5 audit note — "free_shipping coupon updates total after next render"

When user applies a `free_shipping` coupon after selecting a courier, the displayed shipping line item may not update to IDR 0 until a re-render is triggered. The order summary should reactively compute totals whenever `couponData` changes.

**Fix:** Ensure `finalShippingCost` is computed as a derived value, not state:
```tsx
const finalShippingCost = couponData?.type === 'free_shipping' ? 0 : shippingCost;
const finalTotal = subtotal - couponDiscount - pointsDiscount + finalShippingCost;
```

---

### 1.4 Address Form — District Field Not Cascading
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 5.2 Step 3 — "District field cascades from city (RajaOngkir)"

The district (`kecamatan`) field is a free-text input. PRD requires a dropdown that cascades from the selected city via RajaOngkir's `/subdistrict` API. Without this, customers enter inconsistent district names that don't match courier routing databases, potentially causing delivery failures.

**Important Note:** RajaOngkir's free plan may not include subdistrict data — verify API plan before implementing. If subdistrict API isn't available, document this and keep as free-text with a helper text: "Masukkan nama kecamatan sesuai KTP / kurir".

---

### 1.5 Checkout — Points Toggle Not Showing Expiring Warning
**Status:** ⚠️ 🟢  
**File:** `components/store/checkout/PointsRedeemer.tsx`

The `PointsRedeemer` shows total balance. If a user has expiring points (e.g., 500 points expiring in 5 days), the component should nudge them: "⚠️ 500 poin akan kedaluwarsa dalam 5 hari — redeem sekarang!" This requires the checkout page to also fetch expiring-points count from `/api/account/points`.

---

### 1.6 Checkout Form — Phone Validation Regex
**Status:** ⚠️ 🟡  
**File:** `lib/validations/auth.schema.ts`, used at checkout  

The phone regex `/^(\+62|62|0)[0-9]{8,13}$/` accepts valid formats but may reject some edge cases:
- `+6281234567890` (13 digits after +62) → accepted ✅
- `085212345678` (10-11 digits starting with 0) → accepted ✅
- `8123456789` (no prefix) → rejected correctly ✅
- `0812-1234-5678` (with dashes, common in Indonesia) → REJECTED ❌

Many Indonesian users type phone numbers with dashes or spaces. Add normalization before validation:
```typescript
const normalizePhone = (phone: string) => phone.replace(/[\s\-\.]/g, '');
```

---

## 2. PRODUCT PAGES

### 2.1 Product Detail — Variant Selection UX
**Status:** ⚠️ 🟡  
**File:** `components/store/products/ProductDetailClient.tsx`

When a product has multiple variants (e.g., "25 pcs", "50 pcs", "100 pcs"), verify:
1. The currently selected variant is visually highlighted (selected state on variant buttons)
2. The displayed price updates immediately on variant selection
3. The stock badge updates per variant (not showing product-level aggregate)
4. The "add to cart" button is disabled when selected variant has `stock === 0`

If any of these are missing, customers will add wrong variants or be confused by stale prices.

---

### 2.2 Product Catalog — Out-of-Stock Sort
**Status:** ⚠️ 🟡  
**File:** `app/(store)/products/page.tsx`

Out-of-stock products appear in their normal sort position. This fragments the browsable catalog — a customer scanning products sees "Habis" cards mixed in randomly. PRD doesn't specify, but best practice is to push OOS items to the end.

**Fix:**
```typescript
const sorted = [...products].sort((a, b) => {
  const aInStock = a.variants.some(v => v.stock > 0);
  const bInStock = b.variants.some(v => v.stock > 0);
  if (aInStock && !bInStock) return -1;
  if (!aInStock && bInStock) return 1;
  return a.sortOrder - b.sortOrder;
});
```

---

### 2.3 Product Catalog — Search Has No Debounce
**Status:** ⚠️ 🟢  
**File:** `components/store/products/ProductSearch.tsx`

Every keystroke in the search input triggers a re-filter. For 19 SKUs this is fine, but the pattern is unscalable and causes visible flicker. Add 200ms debounce:
```tsx
const debouncedSearch = useDebounce(searchInput, 200);
```

---

### 2.4 Low Stock Warning Threshold
**Status:** ⚠️ 🟢  
**PRD Reference:** Section 7.3 — "When stock < 5: show 'Tersisa X pcs' warning"

Verify `StockBadge` component renders "Tersisa X" when `stock > 0 && stock < 5`. If the threshold is higher (e.g., 10), customers see unnecessary urgency messaging. If it's not implemented, customers miss stock scarcity cues.

---

## 3. CART PAGE

### 3.1 Cart — No Real-Time Stock Validation
**Status:** ❌ 🟡  
**PRD Reference:** Section 5.1 — "Cart shows real-time stock validation"

When a customer has 5 units in cart and another customer buys the last 3, the first customer sees no warning on the cart page until they click "Bayar Sekarang" (which then fails at the API level).

**Fix:** Use `GET /api/cart/validate` (route exists!) on cart page load/focus to check current stock:
```tsx
const { data: cartValidation } = useQuery({
  queryKey: ['cart-validate', cartItems],
  queryFn: () => fetch('/api/cart/validate', { method: 'POST', body: JSON.stringify(cartItems) }),
  staleTime: 30_000, // Check every 30 seconds
  refetchOnWindowFocus: true,
});
```

---

### 3.2 Cart Item Quantity Stepper — Over-Stock Edge Case
**Status:** ⚠️ 🟡  
**File:** `store/cart.store.ts`, `components/store/cart/CartItem.tsx`

The cart store limits to `MAX_CART_QUANTITY = 99`, but it doesn't check against the actual variant `stock`. A user can add 99 units of a product with only 3 in stock — the cart accepts it but checkout rejects it.

**Fix:** Pass `maxQuantity = Math.min(99, variant.stock)` to the quantity stepper. This requires fetching variant stock in the cart page (already done via server component).

---

## 4. ACCOUNT PAGES

### 4.1 Account Profile — Language Preference Has No Effect
**Status:** ⚠️ 🟡  
**File:** `app/(store)/account/profile/page.tsx`

The profile form saves `languagePreference` to the database. But no mechanism reads this preference to actually change the UI language. The `next-intl` routing uses `localePrefix: 'never'`, meaning language is stored per-session/cookie, not in the URL. The saved preference in the DB is never applied.

**Fix:** After saving language preference, update the locale cookie:
```typescript
// After successful PATCH to /api/account/profile:
document.cookie = `NEXT_LOCALE=${languagePreference}; path=/; max-age=${365 * 24 * 60 * 60}`;
router.refresh(); // Reload with new locale
```

---

### 4.2 Order History — No Pagination
**Status:** ⚠️ 🟡  
**File:** `app/(store)/account/orders/page.tsx`

If the orders API returns all orders without pagination, long-term customers with 50+ orders see a very long page with no "load more" or page controls. Add `limit=20&page=1` pagination.

---

### 4.3 Account Dashboard — Points Card Not Live
**Status:** ⚠️ 🟢  
**File:** `app/(store)/account/page.tsx`

The account dashboard shows a points balance card. If this is rendered server-side at request time (SSR), it shows the balance from when the page loaded. After a purchase, if the user goes back to the account page without a full refresh, the points balance may be stale.

**Fix:** Use React Query with `staleTime: 0` for the points balance card, or add a "Perbarui" refresh button.

---

## 5. ADMIN DASHBOARD

### 5.1 Dashboard Refetch Intervals — Not Consistent with Backend
**Status:** ⚠️ 🟢  
**File:** `app/(admin)/admin/dashboard/page.tsx`

Refetch intervals:
- KPIs: 60s ✅ (reasonable)
- Live feed: 30s ✅ (acceptable)
- Inventory: 120s ✅ (acceptable)

However, at each refetch, a new full database query runs. For a dashboard with 5 widgets all refetching at different intervals, there can be up to 10 concurrent DB queries per minute. On Neon free tier (limited concurrent connections), this may cause throttling.

**Fix:** Use `staleTime` to prevent all widgets from simultaneously hitting the DB on page focus:
```typescript
useQuery({ staleTime: 55_000, refetchInterval: 60_000 }); // Prevents double-fetch
```

---

### 5.2 Admin Orders Page — Client vs Server Rendering
**Status:** ⚠️ 🟡  
**File:** `app/(admin)/admin/orders/OrdersClient.tsx`

The orders page uses a client component (`OrdersClient.tsx`). Verify:
1. Does it load all orders at once or paginate via API?
2. Is there a search/filter input wired to `/api/admin/orders?search=&status=&page=`?
3. Is there a loading skeleton while orders are fetching?

If it fetches all orders in one request, this will break performance at 500+ orders.

---

### 5.3 Admin Field Page — Mobile Optimization
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 2.2 — "Warehouse staff: mobile-only access"  
**File:** `app/(admin)/admin/field/page.tsx`

The field operations page is used by warehouse staff on mobile phones. Verify:
- All tap targets are ≥ 44px height
- No horizontal scrolling required on 375px width (iPhone SE)
- Text is legible without zooming (≥ 16px font)
- Action buttons (Pack, Ship, etc.) are prominently placed, not buried in tables

---

### 5.4 Admin Products — Image Upload State
**Status:** ⚠️ 🟡  
**File:** `components/admin/products/ProductForm.tsx`

Product image upload likely calls `/api/admin/upload`. If the upload takes time (large image), the form needs:
- Upload progress indicator
- Preview of uploaded image
- Error handling if upload fails
- Ability to remove an uploaded image before saving

If these states aren't handled, admin may accidentally submit the form before the image upload completes, resulting in a product with no images.

---

## 6. LOADING STATES & SKELETON SCREENS

### 6.1 Checkout Page — No Skeleton for Address Loading
**Status:** ⚠️ 🟢  
When a logged-in user reaches the address step, it fetches saved addresses via React Query. During the fetch, if there's no skeleton/loading state, the step appears blank momentarily.

---

### 6.2 Account Pages — Loading Files Exist But May Be Generic
**Status:** ⚠️ 🟢  
**Files:** `app/(store)/account/loading.tsx`, `app/(store)/account/profile/loading.tsx`

These loading files use Next.js loading UI. Verify they render appropriate skeleton shapes (not just a blank spinner), especially for the orders list and points history which have tabular layouts.

---

## 7. MOBILE-SPECIFIC UX

### 7.1 Bottom Navigation Badge
**Status:** ⚠️ 🟢  
**File:** `components/store/layout/BottomNav.tsx`

The cart icon badge reads count from `useCartStore`. On initial SSR hydration, Zustand's persisted state takes a render cycle to load. This causes the badge to flash from "0" to the actual count on page load. Fix with Zustand's `useStore` hydration guard:
```typescript
const [hydrated, setHydrated] = useState(false);
useEffect(() => setHydrated(true), []);
const cartCount = hydrated ? useCartStore.getState().getTotalItems() : 0;
```

---

### 7.2 Midtrans Snap Popup on iOS Safari
**Status:** ⚠️ 🟡  
**File:** `components/store/checkout/MidtransPayment.tsx`

Midtrans Snap renders as a popup/overlay. On iOS Safari, popups opened by `window.snap.pay()` may be blocked by popup blockers or render incorrectly in private browsing mode. Verify the Snap integration works on:
- iOS Safari 16+ (normal and private browsing)
- Chrome on Android
- Samsung Internet

The Snap popup must be triggered directly inside a user gesture (button click), not inside a `setTimeout` or `Promise` callback — iOS blocks async-triggered popups.

---

### 7.3 WhatsApp Button — Fixed Position Overlaps Content
**Status:** ⚠️ 🟢  
**File:** `components/store/layout/WhatsAppButton.tsx`

The floating WhatsApp button is fixed at bottom-right. On mobile checkout, the "Bayar Sekarang" CTA button may be obscured by the floating WhatsApp button if both are at the same vertical position. Add `bottom: 80px` on checkout pages specifically.

---

## 8. NAVIGATION & ROUTING

### 8.1 Auth Pages URL Mismatch with PRD
**Status:** ⚠️ 🟢  
**PRD Reference:** Site map lists `/auth/login`, `/auth/register`, etc.

Actual implementation: routes are at `/login`, `/register`, `/forgot-password` (route group `(auth)` is transparent).

If any marketing materials, emails, or external links point to `/auth/login`, they will 404. Update PRD or implement a redirect from `/auth/login` → `/login`.

---

### 8.2 Admin Route — `/admin` Doesn't Redirect to `/admin/dashboard`
**Status:** ⚠️ 🟢  
**File:** `app/(admin)/admin/page.tsx`  
**PRD Reference:** Site map — "/admin — Redirect to /admin/dashboard"

Verify that `app/(admin)/admin/page.tsx` contains:
```typescript
import { redirect } from 'next/navigation';
export default function AdminPage() { redirect('/admin/dashboard'); }
```
If it renders content itself instead of redirecting, the admin URL structure is inconsistent.

---

## 9. SEO & META TAGS

### 9.1 Product Pages — Dynamic Meta Tags
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 4.1 — "SEO meta tags on all pages" (P1)  
**File:** `app/(store)/products/[slug]/page.tsx`

Each product page needs `generateMetadata()` returning:
```typescript
export async function generateMetadata({ params }) {
  const product = await getProduct(params.slug);
  return {
    title: `${product.nameId} | Dapur Dekaka`,
    description: product.shortDescriptionId ?? product.descriptionId?.slice(0, 160),
    openGraph: {
      images: [product.images[0]?.cloudinaryUrl],
      type: 'product',
    },
  };
}
```
Without this, all product pages share the same default `<title>` and `<description>`, killing search ranking and social shares.

---

### 9.2 Sitemap — Dynamic Product/Blog URLs
**Status:** ⚠️ 🟡  
**File:** `next-sitemap.config.js`

The sitemap config generates static paths. Verify it includes dynamic routes:
- `/products/[slug]` for all active products
- `/blog/[slug]` for all published posts

Without `additionalPaths` or `transform`, dynamic routes won't appear in the sitemap.

---

### 9.3 Canonical URLs
**Status:** ⚠️ 🟢  

Products can appear in the catalog at `/products` and be linked from the homepage. If both use the same slug without a canonical tag, Google may see duplicate content.

---

## 10. ACCESSIBILITY

### 10.1 Image Alt Text
**Status:** ⚠️ 🟡  
**File:** `components/store/products/ProductCard.tsx`

Product images must have descriptive `alt` text using `product.images[0].altText` (bilingual field exists in schema). If `alt=""` or `alt="product image"` is used instead, screen reader users cannot identify products.

---

### 10.2 Form Error Messages
**Status:** ⚠️ 🟢  

Verify that React Hook Form validation errors are announced to screen readers via `aria-describedby` and `role="alert"`. Missing ARIA attributes mean visually impaired users don't hear validation errors.

---

### 10.3 Color Contrast
**Status:** ⚠️ 🟢  

The brand palette uses `brand-red` (#C41E3A-ish) on white backgrounds. Verify contrast ratio ≥ 4.5:1 (WCAG AA) for body text and ≥ 3:1 for large text/UI components. Use browser DevTools Accessibility checker or Contrast Ratio tool.

---

## SUMMARY — FRONTEND ISSUES BY PRIORITY

| Priority | Issue | File(s) |
|----------|-------|---------|
| 🔴 Critical | Warehouse staff blocked from `/admin/field` (middleware — already in Auth audit) | `middleware.ts` |
| 🟡 Major | "Bayar Sekarang" no loading state — double-click risk | `checkout/page.tsx` |
| 🟡 Major | Cart quantity doesn't cap at actual stock | `cart.store.ts`, `CartItem.tsx` |
| 🟡 Major | No real-time cart stock validation | `cart/page.tsx` |
| 🟡 Major | Checkout stepper shows wrong count for pickup | `CheckoutStepper.tsx` |
| 🟡 Major | Product detail variant selection (price/stock update) | `ProductDetailClient.tsx` |
| 🟡 Major | Product pages missing `generateMetadata()` | `products/[slug]/page.tsx` |
| 🟡 Major | Phone number with dashes rejected at checkout | `lib/validations/auth.schema.ts` |
| 🟢 Minor | Free shipping coupon total not reactive | `checkout/page.tsx` |
| 🟢 Minor | Out-of-stock products not sorted to end | `products/page.tsx` |
| 🟢 Minor | No debounce on product search | `ProductSearch.tsx` |
| 🟢 Minor | Zustand hydration flash on cart badge | `BottomNav.tsx` |
| 🟢 Minor | WhatsApp button overlaps checkout CTA on mobile | `WhatsAppButton.tsx` |
| 🟢 Minor | Auth URL mismatch (PRD says /auth/login, actual is /login) | `app/(auth)/login/page.tsx` |
