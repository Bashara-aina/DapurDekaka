# AUDIT-04: Lib Structure, Service Duplication & Schema Issues

**Project:** DapurDekaka.com  
**Auditor:** Deep Code Audit  
**Date:** May 2026  
**Scope:** `lib/`, database schema (`lib/db/schema.ts`)

---

## OVERVIEW

The `lib/` directory has significant **duplication** — the same functionality is implemented in two or more places, creating maintenance risks and potential bugs where one copy is updated but the other isn't.

Key duplication areas:
1. **Shipping calculation** — exists in both `lib/rajaongkir/` and `lib/services/shipping.service.ts`
2. **Midtrans** — exists in both `lib/midtrans/` and `lib/services/payment.service.ts`
3. **Email sending** — exists as both React Email templates (`lib/resend/templates/`) and raw HTML strings (`lib/services/notification.service.ts`)
4. **Cloudinary** — exists in both `lib/cloudinary/upload.ts` and `lib/services/cloudinary.service.ts`

---

## 1. DUPLICATION — Shipping: Two Independent Implementations

### Location A: `lib/rajaongkir/`

```
lib/rajaongkir/client.ts      — base HTTP client
lib/rajaongkir/provinces.ts   — getProvinces() with in-memory cache
lib/rajaongkir/cities.ts     — getCitiesByProvince() with unstable_cache
lib/rajaongkir/calculate-cost.ts — calculateShippingCost() with retry
```

### Location B: `lib/services/shipping.service.ts`

Also exports:
- `calculateShippingCost()` — different implementation, no retry
- `getProvinces()` — simplified
- `getCitiesByProvince()` — simplified

**Problem:** These are two separate, independent implementations of the same RajaOngkir integration. If API keys change, or if the RajaOngkir response format changes, only one might get updated.

**Which one is used where:**
- `lib/rajaongkir/` is used by the checkout flow (`app/(store)/checkout/page.tsx`)
- `lib/services/shipping.service.ts` is used by... (not fully traced in the API routes audit)

**Fix required:** Deprecate one. Standardize on `lib/rajaongkir/` as the canonical implementation and remove the duplication in `shipping.service.ts`. The `lib/services/shipping.service.ts` should be removed or converted to a thin wrapper that calls `lib/rajaongkir/`.

---

## 2. DUPLICATION — Midtrans: Three Implementations

### Location A: `lib/midtrans/`

```
lib/midtrans/client.ts               — Snap client setup
lib/midtrans/create-transaction.ts  — createMidtransTransaction()
lib/midtrans/verify-webhook.ts     — verifyMidtransSignature()
lib/midtrans/status.ts             — checkTransactionStatus() (Core API)
```

### Location B: `lib/services/payment.service.ts`

Also exports:
- `snap` — same Snap client (duplicated)
- `createTransaction()` — creates Midtrans transaction (duplicates `create-transaction.ts`)
- `verifyWebhook()` — verifies Midtrans signature (duplicates `verify-webhook.ts`)
- Full payment flow: creates order, deducts stock, awards points, confirms coupon

### Location C: `lib/midtrans/create-transaction.ts` + `verify-webhook.ts` are imported by `payment.service.ts`

**Problem:** `payment.service.ts` imports from `lib/midtrans/` for the Snap client, but also re-implements the same logic. It's a wrapper around itself.

**Which one is canonical:**
- `lib/services/payment.service.ts` is what API routes actually call (`checkout/initiate`, `webhooks/midtrans`)
- `lib/midtrans/` is what `payment.service.ts` uses (partially)

**Fix required:** 
1. Make `lib/midtrans/` the canonical, low-level SDK wrapper
2. Make `lib/services/payment.service.ts` call `lib/midtrans/` functions, not re-implement them
3. Remove the duplicated `createTransaction()` and `verifyWebhook()` from `payment.service.ts` — it should delegate to the `midtrans/` functions

---

## 3. DUPLICATION — Email: React Email vs Raw HTML

### Location A: React Email Templates (canonical)
```
lib/resend/templates/OrderConfirmation.tsx
lib/resend/templates/OrderShipped.tsx
lib/resend/templates/OrderDelivered.tsx
lib/resend/templates/OrderCancellation.tsx
lib/resend/templates/PasswordReset.tsx
lib/resend/templates/PickupInvitation.tsx
lib/resend/templates/B2BInquiryAutoReply.tsx
lib/resend/templates/B2BInquiryNotification.tsx
lib/resend/templates/B2BQuoteApproved.tsx
lib/resend/templates/B2BQuoteRejected.tsx
lib/resend/templates/TeamInvite.tsx
lib/resend/templates/PointsExpiring.tsx (planned)
```

### Location B: Raw HTML Strings
```
lib/services/notification.service.ts
```
Has `sendOrderConfirmationEmail()` and `sendShippingEmail()` using raw HTML strings:
```typescript
const html = `<html><body><h1>...</h1></body></html>`;
await resend.emails.send({ html, ... });
```

**Problem:** Two different email-sending patterns coexist. The React Email templates are the intended production path (consistent styling, maintainable). The raw HTML strings in `notification.service.ts` are either:
1. Legacy code that was never migrated to React Email
2. A parallel implementation used by a different code path

**Fix required:**
1. Audit all callers of `notification.service.ts`'s email functions
2. Replace with the corresponding React Email template
3. Remove the raw HTML email functions from `notification.service.ts`
4. Keep only the React Email template path

---

## 4. DUPLICATION — Cloudinary: Two Configurations

### Location A: `lib/cloudinary/upload.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // ❌ non-NEXT_PUBLIC
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

### Location B: `lib/services/cloudinary.service.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary';
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, // ✅ NEXT_PUBLIC
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

**Problem:** These two files use different env var names:
- `lib/cloudinary/upload.ts` uses `CLOUDINARY_CLOUD_NAME` (non-public)
- `lib/services/cloudinary.service.ts` uses `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (public)

This is a **bug** — they may point to different cloud names or one might be undefined.

**Fix required:**
1. Standardize on one env var name
2. Preferred: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (safe for client-facing URLs)
3. `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` remain server-only
4. Remove one of the two cloudinary configurations

---

## 5. SCHEMA — Missing `blogPostViews` Table

### Missing Table: `blog_post_views`

The blog system has `is_published`, `published_at`, and `author_id` tracked, but there's no table to record view counts for blog posts. Analytics (page views per post) can't be implemented without this.

**Fix:** Add to `lib/db/schema.ts`:
```typescript
export const blogPostViews = pgTable('blog_post_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => blogPosts.id),
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
  sessionId: varchar('session_id', { length: 255 }), // anonymous session
  userId: uuid('user_id').references(() => users.id), // if logged in
});
```

---

## 6. SCHEMA — Missing `coupon_usages` Index for User Usage

### Table: `coupon_usages`

The `coupon_usages` table has `user_id` as nullable (for guest orders). There's no composite index for:
```sql
CREATE INDEX idx_coupon_usages_user_coupon
  ON coupon_usages(coupon_id, user_id)
  WHERE user_id IS NOT NULL;
```

This is needed for the `max_uses_per_user` coupon validation efficiently (count how many times user X has used coupon Y).

**Fix:** Add to `lib/db/schema.ts`:
```typescript
// In couponUsages definition:
userId: uuid('user_id').references(() => users.id), // already exists
// Add index manually via migration or raw SQL
```

---

## 7. SCHEMA — `inventory_logs.variant_id` Missing FK Constraint

### Table: `inventory_logs`

```typescript
variantId: uuid('variant_id').notNull().references(() => productVariants.id),
// But no ON DELETE CASCADE
```

If a variant is deleted, `inventory_logs` records would become orphaned (pointing to non-existent variants).

**Fix:** Add `onDelete: 'cascade'` to the `variantId` foreign key in `inventoryLogs` schema, or add a migration to add the FK constraint.

---

## 8. SCHEMA — `order_items` has FK to `products.id` (denormalization)

### Table: `order_items`

```typescript
productId: uuid('product_id').notNull().references(() => products.id),
```

This references `products.id`, which is soft-deleted (`deleted_at` can be set). If a product is soft-deleted after an order is placed, the FK constraint might still be fine (the product row exists), but there's no constraint enforcing referential integrity if the product were hard-deleted.

**Assessment:** Low severity — the product row exists in `order_items` as a snapshot (denormalized). The FK is for query convenience, not enforcement. Not a bug.

---

## 9. MISSING — Points Service Has No `getPointsSummary`

### `lib/services/points.service.ts`

The points service handles earn, redeem, expire, and adjust. But there's no function to get a user's current points summary: total earned, total redeemed, total expired, current balance, and expiry breakdown.

**Fix:** Add to `lib/services/points.service.ts`:
```typescript
export async function getPointsSummary(userId: string) {
  const records = await db.query.pointsHistory.findMany({
    where: eq(pointsHistory.userId, userId),
    orderBy: asc(pointsHistory.createdAt),
  });

  const totalEarned = records.filter(r => r.type === 'earn').reduce((sum, r) => sum + r.pointsAmount, 0);
  const totalRedeemed = records.filter(r => r.type === 'redeem').reduce((sum, r) => sum + Math.abs(r.pointsAmount), 0);
  const totalExpired = records.filter(r => r.type === 'expire').reduce((sum, r) => sum + Math.abs(r.pointsAmount), 0);

  return { totalEarned, totalRedeemed, totalExpired, balance: totalEarned - totalRedeemed - totalExpired };
}
```

---

## 10. MISSING — `lib/errors.ts` Exists But Not Used Consistently

### `lib/errors.ts`

The project has custom error classes (`AppError`, `PaymentError`, `StockError`, `CouponError`) defined, but API routes often use plain `Error` or throw strings.

**Example of inconsistency:**
```typescript
// lib/services/payment.service.ts
throw new Error('Insufficient stock');  // ❌ should be StockError
throw new Error('Invalid coupon');      // ❌ should be CouponError
```

**Fix:** Replace all plain `throw new Error('...')` in service files with the appropriate typed error class from `lib/errors.ts`.

---

## 11. MISSING — `lib/utils/api-response.ts` Good But Not Used Consistently

### `lib/utils/api-response.ts`

Excellent typed API response helpers (`success`, `created`, `unauthorized`, `notFound`, `validationError`, `serverError`). However, some API routes still construct `NextResponse.json()` manually instead of using these helpers.

**Example of inconsistency:**
```typescript
// Some routes use:
return NextResponse.json({ success: true, data }, { status: 200 });

// Should use:
return success(data);  // from api-response.ts
```

**Fix:** Audit all API routes and enforce consistent use of `lib/utils/api-response.ts` helpers.

---

## 12. MISSING — `lib/validations/` Schemas Are Scattered

### Current State:
- `lib/validations/index.ts` — `checkoutSchema`, `indonesianPhone`, `orderFormSchema`
- `lib/validations/auth.schema.ts` — `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`
- `lib/validations/product.schema.ts` — `createProductSchema`, `updateProductSchema`, `categorySchema`
- `lib/services/coupon.service.ts` — coupon validation embedded in service (no separate schema)
- `lib/validations/order.schema.ts` — `addressSchema`

### Problem: No `lib/validations/coupon.schema.ts` or `lib/validations/address.schema.ts`

Coupon validation logic is embedded in `coupon.service.ts`. `addressSchema` is in `order.schema.ts` instead of its own file.

**Fix:**
1. Extract coupon validation from `coupon.service.ts` into `lib/validations/coupon.schema.ts`
2. Move `addressSchema` from `order.schema.ts` to `lib/validations/address.schema.ts`
3. Update all imports accordingly

---

## 13. VALIDATION — Phone Normalization Not Used in Checkout

### `lib/validations/index.ts`

The `indonesianPhone` transformer exists:
```typescript
.transform((val) => {
  if (val.startsWith('+62')) return '0' + val.slice(3);
  if (val.startsWith('62')) return '0' + val.slice(2);
  return val;
});
```

**Problem:** The checkout `IdentityForm` (and checkout initiation) does not use this transformer. Phone numbers are stored in various formats (`+628123456789`, `628123456789`, `081234567890`). This causes inconsistency in:
- `orders.recipient_phone`
- `addresses.recipient_phone`
- `users.phone`

**Fix:** Apply the `indonesianPhone` transformer in all forms that collect phone numbers.

---

## 14. MISSING — Cart Merge Has No Conflict Resolution Logic

### `lib/services/payment.service.ts` — `mergeCartOnLogin()`

When a guest logs in and their localStorage cart needs to merge with their DB cart, the current logic:
1. Gets localStorage items
2. Gets DB items
3. Combines them (adds quantities if same `variantId`)

**Problem:** There's no handling for the case where the same product variant is in both carts at a quantity that exceeds available stock. The merge silently accepts the sum, potentially resulting in a cart with quantity > stock.

**Fix:** In `mergeCartOnLogin()`:
```typescript
const mergedItems = localItems.map(localItem => {
  const dbItem = dbItems.find(i => i.variantId === localItem.variantId);
  if (dbItem) {
    const combinedQty = Math.min(localItem.quantity + dbItem.quantity, MAX_CART_QTY);
    return { ...localItem, quantity: combinedQty };
  }
  return localItem;
});
```

---

## 15. VALIDATION — `checkoutSchema` Missing `customerNote` Field

### `lib/validations/index.ts`

The `checkoutSchema` validates: `recipientName`, `recipientEmail`, `recipientPhone`, `addressLine`, `district`, `city`, `province`, `postalCode`, `courierCode`, `courierService`, `courierName`, `courierCost`, `estimatedDays`, `notes`.

But there's no `customerNote` field validation. The `orders.customer_note` column exists in the schema, but there's no schema field for it in `checkoutSchema`.

**Fix:** Add to `checkoutSchema`:
```typescript
customerNote: z.string().max(500).optional(),
```

---

## 16. MISSING — `lib/utils/calculate-points.ts` Was Never Created

### `lib/utils/calculate-points.ts`

**Status:** **MISSING** — The planned file doesn't exist. Points calculation logic is embedded in `lib/services/points.service.ts`.

**Impact:** Low — the logic exists, just not in the planned location. The 50-line function limit might be violated by having it in the service file.

**Fix:** Create `lib/utils/calculate-points.ts` with the calculation:
```typescript
export function calculatePointsEarned(subtotal: number): number {
  return Math.floor(subtotal / POINTS_PER_IDR); // subtotal / 1000
}

export function calculatePointsValue(points: number): number {
  return points * POINTS_VALUE_IDR; // points * 1000
}

export function calculateMaxRedeemable(subtotal: number, pointsBalance: number): number {
  const maxBySubtotal = Math.floor(subtotal * MAX_REDEEM_PCT / POINTS_VALUE_IDR); // 50% of subtotal
  return Math.min(maxBySubtotal, pointsBalance);
}
```

---

## 17. ARCHITECTURE — Service Layer vs Query Files

### The Plan vs Reality

**Planned:** `lib/db/queries/` — thin query modules (orders.ts, products.ts, users.ts, coupons.ts, blog.ts)  
**Actual:** `lib/services/` — service files combining business logic with queries

**Assessment:** The service layer approach is **better** than the planned query files. It follows the layered architecture rules (Controller → Service → Repository), keeps business logic in one place, and makes testing easier.

However, some services are doing **too much**:
- `payment.service.ts` — handles Midtrans transaction creation, stock deduction, points award, coupon confirmation, order creation — 300+ lines
- `coupon.service.ts` — handles validation AND application AND usage recording — mixed concerns

**Fix:** Split oversized services:
- `payment.service.ts` → `PaymentService` + `OrderCreationService` + `StockDeductionService`
- `coupon.service.ts` → `CouponValidationService` + `CouponApplicationService`

---

## 18. CONFIG — Env Var Names Inconsistent for Cloudinary

### `lib/cloudinary/upload.ts` vs `lib/services/cloudinary.service.ts`

| File | Cloud Name Var | Key Var | Secret Var |
|---|---|---|---|
| `lib/cloudinary/upload.ts` | `CLOUDINARY_CLOUD_NAME` | `CLOUDINARY_API_KEY` | `CLOUDINARY_API_SECRET` |
| `lib/services/cloudinary.service.ts` | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `CLOUDINARY_API_KEY` | `CLOUDINARY_API_SECRET` |

**Assessment:** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is correct for client-facing image URLs. `CLOUDINARY_CLOUD_NAME` is wrong — cloud name is not a secret. The duplication suggests these files were written at different times without cross-checking.

**Fix:** Standardize: Use `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` everywhere. The API key and secret remain server-only.

---

## 19. CONFIG — `CLOUDINARY_API_KEY` vs `CLOUDINARY_API_SECRET` Naming

### `lib/cloudinary/upload.ts` vs `.env`

The `.env.example` has `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. But `lib/cloudinary/upload.ts` reads `CLOUDINARY_CLOUD_NAME` (not `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`).

**Fix:** Add to `.env.local` and verify:
```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
Use only `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` in code (it's safe — cloud names are public).

---

## 20. CONSTANTS — `POINTS_VALUE_IDR` vs `POINTS_PER_IDR` Naming Inconsistency

### `lib/constants/points.ts` vs `lib/services/points.service.ts`

The `points.service.ts` uses:
```typescript
const POINTS_PER_IDR = 1000;   // 1 point per Rp 1,000
```

The constant `POINTS_PER_IDR` name is misleading — it actually means "IDR per point" (1000 IDR = 1 point), not "points per IDR" (which would be 0.001 points per IDR).

**Fix:** Rename to `IDR_PER_POINT = 1000` for clarity. Update all references.

---

## 21. DUPLICATION — Auth Config Exists Twice

### `lib/auth/config.ts` vs `middleware.ts` importing from `@/lib/auth`

The `middleware.ts` imports `authMiddleware` from `@/lib/auth`. The `lib/auth/` directory has multiple files: `config.ts`, `check-role.ts`, `require-admin.ts`, `merge-cart.ts`.

**Problem:** The `lib/auth/config.ts` might not be the same as what `middleware.ts` uses — there could be two different auth configurations.

**Fix:** Verify that `lib/auth/config.ts` is the canonical NextAuth config used by both `middleware.ts` and `app/api/auth/[...nextauth]/route.ts`. Remove any duplicate auth setup.

---

## 22. SUMMARY — Priority Actions for Lib Cleanup

| Priority | Action | File(s) |
|---|---|---|
| **HIGH** | Audit and remove raw HTML email sending — use only React Email templates | `lib/services/notification.service.ts` |
| **HIGH** | Fix Cloudinary env var inconsistency — standardize on `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `lib/cloudinary/upload.ts`, `lib/services/cloudinary.service.ts` |
| **HIGH** | Make `payment.service.ts` delegate to `lib/midtrans/` instead of re-implementing | `lib/services/payment.service.ts`, `lib/midtrans/` |
| **HIGH** | Deprecate `lib/services/shipping.service.ts` — use only `lib/rajaongkir/` | `lib/services/shipping.service.ts` |
| **MEDIUM** | Create `lib/validations/coupon.schema.ts` — extract from `coupon.service.ts` | `lib/services/coupon.service.ts` |
| **MEDIUM** | Move `addressSchema` to `lib/validations/address.schema.ts` | `lib/validations/order.schema.ts` |
| **MEDIUM** | Apply `indonesianPhone` transformer in all phone-handling forms | `lib/validations/index.ts`, checkout forms |
| **MEDIUM** | Replace all `throw new Error('...')` in services with typed errors from `lib/errors.ts` | All `lib/services/*.ts` files |
| **MEDIUM** | Create `lib/utils/calculate-points.ts` | Extract from `lib/services/points.service.ts` |
| **LOW** | Rename `POINTS_PER_IDR` to `IDR_PER_POINT` for clarity | `lib/constants/points.ts` |
| **LOW** | Audit `lib/auth/` files — ensure single auth config | `lib/auth/config.ts`, `middleware.ts` |
| **LOW** | Create missing `blogPostViews` schema + migration | `lib/db/schema.ts` |
| **LOW** | Add `max_uses_per_user` index to `coupon_usages` | `lib/db/schema.ts` (manual migration) |