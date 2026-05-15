# DEEP AUDIT 04 — Frontend, UX & Performance
> Generated: 2026-05-14 | Covers component bugs, SSR/hydration, accessibility, layout issues, performance patterns.

---

## SEVERITY LEGEND
- 🔴 **BROKEN** — Component renders but functionality is non-working
- 🟠 **HIGH** — Significant UX degradation, hydration errors, visible bugs
- 🟡 **MEDIUM** — Polish gaps, inconsistencies, missing states
- 🟢 **LOW** — Improvements, accessibility, best practices

---

## 🔴 BROKEN — BottomNav Active State Causes Hydration Mismatch

**File:** `components/store/layout/BottomNav.tsx:39`

```ts
const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;
```

This pattern causes a React hydration mismatch in Next.js 14. During SSR, `typeof window !== 'undefined'` is `false`, so `isActive` is always `false`. On the client, it becomes `true` for the current path. React's reconciliation sees different class names between server and client HTML and logs a hydration error in the console. In production, this can cause the nav to visually flicker or not update correctly.

**Fix:** Use Next.js's `usePathname()` hook which is SSR-safe and works with Next.js's router:
```tsx
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();
  // ...
  const isActive = pathname === item.href;
```

---

## 🟠 HIGH — Product Catalog Loads ALL Products Client-Side (Not Scalable)

**File:** `app/(store)/products/page.tsx` → `ProductCatalog.tsx`

The product listing page fetches ALL active products from the database in a single server query, passes them as props to the client component, which then does **client-side filtering** via `useMemo`. With 10-20 products this is fine. With 100+ products:

1. The initial page HTML becomes enormous (all product data serialized as props)
2. Memory usage increases linearly on the client
3. Category and search filtering shows instant results but at the cost of loading everything upfront

**File:** `components/store/products/ProductCatalog.tsx:58-106` — All filtering is in-memory.

**Fix for scale:** Move to server-side pagination + search:
```ts
// products/page.tsx
const { searchParams } = request;
const category = searchParams.get('category');
const q = searchParams.get('q');
const page = parseInt(searchParams.get('page') ?? '1');

const products = await db.query.products.findMany({
  where: and(
    eq(products.isActive, true),
    category ? eq(categories.slug, category) : undefined,
    q ? or(like(products.nameId, `%${q}%`)) : undefined,
  ),
  limit: 20,
  offset: (page - 1) * 20,
});
```

For now, the client-side approach works but needs documented as a scalability risk.

---

## 🟠 HIGH — `alert()` Used for Error Handling Throughout Checkout

**Files:** 
- `app/(store)/checkout/page.tsx:213-215, 221, 448`
- `app/(store)/checkout/page.tsx:305, 312`

```ts
alert(data.error || 'Gagal menghitung ongkir');
alert('Gagal membuat pesanan');
alert(data.error || 'Gagal membuat pesanan');
```

`window.alert()` blocks the UI thread, is not styleable, shows the page origin to users, doesn't work in some browser contexts (e.g., iframes), and is generally considered poor UX for a professional e-commerce app. The `sonner` toast library is already installed (`package.json:82`) and used elsewhere.

**Fix:** Replace all `alert()` calls with `toast.error()`:
```tsx
import { toast } from 'sonner';
// ...
toast.error(data.error || 'Gagal menghitung ongkir');
```

---

## 🟠 HIGH — No Loading State When Midtrans Snap.js Loads

**File:** `app/(store)/checkout/page.tsx:620-627`

```tsx
{snapToken && orderNumber && (
  <MidtransPayment
    snapToken={snapToken}
    callbacks={{ onSuccess: handleMidtransSuccess }}
  />
)}
```

When `snapToken` is set, `MidtransPayment` renders and calls `window.snap.pay()`. However, if Midtrans's `snap.js` CDN is slow (common in Indonesia), there's a delay where:
1. The "Bayar Sekarang" button is disabled (`isLoading: true`)
2. Nothing visible happens
3. User waits 3-5 seconds with no feedback
4. Snap modal eventually appears

**Fix:** Show a loading overlay or spinner when `snapToken` is set but before the Snap modal appears:
```tsx
{snapToken && orderNumber && (
  <>
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 text-center">
        <Spinner />
        <p className="mt-3 text-sm">Mempersiapkan pembayaran...</p>
      </div>
    </div>
    <MidtransPayment snapToken={snapToken} callbacks={{ onSuccess: handleMidtransSuccess }} />
  </>
)}
```

---

## 🟠 HIGH — MidtransPayment Component: No Cleanup on Unmount

**File:** `components/store/checkout/MidtransPayment.tsx`

The Midtrans Snap.js payment component loads `snap.js` script dynamically. If the component unmounts (user navigates away during payment), the script tag and Snap modal may not be cleaned up, causing memory leaks or the modal reappearing on re-navigation.

**Fix:** In the `useEffect` cleanup function, call `snap.hide()` and remove the script tag if it was dynamically injected.

---

## 🟠 HIGH — Checkout Stepper: Stepper Doesn't Reflect Pickup Flow Correctly

**File:** `app/(store)/checkout/page.tsx:33-44, 145`

```ts
const STEPS = ['identity', 'delivery', 'courier', 'payment'];      // 4 steps
const STEPS_PICKUP = ['identity', 'delivery', 'payment'];           // 3 steps
const activeSteps = formData.deliveryMethod === 'pickup' ? STEPS_PICKUP : STEPS;
```

The `CheckoutStepper` component receives `activeSteps` (correct). But the step index calculation:
```ts
const currentStepIndex = STEPS.findIndex((s) => s.id === step);  // always uses 4-step STEPS
```

For pickup orders, when the user is on `'payment'`, `STEPS.findIndex` returns index 3, but in `STEPS_PICKUP`, `'payment'` is index 2. Any progress indicator or conditional rendering based on `currentStepIndex` will be off by 1 for pickup users.

Also, when the `deliveryMethod` changes from `delivery` to `pickup` after the user has already selected a courier (step 3), `step` is still `'courier'`. Since `'courier'` doesn't exist in `STEPS_PICKUP`, the stepper will show `currentStepIndex = -1` and render incorrectly.

**Fix:**
1. `const currentStepIndex = activeSteps.findIndex((s) => s.id === step);`
2. When delivery method changes to pickup, reset step to `'delivery'` if current step is `'courier'` or `'payment'`.

---

## 🟠 HIGH — Add to Cart Doesn't Validate Stock Against Current Cart Quantity

**File:** `store/cart.store.ts:36-49`

```ts
addItem: (item) => {
  const existing = get().items.find((i) => i.variantId === item.variantId);
  if (existing) {
    const maxQty = Math.min(99, item.stock ?? 99);
    set({ items: get().items.map((i) =>
      i.variantId === item.variantId
        ? { ...i, quantity: Math.min(i.quantity + 1, maxQty) }  // ← uses item.stock passed IN
```

The `item.stock` used here is whatever was passed from `ProductDetailClient` at the time of adding. But if:
1. User adds 5 items (stock was 10 when page loaded)
2. Another user buys 4 items while this user's session is active
3. Real stock is now 1
4. This user's cart shows 5 quantity, `stock: 10` (stale)

The cart's `stock` value is frozen at page-load time. At checkout, the server correctly validates real stock (via DB), but the frontend allows the user to add up to 99 items (or the stale stock count) without any fresh validation.

**Fix:** Add a `/api/cart/validate` call before displaying the checkout page (this route already exists at `app/api/cart/validate/route.ts`!) and update the cart's `stock` values:
```ts
// On cart page load, call /api/cart/validate to refresh stock values
const { data } = await fetch('/api/cart/validate', { method: 'POST', body: JSON.stringify({ items }) });
// Update each item's stock in the cart store with fresh values
```

---

## 🟡 MEDIUM — No Structured Loading Skeleton for Checkout Page

**File:** `app/(store)/checkout/page.tsx`

The checkout page is a client component (`'use client'`) that depends on session, cart store, and multiple `useQuery` calls. While data loads:
- There's no skeleton or placeholder — the form just shows in whatever state the initial render provides
- If session is loading, form shows with empty default values briefly
- If addresses are loading, the picker flashes between states

The product page has a `loading.tsx` file at `app/(store)/products/loading.tsx`, but there's no `app/(store)/checkout/loading.tsx`.

---

## 🟡 MEDIUM — Checkout "Kembali" Button Works but Has No Back State Cleanup

**File:** `app/(store)/checkout/page.tsx:323-329`

```ts
const handleBack = () => {
  const stepOrder = activeSteps.map(s => s.id);
  const currentIndex = stepOrder.indexOf(step);
  if (currentIndex > 0) {
    setStep(stepOrder[currentIndex - 1] as CheckoutStep);
  }
};
```

Going back from `courier` to `delivery` doesn't clear `shippingOptions`, `formData.courierCode`, or `formData.shippingCost`. If the user changes their address and goes forward again, a new shipping cost fetch fires correctly. But `formData.courierCode` still has the previous selection, and if the user clicks "Lanjut" from the delivery step quickly (before the new shipping options load), the old courier is still selected.

---

## 🟡 MEDIUM — No Error Boundary on Admin Dashboard Components

**File:** `app/(admin)/admin/dashboard/page.tsx`

The admin dashboard uses `useQuery` hooks for multiple data sources (KPIs, live feed, alerts, order funnel, etc.). If any one of these API endpoints returns an error, the query throws and there's no error boundary — the entire dashboard would show the error page.

**Fix:** Wrap each dashboard widget in an `<ErrorBoundary>` or use `onError` in React Query config to catch per-query errors without crashing the whole page.

---

## 🟡 MEDIUM — WhatsAppButton: Hardcoded Number If Env Var Missing

**File:** `components/store/layout/WhatsAppButton.tsx`

```tsx
const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
href={`https://wa.me/${waNumber}?text=...`}
```

If `NEXT_PUBLIC_WHATSAPP_NUMBER` is undefined at build time, the link becomes `https://wa.me/undefined?text=...` — a broken link. This is the same issue as BottomNav.

**Fix:** Provide a fallback or throw a build-time error if not set.

---

## 🟡 MEDIUM — Order Success Page: Cart Clear Timing

**File:** `app/(store)/checkout/page.tsx:319`

```ts
const handleMidtransSuccess = () => {
  clearCart();
};
```

`clearCart()` is called when Midtrans calls the `onSuccess` callback. However, Midtrans's `onSuccess` fires when the user clicks "Selesai" in the Midtrans modal — NOT when the webhook fires. The webhook may not have fired yet. If the webhook is delayed, the database still shows `pending_payment` when the user lands on the success page. The success page must handle both "payment received immediately" and "payment being processed" states.

The current success page (`app/(store)/checkout/success/page.tsx`) should poll for status or show a "Payment being processed" message until the webhook confirms payment.

---

## 🟡 MEDIUM — Halal Badge Shown Twice on Product Detail

**File:** `components/store/products/ProductDetailClient.tsx:98-105`

```tsx
{product.isHalal && <HalalBadge />}
{product.isHalal && (
  <span className="text-[10px] text-text-muted bg-white/60 px-1 rounded">
    MUI 001/2020
  </span>
)}
```

The Halal badge appears in the top-right corner of the product image. Additionally, `HalalBadge` presumably shows a "HALAL" label. Then immediately below it, a "MUI 001/2020" text also appears. Both are conditional on `isHalal`. This creates visual clutter for halal products. The cert number should be inside the badge or below it, not as a separate element.

---

## 🟡 MEDIUM — Product Card Price Shows Lowest Variant Price Without Label

**File:** `components/store/products/ProductCard.tsx` (inferred from ProductCatalog)

The product catalog shows `primaryVariant.price` as "the price" — but if a product has multiple variants with different prices (e.g., "25 pcs: 35k", "50 pcs: 65k"), the catalog only shows one price without indicating it's "from" or "starting at".

**Fix:** Show `Mulai dari Rp X.xxx` if there are multiple variants with different prices.

---

## 🟡 MEDIUM — `next/image` Missing Width/Height on Admin Image Previews

Throughout admin pages, image previews likely use `<img>` tags directly or `next/image` without explicit `width`/`height`. This causes layout shift (CLS) during page load.

---

## 🟡 MEDIUM — No Offline/PWA Handling

The site has a `manifest.json` or service worker? No evidence of PWA setup. The store is accessed mostly on mobile (Indonesian market, food delivery context). Key offline behaviors to add:
- Show offline notice when cart/checkout has no connection
- Cache product list for offline browsing

---

## 🟢 LOW — Checkout Page: Coupon Input Missing Space Between Words

**File:** `app/(store)/checkout/page.tsx:566-572`

```tsx
<p className="text-sm text-green-700">
  <span className="font-semibold">Kupon gratis item aktif!</span><br />
  Beli {couponBuyXgetY.buyQuantity}item, dapat {couponBuyXgetY.getQuantity}item gratis otomatis.
         ↑ missing space                        ↑ missing space
```

"Beli 2item" instead of "Beli 2 item". Minor text bug.

**Fix:**
```tsx
Beli {couponBuyXgetY.buyQuantity} item, dapat {couponBuyXgetY.getQuantity} item gratis otomatis.
```

---

## 🟢 LOW — Back Button in ProductDetailClient Uses `<a>` Instead of `<Link>` or `router.back()`

**File:** `components/store/products/ProductDetailClient.tsx:90-94`

```tsx
<a
  href="/products"
  className="absolute top-4 left-4 ..."
>
  ←
</a>
```

Using `<a href="/products">` causes a full page navigation instead of a client-side router transition. This means:
1. The entire page reloads, losing the product catalog scroll position
2. The browser shows a loading indicator for a full navigation

**Fix:** Use Next.js `<Link href="/products">` or `router.back()`:
```tsx
import { useRouter } from 'next/navigation';
const router = useRouter();
<button onClick={() => router.back()}>←</button>
```

---

## 🟢 LOW — No Favicon for Dark Mode / Multiple Sizes

**File:** `public/assets/icons/` — Only `favicon.ico`, `favicon.svg`, `favicon.icns`

No `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, or `site.webmanifest` for proper multi-device support. The `public/favicon.ico` exists at root but Safari and iOS require `apple-touch-icon`.

---

## 🟢 LOW — Product Description Rendered as Plain Text (No Markdown/HTML Support)

**File:** `components/store/products/ProductDetailClient.tsx:176-181`

```tsx
<p className="text-text-secondary text-sm whitespace-pre-line">
  {product.descriptionId}
</p>
```

`whitespace-pre-line` preserves line breaks but doesn't support **bold**, *italic*, bullet lists, or links. If the admin wrote product descriptions with markdown formatting, it shows raw `**bold**` text.

The admin product form likely uses a plain textarea. If rich text support is added to product descriptions in the future, the frontend needs to support rendering HTML/markdown.

---

## 🟢 LOW — InstagramFeed Component: Hardcoded Dummy Data

**File:** `components/store/home/InstagramFeed.tsx`

Based on the file existing, this component likely shows either hardcoded Instagram post images or links to the Dapur Dekaka Instagram account. If it shows dummy "from Instagram" posts without a real Instagram Basic Display API integration, it's misleading to users.

**Recommendation:** Either connect to real Instagram API (requires app review) or rename to "Gallery" and source from Cloudinary uploads.

---

## 🟢 LOW — Sentry: Config Files Exist But `instrumentation.ts` Is Missing

**Files exist:** `sentry.client.config.ts`, `sentry.edge.config.ts`, `sentry.server.config.ts`

**Missing:** `instrumentation.ts` at the project root (required by Next.js 14 for Sentry server-side initialization with the `@sentry/nextjs` v10+ SDK).

Without `instrumentation.ts`, server-side error tracking may not work:
```ts
// instrumentation.ts — MISSING
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```

Also, `@sentry/nextjs` is in `devDependencies` (should be in `dependencies` for production error tracking).

---

## 🟢 LOW — `next.config.ts` Optimizes `@radix-ui` But It's Not Installed

**File:** `next.config.ts:67`

```ts
experimental: {
  optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui'],
},
```

**File:** `package.json` — No `@radix-ui/*` packages in either `dependencies` or `devDependencies`.

The `@radix-ui` optimization entry has no effect and could cause build warnings. `shadcn` is used (which uses Radix under the hood) but imports are re-exported through shadcn's component wrappers, not imported directly from `@radix-ui`.

**Fix:** Remove `'@radix-ui'` from `optimizePackageImports`, or add the actual Radix packages if they're needed directly.

---

## 🟢 LOW — No `loading.tsx` for Checkout Route

**File structure:** `app/(store)/checkout/` — no `loading.tsx`

Since `checkout/page.tsx` is a `'use client'` component that makes multiple API calls on mount, a server-side `loading.tsx` wouldn't help much. But a skeleton UI that matches the checkout layout would prevent content layout shift.

For comparison, `app/(store)/account/profile/loading.tsx` exists and provides a skeleton.
