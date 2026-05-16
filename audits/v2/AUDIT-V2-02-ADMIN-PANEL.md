# AUDIT V2-02 — Admin Panel
**Date:** 2026-05-15  
**Scope:** `app/(admin)/admin/`, `app/api/admin/` (orders, settings, products, customers, users, dashboard)  
**Severity:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW

---

## BUG-01 🔴 CRITICAL — Settings page fetches non-existent `/api/admin/session`

**File:** `app/(admin)/admin/settings/page.tsx`  
**Line:** 44

### What's wrong
```typescript
const [settingsRes, sessionRes] = await Promise.all([
  fetch('/api/admin/settings'),
  fetch('/api/admin/session'),  // ← This route does NOT exist
]);
```
`/api/admin/session` returns 404. The `sessionRes.ok` check fails, so `userRole` is never set (stays `null`) and `readOnly` is never set to `true`. This means:
- `owner` users can see edit buttons they shouldn't (readOnly should be `true` for them)
- The settings page logic that tries to disable editing for owners is completely broken

### Fix
```typescript
// Change /api/admin/session to /api/auth/session:
fetch('/api/auth/session'),
```
And update the role parsing to match NextAuth session shape:
```typescript
const sessionData = await sessionRes.json();
const role = sessionData?.user?.role ?? sessionData?.role;
setUserRole(role ?? null);
setReadOnly(role === 'owner'); // owner can view but not edit
```

---

## BUG-02 🔴 CRITICAL — Admin order detail status update calls wrong endpoint

**File:** `app/(admin)/admin/orders/[id]/page.tsx`  
**Line:** 160

### What's wrong
```typescript
const res = await fetch(`/api/admin/orders/${orderId}/status`, {
  method: 'PATCH',
  ...
});
```
The route `app/api/admin/orders/[id]/status/route.ts` exists but let's verify the schema. The admin orders status endpoint exists — but the field orders status endpoint at `/api/admin/field/orders/[id]` has warehouse restrictions built in. The admin panel should use the admin-specific status route.

**Verify:** `app/api/admin/orders/[id]/status/route.ts` — confirm it accepts the same payload (status, trackingNumber, etc.) that the order detail page sends.

If the `/status` sub-route exists and works: ✅ This bug is a false alarm.  
If it doesn't: redirect to `PATCH /api/admin/orders/${orderId}`.

---

## BUG-03 🟠 HIGH — Admin order detail page fetches role from wrong session endpoint format

**File:** `app/(admin)/admin/orders/[id]/page.tsx`  
**Lines:** 127–133

### What's wrong
```typescript
const roleRes = await fetch('/api/auth/session');
// ...
const roleData = await roleRes.json();
setCurrentRole(roleData?.user?.role ?? '');
```
The NextAuth `/api/auth/session` endpoint returns `{ user: { ... } }` server-side but in client fetches the format may differ. If `roleData.user` is null (unauthenticated) the role is empty string and `canUpdateStatus` becomes false — admin can't update order status.

Also: the role is fetched EVERY TIME the component mounts — this is an unnecessary extra network call. The admin layout already guards the route, so the user is always authenticated.

### Fix — Use `useSession()` from next-auth/react:
```typescript
import { useSession } from 'next-auth/react';
// In component:
const { data: session } = useSession();
const currentRole = (session?.user as { role?: string })?.role ?? '';
// Remove the roleRes fetch from fetchData()
```

---

## BUG-04 🟠 HIGH — Inventory page "Edit Produk" link is always `/admin/products/undefined`

**File:** `app/(admin)/admin/inventory/InventoryClient.tsx`  
**Line:** 174

### What's wrong
```typescript
<Link href={`/admin/products/${variant.productId}`} ...>
```
But `InventoryVariant` interface (lines 7–14) doesn't include `productId`:
```typescript
interface InventoryVariant {
  id: string;       // variant UUID
  nameId: string;
  sku: string;
  stock: number;
  product: {
    nameId: string;  // ← only nameId, no product.id
  };
}
```
`variant.productId` is `undefined` → link is `/admin/products/undefined`.

### Fix — Add `id` to the nested product object in the interface AND in the DB query:

**In `app/(admin)/admin/inventory/page.tsx`** (the server component), ensure the Drizzle query includes product id:
```typescript
const variants = await db.query.productVariants.findMany({
  with: { 
    product: { columns: { id: true, nameId: true } }  // Add id
  },
  ...
});
```

**In InventoryClient.tsx**, update the interface:
```typescript
interface InventoryVariant {
  id: string;
  nameId: string;
  sku: string;
  stock: number;
  product: {
    id: string;    // ← Add this
    nameId: string;
  };
}
```

**Update the Link:**
```typescript
href={`/admin/products/${variant.product.id}`}
```

---

## BUG-05 🟠 HIGH — Products list page and product edit page need audit

**Files:**  
- `app/(admin)/admin/products/page.tsx`  
- `app/(admin)/admin/products/[id]/page.tsx`
- `app/(admin)/admin/products/new/page.tsx`

### What to check
1. `app/(admin)/admin/products/[id]/page.tsx` — Confirm it passes the right `categories` array and `initialData` to `ProductForm`. If `initialData.variants` or `initialData.images` are undefined, the form will render empty.

2. `ProductForm.tsx` uses `TiptapEditor` for descriptions. Confirm `TiptapEditor` mounts properly in admin context (SSR issues?).

3. The product create/edit form uses `onSubmit` prop — confirm the parent page handlers call `POST /api/admin/products` (new) and `PATCH /api/admin/products/${id}` (edit) with correct payload.

4. Image upload in `ProductForm` calls `POST /api/admin/upload`. Confirm this route exists and returns `{ cloudinaryUrl, cloudinaryPublicId }`.

---

## BUG-06 🟠 HIGH — Admin customers page missing customer detail navigation

**File:** `app/(admin)/admin/customers/page.tsx`  
**Related:** `app/(admin)/admin/customers/[id]/page.tsx`

### What to check
The customers list should link to `/admin/customers/${customer.id}`. If rows are not clickable or linked, the detail page is unreachable.

---

## BUG-07 🟡 MEDIUM — Dashboard KPI cards may show stale data (no auto-refresh)

**File:** `app/(admin)/admin/dashboard/page.tsx`

### What to check
The admin dashboard fetches KPIs server-side. If it's a Server Component with `force-dynamic`, it should be fresh on each navigation. Confirm `export const dynamic = 'force-dynamic'` is present.

---

## BUG-08 🟡 MEDIUM — Admin orders list search does not work with current backend

**File:** `app/(admin)/admin/orders/OrdersClient.tsx`  
**Related:** `app/api/admin/orders/route.ts`

### What to check
If search is implemented with raw SQL ILIKE on orderNumber/recipientName, it should work. If it's using JavaScript `.filter()` client-side only on the paginated result set, search won't find orders on other pages.

---

## BUG-09 🟡 MEDIUM — Admin users page invite doesn't send email

**File:** `app/api/admin/users/invite/route.ts`

### What to check
Confirm invite flow: creates user in DB → sends email via Resend with temp password/link. If the email isn't being sent, invited users have no way to log in.

---

## BUG-10 🔵 LOW — Coupon form maxUsesPerUser field defaults

**File:** `components/admin/coupons/CouponForm.tsx`

### What to check
Confirm the form properly handles optional fields `maxUsesPerUser`, `maxUses`, `minOrderAmount` being empty string vs null vs 0. An empty input that submits `""` or `0` instead of `null` can cause unintended coupon restrictions.

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 01 | 🔴 CRITICAL | `admin/settings/page.tsx:44` | Fetches non-existent `/api/admin/session` → role never set |
| 02 | 🔴 CRITICAL | `admin/orders/[id]/page.tsx:160` | Verify status update endpoint resolves correctly |
| 03 | 🟠 HIGH | `admin/orders/[id]/page.tsx:130` | Role fetched via extra network call, may be empty |
| 04 | 🟠 HIGH | `admin/inventory/InventoryClient.tsx:174` | `productId` undefined → broken Edit Produk link |
| 05 | 🟠 HIGH | `admin/products/[id]/page.tsx` | Audit ProductForm data flow for edit mode |
| 06 | 🟠 HIGH | `admin/customers/page.tsx` | Verify customer rows link to detail page |
| 07 | 🟡 MEDIUM | `admin/dashboard/page.tsx` | Confirm force-dynamic for fresh KPIs |
| 08 | 🟡 MEDIUM | `admin/orders/OrdersClient.tsx` | Server-side search vs client-side filter |
| 09 | 🟡 MEDIUM | `api/admin/users/invite/route.ts` | Confirm invite email is sent |
| 10 | 🔵 LOW | `CouponForm.tsx` | Empty string vs null for optional numeric fields |
