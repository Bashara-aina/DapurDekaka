# AUDIT 02 — Admin Panel Bugs

> All bugs in the admin dashboard, orders management, products, customers, users, and settings pages.

---

## BUG 01 — CRITICAL: `products/new` form submission crashes (missing Server Action directive)
**File:** `app/(admin)/admin/products/new/page.tsx`  
**Approx lines:** ~26–50

`handleSubmit` is an `async` function defined in a Server Component and passed as a prop to `<ProductForm>` (a Client Component). Without the `'use server'` directive, Next.js cannot serialize this function and throws at runtime:

> `"Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'."`

Additionally, `fetch('/api/admin/products')` uses a relative URL inside server-side code — server components cannot resolve relative URLs (there is no `window.location` context).

**Fix Option A:** Add `'use server'` to `handleSubmit` and use an absolute URL:
```ts
async function handleSubmit(data: ProductFormData) {
  'use server';
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/products`, { ... });
  redirect('/admin/products');
}
```

**Fix Option B (cleaner):** Convert to a Route Handler approach and have `ProductForm` call the API client-side with `fetch`, then redirect via `useRouter`.

---

## BUG 02 — CRITICAL: Admin order search and status filter are completely broken
**File:** `app/(admin)/admin/orders/page.tsx`  
**Approx lines:** ~24–43

The page uses raw `sql` template tags for filtering and passes them to `db.query.orders.findMany()`:
```ts
const whereClause = sql`
  ${statusFilter ? sql`${orders.status} = ${statusFilter}` : sql`true`}
  AND ${searchQuery ? sql`...` : sql`true`}
`;
db.query.orders.findMany({ where: whereClause });
```

`db.query.findMany()` expects a **Drizzle operator expression** (e.g. `and(eq(...), ilike(...))`) — not a raw `sql` fragment. This silently fails or throws a Drizzle type error. Search and filter both return wrong results.

**Fix:** Use Drizzle operators:
```ts
import { and, eq, ilike, or } from 'drizzle-orm';

const conditions = [];
if (statusFilter) conditions.push(eq(orders.status, statusFilter));
if (searchQuery) {
  conditions.push(or(
    ilike(orders.orderNumber, `%${searchQuery}%`),
    ilike(orders.guestEmail, `%${searchQuery}%`),
  ));
}
const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
```

---

## BUG 03 — HIGH: Admin dashboard System Health card always shows "Ada Masalah" (red)
**File:** `app/api/admin/dashboard/kpis/route.ts`  
**Approx lines:** ~110–121

The `getKpis()` function never returns a `systemHealth` field. The dashboard page checks:
```ts
kpis?.systemHealth?.status === 'operational'
```
This is always `undefined → false`, so `isSystemHealthy` is always `false`. The System Health indicator permanently shows red "Ada Masalah" even when everything is running fine.

**Fix:** Add a system health check to the KPIs route response:
```ts
return success({
  revenueToday,
  ordersToday,
  // ...other fields...
  systemHealth: {
    status: 'operational',  // or derive from DB/service checks
    message: 'All systems normal',
  },
});
```

---

## BUG 04 — HIGH: Customers list shows all user roles but count only shows customers
**File:** `app/api/admin/customers/route.ts`  
**Approx lines:** ~36–52

When no filters are applied, `whereClause` is `undefined` and `findMany` returns ALL users (superadmin, owner, warehouse, b2b, customer). But the count query falls back to `eq(users.role, 'customer')` — counting only customers. The table header says "X pelanggan" while the table rows include warehouse staff and admins.

**Fix:** Always filter to non-admin roles in both queries:
```ts
const baseFilter = inArray(users.role, ['customer', 'b2b']);
const whereClause = and(baseFilter, ...additionalFilters);
```

---

## BUG 05 — HIGH: Customer detail page shows order history where points history should be
**File:** `app/(admin)/admin/customers/[id]/page.tsx`  
**Approx lines:** ~257–295

The first `<h2>Riwayat Poin</h2>` card at line ~257 renders `customer.orders` with columns "Order", "Status", "Total", "Tanggal". This is a copy-paste error — it renders order data under the points history heading. The actual points history section starts at ~line 299.

**Fix:** Delete the duplicate block at lines ~257–297 entirely. The correct points history is already rendered below it.

---

## BUG 06 — HIGH: Settings page calls non-existent API — `readOnly` always false
**File:** `app/(admin)/admin/settings/page.tsx`  
**Approx line:** ~45

```ts
fetch('/api/admin/session'),
```

There is no `app/api/admin/session/route.ts`. The fetch returns 404, the error is silently caught, `userRole` stays `null`, and `readOnly` stays `false`. Owner-role users can edit settings they shouldn't be able to.

**Fix:** Replace the custom endpoint with the standard NextAuth session:
```ts
fetch('/api/auth/session'),
// then read: json.user?.role
```
Or use `useSession()` from `next-auth/react` directly in the client component.

---

## BUG 07 — HIGH: Admin order status route: warehouse bypasses transition guard for pickup orders
**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Approx lines:** ~86–98

The warehouse role validation check is inside an `else if` that is unreachable for pickup orders:
```ts
if (order.deliveryMethod === 'pickup') {
  // ... pickup-specific validation, early returns
} else if (role === 'warehouse' && !WAREHOUSE_TRANSITIONS.includes(newStatus)) {
  // ← this never runs for pickup orders
}
```

Warehouse staff can freely transition pickup orders to any status, bypassing the allowed transitions list.

**Fix:** Move the warehouse role check above the delivery method check:
```ts
if (role === 'warehouse' && !WAREHOUSE_TRANSITIONS.includes(newStatus)) {
  return forbidden('Warehouse staff cannot perform this status change');
}
// then pickup-specific logic
```

---

## BUG 08 — MEDIUM: Orders `[id]` page: status timeline current step never shows red/active
**File:** `app/(admin)/admin/orders/[id]/page.tsx`  
**Approx lines:** ~244–249

```ts
const isCompleted = idx < currentStepIdx || order.status === step;
const isCurrent = order.status === step;
// color: isCompleted ? green : isCurrent ? red : gray
```

When `isCurrent` is `true`, `isCompleted` is also `true` (because `order.status === step` is in its definition). The ternary evaluates `isCompleted` first and picks green. The active step is indistinguishable from completed steps.

**Fix:**
```ts
const isCompleted = idx < currentStepIdx;
const isCurrent = order.status === step;
// color: isCurrent ? 'ring-blue-500' : isCompleted ? 'bg-green-500' : 'bg-gray-200'
```

---

## BUG 09 — MEDIUM: Orders `[id]` page: existing `trackingUrl` not restored on page load
**File:** `app/(admin)/admin/orders/[id]/page.tsx`  
**Approx lines:** ~108–136

When loading an existing order, only `trackingNumber` is set into state. `order.trackingUrl` is never set into the `trackingUrl` state variable. If an admin re-opens an order that already has a tracking URL and saves without re-entering the URL, the field is cleared.

**Fix:** Add to the initialization effect:
```ts
setTrackingUrl(order.trackingUrl ?? '');
```

---

## BUG 10 — MEDIUM: Orders `[id]` page fetches session via raw fetch instead of `useSession()`
**File:** `app/(admin)/admin/orders/[id]/page.tsx`  
**Approx lines:** ~126–135

```ts
fetch('/api/auth/session')
```

This is a redundant round-trip that may return incomplete user data. The component already runs inside a protected admin layout that has session context.

**Fix:** Import `useSession` from `next-auth/react` and use that instead.

---

## BUG 11 — MEDIUM: Products list shows raw category UUID instead of category name
**File:** `app/(admin)/admin/products/page.tsx`  
**Approx line:** ~75

```tsx
{product.categoryId ?? '-'}
```

The query includes `variants` and `images` relations but not `category`. The "Kategori" column shows a UUID string.

**Fix:** Add `category: true` to the `with` clause in the query, then render `product.category?.nameId ?? '-'`.

---

## BUG 12 — MEDIUM: Points cancellation uses wrong `type` — stored as `'expire'` instead of `'adjust'`
**Files:**  
- `app/api/admin/orders/[id]/status/route.ts` ~line 179  
- `app/api/cron/cancel-expired-orders/route.ts` ~line 117  
- `app/api/webhooks/midtrans/route.ts` (in cancel handler)

All three insert points history records with `type: 'expire'` and a negative or reversed `pointsAmount` when an order is cancelled and points are returned to the user. "Expire" means points were lost — the opposite of what happened.

**Fix:** Use `type: 'adjust'` with a **positive** `pointsAmount` equal to `order.pointsUsed`. Display label in the customer portal will then correctly show "Penyesuaian" or "Refund" instead of "Kadaluarsa".

---

## BUG 13 — MEDIUM: Points `pointsBalanceAfter` double-adds `pointsUsed` in cancellation
**Files:**  
- `app/api/cron/cancel-expired-orders/route.ts` ~line 119  
- `app/api/admin/orders/[id]/status/route.ts` ~line 181

Pattern in both files:
```ts
// Step 1: update users table
await tx.update(users).set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` });
// Now DB has: correct_balance

// Step 2: insert history with:
pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`
// ← reads the ALREADY-UPDATED balance and adds pointsUsed AGAIN
// Stored value: correct_balance + pointsUsed (inflated by full amount)
```

**Fix:** Capture the returned balance from the update and use it:
```ts
const [updatedUser] = await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
  .where(eq(users.id, order.userId))
  .returning({ pointsBalance: users.pointsBalance });

// Then:
pointsBalanceAfter: updatedUser.pointsBalance  // ← correct
```

---

## BUG 14 — MEDIUM: Admin orders dropdown (status change) doesn't close on outside click
**File:** `app/(admin)/admin/orders/OrdersClient.tsx`  
**Approx lines:** ~73, ~236–258

`openDropdown` state is set per-row but there is no `click-outside` handler. Once opened, the dropdown can only be closed by clicking a transition button or the same row's toggle button. Clicking anywhere else on the page leaves it open.

**Fix:** Add a `useEffect` with a `document.addEventListener('click', closeDropdown)`:
```ts
useEffect(() => {
  const handler = () => setOpenDropdown(null);
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}, []);
```

---

## BUG 15 — MEDIUM: Dashboard "Detail" link in Live Feed goes to wrong URL
**File:** `app/(admin)/admin/dashboard/page.tsx`  
**Approx line:** ~602

```tsx
href={`/admin/orders?id=${order.id}`}
```

This links to the orders list with an `?id=` param that the list page ignores. Should be:
```tsx
href={`/admin/orders/${order.id}`}
```

---

## BUG 16 — MEDIUM: Customer detail API response exposes `passwordHash`
**File:** `app/api/admin/customers/[id]/route.ts`  
**Approx lines:** ~58–63

```ts
return success({ ...user, orders: userOrders, ... })
```

`db.query.users.findFirst()` returns the full user record including `passwordHash`. This is sent to the browser and rendered in the React component.

**Fix:** Use column selection to exclude sensitive fields:
```ts
const user = await db.query.users.findFirst({
  columns: {
    passwordHash: false,  // exclude
  },
  ...
});
```

---

## BUG 17 — MEDIUM: Customer detail: `ph.note` field doesn't exist in schema
**File:** `app/(admin)/admin/customers/[id]/page.tsx`  
**Approx line:** ~329

```tsx
{ph.note ?? '-'}
```

The `pointsHistory` schema has `descriptionId` and `descriptionEn` columns, not `note`. The Catatan column always shows `-`.

**Fix:**
```tsx
{ph.descriptionId ?? ph.descriptionEn ?? '-'}
```

---

## BUG 18 — MEDIUM: Shipments page: tracking input shown for `processing`/`shipped` orders but API rejects them
**File:** `components/admin/shipments/ShipmentsClient.tsx` (or similar)  
**Approx line:** ~124

The "Input Resi" form is rendered for orders in `processing`, `packed`, AND `shipped` states. But the PATCH endpoint only accepts orders in `packed` status. Submitting for other states fails silently (toast error only).

**Fix:** Restrict the input form to `packed` orders only:
```tsx
{order.status === 'packed' && <TrackingInput ... />}
```

---

## BUG 19 — LOW: Admin users list: `UserX` icon used for both activate and deactivate actions
**File:** `app/(admin)/admin/users/page.tsx`  
**Approx lines:** ~250–258

The action button always shows `<UserX />` (deactivate icon) regardless of `user.isActive`. Color changes, but icon does not. Users cannot visually distinguish "click to deactivate" from "click to activate".

**Fix:** Conditionally render the icon:
```tsx
{user.isActive ? <UserX className="text-red-500" /> : <UserCheck className="text-green-500" />}
```

---

## BUG 20 — LOW: Admin orders page: duplicate "Pesanan" heading
**File:** `app/(admin)/admin/orders/page.tsx` + `OrdersClient.tsx`

`page.tsx` renders `<h1>Pesanan</h1>` AND `<OrdersClient>` which also renders `<h1>Pesanan</h1>`. Two headings are stacked on the page.

**Fix:** Remove the `<h1>` from `page.tsx` and let `OrdersClient` own the heading, or remove it from `OrdersClient`.

---

## BUG 21 — LOW: `funnelFilter` state declared but never wired to UI or data
**File:** `app/(admin)/admin/dashboard/page.tsx`  
**Approx line:** ~164

```ts
const [funnelFilter] = useState('all');
```

No setter is exposed to the UI, and the value is never used to filter funnel data. The funnel always shows all statuses. Either implement the filter UI or remove the dead state variable.
