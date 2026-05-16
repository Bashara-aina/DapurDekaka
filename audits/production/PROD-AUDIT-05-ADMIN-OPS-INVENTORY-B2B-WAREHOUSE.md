# PROD-AUDIT-05: Admin Ops, Inventory, B2B & Warehouse
**Status: NOT PRODUCTION READY — 5 critical, 9 high severity**
**Focus: Admin panel, inventory management, B2B portal, warehouse field operations, settings**

---

## BUG-01 [CRITICAL] Inventory PATCH does absolute stock overwrite — concurrent edits corrupt stock

**File:** `app/api/admin/field/inventory/route.ts` PATCH ~line 78–93

**Problem:**
```typescript
// Two warehouse users open inventory page simultaneously, both see stock = 50
// User A sets stock = 45 (sold 5)
// User B sets stock = 48 (sold 2)
// Both send PATCH with absolute values
// Result: stock = 48 (User A's change is silently discarded — 5 units "reappear")
db.update(productVariants).set({ stock: newStock })  // ← absolute overwrite
```
This is the same class of bug as a lost update. Any concurrent edit from two warehouse users results in incorrect stock levels.

**Fix:** Convert the `InventoryClient.tsx` stock editing UI to use a **delta (adjustment)** approach rather than setting an absolute value:

```typescript
// In PATCH handler — accept delta, not absolute:
const { variantId, delta } = await req.json();
// delta = +5 (restock) or -3 (manual deduction)

const [updated] = await db
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock + ${delta}, 0)` })
  .where(eq(productVariants.id, variantId))
  .returning({ stock: productVariants.stock });

// Log the adjustment:
await db.insert(inventoryLogs).values({
  variantId,
  quantityBefore: updated.stock - delta,  // approximate for logging
  quantityAfter: updated.stock,
  quantityDelta: updated.stock - (updated.stock - delta),  // actual delta
  reason: reason || 'Manual adjustment',
  changedBy: session.user.id,
});
```

**Update `InventoryClient.tsx`:** Replace the "set stock to X" input with an "adjust by ±N" input:
```tsx
// Instead of: <Input value={newStockValue} onChange={...} />
// Use:
<div className="flex gap-2">
  <Button onClick={() => handleAdjust(variantId, -1)}>-1</Button>
  <Input value={adjustmentAmount} onChange={...} placeholder="±" />
  <Button onClick={() => handleAdjust(variantId, +adjustmentAmount)}>Apply</Button>
</div>
```

---

## BUG-02 [CRITICAL] Inventory adjust logs incorrect delta when clamped to zero

**File:** `app/api/admin/field/inventory/adjust/route.ts` ~line 45–57

**Problem:**
```typescript
const quantityAfter = Math.max(0, quantityBefore + delta);  // clamped

await db.insert(inventoryLogs).values({
  quantityBefore,
  quantityAfter,
  quantityDelta: delta,  // ← WRONG: uses unclamped delta
});
```
If `quantityBefore = 10` and `delta = -100`, `quantityAfter = 0`. But the log records `quantityDelta = -100`. The actual change was -10. The audit log is permanently incorrect.

**Fix:**
```typescript
const quantityAfter = Math.max(0, quantityBefore + delta);
const actualDelta = quantityAfter - quantityBefore;  // ← actual change

await db.insert(inventoryLogs).values({
  quantityBefore,
  quantityAfter,
  quantityDelta: actualDelta,  // ← correct
  note: actualDelta !== delta
    ? `Requested ${delta}, applied ${actualDelta} (limited by available stock)`
    : undefined,
});
```

---

## BUG-03 [CRITICAL] B2B user with no profile sees ALL quotes — data leak

**File:** `app/api/b2b/quotes/route.ts` GET ~line 128–135

**Problem:**
```typescript
let whereClause;

if (role === 'b2b') {
  const profile = await db.query.b2bProfiles.findFirst({ where: eq(b2bProfiles.userId, userId) });
  if (profile) {
    whereClause = eq(b2bQuotes.b2bProfileId, profile.id);
  }
  // ← if profile is null, whereClause stays undefined
}

const quotes = await db.query.b2bQuotes.findMany({ where: whereClause });
// ← if whereClause is undefined, returns ALL quotes from ALL B2B customers
```
A B2B user who has not yet been approved (no profile record) can see every other B2B customer's quotes including their prices and order volumes.

**Fix:**
```typescript
if (role === 'b2b') {
  const profile = await db.query.b2bProfiles.findFirst({ ... });
  if (!profile) {
    return NextResponse.json({ quotes: [] });  // ← return empty, don't leak data
  }
  whereClause = eq(b2bQuotes.b2bProfileId, profile.id);
}
```

---

## BUG-04 [CRITICAL] B2B inquiries page is entirely non-functional — no status update UI or API

**File:** `app/(admin)/admin/b2b-inquiries/page.tsx`
**File:** `app/api/admin/b2b-inquiries/[id]/route.ts` (PATCH method missing or unused)

**Problem:** The page renders a read-only table of inquiries with status badges. There are no action buttons, no forms, and no API route for updating inquiry status. An inquiry can never be moved from `new` to `contacted`, `converted`, or `rejected` through the UI. This is a completely non-functional feature.

**Fix — Add PATCH endpoint:**
```typescript
// app/api/admin/b2b-inquiries/[id]/route.ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin(req, ['owner', 'superadmin', 'admin']);
  const { status, note } = await req.json();

  const validStatuses = ['new', 'contacted', 'converted', 'rejected'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const [updated] = await db
    .update(b2bInquiries)
    .set({ status, adminNote: note, updatedAt: new Date() })
    .where(eq(b2bInquiries.id, params.id))
    .returning();

  await logAudit({ action: 'b2b_inquiry_status_update', adminId: session.user.id, targetId: params.id, data: { status } });

  return NextResponse.json({ inquiry: updated });
}
```

**Fix — Add action UI to the page:**
Add a dropdown or action buttons on each inquiry row:
```tsx
<Select
  value={inquiry.status}
  onValueChange={(newStatus) => handleUpdateStatus(inquiry.id, newStatus)}
>
  <SelectItem value="new">Baru</SelectItem>
  <SelectItem value="contacted">Dihubungi</SelectItem>
  <SelectItem value="converted">Konversi</SelectItem>
  <SelectItem value="rejected">Ditolak</SelectItem>
</Select>
```

---

## BUG-05 [CRITICAL] Admin order creation never inserts `orderItems` — orders have no items

**File:** `app/api/admin/orders/route.ts` POST ~line 173–203
*(Cross-reference with PROD-AUDIT-01 BUG-05 for full fix)*

**Problem:** The POST handler validates the `items` array in its Zod schema but never inserts into `order_items`. Every admin-created order has no line items. This causes order detail pages to crash (accessing empty `order.items`), makes invoices empty, and breaks inventory.

**Fix:** See PROD-AUDIT-01 BUG-05 for complete fix including stock decrement and status history.

---

## BUG-06 [HIGH] Admin order search parameter is parsed but never applied

**File:** `app/api/admin/orders/route.ts` GET ~line 37, 61

**Problem:**
```typescript
const search = url.searchParams.get('search');  // ← read

// Later, in conditions array:
// ← `search` is NEVER used. The variable sits unused.
```
The admin orders list cannot be searched by order number or recipient name. The search input in the admin UI either does nothing or fires the API with a `search` param that is completely ignored.

**Fix:**
```typescript
if (search) {
  conditions.push(
    or(
      ilike(orders.orderNumber, `%${search}%`),
      ilike(orders.recipientName, `%${search}%`),
      ilike(orders.recipientPhone, `%${search}%`),
    )
  );
}
```

---

## BUG-07 [HIGH] `React.cache()` has no effect in Route Handlers — dashboard data never cached

**File:** `app/api/admin/dashboard/kpis/route.ts` ~line 9, 155
**File:** `app/api/admin/dashboard/alerts/route.ts`

**Problem:** `React.cache()` is imported and used to wrap the KPI query function. React's `cache()` is designed for Server Component request deduplication (within a single render pass). In Route Handlers (`export async function GET`), it has zero effect — every request hits the database fresh, and the `cache()` wrapper does nothing.

**Fix:** Use Next.js `unstable_cache` for actual route handler caching:
```typescript
import { unstable_cache } from 'next/cache';

const getCachedKpis = unstable_cache(
  async () => {
    // ... existing KPI query logic
  },
  ['admin-dashboard-kpis'],
  { revalidate: 60 }  // ← cache for 60 seconds
);

export async function GET(req: Request) {
  await requireAdmin(req, ['owner', 'superadmin', 'admin']);
  const kpis = await getCachedKpis();
  return NextResponse.json(kpis);
}
```

---

## BUG-08 [HIGH] B2B quote number generation is non-atomic — concurrent inserts get same number

**File:** `app/api/b2b/quotes/route.ts` POST ~line 59–67

**Problem:**
```typescript
// Current: count all quotes ever created
const { count: quoteCount } = await db.select({ count: count() }).from(b2bQuotes);
const quoteNumber = `BBQ-${dateStr}-${quoteCount + 1}`;
```
Under concurrent POST requests (e.g. admin creates two quotes simultaneously), both read `count = 10` and both generate `BBQ-20260516-11`. The DB will either accept both (duplicate quote numbers) or reject one with a unique constraint error.

**Fix:** Use the `orderDailyCounters` pattern (or a dedicated `b2bQuoteCounters` table):
```typescript
// Use a DB sequence or counter table:
const [counter] = await tx
  .insert(quoteCounters)
  .values({ date: dateStr, count: 1 })
  .onConflictDoUpdate({
    target: quoteCounters.date,
    set: { count: sql`quote_counters.count + 1` },
  })
  .returning({ count: quoteCounters.count });

const quoteNumber = `BBQ-${dateStr}-${String(counter.count).padStart(4, '0')}`;
```

---

## BUG-09 [HIGH] B2B quote detail page has no auth check — anyone with the URL can view quote

**File:** `app/(admin)/admin/b2b-quotes/[id]/page.tsx` ~line 12–31

**Problem:** The Server Component calls `getQuote(params.id)` which hits the database directly, without first verifying the user's session or role. If the admin layout middleware has a gap or is bypassed (e.g. direct API call, test environment), quote data including B2B profile, pricing, and order volumes is exposed.

**Fix:** Add auth check inside the page:
```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function B2BQuoteDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || !['owner', 'superadmin', 'admin'].includes(session.user.role)) {
    redirect('/admin');
  }

  const quote = await getQuote(params.id);
  if (!quote) notFound();

  return <B2BQuoteDetailClient quote={quote} />;
}
```

---

## BUG-10 [HIGH] Restock endpoint has no maximum quantity guard — typos create unlimited stock

**File:** `app/api/admin/field/inventory/restock/route.ts` ~line 11

**Problem:**
```typescript
z.number().int().min(1)  // ← no maximum
```
A warehouse user accidentally typing `99999` instead of `99` will set stock to a massive number. Same issue in the adjust route. No warning, no confirmation dialog required by the API.

**Fix:**
```typescript
const schema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10000, 'Jumlah maksimum restock adalah 10.000 unit'),
  reason: z.string().optional(),
});
```
Also add a client-side confirmation dialog for quantities > 1000:
```tsx
if (quantity > 1000) {
  const confirmed = confirm(`Anda akan menambah ${quantity} unit. Yakin?`);
  if (!confirmed) return;
}
```

---

## BUG-11 [HIGH] Settings PATCH allows `owner` role — should be `superadmin` only

**File:** `app/api/admin/settings/route.ts` PATCH

**Problem:** Per the PRD, only `superadmin` can modify store settings (store name, contact info, payment credentials, etc.). The PATCH endpoint allows `owner` role as well, which violates the permission hierarchy.

**Fix:**
```typescript
// Current:
await requireAdmin(req, ['owner', 'superadmin']);

// Fixed:
await requireAdmin(req, ['superadmin']);  // ← superadmin only
```

---

## BUG-12 [HIGH] `pickup` orders never have `pickupCode` set — warehouse sees "N/A"

**File:** `app/api/checkout/initiate/route.ts` (order creation section)

**Problem:** `orders.pickupCode` is always `null` even for pickup orders. The warehouse field page and pickup queue show "N/A" for every pickup order's pickup code. Customers cannot be given a code to show at pickup.

**Fix:** Set `pickupCode` to the `orderNumber` (or a shorter hash) at order creation:
```typescript
const pickupCode = deliveryMethod === 'pickup'
  ? orderNumber  // or: orderNumber.split('-').pop() for a short code
  : null;

await tx.insert(orders).values({
  ...orderData,
  pickupCode,
});
```
If a dedicated shorter code is desired:
```typescript
const pickupCode = deliveryMethod === 'pickup'
  ? Math.random().toString(36).slice(2, 8).toUpperCase()  // e.g. "X7K2MN"
  : null;
```

---

## BUG-13 [HIGH] Warehouse role blocked from adjusting inventory via `/api/admin/field/inventory/adjust`

**File:** `app/api/admin/field/inventory/adjust/route.ts` ~line 15

**Problem:**
```typescript
await requireAdmin(req, ['owner', 'superadmin']);  // ← warehouse role excluded
```
The warehouse role needs to adjust inventory (mark items as damaged, record discrepancies during packing, etc.). The endpoint that serves the warehouse field inventory page requires `owner` or `superadmin`, locking out the warehouse staff entirely.

**Fix:**
```typescript
await requireAdmin(req, ['owner', 'superadmin', 'warehouse']);  // ← add warehouse
```

---

## BUG-14 [MEDIUM] Admin user invite sends token without creating a `passwordResetTokens` entry

**File:** `app/api/admin/users/invite/route.ts`

**Problem:** The invite flow may create a user account and email an invite link, but if it does not create a `passwordResetTokens` row, the invited user clicking the link will find an invalid/expired token and cannot set their password.

**Action required:** Verify the invite route:
1. Creates user with a random temporary password (hashed)
2. Creates a `passwordResetTokens` row with a 72-hour expiry
3. Emails the invite with a link to `/reset-password/[token]`
4. On password reset, the user's `emailVerified` is also set

---

## BUG-15 [MEDIUM] `orderDailyCounters` cleanup cron doesn't run — counter table grows unbounded

**File:** `app/api/cron/cleanup-counters/route.ts`

**Problem:** Verify this cron is scheduled in Vercel Cron and is actually configured to run. The `orderDailyCounters` table grows 1 row per day. After 1 year it has 365 rows, which is fine, but after 10 years (3650 rows) it will become a performance concern. More importantly, verify the cron does NOT delete the current day's counter or counters from the last 7 days (needed for order number uniqueness verification).

**Action required:** Add a delete for old rows:
```typescript
await db.delete(orderDailyCounters)
  .where(lt(orderDailyCounters.date, sql`CURRENT_DATE - INTERVAL '30 days'`));
```

---

## BUG-16 [MEDIUM] Admin order status transition `processing → paid` is allowed but should not be

**File:** `app/api/admin/orders/[id]/status/route.ts` (allowedTransitions map)

**Problem:** Verify the `allowedTransitions` map does not allow backward transitions (e.g. `shipped → paid`, `packed → paid`). These backward transitions would allow an admin to accidentally put an order in an inconsistent state. 

**Action required:** Audit the `allowedTransitions` map and ensure it only allows forward progressions:
```
pending_payment → paid (only via webhook/reconcile, not admin)
paid → processing → packed → shipped → delivered
any → cancelled (admin privilege)
```

---

## Verification checklist — Admin operations

- [ ] Admin order list search works (order number, recipient name)
- [ ] Admin order create includes items in `orderItems` table
- [ ] Admin order create uses atomic order number generation
- [ ] Admin cancellation reverses all side-effects (points, coupon, stock, history entry)
- [ ] Settings PATCH restricted to superadmin only
- [ ] B2B inquiry status can be updated from the admin UI
- [ ] B2B quote detail page has session/role check
- [ ] B2B quote number generation is atomic

## Verification checklist — Inventory

- [ ] Inventory edits use delta-based approach (not absolute overwrite)
- [ ] Inventory logs record actual delta (not unclamped delta)
- [ ] Warehouse role can call inventory adjust endpoint
- [ ] Restock has max quantity guard (10000)
- [ ] Inventory page shows current stock levels from real DB query

## Verification checklist — Warehouse/field operations

- [ ] Warehouse role restricted to `packed → shipped` only (not `packed → delivered`)
- [ ] Tracking number required before `shipped` transition (API + UI validation)
- [ ] `pickupCode` set at order creation for pickup orders
- [ ] Field order status updates and history writes are in a single transaction
- [ ] Packing queue handles `paid → processing → packed` with two history entries
- [ ] Pickup queue shows only pickup orders with correct pickup codes
- [ ] Worker activity endpoint uses `eq(users.id, uid)` (not `adminActivityLogs.userId`)
- [ ] Today-summary `packedToday` counts from `orderStatusHistory`, not from `orders.updatedAt`
