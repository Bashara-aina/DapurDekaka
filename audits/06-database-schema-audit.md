# AUDIT 06 — Database Schema: Completeness & Integrity

**Project:** DapurDekaka.com
**Date:** May 24, 2026

---

## EXECUTIVE SUMMARY

The Drizzle ORM schema is well-structured with proper UUID primary keys everywhere, integer IDR for all monetary values, UTC timestamps, and comprehensive indexes. Critical findings: missing soft-delete cascade from `products.deleted_at` to `productVariants`, and from `categories.deleted_at` to `products`. All relations are properly defined. The main concern is ensuring soft-delete is consistently filtered in every query path.

---

## SCHEMA OVERVIEW

### What is CORRECT ✅

| Pattern | Implementation |
|---------|---------------|
| Primary keys | UUID everywhere — no sequential IDs exposed |
| Monetary values | All stored as integer IDR (price, b2bPrice, subtotal, discountAmount, totalAmount, pointsAmount, shippingCost, weightGrams, minOrderAmount, maxDiscountAmount, etc.) |
| Timestamps | `withTimezone: true` — UTC in DB, correct |
| Index strategy | Composite indexes on frequently queried columns (status + createdAt, isPublished + publishedAt, role + createdAt, etc.) |
| Soft delete | `deletedAt` column on users, products, categories, blog_posts, carousel_slides, testimonials, b2b_profiles |
| Partial indexes | `expireCandidatesIdx` on pointsHistory for FIFO queries; `publishedIdx` on blog_posts |
| Relations | Drizzle relational schema with proper references, cascade on foreign keys where appropriate |

---

## TABLES AUDIT

### `users` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- UUID primary key ✅
- `role` enum: superadmin, owner, warehouse, customer, b2b ✅
- `deleted_at` soft delete ✅
- `passwordHash` — should be excluded from SELECTs (verified in admin/customers route — correctly excluded) ✅
- `points_balance` with check constraint `>= 0` ✅

---

### `products` table

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — Missing Soft Delete Cascade:**
- `categoryId` is a not-null reference to `categories`
- When a category is soft-deleted (`deleted_at` set), products referencing it have **orphaned `categoryId` references**
- Queries filtering by `isActive` could return inconsistent results
- **Fix:** Either add `ON DELETE CASCADE` at DB level, or ensure ALL query paths filter `deleted_at IS NULL` on categories before joining

**Also noted:**
- All price fields: `price`, `b2bPrice`, `weightGrams` — all integer ✅
- `isFeatured`, `isActive` boolean flags ✅
- `slug` unique index ✅

---

### `product_variants` table

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — Missing Soft Delete Cascade:**
- `productId` is a not-null reference to `products`
- When a product is soft-deleted, its variants are **not automatically excluded** from queries
- Every query that joins products with variants must also filter `products.deleted_at IS NULL`
- **Fix:** Add application-level filtering on all query paths, or implement a cascade mechanism

**Also noted:**
- `stock` is integer with check constraint `>= 0` ✅
- `sku` unique index ✅

---

### `categories` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- Soft delete (`deleted_at`) ✅
- `slug` unique index ✅
- No products cascade — see products table finding above

---

### `orders` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `orderNumber` unique index ✅
- `status` enum with all states ✅
- `couponId` nullable reference — coupon data snapshotted in `couponCode` and `couponSnapshot` ✅
- `points_redeemed` with check constraint ✅
- `shippingAddressSnapshot` JSON column for address at time of order ✅
- `snapToken`, `paymentExpiresAt` for Midtrans ✅
- `paidAt` for settlement timestamp ✅
- `midtransTransactionId` for webhook idempotency ✅

---

### `order_items` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- All product data snapshotted at creation: `productNameId`, `productNameEn`, `variantName`, `pricePerItem`, `weightGrams` ✅
- `variantId` stored but variant data also snapshotted ✅
- This is critical for order integrity — even if product/variant changes later, order history is preserved ✅

---

### `coupons` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `code` unique index ✅
- `type` enum: percentage, nominal, buyXgetY ✅
- `minOrderAmount` integer IDR ✅
- `maxDiscountAmount` integer IDR ✅
- `applicableProductIds` JSON array — validated in validate-coupon route ✅
- `applicableCategoryIds` JSON array — validated in validate-coupon route ✅
- `maxUsesPerUser` nullable integer ✅
- `startsAt`, `expiresAt` timestamps ✅
- `deleted_at` soft delete ✅

---

### `coupon_usages` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- Composite unique index on `(couponId, userId)` and `(couponId, guestEmail)` — prevents duplicate usage ✅
- `usedAt` timestamp ✅

---

### `points_history` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `type` enum: earn, redeem, expire, adjust, void ✅
- `FIFO redemption` with `referencedEarnId` (nullable UUID, self-reference) and `consumedAt` (nullable timestamp) — enables FIFO queue tracking ✅
- Partial index `expireCandidatesIdx WHERE consumedAt IS NULL AND type = 'earn'` — for FIFO queries ✅
- `expiresAt` for earn records ✅
- `voidedAt` for reversed transactions ✅
- `metadata` JSONB for flexible additional data ✅

---

### `inventory_logs` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `reason` enum: manual_adjustment, sale, return, expired, transfer_in, transfer_out ✅
- `orderId` nullable reference ✅
- `adminId` nullable reference for manual adjustments ✅

---

### `blog_posts` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `publishedAt` indexed (composite with `isPublished`) ✅
- Soft delete (`deleted_at`) ✅
- `slug` unique index ✅

---

### `carousel_slides` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `sortOrder` integer ✅
- Soft delete (`deleted_at`) ✅

---

### `settings` table

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- Key-value store for system settings ✅
- Keys should be documented somewhere — no surprises in the schema itself

---

## SOFT DELETE CASCADE MATRIX

| Parent Table | Child Table | Cascade? | Risk |
|---|---|---|---|
| `categories` | `products` | ❌ NO | Orphaned categoryId on soft delete |
| `products` | `product_variants` | ❌ NO | Orphaned productId on soft delete |
| `coupons` | `orders` | ❌ NO | Orphaned couponId on soft delete (LOW risk — data is snapshotted) |

---

## MISSING INDEXES

| Table | Column(s) | Recommended Index |
|-------|-----------|-------------------|
| `orders` | `userId, status` | `idx_orders_userId_status` for customer order history |
| `orders` | `createdAt` (already has range index) | Consider for date-range queries |
| `product_variants` | `productId` | Already has foreign key index ✅ |
| `order_items` | `orderId` | Already has foreign key index ✅ |

---

## PRIORITY FIX LIST

### 🟠 HIGH
1. **`lib/db/schema.ts`** — Document all query paths that must filter soft-deleted records. Create a helper like `activeProducts()` or `notDeleted<T>()` to ensure soft-delete filtering is consistent across all queries.
2. **`lib/db/schema.ts`** — Add `ON DELETE SET NULL` or application-level cascade for `products.categoryId` when category is soft-deleted. At minimum, document that all product queries must `WHERE deleted_at IS NULL` on the categories join.
3. **`lib/db/schema.ts`** — Verify all queries that join products with variants filter `products.deleted_at IS NULL`. Create a tracked checklist of all such query paths.

### 🟡 MEDIUM
4. **`lib/db/schema.ts`** — Add check constraint `CHECK (stock >= 0)` on `product_variants.stock` if not already present (should already be there based on schema review)
5. **`lib/db/schema.ts`** — Add `created_at` timestamp to `inventory_logs` if not present for audit trail

### 🟢 LOW
6. Consider adding a `notes` column to `inventory_logs` for manual adjustment reasons
7. Consider adding a composite index on `points_history(userId, type, createdAt)` for points history queries