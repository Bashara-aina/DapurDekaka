# AUDIT V2-04 — Customer Account & B2B Portal
**Date:** 2026-05-15  
**Scope:** `app/(store)/account/`, `app/(b2b)/b2b/`, `app/api/account/`, `app/api/b2b/`  
**Severity:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW

---

## BUG-01 🔴 CRITICAL — Account orders page always shows empty state (uses table instead of query result)

**File:** `app/(store)/account/orders/page.tsx`  
**Lines:** 66, 87

### What's wrong
```typescript
import { orders } from '@/lib/db/schema';   // ← Drizzle table object
// ...
const ordersResult = await db.query.orders.findMany({ ... }); // ← array of fetched orders
// ...
{orders.length === 0 ? (   // ← Line 66: uses TABLE OBJECT not query result
```
`orders` is the Drizzle schema table definition (an object with column definitions, not an array). `orders.length` is `undefined`, which is falsy — so the condition `orders.length === 0` is always truthy.

**Result:** Every customer who visits `/account/orders` sees "Belum Ada Pesanan" even if they have 100 orders.

Line 87 would also crash if reached:
```typescript
{orders.map((order) => (  // ← Calls .map() on a Drizzle table object → TypeError
```

### Fix — Change `orders` references to `ordersResult`:

```typescript
// Line 66: Change
{orders.length === 0 ? (
// To:
{ordersResult.length === 0 ? (

// Line 87: Change
{orders.map((order) => (
// To:
{ordersResult.map((order) => (
```

Also verify the pagination renders correctly by checking `totalOrders` and `totalPages` calculations use `totalResult[0]?.total`.

---

## BUG-02 🔴 CRITICAL — Account overview page crashes (missing drizzle-orm imports)

**File:** `app/(store)/account/page.tsx`  
**Lines:** 1–10, 29–30

### What's wrong
The page uses `count()`, `eq()`, and the `orders` table from drizzle but **does not import them**:

```typescript
// Current imports (lines 1–5):
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, Gift, MapPin, ChevronRight, ShoppingBag } from 'lucide-react';

// But uses on line 29:
const [totalOrderCountResult] = await db.select({ count: count() }).from(orders)
  .where(eq(orders.userId, session.user.id!));
```

`count`, `eq`, and `orders` are all `undefined` at runtime → `ReferenceError: count is not defined` → page crashes with 500.

### Fix — Add missing imports:

```typescript
import { count, eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
```

---

## BUG-03 🟠 HIGH — B2B landing page shows "0 Varian" for all categories

**File:** `app/(b2b)/b2b/page.tsx`  
**Lines:** 36–60 (`getCategoryCounts` function)

### What's wrong
```typescript
const counts = await db
  .select({
    id: categories.id,
    nameId: categories.nameId,
    // ← NO count column selected!
  })
  .from(categories)
  .leftJoin(products, ...)
  .where(eq(categories.isActive, true))
  .groupBy(categories.id);

// Then line 57:
count: (c as unknown as { count: number }).count ?? 0,
// ← .count doesn't exist in the select → always undefined → always 0
```

Every category card shows "0 Varian" even when products exist.

### Fix — Add count to the SELECT:

```typescript
const counts = await db
  .select({
    id: categories.id,
    nameId: categories.nameId,
    count: sql<number>`count(${products.id})::int`,  // ← Add this
  })
  .from(categories)
  .leftJoin(
    products,
    and(
      eq(categories.id, products.categoryId),
      eq(products.isActive, true),
      eq(products.isB2bAvailable, true),
      isNull(products.deletedAt)
    )
  )
  .where(eq(categories.isActive, true))
  .groupBy(categories.id, categories.nameId);  // Group by nameId too

return counts.map(c => ({
  id: c.id,
  name: c.nameId,
  count: c.count ?? 0,
}));
```

---

## BUG-04 🟠 HIGH — B2B price teaser shows incorrect estimated price instead of actual b2bPrice

**File:** `app/(b2b)/b2b/page.tsx`  
**Lines:** 207–208

### What's wrong
```typescript
const retailPrice = product.variants[0]?.price ?? 0;
const b2bPrice = Math.round(retailPrice * 0.85);  // ← Hardcoded 15% discount estimate
```
The actual B2B price is stored in `variant.b2bPrice`. The teaser shows a fake calculation that doesn't match reality, which could mislead potential B2B customers.

### Fix — Use actual b2bPrice if available:

```typescript
const retailPrice = product.variants[0]?.price ?? 0;
const b2bPrice = product.variants[0]?.b2bPrice ?? Math.round(retailPrice * 0.85);
```
And add a note to the table if `b2bPrice` is null for all variants:
```typescript
<td className="py-2.5 px-3 text-right font-bold text-brand-red">
  {b2bPrice > 0 ? formatIDR(b2bPrice) : 'Hubungi kami'}
</td>
```

---

## BUG-05 🟠 HIGH — B2B account orders page likely has same import bug as customer orders

**File:** `app/(b2b)/b2b/account/orders/page.tsx`

### What to check
Open the file and verify:
1. Uses `ordersResult` (from `db.query.orders.findMany`) not `orders` (schema table) in conditions and `.map()` calls
2. Filters by `userId` correctly for B2B users
3. Shows B2B order items with B2B prices

---

## BUG-06 🟠 HIGH — Account profile page: phone number not pre-filled at checkout despite profileData fetch

**File:** `app/(store)/checkout/page.tsx`  
**Lines:** 136–144, 150–163

### What's wrong
Profile is fetched via `useQuery` to pre-fill phone:
```typescript
const { data: profileData } = useQuery({
  queryKey: ['account', 'profile'],
  queryFn: async () => { ... fetch('/api/account/profile') ... },
  enabled: !!session?.user,
});
```

But in the auto-skip effect:
```typescript
useEffect(() => {
  if (session?.user && step === 'identity') {
    updateForm({
      recipientName: session.user.name || '',
      recipientEmail: session.user.email || '',
      recipientPhone: profileData?.phone || '',  // ← may be '' if profile not loaded yet
    });
    setStep('delivery');
  }
}, [session?.user, profileData]);
```

If `profileData` is still loading when `session` arrives, `recipientPhone` is set to `''`. The `[session?.user, profileData]` dependency should re-run the effect when `profileData` finally loads. However, `step` has already been changed to `'delivery'` so the `step === 'identity'` guard blocks the second run.

**Result:** Phone number is never pre-filled at checkout for logged-in users.

### Fix — Decouple the phone pre-fill from the step-skip logic:

```typescript
// Separate effects:
useEffect(() => {
  if (session?.user && step === 'identity') {
    updateForm({
      recipientName: session.user.name || '',
      recipientEmail: session.user.email || '',
    });
    setStep('delivery');
  }
}, [session?.user]); // Only depends on session

useEffect(() => {
  if (profileData?.phone) {
    updateForm({ recipientPhone: profileData.phone });
  }
}, [profileData]); // Fires whenever profile loads, regardless of step
```

---

## BUG-07 🟡 MEDIUM — Account points page may show wrong calculation

**File:** `app/(store)/account/points/page.tsx`

### What to check
Confirm `pointsBalance * 10` IDR conversion matches `POINTS_VALUE_IDR` constant. If the constant changes, the account page must update too. Both should use the same constant.

In `checkout/success/page.tsx` line 62:
```typescript
{formatIDR(orderData.pointsEarned * 10)}
```
This hardcodes `* 10`. But `POINTS_VALUE_IDR` might be a different value. Always use the constant:
```typescript
import { POINTS_VALUE_IDR } from '@/lib/constants/points';
{formatIDR(orderData.pointsEarned * POINTS_VALUE_IDR)}
```

---

## BUG-08 🟡 MEDIUM — B2B quote form doesn't redirect to success state

**File:** `components/b2b/QuoteForm.tsx`  
**Related:** `app/api/b2b/inquiry/route.ts`

### What to check
After successful inquiry submission:
1. Does the form show a success message or redirect?
2. Does the API send auto-reply email to the B2B inquiry email?
3. Does the API send notification to admin/owner?

If emails aren't sent, admin will miss B2B inquiries.

---

## BUG-09 🟡 MEDIUM — Account addresses: no feedback when deleting default address

**File:** `components/store/account/AddressCard.tsx`

### What to check
If a user deletes their default address, the `isDefault` flag should be cleared and possibly reassigned to another address. Confirm `DELETE /api/account/addresses/${id}` handles this case.

---

## BUG-10 🔵 LOW — B2B products page doesn't show B2B-specific pricing

**File:** `app/(b2b)/b2b/products/page.tsx`

### What to check
When a logged-in B2B user (`role === 'b2b'`) views the B2B products page, they should see `variant.b2bPrice` instead of `variant.price`. Confirm the product listing shows the correct price for authenticated B2B users.

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 01 | 🔴 CRITICAL | `account/orders/page.tsx:66,87` | Uses schema table instead of query result — always empty |
| 02 | 🔴 CRITICAL | `account/page.tsx:29` | Missing drizzle-orm imports → ReferenceError crash |
| 03 | 🟠 HIGH | `b2b/page.tsx:57` | Category counts always 0 (count not in SELECT) |
| 04 | 🟠 HIGH | `b2b/page.tsx:208` | Hardcoded 85% price estimate instead of actual b2bPrice |
| 05 | 🟠 HIGH | `b2b/account/orders/page.tsx` | Verify same import bug as customer orders page |
| 06 | 🟠 HIGH | `checkout/page.tsx:155` | Phone not pre-filled (effect depends on both session+profile) |
| 07 | 🟡 MEDIUM | `account/points/page.tsx` | Hardcoded `* 10` — should use POINTS_VALUE_IDR constant |
| 08 | 🟡 MEDIUM | `b2b/QuoteForm.tsx` | Verify success state and email notifications |
| 09 | 🟡 MEDIUM | `AddressCard.tsx` | No handling when deleting default address |
| 10 | 🔵 LOW | `b2b/products/page.tsx` | B2B price not shown to logged-in B2B users |
