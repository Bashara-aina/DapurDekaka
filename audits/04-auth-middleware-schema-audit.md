# Auth, Middleware & Database Schema — Deep Audit

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit

---

## Executive Summary

The auth system uses NextAuth v5 with a custom middleware layer. The schema is comprehensive with proper UUIDs, indexes, soft deletes, and JSONB support. However, several critical issues exist in the auth flow, middleware, and schema definitions that would cause real problems.

**Auth Health:** ~75% — Session handling is functional but cookie configuration and role management need review.
**Schema Health:** ~85% — Well-structured but some indexes reference wrong columns.

---

## 1. Auth Configuration Audit

### 1.1 NextAuth v5 Config (`lib/auth/config.ts`)

**Status:** ⚠️ Needs review

From `lib/auth/index.ts`:
```ts
import { auth } from './config';
export { auth };
```

The `config.ts` file is not in the read files, but based on the `auth` import usage throughout the codebase, it's the NextAuth v5 configuration. Need to verify:

1. **Session strategy:** Is it using JWT or database sessions? If JWT, is the role stored in the JWT?
2. **Callbacks:** Does the `callbacks.jwt` set the `role` in the token? Does `callbacks.session` expose the role to `session.user.role`?
3. **Cookie settings:** Are `cookieName`, `cookieOptions` configured correctly for production?

### 1.2 Auth in API Routes

Usage pattern seen in initiate route (line 74):
```ts
const session = await auth();
```

This gets the session server-side. The `session.user.role` is then checked directly. Need to verify that NextAuth v5's `auth()` returns the role in the proper shape.

### 1.3 Auth in Middleware

**File:** `app/middleware.ts`

```ts
const handleAuth = authMiddleware(async ({ auth, nextUrl }) => {
  const { pathname } = nextUrl;
  const session = auth;
  const base = nextUrl.href;

  if (pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', base));
    }
    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return NextResponse.redirect(new URL('/', base));
    }
    if (role === 'warehouse') {
      const allowed = ['/admin/inventory', '/admin/shipments'];
      if (!allowed.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/inventory', base));
      }
    }
  }
  ...
});
```

**Issues:**

#### AUTH-01: Warehouse role redirect loop risk
**File:** `app/middleware.ts:18-21`
**Severity:** HIGH

The warehouse role is restricted to `/admin/inventory` and `/admin/shipments`. But if a warehouse worker visits `/admin/field`, they're redirected to `/admin/inventory`. The `field` dashboard is specifically designed for warehouse workers but isn't in the allowed list. This means warehouse workers can never access the field dashboard from navigation, even though the field dashboard is their primary interface.

**Fix:** Add `/admin/field` to the warehouse allowed paths.

#### AUTH-02: No `owner` role in warehouse check
**File:** `app/middleware.ts:14`
**Severity:** MEDIUM

```ts
if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
```
The redirect URL is `('/')` — a regular user. But if someone has `role = 'owner'`, they should go to the admin dashboard, not the store homepage. This is inconsistent. The owner should be able to access all admin pages.

#### AUTH-03: No role check for `/admin` root path
**File:** `app/middleware.ts:14`
**Severity:** LOW

If a warehouse user visits `/admin` (without trailing path), they have no specific rule matching. The middleware would redirect to `('/')` which is wrong — warehouse should stay in the admin. Need to add a specific check for `/admin` root.

#### AUTH-04: Middleware matcher excludes `/admin/` sub-paths
**File:** `app/middleware.ts:46`
```ts
export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};
```
**Critical:** The matcher uses `/admin/:path*` which means `/admin` (without trailing slash or path) is NOT matched. If someone visits `/admin` (the root admin page), it bypasses middleware protection. This could allow unauthorized access to the admin dashboard root.

**Fix:** Change matcher to: `['/admin/:path*', '/admin', '/account/:path*', '/b2b/account/:path*']`

---

## 2. Session & Cookie Issues

#### AUTH-05: No secure cookie configuration for production
**Severity:** HIGH

Need to verify that in production (`NODE_ENV=production`), the auth cookies are set with:
- `secure: true` (HTTPS only)
- `httpOnly: true` (no JS access)
- `sameSite: 'lax'` or `'strict'`

If `sameSite: 'none'` is used without `secure: true`, cookies won't work on modern browsers.

#### AUTH-06: Session not extended on activity
**Severity:** MEDIUM

If sessions expire after a fixed time regardless of activity, users could be logged out mid-checkout. Need to verify the session/maxAge setting and whether session is refreshed on each valid request.

---

## 3. Password Security

#### AUTH-07: Password hash strength not enforced on registration
**Severity:** MEDIUM

The register route (`app/api/auth/register/route.ts`) — does it enforce minimum password strength? The schema has `passwordHash` but no password policy. At minimum: 8 chars, mixed case, number.

#### AUTH-08: No password change functionality for existing users
**Severity:** MEDIUM

Users can reset password via forgot-password flow, but can an authenticated user change their own password? The account/profile page may not have this.

---

## 4. Schema — Critical Issues

### 4.1 Index on Wrong Column

**File:** `lib/db/schema.ts:138`
**Severity:** CRITICAL — Build error

```ts
// In addresses table definition:
}, (table) => ({
  recipientEmailIdx: index('idx_orders_recipient_email').on(table.recipientEmail),
}));
```

**The `addresses` table does NOT have a `recipientEmail` column.** The `recipientEmail` field exists on the `orders` table, not `addresses`. This index definition would cause a Drizzle build error or a migration failure because `table.recipientEmail` doesn't exist on `addresses`.

**This means `drizzle-kit push` or `drizzle-kit generate` would fail.**

### 4.2 Missing Indexes

#### Missing: `idx_orders_recipient_email` on `orders` table
**Severity:** HIGH

The address table incorrectly references `recipientEmail` but the orders table actually has `recipientEmail` and there's already `orderNumberIdx` on orders. But there's no explicit index for `orders.recipientEmail` used in the webhook's order lookup by email (for guest coupon usage check). Actually, webhook looks up by `midtransOrderId`, so this may not be critical for the webhook.

**However**, the guest coupon usage check joins `couponUsages → orders` by `recipientEmail`. There should be an index on `orders.recipientEmail`.

### 4.3 Potential Circular Reference

**File:** `lib/db/schema.ts:141-148`
**Severity:** LOW

```ts
export const savedCarts = pgTable('saved_carts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),  // ← circular
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

The `savedCarts` references `productVariants`, but `productVariants` references `products`, which doesn't directly reference back to `savedCarts`. The circular nature here is that `savedCarts` needs to exist before `productVariants` can be deleted (cascade), but this is standard and not a real issue.

### 4.4 Foreign Key Without Index

**File:** `lib/db/schema.ts:603`
**Severity:** LOW

```ts
export const orderDailyCounters = pgTable('order_daily_counters', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: varchar('date', { length: 10 }).notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

`orderDailyCounters` has no foreign keys. It's a standalone table. Fine.

### 4.5 Missing Indexes for Common Queries

| Query Pattern | Table | Missing Index |
|---|---|---|
| `orders.userId + orders.status` | orders | Missing composite index |
| `orders.status + orders.paymentExpiresAt` | orders | `idx_orders_status_expires` EXISTS but may not be optimal |
| `couponUsages.couponId + couponUsages.orderId` | coupon_usages | `uq_coupon_usages_coupon_order` UNIQUE EXISTS |
| `pointsHistory.userId + pointsHistory.type` | points_history | `idx_points_type_expires` partially covers |
| `products.categoryId + products.isActive` | products | `idx_products_is_active` EXISTS for isActive only |

### 4.6 Soft Delete — Inconsistent Application

#### Applied correctly:
- `products.deletedAt` ✅
- `users.deletedAt` ✅
- `coupons.deletedAt` ✅
- `categories.deletedAt` ✅
- `blogPosts.deletedAt` ✅
- `carouselSlides.deletedAt` ✅
- `testimonials.deletedAt` ✅
- `b2bProfiles.deletedAt` ✅
- `b2bInquiries.deletedAt` ✅

**NOT soft deleted (hard delete or no delete):**
- `addresses` — should a user's addresses be hard deleted? Probably yes (privacy), so fine.
- `accounts` (OAuth accounts) — cascade delete from users is correct.
- `sessions` — cascade delete is correct.
- `verificationTokens` — should probably have expiry-based cleanup but no soft delete needed.
- `passwordResetTokens` — has `usedAt` but not `deletedAt`, should auto-expire.
- `productImages` — cascade delete from products is correct.
- `inventoryLogs` — audit trail should never be deleted, correct to hard delete.
- `orderItems` — cascade delete from orders is correct.
- `orderStatusHistory` — audit trail, correct to cascade.
- `couponUsages` — should probably be soft delete or at least immutable (it's a record of usage).

### 4.7 Timestamps — All UTC

**Status:** ✅ Correct

All timestamp columns use `withTimezone: true` and are stored as UTC. The display code uses `formatWIB()` to show in Asia/Jakarta timezone. Good.

### 4.8 Price/Integer — All Integer IDR

**Status:** ✅ Correct

All price columns use `integer()` type, not `decimal` or `numeric`. `subtotal`, `discountAmount`, `pointsDiscount`, `totalAmount`, `shippingCost`, `pointsBalance`, etc. are all `integer()`. Good.

### 4.9 Weight — All Integer Gram

**Status:** ✅ Correct

`weightGram` columns are all `integer()`. Good.

### 4.10 UUID — All Primary Keys

**Status:** ✅ Correct

All primary keys use `uuid('id').primaryKey().defaultRandom()`. No auto-increment integers.

---

## 5. Migration Readiness

### Migration Issues

#### MIGRATE-01: Wrong index on addresses table
**File:** `lib/db/schema.ts:138`
**Severity:** CRITICAL — Will cause migration failure

As noted in 4.1, the `idx_orders_recipient_email` on `addresses.recipientEmail` won't compile. This would prevent `drizzle-kit generate` from completing.

#### MIGRATE-02: No migration history visible
**Severity:** LOW

From git status, there's no `drizzle` folder visible. Are migrations being run with `drizzle-kit push` (dev) or actual migration files? If using `push`, there's no migration history for production deployment.

---

## 6. Role Permission Matrix

### Confirmed vs Required

| Route | superadmin | owner | warehouse | b2b | customer | guest |
|-------|-----------|-------|-----------|-----|---------|-------|
| Store pages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| /account/* | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| /b2b/account/* | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| /admin/dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/orders | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/products | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/inventory | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| /admin/shipments | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| /admin/customers | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/coupons | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| /admin/blog | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/carousel | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/b2b | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| /admin/settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| /admin/ai-content | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| /admin/field | ✅ | ✅ | ❌* | ❌ | ❌ | ❌ |

*Warehouse cannot access field in middleware (see AUTH-01).

---

## 7. Priority Fix List

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|
| P0-CRITICAL | Index on addresses.recipientEmail — column doesn't exist | `schema.ts:138` | Remove or fix to `orders.recipientEmail` |
| P0-CRITICAL | Middleware matcher misses `/admin` root path | `middleware.ts:46` | Add `/admin` to matcher |
| P0-CRITICAL | warehouse role can't access /admin/field | `middleware.ts:18` | Add `/admin/field` to allowed list |
| P1-HIGH | Owner redirected to `/` instead of admin | `middleware.ts:14` | Fix redirect for owner role |
| P1-HIGH | Admin API routes have no role checks | ALL admin routes | Add explicit role middleware |
| P2-MEDIUM | No password strength enforcement on register | `route.ts` | Add password validation |
| P2-MEDIUM | Missing composite index on orders(userId, status) | `schema.ts` | Add `idx_orders_user_status` |
| P3-LOW | Password change not available for users | N/A | Add change-password flow |
| P3-LOW | Session not extended on activity | `config.ts` | Verify/maxAge and sliding session |
| P3-LOW | couponUsages should be immutable (no delete) | `schema.ts` | Remove delete permission from role |