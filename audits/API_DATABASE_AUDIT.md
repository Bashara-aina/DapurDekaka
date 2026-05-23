# API Routes & Database Deep Audit

**Date:** May 23, 2026
**Auditor:** Senior E-Commerce Security Auditor
**Focus:** API Security, Webhooks, Database Schema, Race Conditions

---

## 1. API Security Vulnerabilities

### 🔴 CRITICAL — Broken Object-Level Authorization (BOLA)

**File:** `app/api/account/addresses/[id]/route.ts` — line 66–71

```typescript
// PUT /api/account/addresses/[id]
const updated = await db.update(addresses)
  .set({ isDefault: body.isDefault })
  .where(and(
    eq(addresses.id, id),
    eq(addresses.userId, session.user.id)
  ))
```

**Issue:** No ownership check before updating. The route verifies auth but does NOT verify the address belongs to the requesting user before allowing `isDefault` update. Any authenticated user can set any other user's address as default by guessing/manipulating the address ID.

**Attack:** POST `/api/account/addresses/[some-uuid}` with `{"isDefault": true}` — if I know or guess another user's address UUID, I can modify it.

**Fix:** Must fetch existing address first, then verify `session.user.id` matches before updating. Similar pattern correctly used in DELETE handler (lines 24–29) but not in PUT.

---

### 🟠 HIGH — Inconsistent Response Format (Security Risk)

**Files:**
- `app/api/admin/products/route.ts` — lines 14–24 (GET/POST use NextResponse.json directly)
- `app/api/admin/products/route.ts` — line 143–155 (POST uses NextResponse.json with 422)
- `app/api/admin/coupons/route.ts` — lines 14–36 (GET uses NextResponse.json directly)
- `app/api/admin/coupons/route.ts` — lines 113–180 (POST uses NextResponse.json)
- `app/api/admin/products/[id]/variants/route.ts` — lines 16–51 (POST uses NextResponse.json)

Every admin API in `app/api/admin/` uses `NextResponse.json({ success: false, error: ... })` directly instead of the project's standardized helpers (`success()`, `validationError()`, `serverError()`).

**Problem:** Inconsistent error format makes it harder for clients to parse errors uniformly. Some routes return `{ success: false, error: ..., code: ... }` while others return `{ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }` with no details.

**Fix:** Use the project's `success()`, `validationError()`, `serverError()`, `unauthorized()`, `forbidden()` helpers consistently.

---

### 🟡 MEDIUM — Auth Check Bypass via Role Type Coercion

**File:** `app/api/b2b/quotes/[id]/[action]/route.ts` — line 37

```typescript
if (session.user.role !== 'b2b' && session.user.role !== 'superadmin' && session.user.role !== 'owner') {
  return forbidden('Akses ditolak');
}
```

**Issue:** Uses `!==` (OR chain) — this means ANY role that is NOT `b2b`, `superadmin`, or `owner` gets rejected. A user with role `warehouse` or `customer` would be rejected correctly. However, if `session.user.role` is `undefined` or an unexpected string, the check passes through since `undefined !== 'b2b'` is true. This appears safe but the type casting `(session.user as { role?: string }).role` is fragile.

**More importantly:** The check allows `b2b` users to access quotes they don't own. The ownership check at line 57 (`quote.b2bProfile.userId !== session.user.id`) only fires if role is `b2b`. But a `b2b` user accessing another B2B user's quote would hit line 57 and be blocked. However, if a `b2b` user's profile was deleted or the join fails silently, this could expose quotes.

**Fix:** Add explicit null check on `session.user.role`.

---

### 🟡 MEDIUM — Account Profile Bug — No Password Hash Edge Case

**File:** `app/api/account/profile/route.ts` — line 118

```typescript
if (!user.passwordHash) {
  return serverError('Akun ini tidak menggunakan password. Login dengan Google.');
}
```

**Issue:** `passwordHash` could be an empty string `""` — this is falsy so it would trigger the error correctly. But if the field is `null` or `" "`, it might not behave as expected. The logic works but relies on truthy/falsy behavior. More critically, `serverError('string')` is called instead of returning an HTTP error with proper status code. `serverError` should receive an `Error` object or be replaced with `unauthorized()` or `forbidden()`.

---

## 2. Missing Validations

### 🔴 CRITICAL — Admin Product Create — No Slug Uniqueness Check in Transaction

**File:** `app/api/admin/products/route.ts` — lines 157–165

```typescript
const slugAlreadyExists = await db.query.products.findFirst({
  where: eq(products.slug, parsed.data.slug),
});
if (slugAlreadyExists) {
  return NextResponse.json(
    { success: false, error: 'Slug sudah digunakan produk lain', code: 'DUPLICATE_SLUG' },
    { status: 409 }
  );
}
// Then creates product
```

**Issue:** The slug check is OUTSIDE any transaction. Two concurrent requests could both pass the slug check, then both try to insert — one would fail at DB level, but the error handling exposes a database error to the client. More critically, `categories` table reference check is also outside transaction.

**Fix:** Move all validation checks inside the insert transaction or use a DB-level unique constraint (which `products.slug` already has per schema line 189).

---

### 🟡 MEDIUM — Admin Variant Create — No SKU Uniqueness Check Before Insert

**File:** `app/api/admin/products/[id]/variants/route.ts` — lines 54–62

```typescript
const skuExists = await db.query.productVariants.findFirst({
  where: eq(productVariants.sku, parsed.data.sku),
});
if (skuExists) {
  return NextResponse.json(
    { success: false, error: 'SKU sudah digunakan varian lain', code: 'DUPLICATE_SKU' },
    { status: 409 }
  );
}
```

**Issue:** Same as products — check is outside transaction. `productVariants.sku` has a unique constraint per schema line 220, so DB would reject duplicate, but the error wouldn't be user-friendly.

---

### 🟡 MEDIUM — Coupon Update Allows Code Change to Existing Code

**File:** `app/api/admin/coupons/[id]/route.ts` — lines 86–93

```typescript
if (parsed.data.code && parsed.data.code.toUpperCase() !== existing.code) {
  const duplicate = await db.query.coupons.findFirst({
    where: eq(coupons.code, parsed.data.code.toUpperCase()),
  });
  if (duplicate) {
    return conflict('Kode kupon sudah digunakan');
  }
}
```

**Issue:** The check for duplicate coupon code is NOT inside a transaction. If two concurrent requests both try to change a coupon's code to the same new value, both could pass the check before either inserts.

---

### 🟡 MEDIUM — Cart Validate Uses console.error Instead of Logger

**File:** `app/api/cart/validate/route.ts` — line 132

```typescript
} catch (error) {
  console.error('[cart/validate]', error);
  return serverError(error);
}
```

**Issue:** Uses raw `console.error` instead of the project's `logger` utility. In production, `console.error` goes to stdout/stderr which may not be captured by log aggregators.

**Same issue in:**
- `app/api/account/addresses/route.ts` — lines 41, 87, 134
- `app/api/account/addresses/[id]/route.ts` — lines 44, 80
- `app/api/account/profile/route.ts` — lines 42, 87, 150, 209
- `app/api/admin/orders/route.ts` — line 310
- `app/api/admin/orders/[id]/status/route.ts` — lines 300, 325, 359, 381

---

## 3. Webhook Issues

### ✅ GOOD — Midtrans Webhook Signature Verification

**File:** `app/api/webhooks/midtrans/route.ts` — lines 33–49

Proper SHA-512 signature verification using raw body. No bypass possible.

---

### ✅ GOOD — Midtrans Webhook Idempotency

**File:** `app/api/webhooks/midtrans/route.ts` — lines 78–84

```typescript
if (body.transaction_id && order.midtransTransactionId === body.transaction_id) {
  return success({ received: true, note: 'already_processed' });
}
```

Proper idempotency check using `midtransTransactionId`. Prevents double-settlement.

---

### 🟠 MEDIUM — Webhook Amount Mismatch Returns 400 (Could Be Attack Vector)

**File:** `app/api/webhooks/midtrans/route.ts` — lines 121–128

```typescript
if (webhookAmount !== expectedAmount) {
  logger.error('[Midtrans Webhook] Amount mismatch', {
    orderId: order_id,
    expectedAmount,
    webhookAmount,
  });
  return NextResponse.json({ received: false }, { status: 400 });
}
```

**Issue:** If a tampered webhook arrives with wrong amount, it returns 400. This is correct behavior — but the note says "Amount mismatch" which could leak internal data in logs. However, this is logged, not returned to client. Fine.

**More concerning:** If someone repeatedly sends tampered webhooks with wrong amounts, they could cause unnecessary log volume. The rate limit of 30 requests/minute (line 28) helps but doesn't prevent abuse from multiple IPs.

---

### 🟠 MEDIUM — Stock Deduction in Webhook Doesn't Check Affected Rows

**File:** `app/api/webhooks/midtrans/route.ts` — lines 147–160

```typescript
const [updated] = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
  .where(and(
    eq(productVariants.id, item.variantId),
    gte(productVariants.stock, item.quantity)
  ))
  .returning({ newStock: productVariants.stock });

if (!updated || updated.newStock === undefined) {
  throw new Error(`Settlement failed: insufficient stock for variant ${item.variantId}`);
}
```

**Issue:** The check `!updated` catches when NO rows are updated, but if the `returning` somehow doesn't return `newStock`, it throws. However, the `GREATEST` guard ensures stock never goes negative even if concurrent deduction has already happened. The `gte(productVariants.stock, item.quantity)` condition ensures we only deduct if stock is sufficient at query time.

**BUT:** Under high concurrency (two webhooks settling simultaneously for the same order), both could pass the `gte(stock, qty)` check before either completes the deduction. The `returning` will show the post-deduction value — if it was already partially deducted by the other transaction, the final `newStock` would be lower than expected, but not negative. The transaction isolation level matters here.

**Risk:** Low in practice because Drizzle uses PostgreSQL transactions with SERIALIZABLE or similar isolation, preventing true concurrent deduction of the same stock.

---

### 🟡 LOW — Webhook Cancelled Order Expiry Handling

**File:** `app/api/webhooks/midtrans/route.ts` — lines 87–89

```typescript
if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status)) {
  return success({ received: true, note: 'already_cancelled' });
}
```

**Issue:** Correctly idempotent. But if a cancelled order's payment somehow settles later (e.g., bank transfer that arrived after cancellation), the code at lines 91–101 handles this with a `manual_review_needed` note. This is logged but requires manual intervention. This is acceptable behavior.

---

## 4. Database Schema Problems

### 🟡 MEDIUM — Missing Partial Index on pointsHistory for Expire Candidates

**File:** `lib/db/schema.ts` — line 437

```typescript
expireCandidatesIdx: index('idx_points_expire_candidates').on(table.userId, table.expiresAt).where(sql`${table.type} = 'earn' AND ${table.isExpired} = false AND ${table.consumedAt} IS NULL`),
```

**Issue:** Drizzle's partial index with `where()` using `sql` template literal may not translate correctly to all PostgreSQL versions or may cause issues during `drizzle-kit push`. The `sql` template in the `where` clause might not be interpreted as expected by Drizzle's query builder.

**Recommendation:** Test this schema push in a staging environment and verify the index is created correctly in Neon.

---

### 🟡 MEDIUM — Missing Index on orderStatusHistory.orderId

**File:** `lib/db/schema.ts` — `orderStatusHistory` table (lines 357–367)

```typescript
export const orderStatusHistory = pgTable('orderStatusHistory', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  ...
}, (table) => ({
  // NO index on orderId!
}));
```

**Issue:** Every query for order status history (e.g., `db.query.orders.findFirst({ with: { statusHistory: true } })`) performs a join on `orderId` with no index. This is a performance issue for large order histories.

**Fix:** Add `index('idx_order_status_history_order_id').on(table.orderId)` to `orderStatusHistory`.

---

### 🟡 MEDIUM — Missing Composite Index on productVariants

**File:** `lib/db/schema.ts` — `productVariants` table (lines 215–233)

Existing indexes: `productId`, `stock`, `sku`, `productId+isActive`.

**Missing:** Index on `isActive` alone — frequently filtered in admin product queries (`isActive === true`).

---

### 🟡 LOW — blogPosts.authorId Has Index but blogPosts.blogCategoryId Does Not

**File:** `lib/db/schema.ts` — `blogPosts` table (lines 452–478)

`authorId` has index but `blogCategoryId` (nullable reference) does not. If blog posts are filtered by category, this would be a sequential scan.

---

### 🟡 LOW — addresses.userId + isDefault Composite index missing

**File:** `lib/db/schema.ts` — `addresses` table (lines 125–142)

```typescript
}, (table) => ({
  userIdIdx: index('idx_addresses_user_id').on(table.userId),
}));
```

The `addresses` GET query sorts by `[desc(addresses.isDefault), desc(addresses.createdAt)]` (line 36 in `app/api/account/addresses/route.ts`). There's no composite index for this pattern.

**Fix:** Add `unique('uq_addresses_user_default').on(table.userId, table.isDefault)` for the unique constraint, or a composite index for the query pattern.

---

## 5. Transaction / Race Condition Risks

### 🟠 HIGH — Inventory Adjustment Not in Transaction + Read-Modify-Write Race

**File:** `app/api/admin/field/inventory/adjust/route.ts` — lines 46–51

```typescript
const quantityBefore = variant.stock;  // READ
const quantityAfter = Math.max(0, quantityBefore + delta);  // COMPUTE
// ... no transaction
await db.update(productVariants).set({ stock: quantityAfter, updatedAt: new Date() })  // WRITE
```

**Issue:** Non-atomic read-modify-write. Two concurrent adjustments could both read stock=10, one adds +5, one adds -3, both write — final stock could be 7 (should be 12) or 5 (should be 7) depending on write order. PostgreSQL's default isolation doesn't prevent this without explicit locking.

**Fix:** Use `sql` atomically:

```typescript
await db.transaction(async (tx) => {
  const [updated] = await tx
    .update(productVariants)
    .set({ stock: sql`GREATEST(stock + ${delta}, 0)`, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId))
    .returning({ newStock: productVariants.stock });
  // Then log
});
```

Or use `SELECT ... FOR UPDATE` to lock the row during adjustment.

---

### 🟠 HIGH — Admin Order POST — Stock Deduction Loop Not Atomic

**File:** `app/api/admin/orders/route.ts` — lines 268–292

```typescript
for (const item of data.items) {
  const [updated] = await tx
    .update(productVariants)
    .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)`, updatedAt: new Date() })
    .where(and(
      eq(productVariants.id, item.variantId),
      gte(productVariants.stock, item.quantity)
    ))
    .returning({ newStock: productVariants.stock });

  if (!updated) {
    throw new Error(`Stok tidak mencukupi untuk variant ${item.variantId}`);
  }
  // Log insertion in same loop — if log fails, order is inconsistent
}
```

**Issue:** While inside a transaction, the loop means if one item fails, all previous stock deductions in this loop are already applied. The loop throws and the transaction rolls back — so this is actually safe. BUT the `inventoryLogs` insertion for each item is also in the loop — if the log insert fails after the stock update, the transaction rolls back, so this is also safe.

**However:** The issue is if the transaction commits successfully but the inventoryLogs insert for item N fails AFTER item N+1's stock was already deducted and logged. This cannot happen because everything is in one transaction — the transaction will roll back all on any error. So this is actually SAFE.

---

### 🟠 MEDIUM — Retry Route Stock Restoration Uses Wrong Comparison

**File:** `app/api/checkout/retry/route.ts` — line 78

```typescript
gte(productVariants.stock, -item.quantity)  // WRONG
```

**Issue:** Should be `gte(productVariants.stock, item.quantity)` for the restore check. The current code `gte(stock, -quantity)` always passes because stock is never negative, and `-item.quantity` is a negative number. This means stock could go negative after restoration if the variant was deleted or stock was manually changed.

**Fix:** Should be `sql` GREATEST pattern for restoration:

```typescript
.set({ stock: sql`GREATEST(stock + ${item.quantity}, 0)`, updatedAt: new Date() })
// No need for gte check on restore
```

---

### 🟠 MEDIUM — B2B Quote Accept — Variants Lookup Outside Transaction

**File:** `app/api/b2b/quotes/[id]/[action]/route.ts` — lines 113–119

```typescript
const variantsLookup = await tx
  .select({ id: productVariants.id, productId: productVariants.productId })
  .from(productVariants)
  .where(inArray(productVariants.id, variantIds));
```

**Issue:** This query runs inside the transaction (`await db.transaction(async (tx) => {` starts at line 62), so it's fine. However, if `variantToProductId.get(item.variantId)` returns `undefined` (variant not found), it throws — but this would fail the transaction, which is correct.

---

### 🟡 LOW — Initiate Checkout Idempotency Window Too Large

**File:** `app/api/checkout/initiate/route.ts` — lines 331–349

```typescript
const existingPending = await db.query.orders.findFirst({
  where: and(
    eq(orders.userId, userId),
    eq(orders.status, 'pending_payment'),
    gte(orders.createdAt, new Date(Date.now() - 30 * 1000)),  // 30 seconds
    eq(orders.subtotal, subtotal)
  ),
```

**Issue:** 30-second idempotency window. A user who starts checkout, waits 31 seconds, then tries again creates a duplicate order (though with a different order number). The `paymentExpiresAt` check would catch this at payment time, but a new Midtrans transaction would be created.

**Risk:** Low — 30 seconds is reasonable. But if the client retries due to network error, it could create duplicate pending orders.

**Fix:** Consider increasing to 5 minutes, or use `paymentExpiresAt` in the check (orders older than payment expiry can't be retried anyway).

---

## 6. Query Performance Issues

### 🟡 MEDIUM — N+1 Query in Account Points Endpoint

**File:** `app/api/account/points/route.ts` — lines 23–28

```typescript
const user = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, session.user.id!),
  columns: { pointsBalance: true },
});

const history = await db.query.pointsHistory.findMany({
  where: (ph, { eq }) => eq(ph.userId, session.user.id!),
```

**Issue:** Two separate queries when one would suffice. Also using the query builder style with function-wrapped where clause. Minor performance impact.

---

### 🟡 LOW — Orders List Without Product/Variant Loading Optimization

**File:** `app/api/admin/orders/route.ts` — lines 79–98

```typescript
db.query.orders.findMany({
  where: whereClause,
  with: {
    items: true,  // loads all items
    user: { columns: { id: true, name: true, email: true } },
  },
```

**Issue:** `items: true` loads all order items but doesn't limit columns. Could fetch unnecessary data. In practice, for a large admin panel with 20-100 orders per page, this is fine.

---

## 7. Specific File:Line References

### Critical Findings (Immediate Action Required)

| # | File | Lines | Issue |
|---|------|-------|-------|
| C1 | `app/api/account/addresses/[id]/route.ts` | 66–71 | BOLA — PUT no address ownership check |
| C2 | `app/api/admin/field/inventory/adjust/route.ts` | 46–62 | No transaction + read-modify-write race |
| C3 | `app/api/checkout/retry/route.ts` | 78 | Wrong `gte` comparison for stock restoration |

### High Findings (Should Fix Soon)

| # | File | Lines | Issue |
|---|------|-------|-------|
| H1 | `app/api/admin/products/route.ts` | 14–24, 143–155 | Uses NextResponse.json instead of project helpers |
| H2 | `app/api/admin/coupons/route.ts` | 14–36, 113–180 | Uses NextResponse.json instead of project helpers |
| H3 | `app/api/admin/products/[id]/variants/route.ts` | 16–51 | Uses NextResponse.json instead of project helpers |
| H4 | `app/api/checkout/initiate/route.ts` | 267 | Uses `console.warn` instead of `logger` |
| H5 | `lib/db/schema.ts` | 357–367 | Missing index on `orderStatusHistory.orderId` |
| H6 | `lib/db/schema.ts` | 437 | Partial index on pointsHistory may not push correctly |

### Medium Findings (Nice to Fix)

| # | File | Lines | Issue |
|---|------|-------|-------|
| M1 | `app/api/account/profile/route.ts` | 118 | `serverError('string')` should be proper HTTP response |
| M2 | `app/api/cart/validate/route.ts` | 132 | Uses `console.error` instead of `logger` |
| M3 | `lib/db/schema.ts` | 215–233 | Missing `isActive` index on `productVariants` |
| M4 | `lib/db/schema.ts` | 452–478 | Missing `blogCategoryId` index on `blogPosts` |
| M5 | `app/api/account/addresses/route.ts` | 63–66 | Race condition on `isDefault` reset (two users simultaneously set default) |
| M6 | `app/api/coupons/validate/route.ts` | 63–67 | Inconsistent response format for guest rejection |
| M7 | `app/api/checkout/initiate/route.ts` | 130–136 | B2B price check uses role from session without verifying B2B profile exists |

---

## 8. Recommendations

### Immediate (Critical)

1. **Fix BOLA in `app/api/account/addresses/[id]/route.ts` line 66:**
   ```typescript
   // Add ownership check before update:
   const existing = await db.query.addresses.findFirst({
     where: and(
       eq(addresses.id, id),
       eq(addresses.userId, session.user.id)
     ),
   });
   if (!existing) return notFound('Alamat tidak ditemukan');
   ```

2. **Fix inventory adjust transaction in `app/api/admin/field/inventory/adjust/route.ts`:**
   Wrap stock update + log in a single transaction with atomic SQL update.

3. **Fix retry stock restoration in `app/api/checkout/retry/route.ts` line 78:**
   Change `gte(productVariants.stock, -item.quantity)` to remove the gte check entirely, since restoration uses `GREATEST(stock + qty, 0)`.

### High Priority

4. **Standardize API response format:** Create a lint rule that forbids `NextResponse.json` directly in API routes and requires the project helpers. This prevents inconsistent error formats.

5. **Add missing database indexes:**
   - `orderStatusHistory.orderId`
   - `blogPosts.blogCategoryId`
   - Composite index on `addresses(userId, isDefault)` for query pattern

6. **Test partial index push:** Verify `expireCandidatesIdx` on `pointsHistory` is created correctly in Neon PostgreSQL.

### Medium Priority

7. **Replace all `console.error/console.warn` with `logger`** across all API routes.

8. **Add `FOR UPDATE` lock on points redemption:** `app/api/checkout/initiate/route.ts` line 443 already uses `for 'update'` — verify this is effective.

9. **Consider adding `createdAt` index on `inventoryLogs`** if query performance degrades with high order volume.

---

## Summary

**API Security:** The most critical issue is the BOLA vulnerability in the address update endpoint. The webhook implementation is solid with proper signature verification, idempotency checks, and transaction usage. Stock deduction uses the correct `GREATEST` pattern with atomic updates.

**Database Schema:** Well-structured overall with proper integer prices (no floats), soft deletes where needed, and good use of UUID primary keys. Missing indexes on `orderStatusHistory.orderId` and `blogPosts.blogCategoryId` should be added. The partial index for points expiry needs verification in staging.

**Transaction Safety:** Most critical paths (checkout, webhook settlement, order status changes) use proper transactions with atomic stock deduction. The inventory adjust endpoint is the main concern — it lacks transaction protection and uses a vulnerable read-modify-write pattern.