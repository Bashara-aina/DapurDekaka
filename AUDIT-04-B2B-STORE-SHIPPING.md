# AUDIT 04 — B2B Portal, Store Pages & Shipping Bugs

> Bugs in the B2B flow, store product/blog pages, shipping cost calculation, and field operations.

---

## BUG 01 — HIGH: B2B homepage category variant counts always show 0
**File:** `app/(b2b)/b2b/page.tsx`  
**Approx lines:** ~36–59

The `getCategoryCounts()` query selects category columns but **no COUNT aggregate**:
```ts
const categoryCounts = await db
  .select({
    id: categories.id,
    nameId: categories.nameId,
    // ← missing: count: sql<number>`count(${products.id})`
  })
  .from(categories)
  .leftJoin(products, eq(products.categoryId, categories.id));
```

At line ~59, `c.count` is always `undefined`, so every category chip shows "0 Varian."

**Fix:**
```ts
const categoryCounts = await db
  .select({
    id: categories.id,
    nameId: categories.nameId,
    nameEn: categories.nameEn,
    count: sql<number>`count(${products.id})::int`,
  })
  .from(categories)
  .leftJoin(products, and(
    eq(products.categoryId, categories.id),
    eq(products.isActive, true),
    eq(products.isB2b, true),
  ))
  .groupBy(categories.id);
```

---

## BUG 02 — HIGH: B2B account orders: rows not clickable, no order detail page
**File:** `app/(b2b)/b2b/account/orders/page.tsx`  
**Approx lines:** ~50–70

Each order row renders in a plain `<div>` with a `<ChevronRight>` icon suggesting clickability, but there is no `onClick` handler and no `href`. There is also no `/b2b/account/orders/[orderNumber]` page. Users can see their order numbers but cannot view items, status history, or tracking info.

**Fix (Step 1):** Create `app/(b2b)/b2b/account/orders/[orderNumber]/page.tsx` — it can reuse the same components as `/account/orders/[orderNumber]/page.tsx` with a B2B-specific role check.

**Fix (Step 2):** Wrap each order row in a `<Link href={`/b2b/account/orders/${order.orderNumber}`}>`.

---

## BUG 03 — HIGH: B2B account recent order cards not clickable
**File:** `app/(b2b)/b2b/account/page.tsx`  
**Approx line:** ~237

Individual recent order cards render in `<div>` elements (not `<Link>`). "Lihat Semua" works, but individual cards lead nowhere.

**Fix:** Wrap each card in `<Link href={`/b2b/account/orders/${order.orderNumber}`}>`.

---

## BUG 04 — HIGH: Superadmin gets 403 when viewing B2B account recent orders
**File:** `app/api/b2b/orders/route.ts`  
**Approx line:** ~12

```ts
if (session?.user?.role !== 'b2b') return forbidden();
```

`app/(b2b)/b2b/account/page.tsx` allows `superadmin` role (line ~98) but the orders API blocks them. When superadmin views the B2B account page, the recent orders section is silently empty.

**Fix:** Allow admin roles to view B2B orders:
```ts
const allowedRoles = ['b2b', 'superadmin', 'owner'];
if (!allowedRoles.includes(session?.user?.role)) return forbidden();
```

---

## BUG 05 — HIGH: B2B API: `limit` query param ignored in orders endpoint
**File:** `app/api/b2b/orders/route.ts`

The account page passes `?limit=3` for the recent orders preview. The route handler never reads `searchParams.get('limit')` and always returns all orders.

**Fix:** Add pagination:
```ts
const limit = parseInt(searchParams.get('limit') ?? '20', 10);
const offset = parseInt(searchParams.get('offset') ?? '0', 10);
// add .limit(limit).offset(offset) to the query
```

---

## BUG 06 — HIGH: B2B quotes `status` filter parsed but never applied
**File:** `app/api/b2b/quotes/route.ts`  
**Approx line:** ~124

```ts
const status = searchParams.get('status');
// ... status is never added to whereClause
```

Admin cannot filter quotes by status — all quotes always return regardless of filter.

**Fix:** Add the filter to the where clause:
```ts
if (status) conditions.push(eq(b2bQuotes.status, status));
```

---

## BUG 07 — MEDIUM: B2B quote accept/reject has no error or loading state
**File:** `app/(b2b)/b2b/account/quotes/page.tsx`  
**Approx lines:** ~171–178

The `actionMutation` object has no `onError` handler and the accept/reject buttons don't use `isPending` to show a loading state. If the action fails, the user gets no feedback. Buttons remain clickable during the API call.

**Fix:**
```ts
const actionMutation = useMutation({
  mutationFn: ...,
  onSuccess: () => queryClient.invalidateQueries(['quotes']),
  onError: (error) => toast.error('Gagal memperbarui quote. Coba lagi.'),
});
// In the button:
<button disabled={actionMutation.isPending} onClick={...}>
  {actionMutation.isPending ? 'Memproses...' : 'Terima'}
</button>
```

---

## BUG 08 — MEDIUM: B2B order list shows raw enum strings (not translated)
**File:** `app/(b2b)/b2b/account/orders/page.tsx`  
**Approx lines:** ~63–70

```tsx
{order.status}  // ← shows "pending_payment", "processing", etc.
```

The account dashboard page (`b2b/account/page.tsx`) uses a `STATUS_CONFIG` map to display Indonesian labels. The orders list page skips this entirely.

**Fix:** Import and use the same `STATUS_CONFIG` map (or a shared utility) to render localized status labels and badge colors.

---

## BUG 09 — HIGH: Shipping cost route uses wrong `Content-Type` — will always fail in production
**File:** `app/api/shipping/cost/route.ts`  
**Approx lines:** ~46–58

The route sends a JSON body to the RajaOngkir API with `'content-type': 'application/json'`. RajaOngkir Starter plan **only accepts `application/x-www-form-urlencoded`**. The existing helper in `lib/rajaongkir/calculate-cost.ts` already handles this correctly.

In production, every shipping cost calculation returns empty results or an API error, making it impossible to select a courier.

**Fix:** Replace the custom fetch with the existing utility:
```ts
import { calculateShippingCost } from '@/lib/rajaongkir/calculate-cost';

const results = await calculateShippingCost({
  origin: ORIGIN_CITY_ID,
  destination: cityId,
  weight,
  courier: courierCode,
});
```

---

## BUG 10 — HIGH: Tracking queue includes pickup orders
**File:** `app/api/admin/field/tracking-queue/route.ts`  
**Approx lines:** ~23–30

The query filters by `status = 'packed'` with no delivery method filter. Pickup orders also reach `packed` status, so they appear in both the pickup queue and the tracking queue simultaneously.

**Fix:** Add a delivery method filter:
```ts
where: and(
  eq(orders.status, 'packed'),
  eq(orders.deliveryMethod, 'delivery'),  // ← add this
),
```

---

## BUG 11 — MEDIUM: Blog related posts query missing `isPublished` filter
**File:** `app/(store)/blog/[slug]/page.tsx`  
**Approx lines:** ~107–110

The related posts query by category:
```ts
where: eq(blogPosts.blogCategoryId, post.category.id)
// ← missing: and(eq(blogPosts.isPublished, true))
```

Unpublished/draft posts in the same category are exposed as related articles. The fallback query (line ~113) correctly filters by `isPublished`.

**Fix:**
```ts
where: and(
  eq(blogPosts.blogCategoryId, post.category.id),
  eq(blogPosts.isPublished, true),
  ne(blogPosts.id, post.id),  // exclude the current post
),
```

---

## BUG 12 — MEDIUM: Blog post `CopyLinkButton` is in a Server Component but uses `onClick`
**File:** `app/(store)/blog/[slug]/page.tsx`  
**Approx lines:** ~191–207

`CopyLinkButton` uses `onClick` and `navigator.clipboard` but the blog detail page has no `'use client'` directive — it's a Server Component. Event handlers in Server Components cause a Next.js runtime error.

**Fix:** Extract `CopyLinkButton` into its own file with `'use client'`:
```tsx
// components/store/blog/CopyLinkButton.tsx
'use client';
export function CopyLinkButton({ url }: { url: string }) {
  return (
    <button onClick={() => navigator.clipboard.writeText(url)}>
      Copy Link
    </button>
  );
}
```

---

## BUG 13 — MEDIUM: Products page has conflicting `force-dynamic` and `revalidate = 300`
**File:** `app/(store)/products/page.tsx`  
**Approx lines:** ~7, ~37

```ts
export const dynamic = 'force-dynamic';
export const revalidate = 300;
```

`force-dynamic` disables all caching. Next.js silently ignores `revalidate` when `force-dynamic` is set. The page runs 3 separate DB queries on every single request with zero caching.

**Fix (Option A):** If real-time inventory is important, keep `force-dynamic` and remove `revalidate`.  
**Fix (Option B):** If caching is acceptable, remove `force-dynamic` and keep `revalidate = 300`.

---

## BUG 14 — MEDIUM: Products page makes 2 separate DB queries where 1 would do
**File:** `app/(store)/products/page.tsx`  
**Approx lines:** ~44–64

Products are fetched twice:
1. `productsList` — full product data with relations
2. `allActiveProducts` — only `categoryId` to derive which categories have products

The second query is redundant — `productsList` already contains `category` data on each product.

**Fix:** Derive the category set from `productsList`:
```ts
const categoryIdsWithProducts = new Set(productsList.map(p => p.categoryId).filter(Boolean));
```
Remove the `allActiveProducts` query entirely.

---

## BUG 15 — MEDIUM: Product detail page makes 2 separate DB queries for the same product
**File:** `app/(store)/products/[slug]/page.tsx`  
**Approx lines:** ~15–31, ~87–106

`generateMetadata` fetches the product once, and the page body fetches it again. In `revalidate = 60` mode, this hits the DB twice per cache miss.

**Fix:** Create a shared cached fetch utility:
```ts
// lib/db/get-product-by-slug.ts
import { unstable_cache } from 'next/cache';
export const getProductBySlug = unstable_cache(
  async (slug: string) => db.query.products.findFirst({ where: eq(products.slug, slug), with: { ... } }),
  ['product-by-slug'],
  { revalidate: 60 }
);
```

---

## BUG 16 — MEDIUM: ProductDetailClient: quantity stepper doesn't pass quantity to cart
**File:** `components/store/products/ProductDetailClient.tsx` (or similar)  
**Approx lines:** ~73, ~84–96

The component has a `quantity` state variable that the stepper increments/decrements, but `handleAddToCart` calls `addItem(...)` without passing `quantity`. Every "Add to Cart" always adds 1 unit regardless of the stepper value.

**Fix:**
```ts
const handleAddToCart = () => {
  addItem({
    variantId: selectedVariant.id,
    quantity,  // ← pass the stepper value
    // ... other fields
  });
};
```

---

## BUG 17 — LOW: Pickup queue API may return orders from all dates
**File:** `app/api/admin/field/pickup-queue/route.ts`

Verify the query filters to today's pickup orders only. If there is no date filter, the queue will accumulate all unpicked-up orders from previous days without visual distinction. Add a `date >= today - 7 days` window or a `status = 'paid' OR status = 'processing'` filter to keep it actionable.

---

## BUG 18 — LOW: Unused imports in multiple field API routes
**Files:**  
- `app/api/admin/field/pickup-queue/route.ts` line 1  
- `app/api/admin/field/tracking-queue/route.ts` line 1  
- `app/api/admin/field/inventory/adjust/route.ts` line 1

All three import `NextResponse` but use the `success`/`forbidden`/`notFound` utilities instead.

**Fix:** Remove the `NextResponse` import from each file.

---

## BUG 19 — LOW: Homepage has unused Drizzle imports
**File:** `app/(store)/page.tsx`  
**Approx line:** ~11

`isNull as isNullCond`, `lte`, and `gte` are imported but never used. `isNull` is used directly (not the alias).

**Fix:** Remove unused imports: `lte`, `gte`, and the `isNullCond` alias.
