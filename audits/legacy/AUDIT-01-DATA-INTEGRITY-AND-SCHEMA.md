# AUDIT 01 — DATA INTEGRITY AND SCHEMA
DapurDekaka.com — Database Table, Relation, Constraint, and Data Flow Audit
**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** Schema, Relations, Transactions, Indexes, Enums, Timezones, Points Expiry

---

## LEGEND

```
✅ Implemented & correct
⚠️ Partially implemented or has a bug
❌ Not implemented (stub / placeholder)
🔴 Critical — blocks real usage / security risk
🟡 Major — significant UX or business impact
🟢 Minor — nice-to-have improvement
```

---

## 1. SCHEMA ALIGNMENT ✅

**Verdict: Well-structured. No `any`. All prices integer. All timestamps UTC.**

Every table in `lib/db/schema.ts` uses `uuid('id').primaryKey().defaultRandom()` — UUID v4 primary keys everywhere with no exceptions.

All monetary fields are `integer` (IDR), confirmed:
- `productVariants.price`, `productVariants.b2bPrice`
- `orders.subtotal`, `orders.discountAmount`, `orders.pointsDiscount`, `orders.shippingCost`, `orders.totalAmount`
- `orderItems.unitPrice`, `orderItems.subtotal`
- `coupons.discountValue`, `coupons.maxDiscountAmount`
- `pointsHistory.pointsAmount`, `pointsHistory.pointsBalanceAfter`

All timestamps use `timestamp('x', { withTimezone: true })` — stored as timestamptz in PostgreSQL.

**Nullable audit — notable patterns:**

| Table | Field | Nullable | Correct? |
|-------|-------|----------|----------|
| `orders.userId` | user reference | NULLABLE | ✅ Guest checkout |
| `orders.addressLine` through `orders.postalCode` | delivery address | NULLABLE | ✅ Pickup orders |
| `orders.couponId` | coupon reference | NULLABLE | ✅ No coupon used |
| `orders.trackingNumber` | tracking | NULLABLE | ✅ Unshipped orders |
| `orders.paidAt`, `shippedAt`, `deliveredAt`, `cancelledAt` | status timestamps | NULLABLE | ✅ Only set on transition |
| `orders.midtransVaNumber` | VA number | NULLABLE | ✅ Not all payment types have VA |
| `coupons.startsAt`, `expiresAt` | validity window | NULLABLE | ✅ Null = no restriction |
| `coupons.maxDiscountAmount` | cap on % discount | NULLABLE | ✅ Only for percentage type |
| `blogPosts.blogCategoryId` | category reference | NULLABLE | ✅ Uncategorized posts allowed |
| `users.emailVerified` | NextAuth email verified | NULLABLE | ✅ OAuth users may not verify |
| `productVariants.b2bPrice` | B2B price | NULLABLE | ✅ B2B uses regular price if unset |

---

## 2. RELATION INTEGRITY

### 2A. Order Cancellation Flows

There are **three cancellation entry points** in the system:

| Entry Point | Route | Restores Stock? | Reverses Points? | Reverses Coupon? | Transaction? |
|-------------|-------|-----------------|-------------------|------------------|-------------|
| Midtrans webhook (`cancel/deny/expire`) | `app/api/webhooks/midtrans/route.ts:236-262` | ❌ (stock never deducted on pending_payment) | ✅ | ✅ | ✅ |
| Cancel-expired-orders cron | `app/api/cron/cancel-expired-orders/route.ts:66-126` | ✅ | ✅ | ✅ | ✅ |
| Admin status update | `app/api/admin/orders/[id]/status/route.ts:79-95` | ❌ | ❌ | ❌ | ❌ |

**🔴 CRITICAL — Admin order cancellation does NOT restore stock, reverse points, or reverse coupon usage.**

```30:41:app/api/admin/orders/[id]/status/route.ts
} else if (newStatus === 'cancelled') {
  updateData.cancelledAt = new Date();
} // ← Ends here. No stock restore, no points reverse, no coupon reverse.

// Status history record is also never written by admin status route.
// Only the Midtrans webhook writes orderStatusHistory (line 147-158 of webhook).
```

**Fix required:** Admin cancellation at minimum should either:
1. Call the same cancellation logic as `cancel-expired-orders` cron (restore stock, reverse points, reverse coupon, write history), OR
2. At minimum, write `orderStatusHistory` record and flag the order for async cleanup — but leaving stock deducted, points deducted, and coupon consumed without any reversal is a direct financial + inventory integrity loss.

### 2B. Checkout Points Deduction Before Order Creation

**🔴 CRITICAL — Points deducted BEFORE order is confirmed inside a non-atomic operation.**

```177:181:app/api/checkout/initiate/route.ts
// Deduct points immediately (tentative — reversed on payment failure)
await db
  .update(users)
  .set({ pointsBalance: sql`points_balance - ${pointsUsed}` })
  .where(eq(users.id, session.user.id));

// ← Immediately after (lines 183-232): Midtrans call, order creation.
// If Midtrans fails or order creation fails, points are gone with no order.
```

If `createMidtransTransaction` throws (network failure, Midtrans outage), or if the order insert fails, the user's points are already spent. The reversal only happens if Midtrans calls the webhook with `cancel/deny/expire` — but if the server crashes between these steps, points are lost with no retry mechanism.

**Fix:** Wrap points deduction, order creation, and order item creation in a single `db.transaction()`. Midtrans token creation can be done before or after the transaction boundary, but the points deduction must be inside it.

---

## 3. SOFT DELETE COVERAGE 🟡

### Has `deletedAt` (soft delete implemented):
- ✅ `users.deletedAt` — `lib/db/schema.ts:85`
- ✅ `products.deletedAt` — `lib/db/schema.ts:183`
- ✅ `productVariants` has `onDelete: 'cascade'` from `products` — effectively cascades, which is appropriate for variants

### Missing `deletedAt` (should be added):

| Table | Has `deletedAt`? | Has `isActive`? | Risk |
|-------|-----------------|-----------------|------|
| `categories` | ❌ No | ✅ `is_active` | Deleting a category orphans products |
| `coupons` | ❌ No | ✅ `is_active` | Cannot restore a "deleted" coupon; history broken |
| `blogPosts` | ❌ No | ✅ `is_published` | Published posts cannot be un-published cleanly |
| `carouselSlides` | ❌ No | ✅ `is_active` | Cannot schedule slide removal cleanly |
| `testimonials` | ❌ No | ✅ `is_active` | Cannot hide a testimonial without deletion |
| `blogCategories` | ❌ No | ❌ None | Cannot soft-delete a category |
| `b2bProfiles` | ❌ No | ✅ `is_approved` | Approved B2B profiles cannot be suspended |
| `b2bInquiries` | ❌ No | ❌ None | Old inquiries accumulate permanently |

**For `coupons` specifically:** Deleting a coupon via hard delete would break `couponUsages` foreign key and `orders.couponId` references. A `deletedAt` column should be added.

---

## 4. ENUM COVERAGE

### 4A. All Enums Defined

| Enum | Values | Used In |
|------|--------|---------|
| `user_role_enum` | `customer`, `b2b`, `warehouse`, `owner`, `superadmin` | `users.role` |
| `order_status_enum` | `pending_payment`, `paid`, `processing`, `packed`, `shipped`, `delivered`, `cancelled`, `refunded` | `orders.status`, `orderStatusHistory` |
| `delivery_method_enum` | `delivery`, `pickup` | `orders.deliveryMethod` |
| `coupon_type_enum` | `percentage`, `fixed`, `free_shipping`, `buy_x_get_y` | `coupons.type` |
| `points_type_enum` | `earn`, `redeem`, `expire`, `adjust` | `pointsHistory.type` |
| `inventory_change_enum` | `manual`, `sale`, `restock`, `adjustment`, `reversal` | `inventoryLogs.changeType` |
| `carousel_type_enum` | `product_hero`, `promo`, `brand_story` | `carouselSlides.type` |
| `b2b_inquiry_status_enum` | `new`, `contacted`, `converted`, `rejected` | `b2bInquiries.status` |
| `b2b_quote_status_enum` | `draft`, `sent`, `accepted`, `rejected`, `expired` | `b2bQuotes.status` |

### 4B. Exhaustive Switch/Case Coverage ⚠️

**`orderStatusEnum`** has 8 values but `refunded` is never reachable:

```22:28:lib/db/schema.ts
'pending_payment', 'paid', 'processing', 'packed',
'shipped', 'delivered', 'cancelled', 'refunded',
```

`VALID_TRANSITIONS` in `app/api/admin/orders/[id]/status/route.ts:22-28`:

```22:28:app/api/admin/orders/[id]/status/route.ts
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  paid: ['cancelled', 'processing'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};
// 'refunded' is not a valid transition from any state.
// 'delivered' has no outgoing transitions (end state in VALID_TRANSITIONS).
// 'paid' cannot go to 'processing' without going through the order flow correctly.
```

**`refunded` status is unreachable via any active code path.** It exists in the enum and Zod schemas (`lib/validations/order.schema.ts:27-36`) but:
- No route can transition any order status to `refunded`
- The `cancel-expired-orders` cron uses `cancelled`, not `refunded`
- The admin status update schema only allows `shipped`, `delivered`, `cancelled`

This is not a bug per se — `refunded` may be intended for future use when actual payment refunds are implemented via Midtrans. However, it should be noted as intentional or removed.

### 4C. Exhaustive Status Transitions

`delivered` has no outgoing transitions defined in `VALID_TRANSITIONS`. A `delivered` order cannot be cancelled, refunded, or modified. This is likely intentional but should be verified against the refund business requirement.

---

## 5. UUID PRIMARY KEYS ✅

Every table uses `uuid('id').primaryKey().defaultRandom()`. Zero integer ID assumptions found in any API route or schema definition.

Verified in grep across all `.ts` files: no raw SQL `SELECT ... WHERE id = 1` or equivalent. All queries use Drizzle ORM with UUID-based lookups.

---

## 6. TRANSACTION BOUNDARIES 🟡

### ✅ Correct — Midtrans Settlement Webhook (`app/api/webhooks/midtrans/route.ts:69-169`)
Full multi-table transaction: order update → stock deduction (per item) → coupon used_count increment → points award → orderStatusHistory insert → couponUsage insert. All inside one `db.transaction()`.

### ✅ Correct — Cancel-Expired-Orders Cron (`app/api/cron/cancel-expired-orders/route.ts:66-126`)
Full multi-table: order update → stock reversal (per item) → points reversal → coupon usage decrement. Inside one `db.transaction()`.

### ✅ Correct — Expire-Points Cron (`app/api/cron/expire-points/route.ts:61-93`)
Per-user transaction: mark records expired → deduct from balance → insert expire history. Inside `db.transaction()`.

### ⚠️ Checkout Initiate — Points deduction is outside transaction (`app/api/checkout/initiate/route.ts:177-181`)
Points deduction happens BEFORE order creation with no transaction wrapping. See Section 2B.

### ⚠️ Admin Status Update — Cancellation lacks transaction (`app/api/admin/orders/[id]/status/route.ts:79-95`)
Single `db.update(orders)` call for cancelled status. No stock reversal, no points reversal, no coupon reversal, no orderStatusHistory insert. See Section 2A.

### 🟢 Field Inventory Routes — Two separate DB calls, acceptable
`app/api/admin/field/inventory/adjust/route.ts:47-57` — `update` + `insert` are separate calls. Since this is a single entity's stock being adjusted (not a multi-entity business operation), separate calls are acceptable.

---

## 7. STOCK ATOMICITY

### ✅ Midtrans Webhook — Correctly implemented (`app/api/webhooks/midtrans/route.ts:82-111`)

```82:95:app/api/webhooks/midtrans/route.ts
const result = await tx
  .update(productVariants)
  .set({
    stock: sql`GREATEST(stock - ${item.quantity}, 0)`,
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(productVariants.id, item.variantId),
      sql`stock >= ${item.quantity}`  // ← Guard: only deduct if enough
    )
  )
  .returning({ newStock: productVariants.stock });

const updatedStock = result[0];
if (!updatedStock) {
  console.warn(`[Webhook] Stock deduction failed for variant ${item.variantId} — insufficient stock`);
  continue;  // ← Skips this item, doesn't abort transaction
}
```

**Issue:** When `result[0]` is undefined (insufficient stock), the code `continue`s to the next item. The transaction still commits for the other items. The order is marked `paid` even though not all stock could be deducted. This is a partial fulfillment situation.

**Recommendation:** If ANY item fails stock deduction, the transaction should abort (throw error). Stock must be fully deducted for all items or the order should not transition to `paid`. The current behavior silently accepts partial stock deduction.

### ✅ Cancel-Expired-Orders Cron — Correctly implements stock reversal (`app/api/cron/cancel-expired-orders/route.ts:77-97`)

```77:85:app/api/cron/cancel-expired-orders/route.ts
const result = await tx
  .update(productVariants)
  .set({
    stock: sql`stock + ${item.quantity}`,  // ← Direct addition, no GREATEST needed
    updatedAt: now,
  })
  .where(eq(productVariants.id, item.variantId))
  .returning({ newStock: productVariants.stock });
```

Uses direct `stock + quantity` for reversal (correct — cancelled orders return items to stock with no cap).

### ⚠️ Restock Route — No `GREATEST` guard (`app/api/admin/field/inventory/restock/route.ts`)

Stock is set to a calculated `quantityAfter` which is `currentStock + delta`. If `delta` is positive, this increases stock. There's no check that `quantityAfter >= 0` because the operation is by definition additive, but a manual restock that accidentally subtracts could push stock to 0 or below if `delta` is negative and > current stock. The `adjust` route at `app/api/admin/field/inventory/adjust/route.ts:45` explicitly uses `Math.max(0, quantityBefore + delta)` — correct.

### ✅ All `orderItems` snapshot required fields at order creation

`app/api/checkout/initiate/route.ts:106-120` — On order creation, `unitPrice` is snapshotted from `variant.price` (re-fetched from DB, not from client payload), `productNameId/En`, `variantNameId/En`, `sku`, `weightGram` all captured. **No stale price display risk in current implementation.**

---

## 8. DATA SNAPSHOTTING ✅

**orderItems snapshot correctness:**

```106:120:app/api/checkout/initiate/route.ts
orderItemsData.push({
  // ...
  unitPrice: variant.price,  // ← From DB, not client payload ✅
  quantity: item.quantity,
  subtotal: itemSubtotal,
  weightGram: item.weightGram,  // ← From client payload (acceptable — this is chosen weight)
});
```

`variant.weightGram` is stored at order creation, not re-fetched. This is acceptable since weight is per-item choice and not a price-affecting field.

**`variant_options` not stored in `orderItems`:** The `orderItems` table has `variantNameId` and `variantNameEn` but no generic `variantOptions` JSON field. If variant options ever include structured data (e.g., `{ size: "large", spice: "medium" }`), this is not persisted. Currently `variantNameId` text field is sufficient.

---

## 9. INDEX COVERAGE 🟡

### No explicit indexes found in `lib/db/schema.ts` or via grep.

Grep for `index` in schema returned no custom index definitions. The following queries on potentially large tables lack explicit indexes:

| Table | Query Pattern | Risk |
|-------|--------------|------|
| `orders.userId` | `where: eq(orders.userId, ...)` — user order history | 🟡 Missing index |
| `orders.status` | `where: eq(orders.status, ...)` — order management filters | 🟡 Missing index |
| `orders.paymentExpiresAt` | `where: lt(orders.paymentExpiresAt, now)` — cancel-expired cron | 🟡 Missing index |
| `orderItems.orderId` | `with: { items: true }` via relation — order detail lookups | 🟡 Missing index |
| `productVariants.productId` | `where: inArray(productVariants.id, ...)` — product detail | 🟡 Missing index |
| `pointsHistory.userId` | `where: eq(pointsHistory.userId, ...)` — account points page | 🟡 Missing index |
| `pointsHistory.expiresAt` | `where: lt(pointsHistory.expiresAt, now)` — expire cron | 🟡 Missing index |
| `inventoryLogs.variantId` | `where: eq(inventoryLogs.variantId, ...)` — variant history | 🟡 Missing index |

PostgreSQL will use sequential scans on small tables but will degrade on large tables. Neon PostgreSQL supports Drizzle index definitions via `index()` helper. Recommended minimum indexes:

```typescript
// Add to lib/db/schema.ts
import { index } from 'drizzle-orm/pg-core';

export const ordersUserIdIdx = index('idx_orders_user_id').on(orders.userId);
export const ordersStatusIdx = index('idx_orders_status').on(orders.status);
export const ordersPaymentExpiresAtIdx = index('idx_orders_payment_expires_at').on(orders.paymentExpiresAt);
export const orderItemsOrderIdIdx = index('idx_order_items_order_id').on(orderItems.orderId);
export const productVariantsProductIdIdx = index('idx_product_variants_product_id').on(productVariants.productId);
export const pointsHistoryUserIdIdx = index('idx_points_history_user_id').on(pointsHistory.userId);
export const pointsHistoryExpiresAtIdx = index('idx_points_history_expires_at').on(pointsHistory.expiresAt);
export const inventoryLogsVariantIdIdx = index('idx_inventory_logs_variant_id').on(inventoryLogs.variantId);
```

---

## 10. TIMEZONE HANDLING ✅

**All `new Date()` calls produce UTC timestamps** — `new Date()` in JavaScript produces local time, but Drizzle with `withTimezone: true` stores these as UTC timestamptz. All three cron routes and the webhook route use `new Date()` consistently.

**RajaOngkir timestamps:** `lib/rajaongkir/client.ts` and `calculate-cost.ts` — RajaOngkir API returns `etd` (estimated delivery days) as a string, not a timestamp. No timezone conversion issue here.

**Midtrans webhook:** `transaction_status` is a string enum (`settlement`, `cancel`, `deny`, `expire`), not a timestamp. No timezone conversion issue.

**Payment expiry calculation:**

```196:app/api/checkout/initiate/route.ts
const paymentExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
```

Uses `Date.now()` (UTC milliseconds) to compute expiry. This is correct — the `paymentExpiresAt` field is stored as UTC and compared against `new Date()` (also UTC) in the cancel-expired-orders cron.

**One minor issue:** `formatWIB(new Date())` in email templates (`app/api/webhooks/midtrans/route.ts:196,221`) — the `formatWIB` function converts to WIB for display. The timestamp passed is `new Date()` which is server local time. On a server in a different timezone, this could show wrong WIB time. However, Vercel serverless functions run in UTC, so `new Date()` is UTC and `formatWIB` correctly converts to WIB.

---

## 11. POINTS EXPIRATION ✅

**Cron infrastructure is complete and correct:**

| Cron | Schedule (vercel.json) | File |
|------|------------------------|------|
| `cancel-expired-orders` | `*/5 * * * *` (every 5 min) | `app/api/cron/cancel-expired-orders/route.ts` ✅ |
| `expire-points` | `0 18 * * *` (18:00 UTC = midnight WIB) | `app/api/cron/expire-points/route.ts` ✅ |
| `points-expiry-warning` | `0 2 * * *` (02:00 UTC = 9AM WIB) | `app/api/cron/points-expiry-warning/route.ts` ✅ |

**Cron auth:** `lib/utils/cron-auth.ts` — correctly verifies `Bearer ${CRON_SECRET}` header. All three cron routes call `verifyCronAuth(req)` before processing.

### ⚠️ Schedule comment mismatch in `expire-points` route

```9:11:app/api/cron/expire-points/route.ts
/**
 * Expire points older than 365 days.
 * Runs daily at 1AM WIB (18:00 UTC) via Vercel Cron.
 */
```

`vercel.json:10` has `"schedule": "0 18 * * *"` which is **18:00 UTC = midnight WIB**, not 1AM WIB. The comment says 1AM WIB but the actual schedule is midnight WIB. One-hour discrepancy.

### ⚠️ `pointsBalanceAfter` computed as SQL expression instead of integer

```82:91:app/api/cron/expire-points/route.ts
await tx.insert(pointsHistory).values({
  // ...
  pointsBalanceAfter: sql`GREATEST(points_balance - ${entry.totalPoints}, 0)`,
  // ↑ Should be a numeric integer, not a SQL expression.
  // Drizzle `values()` expects a plain value, not a sql`` tagged template.
});
```

When Drizzle inserts, it serialises values directly. A `sql` template at this position may be passed as a raw SQL fragment rather than a literal integer, potentially storing the SQL string `"GREATEST(points_balance - N, 0)"` as the `pointsBalanceAfter` value in PostgreSQL.

**Fix:**

```typescript
// First fetch the current balance
const user = await tx.query.users.findFirst({ where: eq(users.id, entry.userId) });
const newBalanceAfter = Math.max(0, (user?.pointsBalance ?? 0) - entry.totalPoints);

await tx.insert(pointsHistory).values({
  // ...
  pointsBalanceAfter: newBalanceAfter,  // ← Integer value
});
```

### 🟢 FIFO Points Redemption
No explicit FIFO implementation found in codebase — points are deducted by `sql\`points_balance - ${pointsUsed}\`` in checkout initiate, which is a global balance deduction, not a per-batch deduction. The `pointsHistory` table has `expiresAt` per earn record and FIFO is intended at the query level (oldest first), but the redemption code does not enforce FIFO. This is a known limitation documented in prior audits.

---

## 12. ADDITIONAL FINDINGS

### 12A. `orderStatusHistory` not written by admin status route 🟡

The `admin/orders/[id]/status/route.ts` does NOT insert into `orderStatusHistory` for any transition (shipped, delivered, cancelled). Only the Midtrans webhook inserts status history (at `app/api/webhooks/midtrans/route.ts:147-158`). Admin transitions silently change status with no audit trail.

### 12B. SQL.raw injection in expire-points cron 🟡

```61:72:app/api/cron/expire-points/route.ts
await tx
  .update(pointsHistory)
  .set({ isExpired: true })
  .where(
    and(
      eq(pointsHistory.userId, entry.userId),
      sql`id IN (${sql.raw(recordIds.map((id) => `'${id}'`).join(','))})`
    )
  );
```

`sql.raw` with string-interpolated UUIDs is used here. UUIDs from the database are trusted input, so this is not an injection risk in practice, but it bypasses Drizzle's parameterised query mechanism. The `recordIds` array is derived from `entry.records.map((r) => r.id)` where each `id` is a UUID v4 fetched from the DB — safe but should use Drizzle's `inArray` instead:

```typescript
import { inArray } from 'drizzle-orm';
// ...
where: and(
  eq(pointsHistory.userId, entry.userId),
  inArray(pointsHistory.id, recordIds)
)
```

### 12C. Missing `refunded` status transition path 🟢

`refunded` is in the enum and Zod schemas but no code path transitions to it. When actual payment refunds are implemented via Midtrans refund API, the transition path will need to be added to `VALID_TRANSITIONS` in `admin/orders/[id]/status/route.ts`.

### 12D. `coupons` table has no soft delete 🟡

See Section 3. A `deletedAt` column should be added for recoverability.

### 12E. `orders.deliveryMethod` constraint ⚠️

`orders.deliveryMethod` is `NOT NULL` — correct. But when `deliveryMethod = 'pickup'`, the address fields (`addressLine`, `district`, `city`, etc.) are all NULL. The `address` table has its own `userId` reference. There's no constraint preventing a `pickup` order from having address data, and no code normalises this — it's handled by the application logic in checkout validate.

---

## PRIORITY ACTION ITEMS

### 🔴 CRITICAL (Fix before production)
1. **Wrap checkout initiate points deduction in transaction** — `app/api/checkout/initiate/route.ts:177-181`
   - Move `pointsUsed` deduction inside the same `db.transaction()` as order creation
2. **Admin cancellation: restore stock + reverse points + reverse coupon** — `app/api/admin/orders/[id]/status/route.ts:91-93`
   - Admin cancelling a `paid`/`processing`/`packed` order must reverse all three
3. **Webhook partial stock failure: abort on any item** — `app/api/webhooks/midtrans/route.ts:98-101`
   - If any item fails stock deduction, throw error to abort transaction

### 🟡 MAJOR (Fix within sprint)
4. **Add missing indexes** to `lib/db/schema.ts` for `orders.userId`, `orders.status`, `orders.paymentExpiresAt`, `orderItems.orderId`, `productVariants.productId`, `pointsHistory.userId`, `pointsHistory.expiresAt`
5. **Add `deletedAt` to `coupons`** — enables safe deletion without breaking history
6. **Admin status route: insert `orderStatusHistory`** on every transition
7. **Fix `pointsBalanceAfter` SQL expression** — `app/api/cron/expire-points/route.ts:86`
8. **Fix expire-points schedule comment** — `app/api/cron/expire-points/route.ts:10`

### 🟢 MINOR (Nice to have)
9. Add `deletedAt` to `blogPosts`, `carouselSlides`, `testimonials`, `categories`, `b2bProfiles`, `b2bInquiries`
10. Add `refunded` transition path when refund flow is implemented
11. Replace `sql.raw` with `inArray` in expire-points cron
12. Consider adding `variantOptions: jsonb` field to `orderItems` for future-proofing structured variant data

---

## SUMMARY

| Area | Status |
|------|--------|
| Schema structure & types | ✅ Excellent |
| UUID primary keys | ✅ Complete |
| Integer prices | ✅ Complete |
| UTC timestamps | ✅ Complete |
| Soft delete coverage | ⚠️ Partial (users & products only) |
| Order cancellation integrity | 🔴 Broken (admin path) |
| Checkout transaction atomicity | 🔴 Broken (points before order) |
| Stock atomicity | ⚠️ Partial (partial failure not aborted) |
| Data snapshotting | ✅ Correct |
| Enum exhaustiveness | ⚠️ `refunded` unreachable |
| Points expiration cron | ✅ Infrastructure complete |
| Cron auth | ✅ Implemented |
| Index coverage | 🟡 Missing (7+ queries lack indexes) |
| Order status history audit trail | ⚠️ Webhook only (admin missing) |
