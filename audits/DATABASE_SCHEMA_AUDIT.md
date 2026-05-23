---
title: "Database Schema Deep Audit"
audit-date: "2026-05-23"
scope: "Drizzle ORM schema, table relationships, indexes, constraints, data integrity"
severity: "CRITICAL"
files-affected: "lib/db/schema.ts, lib/db/index.ts"
---

# Database Schema Deep Audit — DapurDekaka.com

**Date:** 2026-05-23
**Auditor:** Multi-Agent Deep Audit
**Scope:** Drizzle ORM schema correctness, table relationships, indexes, constraints, data integrity

---

## EXECUTIVE SUMMARY

The database schema is **~90% excellent** — proper UUID PKs, soft deletes, integer monetary values, correct foreign keys, appropriate indexes. However, 3 critical issues were found: (1) No database-level CHECK constraint to prevent negative stock, (2) Missing unique constraint on `orders.midtransOrderId` could allow duplicate settlements, (3) Missing index on `pointsHistory.userId` + `expiresAt` for FIFO queries. The schema properly uses `withTimezone: true` for all timestamps and stores all monetary values as integers (not floats).

---

## SECTION 1: OVERALL SCHEMA QUALITY

### ✅ EXCELLENT — No Changes Needed

| Aspect | Status | Details |
|--------|--------|---------|
| Primary keys | ✅ | All tables use `uuid().primaryKey().defaultRandom()` |
| Soft deletes | ✅ | `products.deletedAt`, `users.deletedAt`, `coupons.deletedAt` |
| Monetary values | ✅ | All prices, amounts, costs stored as `integer` (IDR) — not float |
| Foreign keys | ✅ | Proper `references()` with CASCADE where appropriate |
| Timestamps | ✅ | All use `withTimezone: true`, stored as UTC |
| Enums | ✅ | All status/type enums properly defined |
| Indexes | ✅ | Appropriate indexes on frequently queried columns |

---

## SECTION 2: USERS TABLE

**File:** `lib/db/schema.ts` — `users` table

### Schema
```typescript
id: uuid PK ✅
email: varchar unique indexed ✅
name: varchar notNull ✅
phone: varchar(20) ✅
role: userRoleEnum (customer, b2b, warehouse, owner, superadmin) ✅
isActive: boolean default true ✅
pointsBalance: integer default 0 ✅
languagePreference: varchar default 'id' ✅
deletedAt: timestamp (soft delete) ✅
createdAt, updatedAt: timestamps ✅
```

### Issues Found

**ISSUE-1 [MEDIUM]: No unique constraint on email (case-insensitive)**

The `email` column has `.unique()` but PostgreSQL varchar unique constraints are case-sensitive by default. Two users could be created with `Test@Email.com` and `test@email.com`.

**Fix:** Add a functional index:
```sql
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));
```

Or handle case-insensitivity in the registration validation by normalizing before insert.

---

## SECTION 3: PRODUCTS & VARIANTS

**File:** `lib/db/schema.ts` — `products`, `productVariants` tables

### Schema

**products:**
```typescript
id: uuid PK ✅
nameId: varchar ✅
nameEn: varchar ✅
slug: varchar unique ✅
descriptionId: text ✅
descriptionEn: text ✅
categoryId: uuid references categories.id ✅
imageUrl: varchar ✅
isActive: boolean default true ✅
deletedAt: timestamp (soft delete) ✅
createdAt, updatedAt: timestamps ✅
```

**productVariants:**
```typescript
id: uuid PK ✅
productId: uuid references products.id ✅
sku: varchar unique ✅
nameId: varchar ✅
nameEn: varchar ✅
price: integer (IDR) ✅
b2bPrice: integer (IDR) ✅
stock: integer ✅
weightGram: integer ✅
isActive: boolean default true ✅
sortOrder: integer default 0 ✅
```

### Issues Found

**ISSUE-2 [CRITICAL]: No CHECK constraint to prevent negative stock**

The `stock` column has no CHECK constraint. While the application uses `GREATEST(stock - qty, 0)` to prevent negative stock, a buggy or malicious DB operation could set stock to negative.

**Fix:**
```sql
ALTER TABLE product_variants ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
```

**CAUTION:** Before adding constraint, verify no existing negative stock values exist:
```sql
SELECT * FROM product_variants WHERE stock < 0;
```

**ISSUE-3 [INFO]: `weightGram` stored but not displayed to customers**

The `weightGram` field is stored in `productVariants` but the store never shows weight to customers before they add to cart. This was flagged in the store frontend audit.

---

## SECTION 4: ORDERS TABLE

**File:** `lib/db/schema.ts` — `orders` table

### Schema
```typescript
id: uuid PK ✅
orderNumber: varchar(20) unique ✅
userId: uuid nullable (guest checkout) ✅
status: orderStatusEnum ✅
isB2b: boolean ✅
recipientName, recipientPhone, recipientEmail ✅
deliveryMethod: deliveryMethodEnum ✅
deliveryAddress: text ✅
shippingCost: integer ✅
subtotal: integer ✅
discountAmount: integer ✅
pointsDiscount: integer ✅
couponCode: varchar ✅
couponId: uuid nullable ✅
totalAmount: integer ✅
notes: text nullable ✅
pointsEarned: integer default 0 ✅
pointsUsed: integer default 0 ✅
paymentMethod: varchar nullable ✅
midtransOrderId: varchar ✅
snapToken: text ✅
paymentExpiresAt: timestamp ✅
paidAt: timestamp nullable ✅
packedAt, shippedAt, deliveredAt: timestamp nullable ✅
cancelledAt: timestamp nullable ✅
courierCode: varchar nullable ✅
trackingNumber: varchar nullable ✅
createdAt, updatedAt: timestamps ✅
```

### Issues Found

**ISSUE-4 [HIGH]: `midtransOrderId` missing unique constraint**

```typescript
midtransOrderId: varchar('midtrans_order_id')
```

This column is used for Midtrans idempotency but has no unique constraint. If two orders somehow get the same `midtransOrderId`, the unique constraint on `orderNumber` would catch one of them, but it's possible for two orders to have identical `midtransOrderId` values if the code generates duplicates.

**Fix:** Add unique constraint:
```typescript
midtransOrderId: varchar('midtrans_order_id').unique()
```

**ISSUE-5 [MEDIUM]: `couponId` FK has no onDelete behavior**

```typescript
couponId: uuid('coupon_id').references(() => coupons.id)
```

If a coupon is deleted, orders still reference it. This is acceptable because `orders.couponCode` (denormalized) is also stored. But the FK reference could cause confusion.

---

## SECTION 5: ORDER ITEMS TABLE

**File:** `lib/db/schema.ts` — `orderItems` table

### Schema
```typescript
id: uuid PK ✅
orderId: uuid references orders.id CASCADE ✅
variantId: uuid references productVariants.id ✅
quantity: integer ✅
unitPrice: integer ✅ (SNAPSHOT)
productNameId: varchar ✅ (SNAPSHOT)
productNameEn: varchar ✅ (SNAPSHOT)
variantNameId: varchar ✅ (SNAPSHOT)
variantNameEn: varchar ✅ (SNAPSHOT)
weightGram: integer ✅ (SNAPSHOT)
sku: varchar ✅ (SNAPSHOT)
variantOptions: jsonb ✅
```

### ✅ Snapshot Pattern Correctly Implemented

All product/variant data is snapshotted at order creation time. This is correct — even if product prices change later, the order reflects the price at time of purchase.

### Issues Found

**ISSUE-6 [LOW]: `variantOptions` jsonb — no validation of structure**

The `variantOptions` column accepts any JSON. If the wrong structure is inserted, there would be no error — it would just store invalid data.

**Fix:** This is acceptable for flexibility. Application-level validation is sufficient.

---

## SECTION 6: POINTS SYSTEM TABLES

### pointsHistory Table

```typescript
id: uuid PK ✅
userId: uuid references users.id CASCADE ✅
type: pointsTypeEnum (earn, redeem, expire, adjust) ✅
pointsAmount: integer not null ✅
balanceAfter: integer not null ✅
orderId: uuid nullable references orders.id ✅
couponId: uuid nullable references coupons.id ✅
referencedEarnId: uuid nullable (for FIFO tracking) ✅
expiresAt: timestamp nullable ✅
isExpired: boolean default false ✅
consumedAt: timestamp nullable ✅
reason: varchar nullable ✅
createdAt: timestamp ✅
```

### Issues Found

**ISSUE-7 [HIGH]: Missing index for FIFO expire query**

The `expireOverduePoints()` function queries:
```sql
SELECT * FROM pointsHistory
WHERE userId = ? AND type = 'earn' AND isExpired = false AND consumedAt IS NULL AND expiresAt < now()
ORDER BY expiresAt ASC
```

This query needs an index on `(userId, type, isExpired, consumedAt, expiresAt)`.

**Current indexes on pointsHistory:**
- `userId` ✅
- `orderId` ✅

**Missing:** Composite index for expire candidates query.

**Fix:** Add index:
```sql
CREATE INDEX idx_points_history_expire_candidates
ON pointsHistory (userId, type, isExpired, consumedAt, expiresAt)
WHERE type = 'earn' AND isExpired = false AND consumedAt IS NULL;
```

---

## SECTION 7: COUPONS TABLE

**File:** `lib/db/schema.ts` — `coupons` table

### Schema
```typescript
id: uuid PK ✅
code: varchar unique ✅
name: varchar ✅
type: couponTypeEnum (percentage, fixed, free_shipping, buy_x_get_y) ✅
discountValue: integer ✅
minOrderAmount: integer ✅
maxDiscountAmount: integer nullable ✅
maxUses: integer nullable ✅
maxUsesPerUser: integer nullable ✅
isActive: boolean default true ✅
startsAt: timestamp nullable ✅
expiresAt: timestamp nullable ✅
applicableProductIds: jsonb nullable ✅
applicableCategoryIds: jsonb nullable ✅
usedCount: integer default 0 ✅
deletedAt: timestamp (soft delete) ✅
createdAt, updatedAt: timestamps ✅
```

### Issues Found

**ISSUE-8 [MEDIUM]: `freeShipping` column vs `type === 'free_shipping'`**

The code in `checkout/initiate/route.ts` checks `coupon.freeShipping` but the schema shows `type: couponTypeEnum` with value `'free_shipping'`. There is no `freeShipping` boolean column.

**This means `coupon.freeShipping` would always be `undefined` (falsy).**

The code should check:
```typescript
// WRONG:
if (coupon.freeShipping) { ... }

// CORRECT:
if (coupon.type === 'free_shipping') { ... }
```

**Fix:** Update the code to use `coupon.type === 'free_shipping'`.

---

## SECTION 8: ADDRESSES TABLE

**File:** `lib/db/schema.ts` — `addresses` table

### Schema
```typescript
id: uuid PK ✅
userId: uuid references users.id CASCADE ✅
label: varchar (e.g., "Rumah", "Kantor") ✅
recipientName: varchar ✅
phone: varchar ✅
provinceId: varchar ✅
cityId: varchar ✅
postalCode: varchar ✅
fullAddress: text ✅
isDefault: boolean default false ✅
createdAt, updatedAt: timestamps ✅
```

### ✅ Correct — No Issues

---

## SECTION 9: CART & SAVED_CARTS

### savedCarts Table

```typescript
id: uuid PK ✅
userId: uuid references users.id CASCADE ✅
variantId: uuid references productVariants.id CASCADE ✅
quantity: integer ✅
createdAt, updatedAt: timestamps ✅
```

### Issue Found

**ISSUE-9 [LOW]: CASCADE on variantId could delete user saved carts**

If a product variant is hard-deleted (not soft-deleted), all saved carts referencing it are CASCADE-deleted. This is acceptable since variants don't currently have a soft delete mechanism. But if soft delete is added later, this CASCADE behavior might be unexpected.

---

## SECTION 10: SESSIONS & AUTH TABLES

### sessions Table (NextAuth DrizzleAdapter)

```typescript
id: varchar PK — note: not uuid, this is NextAuth's format
sessionToken: varchar(255).unique().notNull()
userId: uuid references users.id CASCADE
expires: timestamp withTimezone
```

### accounts Table (NextAuth DrizzleAdapter)

```typescript
id: varchar PK
userId: uuid references users.id CASCADE
type: varchar
provider: varchar
providerAccountId: varchar
refresh_token: text
access_token: text
expires_at: integer
token_type: varchar
scope: text
id_token: text
session_state: text
```

### verificationTokens Table

```typescript
identifier: varchar
token: varchar unique
expires: timestamp withTimezone
```

### Issue Found

**ISSUE-10 [HIGH]: Type safety gap in DrizzleAdapter config**

In `lib/auth/config.ts`:
```typescript
// @ts-expect-error – DrizzleAdapter sessionsTable schema differs from our camelCase columns
sessionsTable: sessions,
```

The `@ts-expect-error` comments acknowledge a type mismatch between the DrizzleAdapter's expected column names and our camelCase schema. The adapter accesses columns by string name at runtime, so this works. But TypeScript cannot catch schema errors. If the adapter's expected column names change in an update, this could break silently.

**Recommendation:** Monitor this during NextAuth or DrizzleAdapter upgrades.

---

## SECTION 11: INVENTORY LOGS

**File:** `lib/db/schema.ts` — `inventoryLogs` table

```typescript
id: uuid PK ✅
variantId: uuid references productVariants.id ✅
changeType: inventoryChangeEnum ✅
quantity: integer ✅ (can be negative for deductions)
referenceId: uuid nullable (orderId, etc.) ✅
notes: text nullable ✅
createdAt: timestamp ✅
```

### ✅ Correct — No Issues

The `changeType` enum (manual, sale, restock, adjustment, reversal) is appropriate.

---

## SECTION 12: B2B TABLES

### b2bInquiries Table
```typescript
id: uuid PK ✅
companyName: varchar ✅
contactName: varchar ✅
contactEmail: varchar ✅
contactPhone: varchar ✅
message: text ✅
status: b2bInquiryStatusEnum ✅
createdAt, updatedAt: timestamps ✅
```

### b2bQuotes Table
```typescript
id: uuid PK ✅
quoteNumber: varchar unique ✅
inquiryId: uuid references b2bInquiries.id ✅
customerId: uuid references users.id ✅
status: b2bQuoteStatusEnum ✅
totalAmount: integer ✅
validUntil: timestamp ✅
notes: text nullable ✅
createdAt, updatedAt: timestamps ✅
```

### b2bQuoteItems Table
```typescript
id: uuid PK ✅
quoteId: uuid references b2bQuotes.id CASCADE ✅
variantId: uuid references productVariants.id ✅
quantity: integer ✅
unitPrice: integer ✅
createdAt, updatedAt: timestamps ✅
```

### ✅ Correct — No Issues

---

## SECTION 13: BLOG TABLES

### blogPosts Table
```typescript
id: uuid PK ✅
titleId: varchar ✅
titleEn: varchar ✅
slug: varchar unique ✅
contentId: text (Portable Text / JSON) ✅
contentEn: text (Portable Text / JSON) ✅
coverImageUrl: varchar ✅
authorId: uuid references users.id ✅
isPublished: boolean default false ✅
publishedAt: timestamp nullable ✅
createdAt, updatedAt: timestamps ✅
```

### ✅ Correct — No Issues

---

## SECTION 14: CAROUSELS TABLE

```typescript
id: uuid PK ✅
title: varchar ✅
subtitle: varchar nullable ✅
imageUrl: varchar ✅
badge: varchar nullable ✅
linkUrl: varchar nullable ✅
type: carouselTypeEnum ✅
isActive: boolean default true ✅
sortOrder: integer default 0 ✅
expiresAt: timestamp nullable ✅
createdAt, updatedAt: timestamps ✅
```

### ✅ Correct — No Issues

---

## SECTION 15: SYSTEM_SETTINGS TABLE

```typescript
id: uuid PK ✅
key: varchar unique ✅
value: text ✅
type: varchar ('string', 'integer', 'boolean', 'json') ✅
description: varchar nullable ✅
updatedAt: timestamp ✅
```

### ✅ Correct — No Issues

The key-value settings table is used for `origin_city`, `payment_expiry_minutes`, etc.

---

## SECTION 16: AUDIT LOGS TABLE

```typescript
id: uuid PK ✅
userId: uuid references users.id nullable ✅
action: varchar ✅
entityType: varchar ✅
entityId: uuid nullable ✅
changes: jsonb nullable ✅
ipAddress: varchar nullable ✅
userAgent: text nullable ✅
createdAt: timestamp ✅
```

### ✅ Correct — No Issues

---

## SECTION 17: TESTIMONIALS TABLE

```typescript
id: uuid PK ✅
customerName: varchar ✅
content: text ✅
rating: integer (1-5) ✅
isActive: boolean default true ✅
createdAt, updatedAt: timestamps ✅
```

### ✅ Correct — No Issues

---

## SECTION 18: SUMMARY OF ISSUES

| # | Severity | Table | Issue | Fix |
|---|----------|-------|-------|-----|
| 01 | CRITICAL | productVariants | No CHECK constraint for stock >= 0 | Add `CHECK (stock >= 0)` |
| 02 | CRITICAL | orders | `midtransOrderId` has no unique constraint | Add `.unique()` |
| 03 | HIGH | pointsHistory | Missing index for expire candidates query | Add composite index |
| 04 | HIGH | auth config | DrizzleAdapter type safety bypassed | Monitor on upgrades |
| 05 | MEDIUM | users | Email unique constraint is case-sensitive | Add `LOWER(email)` index |
| 06 | MEDIUM | coupons | `freeShipping` column doesn't exist (code bug) | Use `type === 'free_shipping'` |
| 07 | LOW | savedCarts | CASCADE on variantId | Acceptable, document behavior |

---

## SECTION 19: REQUIRED DB MIGRATIONS

Run these after reviewing the issues:

```sql
-- 1. Add stock non-negative constraint (CRITICAL)
ALTER TABLE product_variants ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);

-- 2. Add unique constraint on midtransOrderId (CRITICAL)
ALTER TABLE orders ADD CONSTRAINT orders_midtrans_order_id_unique UNIQUE (midtrans_order_id);

-- 3. Add index for FIFO points expire query (HIGH)
CREATE INDEX idx_points_history_expire_candidates
ON points_history (user_id, type, is_expired, consumed_at, expires_at)
WHERE type = 'earn' AND is_expired = false AND consumed_at IS NULL;

-- 4. Add case-insensitive email unique index (MEDIUM)
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));
```

---

*End of Database Schema Deep Audit*