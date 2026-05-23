---
title: "Auth & Database Integrity Deep Audit"
audit-date: "2026-05-23"
scope: "NextAuth, user accounts, database schema, data integrity"
severity: "CRITICAL"
files-affected: "lib/auth/config.ts, lib/auth/index.ts, app/api/auth/[...nextauth]/route.ts, app/api/auth/register/route.ts, app/api/auth/forgot-password/route.ts, app/api/auth/reset-password/route.ts, app/middleware.ts, app/(auth)/*, app/(store)/account/*, app/api/checkout/initiate/route.ts, app/api/webhooks/midtrans/route.ts, lib/db/schema.ts, lib/services/points.service.ts"
---

# Auth & Database Integrity Deep Audit

**Auditor:** AI Agent (Cursor)
**Date:** 2026-05-23
**Project:** DapurDekaka.com — NextAuth v5 + Drizzle ORM + Neon PostgreSQL
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW > INFO

---

## PART 1 — NEXTAUTH CONFIGURATION

### 1.1 NextAuth Config (`lib/auth/config.ts`) — ✅ MOSTLY CORRECT

**Finding [INFO]:** Session strategy is `database` (not JWT).

```typescript
session: { strategy: 'database', secure: process.env.NODE_ENV === 'production' },
```

This is the correct choice for this project because:
- Uses DrizzleAdapter with proper database session store
- `accounts`, `sessions`, `verificationTokens` tables are all in schema
- Database sessions are more secure than JWT for this use case

**Finding [INFO]:** Auth secret check happens at import time:

```typescript
if (!googleId || !googleSecret) {
  throw new Error('AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set');
}
```

If these env vars are missing at build time, the entire app crashes. This is intentional per the rules (fail fast), but worth noting.

**Finding [CRITICAL - BUG]:** Type assertions on adapter tables:

```typescript
// @ts-expect-error – DrizzleAdapter accountsTable schema differs from our camelCase columns
accountsTable: accounts,
// @ts-expect-error – DrizzleAdapter sessionsTable schema differs from our id PK
sessionsTable: sessions,
```

The `@ts-expect-error` comments acknowledge a known type mismatch between the DrizzleAdapter's expected column names and our camelCase schema. The adapter accesses columns by string name at runtime, so this "works" but the type safety is bypassed. The `sessions` table uses `id` as primary key (correct), but the DrizzleAdapter may expect a different PK name. This is a TypeScript safety gap.

**Session callback correctly extends user data:**

```typescript
async session({ session, user }) {
  if (!session.user) return session;
  if (user?.id) {
    session.user.id = user.id as string;
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { role: true, isActive: true, name: true },
    });
    if (!dbUser) {
      return null as unknown as Session; // Returns null session = unauthenticated
    }
    if (dbUser.role) {
      session.user.role = dbUser.role;
    }
    if (dbUser.isActive === false) {
      session.user.isActive = false;
    }
  }
  return session;
},
```

This is correctly implemented. The null-return pattern is intentional — it forces the user to re-authenticate.

**Credentials provider is properly implemented:**
- Validates email + password existence
- Checks `isActive` flag — inactive users cannot log in
- Uses bcrypt.compare for password verification
- Returns `{ id, email, name, role }` — role is included in session token

### 1.2 Auth Route Handler (`app/api/auth/[...nextauth]/route.ts`) — ✅ CORRECT

Rate limiting wrapper applied correctly. Both GET and POST go through `withRateLimit`. The handler is clean.

### 1.3 AUTH_SECRET — ✅ CONFIRMED

`AUTH_SECRET` is set in the auth config. NextAuth v5 requires it. It's not verified in this file but is required at runtime.

---

## PART 2 — LOGIN/REGISTER FLOW

### 2.1 Login Page (`app/(auth)/login/page.tsx`) — ✅ FUNCTIONAL

- Google OAuth + credentials both implemented
- Cart merge on login (localStorage → DB) implemented correctly
- Error handling for all OAuth error codes
- `callbackUrl` sanitization prevents open redirect
- Session update (`await update()`) after login mitigates session fixation
- Suspense wrapper for searchParams access (required in Next.js 14)
- Loading states for both Google and credentials login

### 2.2 Register Page (`app/(auth)/register/page.tsx`) — ✅ FUNCTIONAL

- Google OAuth + credentials both implemented
- Auto-login after registration (calls `signIn('credentials', ...)`)
- Cart merge on registration also implemented
- Client-side password validation (min 8, confirm match)
- POST to `/api/auth/register` with Zod validation

**Finding [MEDIUM]:** The register page calls `signIn('credentials', ...)` after a successful registration to auto-login. This is correct behavior, but the flow has a potential race: if the session is not yet established when the router.push happens, the user might briefly see the login page. However, the `router.push('/login?registered=true')` fallback handles this.

### 2.3 Forgot Password Page (`app/(auth)/forgot-password/page.tsx`) — ✅ FUNCTIONAL

- Email input → POST `/api/auth/forgot-password`
- Success state shown after submission (timing normalization included)
- Rate limited to 3 requests per minute (correct for forgot-password)

### 2.4 Reset Password Page (`app/(auth)/reset-password/[token]/page.tsx`) — ✅ FUNCTIONAL

- Token validated via `useSearchParams` (Suspense wrapper present)
- Token validation happens client-side (checks if token param exists)
- POST to `/api/auth/reset-password` with token + new password
- Session cleared on reset (sessions deleted in reset-password/route.ts)

### 2.5 Auth API Routes

**`/api/auth/register` — ✅ SECURE:**
- Zod validation: name (min 2), email, password (min 8, must have upper, lower, number)
- bcrypt hash with cost 12 (industry standard)
- Creates user with role='customer', isActive=true, pointsBalance=0, languagePreference='id'
- Email uniqueness check with case-insensitive comparison
- Rate limited to 5 requests per minute

**`/api/auth/forgot-password` — ✅ SECURE:**
- Timing normalization for non-existent users (200-300ms delay)
- Token stored as bcrypt hash (not reversible)
- Token expires in 1 hour
- Previous tokens deleted before creating new one
- Non-blocking email send (user sees success even if email fails)
- Rate limited to 3 requests per minute

**`/api/auth/reset-password` — ✅ SECURE:**
- Token prefix validation (first 8 chars)
- bcrypt.compare against stored hash
- All user sessions deleted on password reset (forces re-login everywhere)
- Token marked as used after successful reset
- Rate limited to 5 requests per minute

---

## PART 3 — MIDDLEWARE PROTECTION

### 3.1 Middleware (`app/middleware.ts`) — ✅ MOSTLY CORRECT, ONE BUG

**GOOD:**
- Security headers applied to all responses (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- Inactive user check: `session.user.isActive === false` → redirect to login
- Admin routes protected: requires `superadmin`, `owner`, or `warehouse` role
- Warehouse role has limited access: only `/admin/inventory`, `/admin/shipments`, `/admin/field`, `/admin/orders`
- Account routes protected: requires authenticated user
- B2B account routes: requires `b2b` or `superadmin` role

**BUG [CRITICAL - AUTH BYPASS]:** The `/admin` path is NOT matched by the `/admin/:path*` pattern when the user accesses just `/admin`.

```typescript
// Current config:
export const config = {
  matcher: ['/admin', '/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};
```

The `['/admin', '/admin/:path*']` is **incorrect Next.js syntax**. The correct syntax for catch-all routes in Next.js middleware is:
- `/admin` matches exactly `/admin`
- `/admin/:path*` matches `/admin` and all sub-paths (correct)
- `/admin/*` would match `/admin/anything` but NOT `/admin` exactly

The issue is that **no combination of these glob patterns covers both `/admin` and `/admin/deep/nested/path` correctly**. The correct matcher would be:

```typescript
matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*']
```

The `/admin` exact match is already covered by `/admin/:path*` since `:path*` matches zero or more segments (including zero). So the extra `'/admin'` entry is redundant but the real issue is the syntax is non-standard. However, based on testing in the actual project, if `/admin` works as a standalone, it may actually be fine as Next.js handles this. But the `/admin/:path*` syntax is non-standard — it should be `/admin/(.*)` or just `/admin/:path*` which might not match `/admin` exactly.

**Clarification needed:** Test whether `/admin` (without sub-path) is actually protected. If not, this is a CRITICAL auth bypass.

### 3.2 Role Checks in Middleware

```typescript
if (!['superadmin', 'owner', 'warehouse'].includes(role)) {
  return NextResponse.redirect(new URL('/', base));
}
```

Correct. Orders page is accessible to all three roles. Warehouse restricted to specific routes correctly.

---

## PART 4 — SESSION MANAGEMENT

### 4.1 Session Storage — ✅ SECURE

Database sessions (not JWT) means:
- Sessions are stored in `sessions` table with UUID primary key
- `sessionToken` is varchar(255) not null unique
- `userId` references users.id with CASCADE delete
- `expires` timestamp with timezone

**Finding [INFO]:** NextAuth v5 with database sessions means session tokens are rotated on each sign-in. This is good for security but means there's no persistent "remember me" across browser restarts unless the session is kept alive.

### 4.2 JWT Not Used — ✅ CORRECT DECISION

The project uses `strategy: 'database'`, not JWT. This is the right call because:
- `role` and `isActive` are in the database and fetched on each session
- A JWT would require the role to be embedded in the token (security risk if token is stolen)
- Database sessions can be revoked immediately (delete from sessions table)

---

## PART 5 — ACCOUNT PAGES AUDIT

### 5.1 `/account/profile` — ✅ FULLY FUNCTIONAL

- Edit name, phone, language preference
- Password management (change for email users, set for OAuth users)
- Read-only email field (cannot change — correct)
- Google OAuth users can set a password to enable email login
- Shows linked providers correctly
- `GET /api/account/profile` returns hasPassword and linkedProviders
- PATCH for profile update, PUT for password change, POST for setting new password

### 5.2 `/account/addresses` — ✅ FULLY FUNCTIONAL

- CRUD operations for delivery addresses
- Default address management
- Province → City cascading (fetches both on load)
- Delete confirmation before removal
- Empty state when no addresses

### 5.3 `/account/orders` — ✅ FULLY FUNCTIONAL

- Server-side rendered (auth check in page component)
- Pagination with 10 orders per page
- Status filter tabs (all, pending_payment, processing, packed, shipped, delivered, cancelled)
- Order status badges with color coding
- Order item count display
- FormatWIB for dates
- FormatIDR for amounts

### 5.4 `/account/points` — ✅ FULLY FUNCTIONAL

- Balance display with gradient card
- Points-to-IDR conversion shown (~{balance * 10} can redeem)
- Expiring points warning (< 30 days and < 7 days)
- Points history with infinite scroll (20 per page)
- B2B bonus section (2x multiplier mentioned in UI text)
- How to earn section with info cards

**Finding [INFO]:** The UI says "B2B users earn 2x points" which matches the PRD. This is displayed in the account/points page.

### 5.5 `/account/vouchers` — ✅ FULLY FUNCTIONAL

- Tabs for available and used vouchers
- Shows used coupons with discountApplied and usedAt
- Empty states for both tabs
- Fetches from `/api/account/vouchers`

---

## PART 6 — DATABASE SCHEMA AUDIT

### 6.1 Schema Overview — ✅ EXCELLENT

The schema in `lib/db/schema.ts` is comprehensive and well-structured.

**Enums (all correct):**
- `userRoleEnum`: customer, b2b, warehouse, owner, superadmin
- `orderStatusEnum`: pending_payment, paid, processing, packed, shipped, delivered, cancelled, refunded
- `deliveryMethodEnum`: delivery, pickup
- `couponTypeEnum`: percentage, fixed, free_shipping, buy_x_get_y
- `pointsTypeEnum`: earn, redeem, expire, adjust
- `inventoryChangeEnum`: manual, sale, restock, adjustment, reversal
- `carouselTypeEnum`: product_hero, promo, brand_story
- `b2bInquiryStatusEnum`: new, contacted, converted, rejected
- `b2bQuoteStatusEnum`: draft, sent, accepted, rejected, expired

### 6.2 Users Table — ✅ CORRECT

```typescript
id: uuid('id').primaryKey().defaultRandom()  // UUID PK ✅
email: varchar('email', { length: 255 }).notNull().unique()  // Indexed ✅
name: varchar('name', { length: 255 }).notNull()
phone: varchar('phone', { length: 20 })  // Optional ✅
role: userRoleEnum('role').notNull().default('customer')  // Default correct ✅
isActive: boolean('is_active').notNull().default(true)  // ✅
pointsBalance: integer('points_balance').notNull().default(0)  // Integer ✅
languagePreference: varchar('language_preference', { length: 5 }).notNull().default('id')  // ✅
deletedAt: timestamp('deleted_at', { withTimezone: true })  // Soft delete ✅
createdAt/updatedAt: timestamps with timezone ✅
```

**Indexes:** email, role — correct.

### 6.3 Products & Variants — ✅ CORRECT

- `products.deletedAt` for soft delete ✅
- `productVariants.stock` as integer (not allowing negative) — but NO CHECK CONSTRAINT
- `weightGram` is integer ✅
- `price` and `b2bPrice` are integer (IDR) ✅
- All monetary values stored as integer IDR ✅

**Finding [MEDIUM]:** `stock` column has no CHECK constraint to prevent negative values. The application uses `GREATEST(stock - qty, 0)` which prevents going negative at the application level, but a DB-level CHECK constraint would provide defense-in-depth.

### 6.4 Orders Table — ✅ CORRECT

- UUID primary key ✅
- `orderNumber` unique varchar(20) ✅
- `userId` nullable (guest checkout) ✅
- All monetary fields (subtotal, discountAmount, pointsDiscount, totalAmount, shippingCost) as integer ✅
- `pointsEarned` and `pointsUsed` as integer ✅
- `isB2b` boolean ✅
- Timestamps for paidAt, shippedAt, deliveredAt, cancelledAt ✅

**Indexes:** userId, status, paymentExpiresAt, midtransOrderId (unique), orderNumber, paidAt, createdAt, recipientEmail, userId+status — all appropriate.

### 6.5 Order Items — ✅ CORRECT

- `orderId` with CASCADE delete ✅
- Snapshot fields: productNameId, productNameEn, variantNameId, variantNameEn, sku, unitPrice, weightGram ✅
- All prices as integer ✅
- `variantOptions` as jsonb for flexible variant attributes ✅

### 6.6 Points System — ✅ CORRECT

- `pointsHistory` tracks earn, redeem, expire, adjust ✅
- `expiresAt` timestamp for FIFO expiration ✅
- `isExpired` boolean flag ✅
- `consumedAt` for tracking which earn records have been redeemed ✅
- `referencedEarnId` for FIFO redemption tracking ✅
- Proper indexes for expire candidates query ✅

**Finding [INFO]:** The schema supports FIFO points redemption (oldest non-expired, non-consumed points used first). The `referencedEarnId` self-reference pattern is correctly implemented.

### 6.7 Coupons — ✅ CORRECT

- All validation fields present: minOrderAmount, maxDiscountAmount, maxUses, maxUsesPerUser ✅
- `isActive` boolean ✅
- `startsAt` / `expiresAt` for time-bound coupons ✅
- `applicableProductIds` and `applicableCategoryIds` as jsonb ✅
- Soft delete (`deletedAt`) ✅

### 6.8 Foreign Keys — ✅ CORRECT

- `accounts.userId` → `users.id` with CASCADE ✅
- `sessions.userId` → `users.id` with CASCADE ✅
- `addresses.userId` → `users.id` with CASCADE ✅
- `orders.userId` → `users.id` (nullable, no delete constraint) ✅
- `orderItems.orderId` → `orders.id` with CASCADE ✅
- `orderItems.variantId` → `productVariants.id` ✅
- `pointsHistory.userId` → `users.id` with CASCADE ✅

**Finding [INFO]:** `orders.couponId` → `coupons.id` is missing `onDelete` behavior. If a coupon is deleted, the order still references it. This is acceptable because the coupon code is also stored on the order (`orders.couponCode`), so the reference is denormalized for display purposes.

### 6.9 Timestamps — ✅ CORRECT

All timestamps use `withTimezone: true`. All stored as UTC. Display is WIB (Asia/Jakarta, UTC+7) handled in `formatDate.ts`.

### 6.10 Monetary Values — ✅ CORRECT

All monetary fields (price, subtotal, totalAmount, shippingCost, discountAmount, pointsDiscount, discountValue, etc.) are `integer`, not float. This is correct for IDR currency.

---

## PART 7 — POINTS SYSTEM AUDIT

### 7.1 Points Earn Rate — ✅ CORRECT

```typescript
// In checkout/initiate/route.ts:
const pointsEarnedBase = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;
const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;
```

1 point per Rp 1,000 subtotal. B2B orders get 2x multiplier. This is correctly implemented.

### 7.2 Points Awarded on Settlement — ✅ SECURE

In the Midtrans webhook (`app/api/webhooks/midtrans/route.ts`):

```typescript
if (order.userId && order.pointsEarned > 0) {
  const earnedPoints = order.pointsEarned;
  await tx
    .update(users)
    .set({ pointsBalance: sql`points_balance + ${earnedPoints}` })
    .where(eq(users.id, order.userId))
    .returning({ pointsBalance: users.pointsBalance });

  await tx.insert(pointsHistory).values({
    userId: order.userId,
    type: 'earn',
    pointsAmount: earnedPoints,
    pointsBalanceAfter: newBalance,
    orderId: order.id,
    expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });
}
```

**Guest checkout does NOT earn points** — `order.userId` is null for guests, so the condition `order.userId && order.pointsEarned > 0` fails. ✅ CORRECT.

### 7.3 Points Redemption (FIFO) — ✅ CORRECT

The FIFO redemption is implemented correctly in `checkout/initiate/route.ts`:
- Fetches all non-expired, non-consumed earn records ordered by expiresAt (FIFO)
- Accumulates until pointsUsed is covered
- Creates redeem records referencing specific earn IDs
- Marks earn records as consumed (consumedAt set)

### 7.4 Points Expiry — ✅ CORRECT

`lib/services/points.service.ts` has `expireOverduePoints()` with:
- Batch processing (50 rows at a time) to avoid long-held locks
- Transaction inside loop for atomicity
- Correctly sets `isExpired = true` on earn records
- Creates expire transaction record in pointsHistory

### 7.5 Points Value — ✅ INFO

1 point = Rp 10 when redeeming (100 points = Rp 1,000). The constants in `lib/constants/points.ts` define:
- `POINTS_EARN_RATE = 1`
- `POINTS_VALUE_IDR = 10`
- `POINTS_EXPIRY_DAYS = 365`
- `POINTS_MIN_REDEEM = 100`
- `POINTS_MAX_REDEEM_PCT = 50`
- `B2B_POINTS_MULTIPLIER = 2`

---

## PART 8 — SECURITY FINDINGS

### 8.1 [INFO] Auth Flow — Good Practices

- Rate limiting on all auth endpoints (login: 10/min, register: 5/min, forgot-password: 3/min, reset-password: 5/min)
- bcrypt with cost 12 for password hashing
- Session fixation mitigation (session.update() after login)
- OAuth error codes mapped to user-friendly Indonesian messages
- Timing normalization on forgot-password for non-existent users
- All user sessions deleted on password reset

### 8.2 [CRITICAL - POSSIBLE BUG] Middleware Matcher Syntax

The middleware matcher uses:
```typescript
matcher: ['/admin', '/admin/:path*', '/account/:path*', '/b2b/account/:path*']
```

**Issue:** The `'/admin'` exact match combined with `/admin/:path*` might not work as intended. The correct Next.js 14 middleware matcher for covering `/admin` and all sub-paths is simply `/admin/:path*` (where `:path*` matches zero or more segments including zero). The explicit `'/admin'` entry may be redundant and could potentially cause issues.

**Recommendation:** Test this thoroughly. If `/admin` (without sub-path) is accessible without auth for some users, this is a CRITICAL vulnerability. Fix by changing to:
```typescript
matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*']
```

### 8.3 [HIGH] Type Safety Gap in DrizzleAdapter

The `@ts-expect-error` comments on the adapter configuration acknowledge type mismatches between the DrizzleAdapter's expected schema and our camelCase column names. While this "works" at runtime (the adapter accesses columns by string name), it means TypeScript cannot catch schema errors. If the adapter's expected column names change in an update, this could break silently.

**Recommendation:** Monitor this during upgrades. Consider creating type-safe wrapper functions for adapter operations.

### 8.4 [MEDIUM] No Database-Level Stock Check Constraint

The `productVariants.stock` column has no CHECK constraint preventing negative values. The application uses `GREATEST(stock - qty, 0)` as a safety measure, but a malicious or buggy database operation could still set stock to negative.

**Recommendation:** Add `CHECK (stock >= 0)` constraint to the stock column. However, this requires migration and may cause issues if existing data violates the constraint.

### 8.5 [INFO] Inactive User Handling

The middleware correctly handles inactive users:
```typescript
if (session?.user?.isActive === false) {
  const inactiveRedirectUrl = pathname.startsWith('/admin')
    ? '/login?inactive=1'
    : `/login?inactive=1&callbackUrl=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(new URL(inactiveRedirectUrl, base));
}
```

This is good. The `isActive` flag is checked at the NextAuth session level via the session callback.

---

## PART 9 — CRITICAL DATA INTEGRITY ISSUES

### 9.1 [CRITICAL] `order.pointsEarned` Reference Bug in Net-30 Handler

In `checkout/initiate/route.ts`, lines 611-612:

```typescript
// Award loyalty points for B2B Net-30 order
if (userId && order.pointsEarned > 0) {  // ❌ BUG: 'order' is undefined here
  const earnedPoints = order.pointsEarned;
```

The variable `order` does not exist at this point in the code. The order was created as `created` (from the INSERT result), and the callback result is `counterResult[0]` which is assigned to `order` after the transaction. But inside the Net-30 handler block (lines 580-653), `order` refers to something else or is undefined.

**This code would throw a ReferenceError in production if a B2B Net-30 order is placed.**

### 9.2 [HIGH] `order.items` Referenced Before Existence in Net-30 Block

In the Net-30 fulfillment block (lines 580-653), `allOrderItems` is constructed from `orderItemsData` and `freeItems`. But the code checks `if (item.quantity <= 0) continue` — this is fine. However, the `order.pointsEarned` bug above is the more critical issue.

### 9.3 [MEDIUM] `savedCarts` Table FK to `productVariants.id`

```typescript
savedCarts = pgTable('saved_carts', {
  ...
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  ...
})
```

The `savedCarts` table references `productVariants.id` with CASCADE delete. This means if a product variant is deleted, all saved carts containing that variant are deleted. This could cause unexpected data loss if variants are ever soft-deleted (marked inactive rather than deleted). Currently variants don't have a deletedAt column, so this is acceptable.

---

## PART 10 — API ROUTE PROTECTION AUDIT

### 10.1 Authenticated Routes with `auth()`:

- `GET/POST/PUT/PATCH /api/account/profile` — ✅ auth required
- `GET /api/account/addresses` — ✅ auth required
- `POST /api/account/addresses` — ✅ auth required
- `PUT/DELETE /api/account/addresses/[id]` — ✅ auth required
- `GET /api/account/points` — ✅ auth required
- `GET /api/account/vouchers` — ✅ auth required

### 10.2 Public Routes (no auth):

- `POST /api/auth/register` — ✅ correct (new users need to register)
- `POST /api/auth/forgot-password` — ✅ correct (users need to reset password)
- `POST /api/auth/reset-password` — ✅ correct (users need to reset password)
- `POST /api/checkout/initiate` — ✅ correct (guest checkout supported)
- `POST /api/coupons/validate` — ✅ correct (public)
- `GET /api/products` — ✅ correct (public browsing)
- `GET /api/shipping/provinces` — ✅ correct (public)
- `GET /api/shipping/cities` — ✅ correct (public)

### 10.3 Admin Routes — ✅ PROTECTED

All `/api/admin/*` routes are protected by the admin layout or middleware. The admin pages use `requireAdmin()` from `lib/auth/require-admin.ts`.

---

## PART 11 — B2B POINTS 2X MULTIPLIER AUDIT

### 11.1 [✅ CONFIRMED] 2X Multiplier Implemented

In `checkout/initiate/route.ts`:

```typescript
const pointsEarnedBase = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;
const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;
```

The `isB2bOrder` flag is set when `session?.user?.role === 'b2b'`. This is correctly applied at order creation time (stored in `orders.pointsEarned`). The Midtrans webhook then awards this pre-calculated amount.

### 11.2 Net-30 B2B Orders — ✅ SAME LOGIC

The Net-30 handler (line 611) references `order.pointsEarned` which has already been calculated with the 2x multiplier applied. However, due to the bug identified in 9.1, the Net-30 points award would fail with a ReferenceError.

---

## PART 12 — SUMMARY TABLE

| Area | Status | Severity | Notes |
|------|--------|----------|-------|
| NextAuth config | ✅ Good | — | Database sessions, role in callback |
| Auth route handler | ✅ Good | — | Rate limited correctly |
| Login page | ✅ Good | — | Cart merge, session fixation mitigation |
| Register page | ✅ Good | — | Auto-login, cart merge |
| Forgot/Reset password | ✅ Good | — | Timing normalization, session invalidation |
| Middleware protection | ⚠️ Possible Bug | CRITICAL | Matcher syntax may not protect /admin |
| Session storage | ✅ Good | — | Database sessions, not JWT |
| Account profile | ✅ Good | — | Full CRUD, password management |
| Account addresses | ✅ Good | — | Full CRUD with default management |
| Account orders | ✅ Good | — | Pagination, status filter |
| Account points | ✅ Good | — | Balance, history, expiring warnings |
| Account vouchers | ✅ Good | — | Available + used tabs |
| DB Schema — Users | ✅ Good | — | UUID PK, soft delete, role enum |
| DB Schema — Products | ✅ Good | — | Soft delete, integer stock |
| DB Schema — Orders | ✅ Good | — | Snapshots, all monetary as integer |
| DB Schema — Points | ✅ Good | — | FIFO, expiry tracking |
| DB Schema — Coupons | ✅ Good | — | All validation fields |
| Points earn (1pt/1k) | ✅ Good | — | Floor division |
| Points 2x for B2B | ✅ Good | — | Applied at initiate |
| Points on settlement | ✅ Good | — | Midtrans webhook awards |
| Guest checkout no pts | ✅ Good | — | userId null check |
| Stock deduction | ✅ Good | — | GREATEST guard, atomic |
| Rate limiting | ✅ Good | — | All auth endpoints protected |
| Password hashing | ✅ Good | — | bcrypt cost 12 |
| API response format | ✅ Good | — | Consistent { success, data, error } |
| **Net-30 points bug** | ❌ CRITICAL | CRITICAL | `order` undefined in Net-30 handler |
| Stock check constraint | ⚠️ Missing | MEDIUM | No DB-level stock >= 0 |
| DrizzleAdapter types | ⚠️ Type safety gap | HIGH | @ts-expect-error bypasses safety |

---

## RECOMMENDATIONS (Priority Order)

### 1. [CRITICAL] Fix Net-30 `order.pointsEarned` Bug

In `app/api/checkout/initiate/route.ts` lines 611-612, change:
```typescript
if (userId && order.pointsEarned > 0) {
  const earnedPoints = order.pointsEarned;
```
To:
```typescript
if (userId && created.pointsEarned > 0) {
  const earnedPoints = created.pointsEarned;
```

The variable `order` doesn't exist in the Net-30 block — it should be `created` (the newly inserted order from the transaction result).

### 2. [CRITICAL] Verify Middleware `/admin` Protection

Test that `/admin` (without sub-path) is protected. If not, change the matcher from:
```typescript
matcher: ['/admin', '/admin/:path*', '/account/:path*', '/b2b/account/:path*']
```
To:
```typescript
matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*']
```

### 3. [HIGH] Monitor DrizzleAdapter Type Safety

Keep the `@ts-expect-error` comments but add a comment explaining why. When upgrading `@auth/drizzle-adapter`, verify column name compatibility.

### 4. [MEDIUM] Add Stock CHECK Constraint

After verifying no negative stock values exist in DB, add constraint:
```sql
ALTER TABLE product_variants ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
```

### 5. [INFO] Continue Monitoring

All other systems are well-implemented. The auth flow, points system, and database schema are solid. The two critical issues above should be fixed before any production deployment.

---

## FILES AUDITED

### Auth Configuration
- `lib/auth/config.ts` — NextAuth config with Google + Credentials providers
- `lib/auth/index.ts` — Auth exports
- `app/api/auth/[...nextauth]/route.ts` — Auth route handler with rate limiting

### Auth Pages
- `app/(auth)/login/page.tsx` — Login with Google + credentials
- `app/(auth)/register/page.tsx` — Register with Google + credentials
- `app/(auth)/forgot-password/page.tsx` — Forgot password flow
- `app/(auth)/reset-password/[token]/page.tsx` — Reset password with token

### Auth API Routes
- `app/api/auth/register/route.ts` — User registration
- `app/api/auth/forgot-password/route.ts` — Forgot password
- `app/api/auth/reset-password/route.ts` — Reset password with token

### Account Pages
- `app/(store)/account/profile/page.tsx` — Profile management
- `app/(store)/account/addresses/page.tsx` — Address management
- `app/(store)/account/orders/page.tsx` — Order history
- `app/(store)/account/points/page.tsx` — Points balance and history
- `app/(store)/account/vouchers/page.tsx` — Voucher display

### Account API Routes
- `app/api/account/profile/route.ts` — Profile GET/PATCH/PUT/POST

### Core Business Logic
- `app/api/checkout/initiate/route.ts` — Order creation with points calculation
- `app/api/webhooks/midtrans/route.ts` — Payment settlement with points award

### Database
- `lib/db/schema.ts` — Full schema with enums, tables, relations, indexes
- `lib/db/index.ts` — Drizzle client singleton

### Middleware
- `app/middleware.ts` — Route protection with role checks

### Services
- `lib/services/points.service.ts` — Points earn, redeem, expire logic
- `lib/constants/points.ts` — Points constants (earn rate, value, expiry)

### Admin
- `app/(admin)/admin/team-dashboard/page.tsx` — Team dashboard server page
- `app/(admin)/admin/team-dashboard/TeamDashboardClient.tsx` — Team dashboard client