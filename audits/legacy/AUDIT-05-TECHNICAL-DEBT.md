# AUDIT 05 — Technical Debt & Security
# DapurDekaka.com — Code Quality, Security Vulnerabilities, and Technical Gaps
**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** Security, code quality, performance, missing infrastructure

---

## LEGEND
- ✅ Good
- ⚠️ Needs attention
- ❌ Missing / broken
- 🔴 Security issue or critical debt
- 🟡 Significant technical concern
- 🟢 Code quality / minor improvement

---

## 1. SECURITY VULNERABILITIES

### 1.1 Missing Role Check on Order Status API
**Severity:** 🔴 Critical

**File:** `app/api/admin/orders/[id]/status/route.ts`

The route only validates that a session exists, not that the user has an admin-level role:
```typescript
const session = await auth();
if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// ← No role check here
```

**Impact:** Any registered `customer` who knows:
1. Their own order ID (from the order confirmation email)
2. The API endpoint URL pattern
3. A valid status transition value

...can change their own order status (e.g., from `pending_payment` to `paid`) by making a direct API call with their valid session cookie. This would bypass payment entirely.

**Fix:**
```typescript
const session = await auth();
if (!session?.user) return unauthorized();
const allowedRoles = ['owner', 'superadmin', 'warehouse'];
if (!allowedRoles.includes(session.user.role)) return forbidden();
```

### 1.2 API Routes Without Role Checks

All routes under `/api/admin/*` need role validation. Currently many only check for session existence. A logged-in `customer` with knowledge of the API could:
- Read admin coupon data
- Read all B2B inquiry data
- Post to admin blog routes

**Fix:** Create a reusable middleware guard:
```typescript
// lib/auth/require-role.ts
export async function requireRole(allowedRoles: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  if (!allowedRoles.includes(session.user.role)) throw new Error('FORBIDDEN');
  return session;
}
```

Apply to every `/api/admin/*` route handler.

### 1.2b Middleware / Auth Strategy Mismatch
**Severity:** 🔴 Critical — Must Investigate

**Files:** `app/middleware.ts` + `lib/auth/index.ts`

The auth config uses **database sessions**:
```typescript
// lib/auth/index.ts
session: { strategy: 'database' }
```

But the middleware reads sessions using `getToken` from `@auth/core/jwt`, which decodes **JWT tokens**, not opaque database session tokens:
```typescript
// app/middleware.ts
const token = await getToken({
  req,
  secret: AUTH_SECRET,
  cookieName: 'authjs.session-token',
});
```

**The Problem:** With `strategy: 'database'`, the `authjs.session-token` cookie contains an opaque UUID (not a JWT). The `getToken()` function tries to verify it as a JWT and will return `null`. This means:
- `session?.id` is always `undefined`
- ALL admin routes redirect to `/login` even for authenticated users
- ALL `/account` routes redirect to `/login` even for authenticated users

**This may render the entire authentication system non-functional in production.** It could work in development due to some env-specific bypass, but fail when deployed.

**Fix Option A — Switch to JWT strategy:**
```typescript
// lib/auth/index.ts
session: { strategy: 'jwt' }
callbacks: {
  async jwt({ token, user }) {
    if (user) { token.id = user.id; token.role = user.role; }
    return token;
  },
  async session({ session, token }) {
    session.user.id = token.id as string;
    session.user.role = token.role as UserRole;
    return session;
  }
}
```

**Fix Option B — Use `auth()` in middleware (NextAuth v5 native approach):**
```typescript
// middleware.ts
import { auth } from '@/lib/auth';
export default auth((req) => {
  const session = req.auth;
  // protect routes based on session.user.role
});
```
This works with database sessions because `auth()` in middleware handles the session lookup natively.

Note: If database sessions are preferred (better security — tokens can be revoked), use Option B. If JWT is acceptable (cannot revoke individual sessions), use Option A.

---

### 1.3 Guest Order Tracking — Privacy Risk
**Severity:** 🔴 High

**File:** `app/api/orders/[orderNumber]/route.ts`

If the order detail API returns full data (name, email, phone, address) for anyone who knows the order number — without requiring email verification — this is a privacy/GDPR issue.

Order numbers follow a predictable pattern: `DDK-20260512-0047`. An attacker could enumerate:
```
DDK-20260512-0001 through DDK-20260512-9999
```
...and collect personal data of all customers.

**Required Gate:**
```typescript
// For guest access: require email verification
const { email } = await request.json(); // or from query param
const order = await db.query.orders.findFirst({ where: eq(orders.orderNumber, orderNumber) });
if (!order) return notFound();

const session = await auth();
const isOwner = session?.user?.id === order.userId;
const isEmailMatch = order.recipientEmail.toLowerCase() === email?.toLowerCase();
if (!isOwner && !isEmailMatch) return forbidden();
```

### 1.4 XSS via Blog Content
**Severity:** 🟡 Medium

**Location:** Blog post detail page (`/blog/[slug]`)

Blog content stored as HTML (TipTap output) and rendered with `dangerouslySetInnerHTML`. If an admin account is compromised, an attacker could inject malicious JavaScript into a blog post that runs in every visitor's browser.

**Fix:** Sanitize HTML before rendering:
```typescript
import DOMPurify from 'isomorphic-dompurify';
const cleanContent = DOMPurify.sanitize(post.contentId);
<div dangerouslySetInnerHTML={{ __html: cleanContent }} />
```

Or use a safer rendering approach: store TipTap JSON and render with TipTap's React component (which doesn't use dangerouslySetInnerHTML).

### 1.5 Race Condition — Overselling
**Severity:** 🟡 Medium

**File:** `app/api/checkout/initiate/route.ts`

Stock is validated, then order is created, then stock is deducted — all in separate operations. Between validation and deduction, another concurrent order could claim the same stock.

**Fix:** Use a database transaction with row-level locking:
```typescript
await db.transaction(async (tx) => {
  // Lock the variant rows
  const variants = await tx
    .select()
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds))
    .for('update'); // SELECT FOR UPDATE
  
  // Validate stock within the transaction
  for (const item of cartItems) {
    const variant = variants.find(v => v.id === item.variantId);
    if (!variant || variant.stock < item.quantity) {
      throw new Error(`Stok ${variant?.nameId} tidak mencukupi`);
    }
  }
  
  // Create order and deduct stock atomically
  // ...
});
```

### 1.6 Rate Limiting — Verification Needed
**Severity:** 🟡 Medium

`lib/utils/rate-limit.ts` exists but rate limiting may not be applied. Critical endpoints to verify:

| Endpoint | Should be Rate Limited | Limit |
|---|---|---|
| `/api/auth/register` | Yes | 5 req/IP/hour |
| `/api/auth/forgot-password` | Yes | 3 req/email/hour |
| `/api/coupons/validate` | Yes | 20 req/session/min |
| `/api/checkout/initiate` | Yes | 5 req/session/5min |
| `/api/b2b/inquiry` | Yes | 3 req/IP/hour |

If rate limiting is not applied, these endpoints are vulnerable to:
- Registration flooding (abuse)
- Coupon brute-force (try all codes)
- Checkout DoS
- Email harvesting via forgot-password

### 1.7 Environment Variables — `.env.local` in Repo Risk
**Severity:** 🟡 Medium

The `.env.local` file exists in the project root. Verify it's in `.gitignore`. It should contain production secrets (DATABASE_URL, Midtrans server key, Resend API key). If accidentally committed:
```bash
git log --all --full-history -- .env.local
# Check if .env.local was ever committed
```

Similarly, `.env` (not `.env.local`) is in the root and may contain real values based on the file listing.

### 1.8 CSRF Protection
**Severity:** 🟢 Low

Next.js App Router API routes using `POST`/`PATCH`/`DELETE` with `Authorization` or session cookies are generally protected by SameSite cookie policy. Verify `next-auth` session cookies are set with `SameSite=Strict` or `SameSite=Lax`.

### 1.9 Midtrans Client Key Exposure
**Status:** ✅ Acceptable

`NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` is correctly public (required for Snap.js popup). The server key must NOT be `NEXT_PUBLIC_`. Verify in `.env.example` and deployed Vercel config.

---

## 2. HARDCODED VALUES THAT MUST BE DYNAMIC

These values are hardcoded in source code but should come from `system_settings` table or environment variables:

| Hardcoded Value | File | Should Come From |
|---|---|---|
| WhatsApp number | `lib/constants/index.ts`, `WhatsAppButton.tsx` | `system_settings.store_whatsapp_number` |
| Payment expiry (15 min) | `app/api/checkout/initiate/route.ts` | `system_settings.payment_expiry_minutes` |
| Max payment retries (3) | Checkout flow | `system_settings.payment_max_retries` |
| Points earn rate (1) | Constants file | `system_settings.points_earn_rate` |
| Points value per IDR (1000) | `lib/constants/points.ts` | `system_settings.points_per_idr` |
| Points min redeem (100) | `lib/constants/points.ts` | `system_settings.points_min_redeem` |
| Points max redeem % (50) | Checkout page | `system_settings.points_max_redeem_pct` |
| RajaOngkir origin city ID (23) | `lib/constants/couriers.ts` | `system_settings.rajaongkir_origin_city_id` |
| Min billable weight (1000g) | RajaOngkir route | `system_settings.min_order_weight_gram` |
| Admin greeting "Bashara" | `admin/dashboard/page.tsx` | `session.user.name` |
| Cloudinary health "ok" | Dashboard | Real health check |
| Promo code "SELAMATDATANG" | HeroCarousel slide | DB carousel `badge_text` field |

**Fix Pattern:**
```typescript
// lib/settings/get-settings.ts
import { cache } from 'react';

export const getSystemSettings = cache(async () => {
  const settings = await db.query.systemSettings.findMany();
  return Object.fromEntries(settings.map(s => [s.key, s.value]));
});

// Usage:
const settings = await getSystemSettings();
const waNumber = settings['store_whatsapp_number'] ?? DEFAULT_WA_NUMBER;
```

---

## 3. MISSING DATA INTEGRITY CONSTRAINTS

### 3.1 Points Balance Consistency
The `users.points_balance` column must always equal the sum of `points_history.points_amount` for that user. Currently, this constraint is only maintained by application code (not database-level). If a bug causes a partial update, the balance will drift.

**Fix Options:**
1. Add a database trigger (not possible in Drizzle easily)
2. Add a reconciliation check in the points expiry cron
3. Add an admin tool to recalculate and fix drifted balances

### 3.2 Default Address Constraint
PRD says only one address per user can have `is_default = true`. This is enforced in application code only. A bug could create multiple default addresses.

**Fix:** In the address management API, when setting a new default, first clear all existing defaults:
```typescript
await db.update(addresses)
  .set({ isDefault: false })
  .where(eq(addresses.userId, userId));
await db.update(addresses)
  .set({ isDefault: true })
  .where(eq(addresses.id, addressId));
```
Wrap in a transaction to ensure atomicity.

### 3.3 Order Total Consistency
The `orders.total_amount` must equal `subtotal - discount_amount - points_discount + shipping_cost`. This calculation happens in the checkout initiate route but is never verified again. If a partial update occurs (DB write of order succeeds, but something else fails), the totals could be inconsistent.

---

## 4. TYPESCRIPT ISSUES

### 4.1 Untyped `any` Usage

Search for `any` in the codebase:
```bash
grep -r "as any" app/ lib/ components/ --include="*.ts" --include="*.tsx"
```

Known `any` usage in the schema query:
```typescript
if (filters.status) conditions.push(eq(orders.status, filters.status as any));
```

This bypasses type checking on an enum. Should use:
```typescript
if (filters.status && isOrderStatus(filters.status)) {
  conditions.push(eq(orders.status, filters.status));
}
```

### 4.2 Missing Type for Session User

`lib/types/next-auth.d.ts` exists to extend the Session type with `role`. Verify it includes all custom fields:
```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
```

If `role` is not typed on the session, `session.user.role` will be `unknown` everywhere, causing implicit `any`.

### 4.3 `params` Type in Next.js 14

Next.js 14 page params are typed as `{ params: { id: string } }`. With Next.js 15 (upcoming), params become Promises. The current code uses the sync pattern — fine for Next.js 14 but should be noted for future upgrade.

---

## 5. PERFORMANCE ISSUES

### 5.1 No Database Query Caching

Server components fetch from the database on every request with `export const dynamic = 'force-dynamic'`. This is correct for order-related pages (always fresh), but some data is static or slow-changing:
- Categories — changes rarely, should be cached
- Carousel slides — changes rarely
- System settings — changes rarely
- Testimonials — changes rarely

**Fix:** Use React's `cache()` function for slow-changing data:
```typescript
import { cache } from 'react';

export const getCategories = cache(async () => {
  return db.query.categories.findMany({ where: eq(categories.isActive, true) });
});
```
This deduplicates identical queries within a single request and respects Next.js data cache.

### 5.2 N+1 Query Risk

The admin orders list page fetches orders "with items" — this is a JOIN and is fine. But check:
- Admin products page: fetches products, then for each product fetches variants separately? If so, this is N+1.
- Customer account page: fetches user, then orders, then items — verify these are joined, not sequential.

### 5.3 No Pagination on Large Queries

Several pages have hardcoded limits without proper pagination:
- `/admin/orders` — 50 orders limit
- `/admin/users` — 100 users limit
- `/admin/customers` — unknown limit
- `/account/orders` — all orders (no limit)

As data grows, these pages will become slow. Implement cursor-based or offset pagination with proper `LIMIT` and `OFFSET` in all list queries.

### 5.4 RajaOngkir API — No Caching

Every time a user changes their address at checkout, a fresh call to RajaOngkir is made. Province and city data changes extremely rarely. Cost calculation varies but could be cached per (origin, destination, weight) combination for a few minutes.

**Fix:** Cache province/city data for 24 hours:
```typescript
// Use Next.js fetch cache for external APIs
const response = await fetch(rajaOngkirUrl, {
  headers: { key: process.env.RAJAONGKIR_API_KEY },
  next: { revalidate: 86400 }, // 24 hours
});
```

### 5.5 Image Optimization

All product images are served from Cloudinary. Verify:
- Next.js `Image` component is used (not bare `<img>`) everywhere
- Cloudinary domain is in `next.config.js` `images.domains` or `remotePatterns`
- `width` and `height` props are set correctly (prevents layout shift)
- `priority` prop is set on above-the-fold images (hero, product thumbnails on first load)

---

## 6. CODE QUALITY

### 6.1 Cart Store — Missing DB Sync

**File:** Zustand cart store (not audited but referenced throughout)

The cart is localStorage-only for all users (guests and logged-in). PRD says logged-in users should have DB-synced cart. The `merge-cart` API handles the login-time merge, but:
- What happens if the user logs in on a different device? Cart is lost.
- What if localStorage is cleared? Cart is lost even for registered users.

**Recommended Approach:** After successful login, save cart state to DB. On page load for logged-in users, fetch cart from DB and merge with localStorage.

### 6.2 Product Seeding — Not Complete

`scripts/seed.ts` is referenced in PRD and package.json (`db:seed` script). The 19 SKUs from Shopee need to be seeded. Verify the seed script:
1. Creates all 5 categories
2. Creates the superadmin user
3. Seeds all system settings
4. Creates sample coupons (`SELAMATDATANG`, `GRATISONGKIR`)
5. Creates the 19 products with realistic pricing (15-20% below Shopee)

If products aren't seeded, the store launches empty.

### 6.3 Drizzle Relations — Missing Explicit Joins in Some Queries

Some queries use Drizzle's relational API (`db.query.*.findMany({ with: {} })`) while others use the query builder. The relational API is more readable but less flexible. For complex admin queries (filtering + sorting + pagination), the query builder is better. Keep patterns consistent within feature areas.

### 6.4 Error Handling — Inconsistent Patterns

Three different error response patterns found:
```typescript
// Pattern 1: Utility function
return apiError(e.message, 400);

// Pattern 2: Direct NextResponse
return NextResponse.json({ error: e.message }, { status: 400 });

// Pattern 3: Throw (unhandled)
throw new Error('Something went wrong');
```

Standardize on Pattern 1 using `lib/utils/api-response.ts`. Unhandled throws in API routes will return a 500 with a generic error — bad UX.

### 6.5 Unused Imports / Dead Code

Run type-check and lint to find:
```bash
npm run type-check
npm run lint
```

Known dead code:
- `lib/utils/health-check.ts` — referenced in dashboard but endpoint not built
- `lib/utils/integration-helpers.ts` — purpose unknown, may be unused

---

## 7. MISSING INFRASTRUCTURE

### 7.1 Error Monitoring

No Sentry or error monitoring configured. In production, any unhandled error in an API route or server component will silently fail (user sees a generic error page, but no alert is sent).

**Fix:** Add Sentry:
```bash
npm install @sentry/nextjs
```
Configure in `sentry.client.config.ts`, `sentry.server.config.ts`, `next.config.js`.

### 7.2 Performance Monitoring

No analytics or performance monitoring beyond `@vercel/analytics` (which is installed). Consider adding:
- Core Web Vitals tracking (already partially covered by Vercel Analytics)
- API response time logging

### 7.3 Database Connection Pooling

**File:** `lib/db/index.ts`

Using `@neondatabase/serverless` with HTTP pooler. This is correct for Vercel serverless (not WebSocket). Verify the `DATABASE_URL` uses Neon's pooled connection string (`-pooler.neon.tech`) for production, not the direct connection string.

### 7.4 Test Coverage

**Tests:** Zero test files found in the project.

For a payment-processing e-commerce app, critical paths need tests:
- Midtrans webhook signature verification
- Order number generation (uniqueness)
- Points calculation (earn/redeem/expiry)
- Coupon validation logic (all cases)
- Shipping weight calculation

At minimum, add:
```bash
npm install --save-dev vitest @vitejs/plugin-react
```
Write unit tests for pure functions in `lib/`:
- `lib/midtrans/verify-webhook.ts`
- `lib/utils/generate-order-number.ts`
- `lib/points/expiry-check.ts`
- `lib/validations/order.schema.ts`

### 7.5 CI/CD Pipeline

No GitHub Actions or Vercel CI configuration visible. Verify:
- `next build` runs on every push (catches TypeScript errors before deployment)
- Lint runs on every PR
- Type check runs on every PR

---

## 8. DEPENDENCY AUDIT

### 8.1 Dependency Versions

Key dependencies and their versions:
- `next`: `14.2.15` — Latest Next.js 14 ✅
- `next-auth`: `5.0.0-beta.22` — **Beta version** ⚠️
- `drizzle-orm`: `0.39.0` ✅
- `midtrans-client`: `1.4.3` ✅

**`next-auth` Beta Warning:**
Using `next-auth@5` (Auth.js) in beta means:
- API may change between beta versions
- Some features may be unstable
- Production apps should pin to a specific beta version and not auto-upgrade
- Add `overrides` in `package.json` to lock the beta version

### 8.2 `@react-pdf/renderer`

Installed but only used for client-side PDF generation (checkout success page). Server-side PDF generation (for email attachments) is not implemented. If moving to server-side PDFs, `@react-pdf/renderer` works in Node.js but may have size implications on Vercel serverless functions (cold start time).

### 8.3 `next-intl`

Installed for i18n but translation files (`messages/`) don't appear to exist. If `next-intl` is imported but not configured, it may cause runtime errors. Verify the i18n setup or remove the dependency if not actively used.

---

## 9. COMPLETE PRIORITY MATRIX

### Immediate (Before Launch — Day 0)

| # | Issue | File to Fix |
|---|---|---|
| 1 | Missing role check on order status API | `app/api/admin/orders/[id]/status/route.ts` |
| 2 | Guest order tracking — no email gate | `app/api/orders/[orderNumber]/route.ts` |
| 3 | Points balance hardcoded to 0 | `app/(store)/checkout/page.tsx:99` |
| 4 | All product management APIs missing | New files: `app/api/admin/products/*` |
| 5 | All field/warehouse APIs missing | New files: `app/api/admin/field/*` |
| 6 | Admin dashboard APIs missing | New files: `app/api/admin/dashboard/*` |
| 7 | Order status transitions broken | `app/api/admin/orders/[id]/status/route.ts` |
| 8 | `coupon_usages` never populated | `app/api/webhooks/midtrans/route.ts` |
| 9 | `order_status_history` not written on payment | `app/api/webhooks/midtrans/route.ts` |
| 10 | Vercel cron jobs not verified | `vercel.json` |

### Before Marketing Launch (Week 1)

| # | Issue | File to Fix |
|---|---|---|
| 11 | XSS via blog content | Blog detail page |
| 12 | Rate limiting not verified | Check all auth/checkout routes |
| 13 | Admin role check on all `/api/admin/*` | All admin route files |
| 14 | WhatsApp number hardcoded | `lib/constants/index.ts` |
| 15 | Saved address picker at checkout | `app/(store)/checkout/page.tsx` |
| 16 | Order detail page missing | New: `app/(admin)/admin/orders/[id]/page.tsx` |
| 17 | Customer profile page missing | New: `app/(store)/account/profile/page.tsx` |
| 18 | Cancellation email missing | New: email template + trigger in webhook/cron |
| 19 | Pickup email missing | `app/api/webhooks/midtrans/route.ts` |
| 20 | Identity form not pre-filled for logged-in users | `app/(store)/checkout/page.tsx` |

### Post-Launch (Month 1)

| # | Issue | File to Fix |
|---|---|---|
| 21 | FIFO points redemption | New: points consumption algorithm |
| 22 | B2B double points multiplier | `app/api/webhooks/midtrans/route.ts` |
| 23 | System settings editable from UI | `app/(admin)/admin/settings/page.tsx` + API |
| 24 | Order CSV export | New: `app/api/admin/orders/export/route.ts` |
| 25 | Stock pagination on admin | Admin queries with LIMIT/OFFSET |
| 26 | Error monitoring (Sentry) | `sentry.*.config.ts` |
| 27 | Cart DB sync for logged-in users | Cart store + new API |
| 28 | Real-time stock validation in cart | New: `app/api/cart/validate/route.ts` |
| 29 | Admin user role editing UI | `app/(admin)/admin/users/page.tsx` + API |
| 30 | Settings PATCH API | New: `app/api/admin/settings/route.ts` |

---

## 10. ENVIRONMENT VARIABLES CHECKLIST

The following must be set in Vercel production before launch:

```env
# Database
DATABASE_URL=                    # Neon pooled connection string (-pooler.)
DATABASE_URL_UNPOOLED=           # Neon direct (for migrations)

# Auth
AUTH_SECRET=                     # Strong random secret (used by NextAuth v5)
NEXTAUTH_URL=                    # https://dapurdekaka.com
AUTH_GOOGLE_ID=                  # Google OAuth client ID (NextAuth v5 naming)
AUTH_GOOGLE_SECRET=              # Google OAuth client secret

# Payment
MIDTRANS_SERVER_KEY=             # Production server key (starts with Sb- for sandbox, remove for prod)
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY= # Production client key

# Shipping
RAJAONGKIR_API_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=               # noreply@dapurdekaka.com (must be verified domain)

# Storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# AI
MINIMAX_API_KEY=                 # For caption generator

# Cron
CRON_SECRET=                     # Secret for authenticating cron job calls

# Seeding
SEED_ADMIN_EMAIL=                # Superadmin email
SEED_ADMIN_PASSWORD=             # Superadmin initial password
```

Verify `.env.example` lists all of these with placeholder values so any developer setting up the project knows what's needed.
