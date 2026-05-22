# AUDIT 05 — BACKEND, CRONS, MISSING APIs & SECURITY
**Date**: 2026-05-22 | **Branch**: fix/multiple-audit-fixes-may-2026  
**Scope**: `app/api/`, `app/api/cron/`, security posture, missing routes  
**If 100 users hit this tomorrow**: Stock counts corrupt with every expired order; no PDF receipts; testimonials silently missing; `/api/settings/public` 404s on every checkout; concurrent coupon usage possible under load.

---

## BUG-01 — CRITICAL: Cancel-Expired Cron Restores Stock That Was Never Decremented

**File**: `app/api/cron/cancel-expired-orders/route.ts:96–113`  
**Severity**: CRITICAL — inventory data corruption  

**The problem in full detail**:

Order lifecycle for stock:
1. **Order created** (`pending_payment`) — stock is **NOT decremented**
2. **Midtrans webhook `settlement`** — stock IS decremented + `inventoryLogs` entry created
3. **Order cancelled** (Midtrans webhook) — checks `inventoryLogs` for a `sale` entry, only restores if found
4. **Order expired** (cancel-expired cron) — unconditionally restores stock **without checking inventoryLogs**

Step 4 is wrong. Every expired `pending_payment` order causes stock to increase by the ordered quantity, even though stock was never decremented.

Example: 10 users add "Siomay Premium (5pcs)" to cart and start checkout but abandon at payment. Current stock: 50. After cron runs overnight: stock becomes 50 + (10 × 5) = **100** — fabricated units.

**The webhook handler's correct guard** (`webhooks/midtrans/route.ts:285–314`):
```ts
const [salesLog] = await tx
  .select({ count: sql<number>`count(*)::int` })
  .from(inventoryLogs)
  .where(and(
    eq(inventoryLogs.orderId, order.id),
    eq(inventoryLogs.changeType, 'sale')
  ));

if ((salesLog?.count ?? 0) > 0) {
  // restore stock
}
```

**Fix**: Wrap the entire stock restoration block in the cron with the same guard:
```ts
// At top of the per-order transaction, add:
const [salesLog] = await tx
  .select({ count: sql<number>`count(*)::int` })
  .from(inventoryLogs)
  .where(and(
    eq(inventoryLogs.orderId, order.id),
    eq(inventoryLogs.changeType, 'sale')
  ));

const stockWasDecremented = (salesLog?.count ?? 0) > 0;

// Then wrap restore loop:
if (stockWasDecremented) {
  for (const item of order.items) {
    // ... existing stock restore code (lines 96-113)
  }
}
```

---

## BUG-02 — HIGH: Cancel-Expired Cron Hardcodes "15 Menit" in Status Note

**File**: `app/api/cron/cancel-expired-orders/route.ts:93`  
**Severity**: MEDIUM — misleading audit trail  

**What's wrong**:
```ts
note: `Otomatis dibatalkan karena tidak dibayar dalam 15 menit`,
```

The actual expiry duration comes from the `payment_expiry_minutes` system setting, configurable by superadmin. If the setting is changed to 30 or 60 minutes, the status history note will still say "15 menit" — creating a misleading audit trail.

**Fix**: The cron currently has no access to the expiry minutes setting. Add:
```ts
// At top of the GET handler, after cron auth:
const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;

// Then use it:
note: `Otomatis dibatalkan karena tidak dibayar dalam ${expiryMinutes} menit`,
```

---

## BUG-03 — HIGH: No `/api/orders/[orderNumber]/receipt` Route

**File**: `components/email/OrderReceiptPDF.tsx` (component exists, no serving route)  
**Severity**: HIGH — broken feature  

**What's wrong**: The account order detail page (`app/(store)/account/orders/[orderNumber]/page.tsx`) has a PDF receipt download button. `OrderReceiptPDF.tsx` exists using `@react-pdf/renderer`. But there is no API route to render and serve the PDF.

Every "Download Struk" button click results in a 404.

**Fix**: Create `app/api/orders/[orderNumber]/receipt/route.ts`:
```ts
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { OrderReceiptPDF } from '@/components/email/OrderReceiptPDF';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // @react-pdf requires Node.js

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  const session = await auth();

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order) {
    return new Response('Not Found', { status: 404 });
  }

  // Auth: must be order owner, or admin
  const adminRoles = ['superadmin', 'owner', 'warehouse', 'staff'];
  const isAdmin = adminRoles.includes(session?.user?.role ?? '');
  const isOwner = session?.user?.id && order.userId === session.user.id;
  
  if (!isAdmin && !isOwner) {
    return new Response('Forbidden', { status: 403 });
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(OrderReceiptPDF, { order })
  );

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="struk-${order.orderNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

---

## BUG-04 — HIGH: No `/api/settings/public` Route

**File**: `app/(store)/checkout/page.tsx:213`  
**Severity**: HIGH — broken checkout pickup info  

**What's wrong**: The checkout page fetches store hours from `/api/settings/public`:
```ts
const res = await fetch('/api/settings/public');
```

This route **does not exist**. The fetch silently fails, and store hours fall back to hardcoded defaults (`Senin - Sabtu`, `08.00 - 17.00 WIB`). If the admin has changed store hours in system settings, the checkout pickup page still shows the hardcoded values.

**Fix**: Create `app/api/settings/public/route.ts`:
```ts
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { success } from '@/lib/utils/api-response';
export const dynamic = 'force-dynamic';

const PUBLIC_SETTING_KEYS = [
  'store_open_days',
  'store_opening_hours',
  'store_address',
  'PROMO_CODE',
  'PROMO_TITLE',
  'PROMO_SUBTITLE',
  'CAROUSEL_SPEED_MS',
];

export async function GET() {
  const rows = await db.query.systemSettings.findMany({
    where: sql`${systemSettings.key} IN (${sql.join(
      PUBLIC_SETTING_KEYS.map(k => sql`${k}`),
      sql`, `
    )})`,
  });

  const result = Object.fromEntries(
    rows.map(r => [r.key, { value: r.value, type: r.type }])
  );
  return success(result);
}
```

---

## BUG-05 — HIGH: No `/api/testimonials/public` Route

**File**: `components/store/home/Testimonials.tsx`  
**Severity**: HIGH — homepage section silently broken  

**What's wrong**: Testimonials component fetches from `/api/testimonials/public`. This route does not exist. Homepage shows 0 testimonials to all visitors — no social proof.

**Verification**: Check if `testimonials` table exists in schema and if data was seeded.

**Fix**:
1. First verify the `testimonials` table in `lib/db/schema.ts`
2. If table exists, create `app/api/testimonials/public/route.ts`:
```ts
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { success } from '@/lib/utils/api-response';
export const revalidate = 3600;

export async function GET() {
  const data = await db.query.testimonials.findMany({
    where: eq(testimonials.isActive, true),
    orderBy: [asc(testimonials.sortOrder)],
    limit: 10,
  });
  return success(data);
}
```
3. If table doesn't exist: seed with hardcoded testimonials OR create the table + migration.

---

## BUG-06 — MEDIUM: Midtrans Webhook Doesn't Handle `pending` Status

**File**: `app/api/webhooks/midtrans/route.ts`  
**Severity**: MEDIUM — silent webhook events  

**What's wrong**: Midtrans sends several transaction statuses. The webhook handler covers:
- `settlement` / `capture` → paid
- `cancel` / `deny` / `expire` → cancelled

But NOT `pending`. When a user pays via bank transfer (VA), Midtrans first sends `pending` — the user has opened the payment UI but hasn't completed the transfer. This event is currently silently ignored (falls through all conditions, returns `success({ received: true })`).

No harm is done (the order is already in `pending_payment` state), but this means:
- `midtransPaymentType` and `midtransVaNumber` are never saved from the `pending` webhook
- The pending page has to poll the order to get these values via the orders API

**Fix**: Add explicit `pending` status handling:
```ts
} else if (transaction_status === 'pending') {
  // Save payment type and VA number if available
  await db.update(orders)
    .set({
      midtransPaymentType: body.payment_type ?? null,
      midtransVaNumber: body.va_numbers?.[0]?.va_number ?? null,
    })
    .where(eq(orders.id, order.id));

  logger.info('[Midtrans Webhook] Order pending payment', {
    orderNumber: order.orderNumber,
    paymentType: body.payment_type,
  });
}
```

---

## BUG-07 — MEDIUM: Cart Validate API Doesn't Check Product Active Status

**File**: `app/api/cart/validate/route.ts`  
**Severity**: MEDIUM — deactivated products can stay in cart  

**What's wrong**: The cart validation API checks stock quantities but not whether the product/variant is still active:
- `productVariants.isActive = true` — not checked
- `products.isActive = true` — not checked
- `products.deletedAt IS NULL` — not checked

A product that's been deactivated (e.g., seasonal item taken off sale) will still show `available: true` in cart validation if stock > 0.

**Fix**: Add a JOIN + active check in the validation query:
```ts
const dbVariants = await db
  .select({
    id: productVariants.id,
    stock: productVariants.stock,
    isActive: productVariants.isActive,
    productIsActive: products.isActive,
    productDeletedAt: products.deletedAt,
  })
  .from(productVariants)
  .innerJoin(products, eq(productVariants.productId, products.id))
  .where(and(
    inArray(productVariants.id, variantIds),
    eq(productVariants.isActive, true),
    eq(products.isActive, true),
    isNull(products.deletedAt)
  ));

// Variants not in dbVariants result are either deactivated or product deleted
```

---

## BUG-08 — MEDIUM: Expire-Points Cron Uses Non-Atomic Balance Deduction Pattern

**File**: `app/api/cron/expire-points/route.ts`  
**Severity**: MEDIUM — potential double-deduction under concurrent cron runs  

**What's wrong**: The expire-points cron:
1. Fetches earn records where `isExpired = false AND expiresAt < now`
2. Groups by user
3. Marks records as expired
4. Deducts from `pointsBalance` with `GREATEST(points_balance - total, 0)`

The issue: if the cron fires twice within the same second (e.g., Vercel cron + manual trigger), both runs could fetch the same unexpired records (step 1) before either marks them expired (step 3). Both runs would then deduct from balance, doubling the deduction.

Under Neon's HTTP driver, Drizzle "transactions" are not guaranteed serializable — each query is an HTTP request.

**Fix**: Use an atomic UPDATE...RETURNING pattern that both marks as expired AND returns only the rows that this invocation changed:
```ts
// Instead of: select then update
// Use: UPDATE ... WHERE is_expired = false AND expires_at < now RETURNING ...
const expiredNow = await db
  .update(pointsHistory)
  .set({ isExpired: true })
  .where(and(
    eq(pointsHistory.type, 'earn'),
    eq(pointsHistory.isExpired, false),
    sql`${pointsHistory.expiresAt} IS NOT NULL`,
    sql`${pointsHistory.expiresAt} < ${now}`,
    sql`${pointsHistory.consumedAt} IS NULL`,
  ))
  .returning(); // Only processes records this invocation "won"

// Then group expiredNow by userId and deduct
```

---

## BUG-09 — HIGH: Concurrent Coupon Usage Race Condition

**File**: `app/api/checkout/initiate/route.ts:195–200`  
**Severity**: HIGH — coupon can be used more times than allowed under load  

**What's wrong**: The coupon `maxUses` check:
```ts
if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
  return conflict('Kupon sudah mencapai batas penggunaan');
}
```

This is a SELECT-then-act pattern with no row lock. Under concurrent requests (common during flash sales), two checkouts can both pass this check before either increments `usedCount`. A coupon with `maxUses = 1` could be used twice.

**Fix**: Use an atomic UPDATE with a WHERE guard:
```ts
// Instead of checking usedCount then incrementing later,
// use conditional update to "claim" the coupon slot:
const [claimed] = await tx
  .update(coupons)
  .set({ usedCount: sql`used_count + 1` })
  .where(and(
    eq(coupons.id, coupon.id),
    coupon.maxUses
      ? sql`used_count < ${coupon.maxUses}`
      : sql`1=1` // unlimited
  ))
  .returning({ usedCount: coupons.usedCount });

if (!claimed) {
  throw new Error('Kupon sudah mencapai batas penggunaan');
}
```

This makes the increment and check atomic. Undo in the cancel/expire handler by decrementing.

---

## BUG-10 — MEDIUM: Checkout Initiate Rate Limit Is Per-IP, Not Per-User

**File**: `app/api/checkout/initiate/route.ts:70`  
**Severity**: MEDIUM — idempotency gap  

**What's wrong**: Rate limit is 10 req/60s per IP. Authenticated users are not rate-limited by userId. The existing idempotency check (30-second window, same subtotal) helps, but:
- Different items = different subtotals = bypasses idempotency
- Behind a shared IP (corporate network, mobile proxy), one user's rate limit consumes slots for others

**Fix**: Add a per-user rate limit layer using userId when available:
```ts
if (userId) {
  const userRateKey = `checkout:user:${userId}`;
  // Check Redis/memory cache for this userId
  // Allow 2 checkout initiates per 10 seconds per user
}
```

---

## BUG-11 — LOW: Health Check Endpoint May Expose Infrastructure Details

**File**: `app/api/health/route.ts`  
**Severity**: LOW — minor security concern  

**What's wrong**: Health check endpoints often return DB connectivity status, version strings, or environment details. If this information is returned unauthenticated, attackers can probe infrastructure.

**Verification needed**: Read the route and check what it returns.

**Fix**: Ensure `/api/health` returns only:
```json
{ "status": "ok", "timestamp": "2026-05-22T..." }
```
No DB version, no environment name, no dependency versions.

---

## BUG-12 — MEDIUM: Resend Email Errors Are Fire-and-Forget Without Monitoring

**File**: `app/api/webhooks/midtrans/route.ts:218–270`  
**Severity**: MEDIUM — silent email failures  

**What's wrong**: All email sends are fire-and-forget:
```ts
sendEmail({ ... }).catch((emailError) => {
  logger.error('[Email] Failed to send confirmation', { error: ... });
});
```

The `logger.error` call logs to stdout (or wherever logger pipes to), but:
1. There's no retry mechanism for failed emails
2. There's no alerting when emails consistently fail
3. A customer who paid but didn't receive confirmation email has no self-service way to get it resent

**Fix**: 
1. Short-term: Store `emailSentAt` on the order. If null after 10 minutes, a background job can retry.
2. Medium-term: Use a proper email queue (Resend has retry built-in if you use webhooks back from Resend).
3. Minimum: Add a "Kirim Ulang Email" button in the admin order detail page.

---

## BUG-13 — MEDIUM: `minimax.ts` Service — Unknown Usage

**File**: `lib/services/minimax.ts`  
**Severity**: MEDIUM — unknown state  

**What's wrong**: `minimax.ts` service exists. If this is an AI caption generation service (used in `components/admin/ai/CaptionGenerator.tsx`), it may require an API key (`MINIMAX_API_KEY` or similar). If the key is not set in production environment variables, the AI caption generation crashes silently or throws.

**Verification**: Check if `MINIMAX_API_KEY` (or equivalent) is in `lib/config/validate-env.ts`. If not, it won't be validated at startup and will only fail at runtime.

**Fix**: Add to env validation:
```ts
// lib/config/validate-env.ts
MINIMAX_API_KEY: z.string().min(1), // or .optional() if feature is optional
```

---

## MISSING FEATURE: No Webhook Signature Verification Caching

**File**: `app/api/webhooks/midtrans/route.ts:39–48`  
**Severity**: LOW  

**What's missing**: The signature verification is done correctly using SHA-512. But the server key is read from `process.env.MIDTRANS_SERVER_KEY` on every request. This is fine, but if the key is ever rotated mid-deployment, there's a window where verification fails. No operational concern unless key rotation happens.

---

## MISSING FEATURE: Reconcile Cron for Stuck `pending_payment` Orders

**File**: Previous audits mention a reconcile cron  
**Severity**: MEDIUM  

**What's missing**: Orders that received payment through Midtrans but the webhook failed (network timeout, server restart) will remain stuck in `pending_payment` state forever. The cancel-expired cron will eventually cancel them, but if the payment was received, that's wrong.

A reconcile cron should:
1. Find orders in `pending_payment` where `paymentExpiresAt > (now - 24h)` (recently expired)
2. Query Midtrans for each order's actual status
3. If status is `settlement`, process as paid
4. If status is `expire`/`cancel`, process as cancelled

**Fix**: Implement `app/api/cron/reconcile-payments/route.ts` that runs every hour. Reference: `lib/midtrans/status.ts` `checkTransactionStatus` is already implemented.

---

## SECURITY: User Enumeration in Forgot-Password Response Timing

**File**: `app/api/auth/forgot-password/route.ts`  
**Severity**: LOW (mitigated)  

**Current state**: The API adds a 400ms delay for non-existent users to normalize timing. This is good. However, the delay should be checked to ensure it's actually in a `finally` block that runs regardless of whether the user exists.

**Verify**: If the delay is only applied in the "user not found" branch, a statistical attacker can still enumerate by measuring response times (existing user = no delay = faster; non-existing user = delay = slower). The delay must apply to ALL responses equally.

---

## SECURITY: `couponCode.toUpperCase()` But `code` Stored Mixed-Case

**File**: `app/api/checkout/initiate/route.ts:178`  
**Severity**: LOW  

**What's wrong**: Coupon code is uppercased before DB lookup (`couponCode.toUpperCase()`), and the DB lookup is `eq(coupons.code, couponCode.toUpperCase())`. This works. But if a coupon was inserted with lowercase letters in the DB, it would never match.

**Fix**: Ensure all coupon codes in the DB are stored uppercase. When creating a coupon in the admin UI, always uppercase the code:
```ts
// In coupon creation API:
code: body.code.trim().toUpperCase(),
```
