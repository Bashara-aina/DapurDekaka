# AUDIT-02 — Admin Panel & Operations
**Date:** 2026-05-16  
**Scope:** `app/(admin)/admin/`, `app/api/admin/`, admin order management, B2B admin, inventory, shipments  
**Severity legend:** 🔴 Critical · 🟠 High (broken feature) · 🟡 Medium · 🟢 Low

---

## BUG-01 🔴 B2B Inquiry status update silently 404s — PATCH endpoint missing

**Files:**  
- `app/(admin)/admin/b2b-inquiries/B2BInquiryStatusClient.tsx` — line 23  
- `app/api/admin/b2b-inquiries/route.ts` — entire file

**Root cause:**  
`B2BInquiryStatusClient.tsx` sends:
```ts
const res = await fetch(`/api/admin/b2b-inquiries/${inquiryId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: newStatus }),
});
```

But `app/api/admin/b2b-inquiries/route.ts` only exports `GET` (returns all inquiries). There is **no `[id]` route folder** and **no PATCH handler**. Every status change from the inquiry table silently returns a 404. The dropdown appears to work (local state updates via `setStatus(newStatus)`) but the change is never persisted to the database.

**Impact:** B2B inquiry status management is completely non-functional. All status changes are lost on page refresh.

**Fix — Step 1:** Create route file `app/api/admin/b2b-inquiries/[id]/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bInquiries, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, validationError, serverError, notFound, unauthorized, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

const patchSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'rejected']),
  internalNotes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) return forbidden('Anda tidak memiliki akses');

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const inquiry = await db.query.b2bInquiries.findFirst({ where: eq(b2bInquiries.id, id) });
    if (!inquiry) return notFound('Inquiry tidak ditemukan');

    const [updated] = await db
      .update(b2bInquiries)
      .set({
        status: parsed.data.status,
        ...(parsed.data.internalNotes !== undefined && { internalNotes: parsed.data.internalNotes }),
        handledBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(b2bInquiries.id, id))
      .returning();

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) return forbidden('Anda tidak memiliki akses');

    const { id } = await params;
    const inquiry = await db.query.b2bInquiries.findFirst({ where: eq(b2bInquiries.id, id) });
    if (!inquiry) return notFound('Inquiry tidak ditemukan');

    return success(inquiry);
  } catch (error) {
    return serverError(error);
  }
}
```

**Fix — Step 2:** Update `B2BInquiryStatusClient.tsx` to handle errors:

```ts
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  toast?.error(err.error || 'Gagal mengubah status');
  setStatus(currentStatus); // revert optimistic update
  return;
}
setStatus(newStatus);
router.refresh();
```

---

## BUG-02 🟠 Admin B2B quotes use `Math.random()` for quote number — collision risk

**File:** `app/api/admin/b2b-quotes/route.ts`  
**Lines:** 21–28

**Root cause:**  
```ts
function generateQuoteNumber(): string {
  const date = new Date();
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `DDK-B2B-${year}${month}${day}-${random}`;
}
```

This generates quote numbers non-atomically using `Math.random()`. Under load, two simultaneous requests could generate identical numbers. The `quoteNumber` column has a UNIQUE constraint, so this would throw a unique violation error — the admin gets a 500 instead of a success.

Compare to the **correct** implementation in `app/api/b2b/quotes/route.ts` (lines 59–81) which uses an atomic counter table (`b2bQuoteCounters`) with `ON CONFLICT DO UPDATE`.

**Fix:** Replace `generateQuoteNumber()` with the same counter-based approach used in `app/api/b2b/quotes/route.ts`:

```ts
// In app/api/admin/b2b-quotes/route.ts, POST handler, replace generateQuoteNumber():

import { b2bQuoteCounters } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

const quoteNumber = await db.transaction(async (tx) => {
  const result = await tx
    .insert(b2bQuoteCounters)
    .values({ date: dateStr, lastSequence: 1 })
    .onConflictDoUpdate({
      target: b2bQuoteCounters.date,
      set: {
        lastSequence: sql`${b2bQuoteCounters.lastSequence} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ newSequence: b2bQuoteCounters.lastSequence });

  const seq = result[0]?.newSequence ?? 1;
  return `BBQ-${dateStr}-${String(seq).padStart(4, '0')}`;
});
```

---

## BUG-03 🟠 Admin cancel order stores SQL expression in `pointsBalanceAfter` column

**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Lines:** 196–207

**Root cause:**
```ts
await tx.insert(pointsHistory).values({
  userId: order.userId,
  type: 'adjust',
  pointsAmount: order.pointsUsed,
  pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`,  // ← SQL expression, not integer
  ...
});
```

`pointsBalanceAfter` is an `integer` column in the schema. Passing a Drizzle `sql` template literal here will either fail silently or store an incorrect value. The issue is the same as AUDIT-01 BUG-08 but on the admin cancellation path.

**Fix:** Read the actual updated balance from the UPDATE's RETURNING clause:

```ts
const [updatedUser] = await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
  .where(eq(users.id, order.userId))
  .returning({ pointsBalance: users.pointsBalance });

const newBalance = updatedUser?.pointsBalance ?? 0;

await tx.insert(pointsHistory).values({
  userId: order.userId,
  type: 'adjust',
  pointsAmount: order.pointsUsed,
  pointsBalanceAfter: newBalance,  // actual integer
  descriptionId: `Pembatalan pesanan ${order.orderNumber} — poin dikembalikan`,
  descriptionEn: `Order ${order.orderNumber} cancelled — points returned`,
  orderId: orderId,
  expiresAt: null,
  isExpired: false,
});
```

Move the `users.update` call outside of its existing location and combine with the history insert, using RETURNING.

---

## BUG-04 🟠 Admin `points/adjust` API response returns stale (pre-transaction) balance

**File:** `app/api/admin/points/adjust/route.ts`  
**Lines:** 85–91

**Root cause:**
```ts
return success({
  userId,
  adjustedAmount,
  newBalance: (targetUser.pointsBalance ?? 0) + adjustedAmount,  // ← stale
  message: ...
});
```

`targetUser` is fetched BEFORE the transaction runs. The actual DB update uses `GREATEST(points_balance + adjustedAmount, 0)` which clamps at 0. If the admin deducts more than the user's balance, the real new balance is 0 — but the API response returns a negative number. The admin UI would show a negative balance until page reload.

**Fix:** Return the actual new balance from the transaction's RETURNING clause (already in `updatedUser.pointsBalance`):

```ts
// The transaction already returns updatedUser with the real balance:
await db.transaction(async (tx) => {
  const [updatedUser] = await tx
    .update(users)
    .set({ pointsBalance: sql`GREATEST(points_balance + ${adjustedAmount}, 0)`, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ pointsBalance: users.pointsBalance });

  const newBalance = updatedUser?.pointsBalance ?? 0;

  await tx.insert(pointsHistory).values({
    ...
    pointsBalanceAfter: newBalance,
  });
  
  // Return newBalance from here:
  return newBalance;
});

// Then in the response:
return success({
  userId,
  adjustedAmount,
  newBalance,  // from tx RETURNING
  message: ...,
});
```

---

## BUG-05 🟠 Owner role can invite other owners via `/api/admin/users/invite`

**File:** `app/api/admin/users/invite/route.ts`  
**Lines:** 27–29, 13–17

**Root cause:**
```ts
// Auth check allows both superadmin AND owner to call this endpoint:
if (!role || !['superadmin', 'owner'].includes(role)) {
  return forbidden('...');
}

// The schema allows owner role to be assigned:
const inviteSchema = z.object({
  role: z.enum(['warehouse', 'owner', 'b2b', 'customer']),
});
```

An **owner** can call this endpoint and create another **owner** account. Per PRD Section 2.2: "Only role that can create/edit/delete admin accounts: Superadmin."

**Fix — Option A (Recommended):** Restrict the endpoint to `superadmin` only:
```ts
if (!role || role !== 'superadmin') {
  return forbidden('Hanya superadmin yang dapat mengundang pengguna');
}
```

**Fix — Option B:** Keep owner access but restrict which roles they can assign:
```ts
const allowedRoles = role === 'superadmin'
  ? ['warehouse', 'owner', 'b2b', 'customer']
  : ['warehouse', 'b2b', 'customer'];  // owner cannot invite other owners

const inviteSchema = z.object({
  role: z.enum(allowedRoles as [string, ...string[]]),
});
```

---

## BUG-06 🟡 Packing queue (`field/packing-queue`) skips `processing` status — warehouse jumps `paid → packed`

**File:** `app/api/admin/field/packing-queue/route.ts`  
**Scope:** The PATCH handler marks orders as `packed` directly from `paid`

**Root cause:**  
The packing-queue field API allows warehouse to move an order from `paid → packed`, bypassing the `processing` step. The admin order status route enforces `VALID_TRANSITIONS` (paid → processing → packed), but the field API does not.

Meanwhile, the main admin status API restricts warehouse to ONLY `shipped`:
```ts
// admin/orders/[id]/status/route.ts:101
const WAREHOUSE_TRANSITIONS = ['shipped'];
if (role === 'warehouse' && !WAREHOUSE_TRANSITIONS.includes(newStatus)) {
  return forbidden('Warehouse hanya dapat mengubah status ke shipped');
}
```

This creates an inconsistency:
- Via field/packing-queue: warehouse can go `paid → packed` ✓
- Via admin route: warehouse CANNOT go `paid → packed` ✗
- Via admin route: warehouse CAN go `packed → shipped` ✓

**Decision needed:** Should the field API enforce the `processing` step? For a small operation like Dapur Dekaka, the answer is probably NO — warehouse packs immediately. The current field API behavior is actually the correct UX.

**Fix:** The field packing-queue PATCH handler should add a status history entry recording the skip from `paid` directly to `packed` (and optionally add a `processing` → `packed` transition in one step):

```ts
// In the packing-queue PATCH, after confirming order.status === 'paid':
await db.transaction(async (tx) => {
  await tx.update(orders)
    .set({ status: 'packed', updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await tx.insert(orderStatusHistory).values({
    orderId,
    fromStatus: 'paid',
    toStatus: 'packed',
    changedByUserId: session.user.id,
    changedByType: 'user',
    note: `Dikemas oleh ${session.user.name ?? 'warehouse'}`,
  });
});
```

Also update `VALID_TRANSITIONS` in the admin status route to allow `paid → packed` directly (or document this as intentional bypass via field API only).

---

## BUG-07 🟡 Shipments page and field tracking-queue show different order sets

**Files:**  
- `app/(admin)/admin/shipments/page.tsx` — admin view  
- `app/api/admin/field/tracking-queue/route.ts` — warehouse field API

**Root cause:**  
Admin shipments page (line 12–15 of page.tsx) filters:
```ts
where: and(
  isNull(orders.trackingNumber),        // ← no tracking yet
  eq(orders.deliveryMethod, 'delivery'),
  or(eq(orders.status, 'processing'), eq(orders.status, 'packed'))
)
```

Field tracking-queue API filters:
```ts
where: and(
  eq(orders.status, 'packed'),          // ← only packed, no trackingNumber filter
  eq(orders.deliveryMethod, 'delivery'),
)
```

Differences:
1. Admin shipments shows `processing` AND `packed` orders; field shows only `packed`
2. Admin shipments excludes orders that already have a tracking number; field does NOT exclude them (warehouse might see already-shipped orders)
3. Field tracking-queue can show already-shipped orders that still have `packed` status (edge case: if someone input a tracking number but status wasn't updated)

**Fix for field tracking-queue:** Add `isNull(orders.trackingNumber)` to exclude already-tracked orders:
```ts
const packedOrders = await db.query.orders.findMany({
  where: and(
    eq(orders.status, 'packed'),
    eq(orders.deliveryMethod, 'delivery'),
    isNull(orders.trackingNumber),  // add this
  ),
  ...
});
```

Import `isNull` from `drizzle-orm`.

---

## BUG-08 🟡 Admin orders page missing `recipientEmail` in serialized output

**File:** `app/(admin)/admin/orders/OrdersClient.tsx`  
**File:** `app/api/admin/orders/route.ts`

**Issue:**  
The admin orders API returns `items`, `user` (with id/name/email) but the `recipientEmail` and `recipientPhone` fields may not be serialized to the client component. When admin tries to send an email from the order detail view, these fields might be undefined.

**Verify:** Check that `app/api/admin/orders/route.ts` returns `recipientEmail` and `recipientPhone` in the orders list response. These are direct columns on the `orders` table and should be included in `findMany` by default, but confirm the `columns` selector isn't inadvertently excluding them.

---

## Summary Table

| Bug | File | Severity | Impact |
|-----|------|----------|--------|
| BUG-01 | `b2b-inquiries/[id]/route.ts` (missing) | 🔴 Critical | All B2B inquiry status changes lost |
| BUG-02 | `admin/b2b-quotes/route.ts:21` | 🟠 High | Quote number collisions on concurrent creates |
| BUG-03 | `admin/orders/[id]/status/route.ts:200` | 🟠 High | SQL expression stored in integer column |
| BUG-04 | `admin/points/adjust/route.ts:87` | 🟠 High | Stale balance in API response |
| BUG-05 | `admin/users/invite/route.ts:27` | 🟠 High | Owner can create owner accounts |
| BUG-06 | `field/packing-queue/route.ts` | 🟡 Medium | Inconsistent workflow step enforcement |
| BUG-07 | `field/tracking-queue/route.ts` | 🟡 Medium | Shows already-tracked orders to warehouse |
| BUG-08 | `admin/orders/route.ts` | 🟡 Medium | Verify email fields in list response |
