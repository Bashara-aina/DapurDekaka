# CURSOR AUDIT 05 — Security, Permissions & Infrastructure
**Project:** DapurDekaka.com  
**Date:** 2026-05-15  
**Scope:** Role-based access control, API security, cron jobs, DB integrity, environment configuration

---

## Overview

Several security issues exist where the implementation diverges from the PRD's role permission matrix. Additionally, the cron infrastructure has gaps that can leave the system in an inconsistent state. These are not theoretical — they affect real users and real money.

---

## SECURITY BUG 01 — Settings API Allows Owner to Modify Settings

**Severity:** Medium — PRD specifies owner cannot change settings (only view)  
**File:** `app/api/admin/settings/route.ts:PATCH:32-36`

### What's broken

The PATCH handler allows both `superadmin` AND `owner` to update system settings:

```ts
const role = (session.user as { role?: string }).role;
if (!role || !['superadmin', 'owner'].includes(role)) {
  return forbidden('Anda tidak memiliki akses untuk mengubah pengaturan');
}
```

**PRD Section 9.3 Role Matrix:**
- Owner: Cannot access settings (❌ on System settings row)
- Superadmin: Full access ✓

Owner should be able to GET (read) settings but not PATCH (modify) them.

### Fix

```ts
// app/api/admin/settings/route.ts

// GET — allow owner to read
export async function GET(req: NextRequest) {
  // ...
  if (!role || !['superadmin', 'owner'].includes(role)) {
    return forbidden('...');
  }
  // ...
}

// PATCH — superadmin only
export async function PATCH(req: NextRequest) {
  // ...
  if (!role || role !== 'superadmin') {   // ← changed: owner cannot write
    return forbidden('Hanya superadmin yang dapat mengubah pengaturan');
  }
  // ...
}
```

Also update the settings page frontend at `app/(admin)/admin/settings/page.tsx` to disable form inputs and hide the save button for owner role.

---

## SECURITY BUG 02 — Admin Cancellation Restores Stock Even for Already-Cancelled Orders

**Severity:** Medium — double stock restoration is possible via race condition  
**File:** `app/api/admin/orders/[id]/status/route.ts:148-170`

### What's broken

When admin cancels an order that was also cancelled by the Midtrans webhook (both happen near-simultaneously), stock gets restored TWICE:

1. Midtrans webhook fires: `status → cancelled`, stock +X restored
2. Admin clicks cancel (slight delay): order still passes `if (newStatus === 'cancelled')` check before the DB update propagates

The cancellation transaction:
```ts
// No guard checking if stock was already restored
for (const item of order.items) {
  await tx.update(productVariants)
    .set({ stock: sql`stock + ${item.quantity}` })  // ← no check
    .where(eq(productVariants.id, item.variantId))
}
```

### Fix

Add an idempotency guard — only restore stock when transitioning FROM a status that had stock deducted (`paid`, `processing`, `packed`, `shipped`). A `pending_payment` order never had stock deducted (stock deduction happens at webhook settlement), so cancelling it should NOT restore stock:

```ts
// app/api/admin/orders/[id]/status/route.ts — wrap stock restoration in condition:
if (newStatus === 'cancelled') {
  const statusesThatDeductedStock = ['paid', 'processing', 'packed', 'shipped', 'delivered'];
  
  if (statusesThatDeductedStock.includes(currentStatus)) {
    // Only restore stock if order was already paid (stock was deducted at settlement)
    for (const item of order.items) {
      // ... stock restoration code ...
    }
  }
  
  // Points/coupon reversal is always safe to do (idempotent)
  if (order.userId && order.pointsUsed > 0) {
    // ... points reversal ...
  }
}
```

---

## SECURITY BUG 03 — Order Tracking Page Exposes Full Order Before Email Verification

**Severity:** Low — minor information disclosure for orders with guessable order numbers  
**File:** `app/(store)/orders/[orderNumber]/page.tsx` and `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

### What's broken

The Server Component at `app/(store)/orders/[orderNumber]/page.tsx` fetches the full order server-side and passes `initialStatus` to the client. The client component then calls the API to get full details.

The API correctly implements email verification for unverified requests. However, the server component passes `initialStatus` directly from the DB without verification:

```ts
// app/(store)/orders/[orderNumber]/page.tsx:26-35
const order = await db.query.orders.findFirst({...});
if (!order) notFound();

return (
  <OrderTrackingClient
    orderNumber={orderNumber}
    initialStatus={order.status}  // ← unverified access to order data
  />
);
```

This only leaks order status, not PII. Low severity but worth fixing.

### Fix

Only pass `orderNumber` to the client (not `initialStatus`). Let the client fetch and handle the verification flow:

```ts
// app/(store)/orders/[orderNumber]/page.tsx
export default async function OrderTrackingPage({ params }: Props) {
  const { orderNumber } = await params;
  
  // Just verify order exists (don't expose data)
  const exists = await db.select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  
  if (exists.length === 0) notFound();
  
  return <OrderTrackingClient orderNumber={orderNumber} />;
}
```

The client handles email verification, shows the email input form for guests, and fetches full details after verification.

---

## INFRASTRUCTURE BUG 01 — Cron: `cancel-expired-orders` May Cancel Already-Paid Orders

**Severity:** Medium — race condition between expiry cron and Midtrans webhook  
**File:** `app/api/cron/cancel-expired-orders/route.ts`

### What's broken

The expiry cron finds orders where `paymentExpiresAt < NOW()` and cancels them. The Midtrans webhook can fire at the same moment, trying to mark the same order as `paid`. The cron wins because DB transactions are not coordinated.

```ts
// Typical race:
// T=0: Payment expiry (15min) passes
// T=1: Cron fires, finds order in pending_payment, cancels it
// T=2: Midtrans webhook fires, finds order in cancelled, should be rejected
```

The webhook at `app/api/webhooks/midtrans/route.ts` has this check:
```ts
if (order.status === 'paid' && transaction_status === 'settlement') {
  return success({ received: true, note: 'already_processed' });
}
```

But if `order.status === 'cancelled'` (from cron), the webhook proceeds past this check and tries to update `cancelled → paid`. The next DB update would set the order to `paid` even though the cron cancelled it.

### Fix

Add an explicit guard in the webhook: do not process settlement for cancelled orders:

```ts
// app/api/webhooks/midtrans/route.ts — add after existing idempotency checks (around line 60):
if (order.status === 'cancelled' && transaction_status === 'settlement') {
  logger.warn('[Midtrans Webhook] Received settlement for cancelled order', {
    orderNumber: order.orderNumber,
  });
  // TODO: Manual review needed — customer paid but order was already cancelled
  // Alert admin via email/notification
  return NextResponse.json({ received: true, note: 'order_already_cancelled_but_payment_received' }, { status: 200 });
}
```

Also make the expiry cron use a conditional update to only cancel if still `pending_payment`:
```ts
// app/api/cron/cancel-expired-orders/route.ts
await db.update(orders)
  .set({ status: 'cancelled', cancelledAt: new Date() })
  .where(
    and(
      eq(orders.id, order.id),
      eq(orders.status, 'pending_payment')  // ← conditional: only cancel if still pending
    )
  );
```

---

## INFRASTRUCTURE BUG 02 — Points Expiry Cron: Potential Double-Expiry

**Severity:** Low  
**File:** `app/api/cron/expire-points/route.ts`

Verify the points expiry cron marks individual point records as `isExpired = true` AND deducts from `users.pointsBalance`. If both operations are not atomic, a crash between them leaves the balance wrong.

The cron should:
1. Find `pointsHistory` records where `expiresAt < NOW()` AND `isExpired = false`
2. In a transaction: set `isExpired = true`, subtract from `users.pointsBalance`
3. Create a new `pointsHistory` record with `type = 'expire'`

All three steps must be in the same DB transaction.

---

## INFRASTRUCTURE BUG 03 — Cron Auth Token Not Set in Vercel Env

**File:** `lib/utils/cron-auth.ts`  
**vercel.json:** Check if cron routes are protected

The cron auth at `lib/utils/cron-auth.ts` uses a secret token (`CRON_SECRET` env var). Verify:
1. `CRON_SECRET` is set in Vercel production environment
2. `vercel.json` has the correct cron schedule configuration
3. The Vercel cron jobs actually call the correct internal URLs

If `CRON_SECRET` is not set, `verifyCronAuth` returns false for all requests and all cron jobs are blocked with 401.

---

## PERMISSIONS REFERENCE TABLE

Cross-checking implementation vs PRD for every admin action:

| Action | PRD Allows | Current Implementation | Status |
|--------|------------|----------------------|--------|
| View all orders | owner, superadmin | ✅ PATCH auth check | OK |
| Update order status to processing/packed | owner, superadmin | ✅ admin route | OK |
| Update order status to shipped | warehouse, owner, superadmin | ✅ warehouse included | OK |
| Cancel order | superadmin, owner | ✅ ADMIN_TRANSITIONS check | OK |
| Manage coupons | superadmin only | ⚠️ Check admin/coupons route | VERIFY |
| Manage products | owner, superadmin | ✅ products route | OK |
| Manage inventory | warehouse, owner, superadmin | ❌ adjust requires owner/superadmin only | BUG (see Audit 03) |
| View revenue dashboard | owner, superadmin | ✅ dashboard/kpis route | OK |
| Modify system settings | superadmin only | ❌ owner can modify | BUG 01 above |
| Manage admin users | superadmin only | ✅ users route | VERIFY |
| Access AI tools | superadmin only | ✅ ai/caption route | VERIFY |
| Approve B2B Net-30 | superadmin only | ✅ b2b-profiles approve route | OK |
| Manual points adjustment | superadmin | ✅ points/adjust route | VERIFY |

---

## DATABASE INTEGRITY CHECKS

### Missing Unique Constraint on `couponUsages`

**File:** `lib/db/schema.ts`

The `couponUsages` table has `idx_coupon_usages_coupon_user` index but not a UNIQUE constraint. A race condition at checkout could insert two rows for the same `(couponId, userId)`, allowing the same coupon to be counted as used once per row. Add a unique constraint:

```sql
-- Migration needed:
ALTER TABLE coupon_usages 
ADD CONSTRAINT uq_coupon_usages_coupon_order UNIQUE (coupon_id, order_id);
```

In schema.ts:
```ts
export const couponUsages = pgTable('coupon_usages', {
  // ... existing fields
}, (table) => ({
  couponOrderUnique: unique('uq_coupon_order').on(table.couponId, table.orderId),
}));
```

### Missing Index on `pointsHistory.orderId`

Cancellation reversal queries `pointsHistory` by `orderId` (once BUG 01 in Audit 01 is fixed). There's no index on this column:

```ts
// lib/db/schema.ts — add to indexes section:
export const pointsHistoryOrderIdIdx = index('idx_points_history_order_id').on(pointsHistory.orderId);
```

### `orderStatusHistory.metadata` Column Type

The `orderStatusHistory.metadata` column stores arbitrary JSON. Verify it's defined as `jsonb` in the schema (not `text`). Storing as jsonb allows efficient GIN indexing if needed later.

---

## ENVIRONMENT VARIABLES CHECKLIST

Run this check before going to production. Each var must be set in Vercel:

```
# Required — payment
MIDTRANS_SERVER_KEY=       ← Do NOT prefix with NEXT_PUBLIC_
MIDTRANS_CLIENT_KEY=       ← CAN have NEXT_PUBLIC_ prefix (for Snap.js)
MIDTRANS_IS_PRODUCTION=    ← 'true' for production, 'false' for sandbox

# Required — database
DATABASE_URL=              ← Neon connection string with ?sslmode=require

# Required — auth
NEXTAUTH_SECRET=           ← 32+ char random string
NEXTAUTH_URL=              ← https://dapurdekaka.com

# Required — email
RESEND_API_KEY=

# Required — storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Required — shipping
RAJAONGKIR_API_KEY=

# Required — cron security
CRON_SECRET=               ← Must be set or ALL crons will fail with 401

# Optional but important
SENTRY_DSN=                ← Move @sentry/nextjs from devDependencies to dependencies
NEXT_PUBLIC_STORE_ADDRESS= ← Used in pickup invitation email
```

Check `lib/config/validate-env.ts` — this should validate all required vars at startup. If any are missing, Next.js should fail to start (not silently use undefined values).

---

## VERCEL.JSON CRON SCHEDULE VERIFICATION

Verify `vercel.json` has these cron jobs configured:

```json
{
  "crons": [
    {
      "path": "/api/cron/cancel-expired-orders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/reconcile-payments",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/expire-points",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/points-expiry-warning",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/cleanup-counters",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Check the current `vercel.json` at project root and confirm all 5 crons are scheduled. Missing crons = silent operational failures.

---

## RATE LIMITING GAPS

Current rate limiting (via `withRateLimit`):
- `POST /api/checkout/initiate` — 10 req/min ✓
- `POST /api/coupons/validate` — 20 req/min ✓

Missing rate limits (should add):
- `POST /api/auth/forgot-password` — no rate limit → allows email flooding
- `POST /api/auth/register` — no rate limit → allows account creation spam
- `GET /api/shipping/cost` — calls RajaOngkir API, no rate limit → can exhaust quota

For forgot-password specifically:
```ts
// app/api/auth/forgot-password/route.ts — wrap with rate limit
export const POST = withRateLimit(
  async (req: NextRequest) => { ... },
  { windowMs: 15 * 60 * 1000, maxRequests: 3 }  // 3 per 15 minutes per IP
);
```

---

## CHECKLIST FOR CURSOR

- [ ] Fix settings PATCH to require `superadmin` only in `app/api/admin/settings/route.ts`
- [ ] Update settings page UI to show read-only for owner role
- [ ] Add stock restoration guard in `app/api/admin/orders/[id]/status/route.ts` (only restore if order was paid)
- [ ] Add `order.status === 'cancelled'` guard in `app/api/webhooks/midtrans/route.ts` settlement handler
- [ ] Add conditional update (AND status = 'pending_payment') to expiry cron cancellation
- [ ] Verify `CRON_SECRET` env var is set and all 5 crons are in `vercel.json`
- [ ] Add `unique` constraint on `coupon_usages(coupon_id, order_id)` 
- [ ] Add index on `pointsHistory.orderId`
- [ ] Add rate limiting to forgot-password and register routes
- [ ] Move `@sentry/nextjs` from `devDependencies` to `dependencies` in `package.json`
- [ ] Verify coupons admin route requires `superadmin` only (PRD says owner cannot manage coupons)
