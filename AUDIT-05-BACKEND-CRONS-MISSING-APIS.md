# AUDIT 05 — BACKEND, CRONS & MISSING APIS

**Auditor:** AI Code Review
**Date:** May 22, 2026
**Focus:** `app/api/`, `lib/`, cron routes, webhook routes
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW

---

## BUG-01 — CRITICAL: Coupon slot claimed OUTSIDE the main transaction (crash = wasted slot)

**File:** `app/api/checkout/initiate/route.ts:209-224`

**What's wrong:**
The atomic conditional UPDATE that claims a coupon slot (`usedCount + 1`) is executed **before** the main database transaction starts at line 497. If the server crashes or an error occurs between the coupon claim (line 209) and the transaction commit (line 745), the coupon's `usedCount` is permanently incremented but no order is created. The slot is wasted.

The pattern is:
```typescript
// Line 209-224 — OUTSIDE the transaction at line 497
const [claimed] = await db
  .update(coupons)
  .set({ usedCount: sql`used_count + 1` })
  .where(coupon.maxUses ? and(...) : eq(coupons.id, coupon.id))
  .returning({ usedCount: coupons.usedCount });

// ... more code ...

// Line 497 — MAIN TRANSACTION BEGINS
const counterResult = await db.transaction(async (tx) => {
```

**Fix:**
Move the atomic coupon slot claim INSIDE the transaction block at line 497. The `onConflictDoNothing` pattern on `couponUsages` (lines 206-216) provides double protection — but the primary `usedCount` increment must be transactionally coupled with order creation:

```typescript
const counterResult = await db.transaction(async (tx) => {
  // Claim coupon slot INSIDE transaction
  if (coupon) {
    const [claimed] = await tx
      .update(coupons)
      .set({ usedCount: sql`used_count + 1` })
      .where(
        coupon.maxUses
          ? and(eq(coupons.id, coupon.id), sql`used_count < ${coupon.maxUses}`)
          : eq(coupons.id, coupon.id)
      )
      .returning({ usedCount: coupons.usedCount });

    if (!claimed) {
      throw new Error('Kupon sudah mencapai batas');
    }
  }

  // Then create order...
});
```

Also remove the pre-transaction coupon claim at line 209-224.

---

## BUG-02 — CRITICAL: `points-expiry-warning` cron is NOT configured in vercel.json

**File:** `vercel.json:3-31`

**What's wrong:**
`app/api/cron/points-expiry-warning/route.ts` exists and is fully implemented with `checkExpiringPoints()`, sends `PointsExpiringEmail` to users 30 days before expiry, and marks records with `warnedAt`. However, it is **missing from the `crons` array** in `vercel.json`.

Currently configured crons:
- `cancel-expired-orders` — every 5 min ✅
- `expire-points` — daily at midnight ✅
- `reconcile-payments` — every 2 hours ✅
- `reconcile-points` — daily at 3 AM ✅
- `cleanup-counters` — daily at 2 AM ✅
- `cleanup-audit-logs` — weekly ✅

**Missing:**
- `points-expiry-warning` — should run daily at 9 AM WIB (02:00 UTC)

**Fix:**
Add to `vercel.json` crons array:

```json
{
  "path": "/api/cron/points-expiry-warning",
  "schedule": "0 2 * * *"
}
```

---

## BUG-03 — HIGH: Rate limiting on `checkout/initiate` is IP-only — logged-in users can bypass

**File:** `app/api/checkout/initiate/route.ts:71-846`
**File:** `lib/utils/rate-limit.ts:126-128`

**What's wrong:**
`withRateLimit` uses `req.ip` as the rate limit key (line 128 of rate-limit.ts). For logged-in users making concurrent requests from the same IP (e.g., Vercel serverless cold starts, or corporate NAT), the IP-based limit can be shared across many user sessions.

The code itself has a TODO comment acknowledging this (line 389-392):
```typescript
// TODO (BUG-10): Current rate limit is per-IP only (withRateLimit).
// For per-user rate limiting (when userId is available), consider using
// an in-memory Map or Redis to track userId → request count within window.
```

**Fix:**
Add a `keyGenerator` option when calling `withRateLimit` for authenticated routes:

```typescript
export const POST = withRateLimit(
  async (req: NextRequest) => { /* ... */ },
  {
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: (req: NextRequest) => {
      // Use userId if authenticated, else fall back to IP
      const session = await auth();
      return session?.user?.id ?? req.ip ?? 'unknown';
    }
  }
);
```

Note: This requires `withRateLimit` to be async-compatible for `keyGenerator`. Currently it is synchronous — may need refactoring.

---

## BUG-04 — HIGH: Stock restoration on cancel/expire uses non-atomic `stock + qty` pattern

**File:** `app/api/webhooks/midtrans/route.ts:317`
**File:** `app/api/cron/cancel-expired-orders/route.ts:109`
**File:** `app/api/cron/reconcile-payments/route.ts:116`

**What's wrong:**
When orders are cancelled (payment fail, expired, reconcile), stock is restored using:

```typescript
.set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
```

This is not atomic relative to concurrent reads/writes. While adding stock cannot cause negative stock (only reducing stock can), the pattern is **inconsistent** with the settlement side which uses `GREATEST(stock - qty, 0)`. More importantly, if the same item's stock is being concurrently modified by another request (e.g., another order completing), the simple addition could result in stock higher than what actually exists.

For cancellation flows, the check for existing `sale` inventory logs (lines 303-333 in webhook, lines 97-125 in cancel-expired-orders) is correct and prevents double-restoration. However, the restoration itself should still be done with proper atomic semantics.

**Fix:**
Use atomic conditional restoration for cancellations:

```typescript
// For cancellation/restoration (stock was ALREADY deducted):
await tx
  .update(productVariants)
  .set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
  .where(eq(productVariants.id, item.variantId));
// Note: Unlike deduction, restoration cannot go negative
// but should still use transaction to be safe
```

The real issue is that cancellation stock restoration is fine (adding back), but the **pattern inconsistency** makes the codebase harder to reason about. The critical fix is ensuring the **check** for whether stock was ever deducted (via `inventoryLogs.changeType = 'sale'`) is robust — and it is, in all three files.

---

## BUG-05 — HIGH: Guest coupon per-user enforcement uses recipientEmail from request body (spoofable)

**File:** `app/api/checkout/initiate/route.ts:405-417`

**What's wrong:**
For guest users, the coupon per-user limit enforcement looks up previous usages by joining `couponUsages` with `orders` on `recipientEmail`:

```typescript
const guestUsageCount = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(couponUsages)
  .innerJoin(orders, eq(couponUsages.orderId, orders.id))
  .where(and(
    eq(couponUsages.couponId, coupon.id),
    eq(orders.recipientEmail, recipientEmail.toLowerCase())
  ));
```

A malicious guest could bypass this by using variations of the same email (e.g., `test@gmail.com` vs `Test@Gmail.com` after `.toLowerCase()` is applied — actually `.toLowerCase()` handles case, but whitespace variants like `test @gmail.com` or different email formats could theoretically work).

More critically: the `recipientEmail` comes from the **client request body** and is not verified until order creation. A guest could pass different email per request attempt.

**Fix:**
After the order is created at line 585-624, perform the guest email coupon check against the **created order's** email (which is now in the DB and immutable for that session). The check at line 405-417 should happen AFTER the order record exists, inside the transaction, using the actual saved email. However, this creates a circular problem — we can't know if the guest has used the coupon until we create the order.

**Better fix:** Create a provisional `couponUsages` row with `orderId = null` for guests at initiate time (similar to how it's done for logged-in users at line 735-741), then confirm it when the webhook settles. This makes guest enforcement consistent with user enforcement.

---

## BUG-06 — MEDIUM: `expire-points` cron doesn't mark `warnedAt` records as `isExpired` before expiring them

**File:** `app/api/cron/expire-points/route.ts:28-43`

**What's wrong:**
The `expire-points` cron finds and expires points records using:

```typescript
const rows = await tx
  .update(pointsHistory)
  .set({ isExpired: true })
  .where(and(
    eq(pointsHistory.type, 'earn'),
    eq(pointsHistory.isExpired, false),
    lt(pointsHistory.expiresAt, now),
    sql`${pointsHistory.consumedAt} IS NULL`
  ))
  .returning();
```

This correctly expires records where `consumedAt IS NULL`. However, the `checkExpiringPoints` function (in `lib/points/expiry-check.ts:44`) selects records with `isNull(pointsHistory.warnedAt)` — meaning records that have already received a warning email but haven't expired yet.

There's a potential gap: if a record gets a warning (`warnedAt` set), then is partially redeemed (some but not all of the points are consumed), the remaining unconsumed portion still has `warnedAt` set. When `expire-points` runs, it will expire records regardless of `warnedAt` status — which is correct behavior. But the `checkExpiringPoints` will skip those records on future runs because `warnedAt` is already set. This is by design.

However, there is a subtle bug: the `expire-points` cron does NOT use `warnedAt` as a filter — it expires ALL unconsumed, expired records. This means a record that was warned 30 days before expiry, then partially redeemed (remaining points still unconsumed), will be expired correctly. But if the remaining points are subsequently redeemed before the expiry date, the `isExpired` flag from the cron update stays `true` even though the points were consumed. The `isExpired` flag being set on an already-consumed record could cause confusion in FIFO redemption logic.

**Fix:**
Add an additional filter in `expire-points` to skip records where `consumedAt IS NOT NULL` (already addressed) and ensure the cron only expires truly unconsumed records:

```typescript
const rows = await tx
  .update(pointsHistory)
  .set({ isExpired: true })
  .where(
    and(
      eq(pointsHistory.type, 'earn'),
      eq(pointsHistory.isExpired, false),
      lt(pointsHistory.expiresAt, now),
      sql`${pointsHistory.consumedAt} IS NULL`
    )
  )
  .returning();
```

The `sql` template uses `IS NULL` which Drizzle should handle correctly. Verify the generated SQL is `consumed_at IS NULL` and not `consumed_at = NULL`.

---

## BUG-07 — MEDIUM: Two divergent coupon validation schemas — inconsistent behavior possible

**File:** `app/api/coupons/validate/route.ts:11-16`
**File:** `app/api/checkout/validate-coupon/route.ts:9-18`

**What's wrong:**

**`/api/coupons/validate` schema:**
```typescript
const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),    // allows 0
  userId: z.string().uuid().optional().nullable(),
  productIds: z.array(z.string().uuid()).optional(),
});
```

**`/api/checkout/validate-coupon` schema:**
```typescript
const validateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().positive(),         // must be > 0
  userId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
});
```

Differences:
1. `subtotal`: one allows `nonnegative` (≥0), other requires `positive` (>0)
2. `userId`: one is `optional().nullable()`, other is just `optional()`
3. `items` vs `productIds`: completely different structures

The cart page calls `/api/coupons/validate`; checkout flow calls `/api/checkout/validate-coupon`. A coupon that passes one validation could theoretically fail the other due to schema differences.

**Fix:**
Unify the schemas into a shared validation file `lib/validations/coupon.schema.ts`:

```typescript
export const CouponValidationSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),
  userId: z.string().uuid().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

// For checkout-specific validation with items
export const CheckoutCouponValidationSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().positive(),
  userId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
});
```

---

## BUG-08 — MEDIUM: Shipping cost recalculation at checkout initiate doesn't validate courier service

**File:** `app/api/checkout/initiate/route.ts:453-458`

**What's wrong:**
The server-side shipping cost recalculation (lines 430-474) fetches RajaOngkir costs and looks for the matching `courierService`:

```typescript
for (const cost of courierData.costs) {
  if (cost.service === addressData.courierService) {
    serverCalculatedShippingCost = cost.cost[0].value;
    break;
  }
}
```

But if the `courierService` doesn't match any returned service (e.g., RajaOngkir returns a different etd format or the service name changed), `serverCalculatedShippingCost` stays 0. Then the validation at lines 467-473 passes because `serverCalculatedShippingCost === 0` passes the `> 0` check, and the client's `shippingCost` (which could be manipulated) is accepted.

**Fix:**
Add explicit validation that a matching service was found:

```typescript
let serverCalculatedShippingCost = 0;
let serviceFound = false;

for (const cost of courierData.costs) {
  if (cost.service === addressData.courierService) {
    serverCalculatedShippingCost = cost.cost[0].value;
    serviceFound = true;
    break;
  }
}

if (!serviceFound) {
  return conflict('Layanan kurir tidak ditemukan. Silakan refresh halaman.');
}
```

---

## MISSING API ROUTES

### MISSING-01 — MEDIUM: No `POST /api/points/redeem` route (PRD Section 4.2)

**Reference:** PRD Section 4.2 Admin Features — "Manual points adjustment"
**Reference:** PRD Section 3.4 API Routes — lists `/api/points/redeem`

**What's wrong:**
The PRD lists `POST /api/points/redeem` as an API route, but it does not exist. Points redemption is handled inline within `checkout/initiate` (lines 516-577). There is no dedicated points redemption endpoint.

This is not necessarily a bug — the functionality is implemented — but the route is not exposed as a standalone API for admin manual adjustments or other use cases.

**Note:** `lib/services/points.service.ts` exists but is not imported anywhere in the actual API routes. It's dead code (or was refactored into initiate). The `earnPoints()` function in that file uses `tx.update(users).set({ pointsBalance: newBalance })` which is not atomic — it sets an absolute value rather than using `sql\`points_balance + ${earnedPoints}\`` like the webhook does.

---

### MISSING-02 — LOW: No `POST /api/checkout/pickup-invitation` route (PRD Section 3.4)

**Reference:** PRD Section 3.4 — `/api/checkout/pickup-invitation ... Generate pickup instructions`

**What's wrong:**
This route is listed in the PRD but does not exist as a standalone endpoint. Pickup invitation logic is embedded in the webhook email sending (webhook routes sends `PickupInvitationEmail` directly). The `pickupCode` is set at order creation time (initiate line 589).

If an admin or customer needs to regenerate a pickup invitation, there is no API to do so.

---

### MISSING-03 — LOW: No `GET /api/products` (list) route with search/filter

**Reference:** PRD Section 3.4 — `/api/products ... Product listing + search`

**What's wrong:**
The PRD lists `GET /api/products` for product listing + search, but the existing file `app/api/products/[slug]/route.ts` only handles single product by slug. There is no general product listing API route.

However, product listing is handled via **Server Components** with ISR (not an API route) per the rendering strategy in TECH_STACK Section 1.3. The PRD's API routes section may be outdated or referring to a different architecture. The store uses direct Server Component data fetching for products.

---

## INCOMPLETE IMPLEMENTATIONS

### INCOMPLETE-01 — HIGH: `reconcile-payments` cron doesn't deduct stock/award points when reconciling settlement

**File:** `app/api/cron/reconcile-payments/route.ts:47-70`

**What's wrong:**
When `reconcile-payments` finds an order that Midtrans says is `settlement` or `capture` but the webhook was missed, it updates the order status to `paid` and adds status history:

```typescript
await tx
  .update(orders)
  .set({
    status: 'paid',
    paidAt: new Date(),
    midtransPaymentType: midtransStatus.paymentType ?? null,
  })
  .where(eq(orders.id, order.id));
```

**But it does NOT:**
1. Deduct stock (no `productVariants` update)
2. Award loyalty points (no `pointsHistory` insert)
3. Confirm coupon `usedCount` increment (no `coupons` update)
4. Send confirmation email

This means if a settlement webhook was missed, the order is marked `paid` but stock is NOT deducted and points are NOT awarded. An order could be paid but stock remains, and customer doesn't receive points.

**Fix:**
Add the full settlement processing logic inside the reconciliation transaction:

```typescript
if (midtransStatus.transactionStatus === 'settlement' || midtransStatus.transactionStatus === 'capture') {
  await db.transaction(async (tx) => {
    // Update order to paid
    await tx.update(orders).set({ status: 'paid', paidAt: new Date() }).where(eq(orders.id, order.id));

    // Deduct stock (atomic)
    for (const item of order.items) {
      const [updated] = await tx
        .update(productVariants)
        .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
        .where(and(eq(productVariants.id, item.variantId), gte(productVariants.stock, item.quantity)))
        .returning({ newStock: productVariants.stock });

      if (!updated) {
        throw new Error(`Insufficient stock for variant ${item.variantId}`);
      }

      // Log inventory
      await tx.insert(inventoryLogs).values({
        variantId: item.variantId,
        changeType: 'sale',
        quantityBefore: updated.newStock + item.quantity,
        quantityAfter: updated.newStock,
        quantityDelta: -item.quantity,
        orderId: order.id,
      });
    }

    // Award points
    if (order.userId && order.pointsEarned > 0) {
      const updatedUsers = await tx.update(users)
        .set({ pointsBalance: sql`points_balance + ${order.pointsEarned}` })
        .where(eq(users.id, order.userId))
        .returning({ pointsBalance: users.pointsBalance });

      const newBalance = updatedUsers[0]?.pointsBalance ?? order.pointsEarned;
      await tx.insert(pointsHistory).values({
        userId: order.userId,
        type: 'earn',
        pointsAmount: order.pointsEarned,
        pointsBalanceAfter: newBalance,
        descriptionId: `Pembelian ${order.orderNumber} (reconcile)`,
        orderId: order.id,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Confirm coupon
    if (order.couponId) {
      await tx.update(coupons)
        .set({ usedCount: sql`used_count + 1` })
        .where(eq(coupons.id, order.couponId));
    }
  });
}
```

---

### INCOMPLETE-02 — MEDIUM: `lib/services/points.service.ts` uses non-atomic balance update

**File:** `lib/services/points.service.ts:41-43`

**What's wrong:**
The `earnPoints()` function updates user balance using an absolute value:

```typescript
await tx.update(users).set({ pointsBalance: newBalance }).where(eq(users.id, userId));
```

Where `newBalance = (user?.pointsBalance ?? 0) + pointsEarned` — computed from a stale read inside the transaction. If two concurrent earnings happen for the same user in the same transaction, the second read sees the pre-first-update value and overwrites.

This service file is not imported anywhere in the actual API routes (the webhook uses inline SQL `sql\`points_balance + ${earnedPoints}\``). It's dead code that could cause bugs if anyone starts using it.

**Fix:**
If this service is to be kept, use atomic SQL increment:

```typescript
await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance + ${pointsEarned}` })
  .where(eq(users.id, userId));
```

Or remove the file entirely if it's not used.

---

## TRANSACTION GAPS

### GAP-01 — HIGH: Stock deduction for Net-30 B2B orders NOT atomic

**File:** `app/api/checkout/initiate/route.ts:666-679`

**What's wrong:**
For Net-30 B2B orders (no Midtrans, marked `paid` immediately at initiate), stock is deducted with:

```typescript
const [updated] = await tx
  .update(productVariants)
  .set({ stock: sql`stock - ${item.quantity}` })
  .where(and(
    eq(productVariants.id, item.variantId),
    gte(productVariants.stock, item.quantity)
  ))
  .returning({ newStock: productVariants.stock });
```

**Problems:**
1. Uses `stock - ${item.quantity}` instead of `GREATEST(stock - ${item.quantity}, 0)` — if concurrent deduction brings stock to exactly the quantity being deducted, the condition `gte(stock, qty)` passes but the result could theoretically go negative if another concurrent request also deducted.
2. If the `returning` gives no rows (insufficient stock), the code throws an error but the order has already been created in the same transaction — the error propagates and the transaction rolls back, which is correct behavior. However, the error message is opaque.

**Fix:**
```typescript
const [updated] = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
  .where(and(
    eq(productVariants.id, item.variantId),
    gte(productVariants.stock, item.quantity)
  ))
  .returning({ newStock: productVariants.stock });

if (!updated) {
  throw new Error(`Stok tidak mencukupi untuk variant ${item.variantId}`);
}
```

---

### GAP-02 — MEDIUM: `cancel-expired-orders` cron processes orders sequentially, not in batch

**File:** `app/api/cron/cancel-expired-orders/route.ts:42-172`

**What's wrong:**
The cron finds all expired orders, then processes them one-by-one in a `for` loop, each with its own `db.transaction()`. If there are 100 expired orders, this makes 100 sequential transaction calls. For a cron expected to run every 5 minutes, this is acceptable for small volumes but won't scale.

Additionally, the Midtrans status check (line 48) is inside the loop — 100 sequential external API calls.

**Note:** This is a scaling concern, not a correctness bug. For V1 with expected <100 orders/day, it's fine.

---

## SUMMARY TABLE

| Bug ID | Severity | Area | File | Issue |
|--------|----------|------|------|-------|
| BUG-01 | CRITICAL | Coupon | `initiate/route.ts:209` | Coupon slot claim outside transaction |
| BUG-02 | CRITICAL | Cron | `vercel.json` | `points-expiry-warning` not in crons array |
| BUG-03 | HIGH | Rate Limit | `initiate/route.ts:71` | IP-only rate limit, bypassable by logged-in users |
| BUG-04 | HIGH | Stock | `webhook/route.ts:317` | Non-atomic stock restoration pattern |
| BUG-05 | HIGH | Coupon | `initiate/route.ts:405` | Guest email coupon check uses unsanitized client input |
| BUG-06 | MEDIUM | Points | `expire-points/route.ts:28` | Minor: isExpired on partially-consumed records |
| BUG-07 | MEDIUM | Schema | `coupons/validate/route.ts:11` vs `checkout/validate-coupon/route.ts:9` | Two divergent Zod schemas |
| BUG-08 | MEDIUM | Shipping | `initiate/route.ts:453` | Missing serviceFound check in shipping recalc |
| MISSING-01 | MEDIUM | Points | (no file) | `POST /api/points/redeem` not implemented as standalone route; `lib/services/points.service.ts` is dead code |
| MISSING-02 | LOW | Checkout | (no file) | `POST /api/checkout/pickup-invitation` not standalone |
| INCOMPLETE-01 | HIGH | Cron | `reconcile-payments/route.ts:47` | Settlement reconciliation doesn't deduct stock/award points |
| INCOMPLETE-02 | MEDIUM | Points | `lib/services/points.service.ts:41` | Non-atomic balance update in unused service |
| GAP-01 | HIGH | Stock | `initiate/route.ts:666` | Net-30 stock deduction not using GREATEST pattern |
| GAP-02 | MEDIUM | Cron | `cancel-expired-orders/route.ts:42` | Sequential order processing (scaling concern) |

---

## POSITIVE FINDINGS (Working Correctly)

- **Midtrans webhook signature**: SHA512 verification correctly implemented (`verifyMidtransSignature`)
- **Idempotency**: Webhook correctly checks `midtransTransactionId` and `status` before reprocessing
- **Atomic stock deduction**: Settlement handler uses `GREATEST(stock - qty, 0)` correctly (line 148)
- **Inventory log pattern**: Sale logs record `quantityBefore = stock + qty` (before deduction) — correct
- **FIFO points**: Redeem records correctly reference `referencedEarnId` for unconsume on cancel
- **Rate limiting**: All public routes have `withRateLimit` applied
- **CRON_AUTH**: All cron routes verify Bearer token correctly (skips in dev)
- **RajaOngkir cold-chain**: Only `FROZEN` and `YES` services shown, fallback message implemented
- **API response format**: All routes use `{ success, data?, error? }` via `lib/utils/api-response.ts`
- **Vercel cron config**: 6 of 7 crons correctly configured in `vercel.json`
- **Transaction wrapping**: Settlement, cancel, and Net-30 processing all use `db.transaction()`
- **Buy X Get Y coupon**: Fully implemented with free items added to order
- **Points 2x multiplier for B2B**: Correctly implemented at line 487