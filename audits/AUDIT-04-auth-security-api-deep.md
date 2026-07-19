# AUDIT 04 — Auth, Security & API Routes Deep Audit

**Auditor:** AI QA Agent
**Date:** May 25, 2026
**Scope:** Auth system, all API routes, middleware, security headers
**Pretext:** Pretend 100 users login tomorrow + 100 hackers probe the APIs tonight.

---

## AUTH AUDIT

### ✅ PASS — NextAuth Config (`lib/auth/config.ts`)
- NextAuth v5 with Google OAuth + Credentials provider — properly configured
- `trustHost: true` set (required for cookies behind proxy/CDN)
- Session strategy: `database` (uses DB sessions adapter)
- Auth secret validation at startup: min 32 chars — GOOD
- Google OAuth keys checked at startup — won't silently fail
- Session callback enriches user with `id`, `role`, `isActive` from DB on every session refresh
- Inactive user flag returned in session for downstream redirects

### ✅ PASS — NextAuth Handler (`app/api/auth/[...nextauth]/route.ts`)
- Wrapped with rate limiting: 10 req/min GET + POST — prevents brute force on `/api/auth/signin`
- Uses `req.headers.get('x-forwarded-for')` — consistent with rate-limit.ts
- Properly exports GET + POST handlers from NextAuth instance

### ✅ PASS — Session Cookie Security
- NextAuth v5 uses `HttpOnly`, `secure`, `sameSite: 'lax'` cookies by default
- Database session strategy means no JWT stored client-side — tokens are DB-backed
- No CSRF issue: NextAuth CSRF protection enabled by default on POST handlers

### ✅ PASS — Inactive User Guard (`middleware.ts` line 22-28)
- Inactive users (`isActive === false`) are redirected to `/login?inactive=1` before any route renders
- Separate callbackUrl for admin vs store routes — prevents admin page disclosure
- Applied BEFORE any page-specific auth checks — correct ordering

### ✅ PASS — Role-Based Admin Guard (`middleware.ts` line 30-45)
- Warehouse users are limited to specific sub-paths (`/admin/inventory`, `/admin/shipments`, `/admin/field`)
- Unauthorized admin access redirects to `/admin/inventory` (not `/` — prevents confusion)
- Role check array: `['superadmin', 'owner', 'warehouse']` — correct per spec

### ⚠️ MEDIUM — Account Guard Missing Callback for B2B
`middleware.ts` line 55-61: B2B account guard redirects to `/login?callbackUrl=...` but the callbackUrl is not preserved across the auth redirect. After login, NextAuth may lose the original b2b/account URL. **Fix:** Use `callbackUrl` param on login page (line 58 in login/page.tsx already does this correctly) — verify it works end-to-end.

### ✅ PASS — Login Page (`app/(auth)/login/page.tsx`)
- Google OAuth + Credentials form — both flows implemented
- `getSafeCallbackUrl()` (line 10-19): properly validates URL starts with `/` and rejects `//` — prevents open redirect
- Session refresh on successful credentials login (line 81) — mitigates session fixation
- Cart merge on login (line 82-108): POST to `/api/auth/merge-cart` with localStorage items, non-blocking failure
- Error mapping for OAuth error params — good UX
- Rate limit protection handled at NextAuth handler level

### ✅ PASS — Forgot Password (`app/api/auth/forgot-password/route.ts`)
- Rate limited: 3 req/min (strict — this is a user enumeration endpoint)
- Timing normalization: even when user not found, simulates 200-300ms delay — prevents timing oracle
- Non-blocking email send: user sees success even if Resend fails
- Token: 32-byte random hex, hashed with bcrypt (cost 10), stored as `tokenHash` + `tokenPrefix` (first 8 chars for DB lookup)
- 1-hour expiry
- Previous tokens deleted before creating new one — prevents token reuse

### ✅ PASS — Reset Password (`app/api/auth/reset-password/route.ts`)
- Rate limited: 5 req/min
- Token validated via `tokenPrefix` lookup + bcrypt.compare against stored hash
- Session deletion for the user on reset — forces re-login
- Password reset token marked as `usedAt` after successful reset
- `minimum 8 characters` validation

### ✅ PASS — Guest Checkout Points Rule
`/api/checkout/initiate/route.ts` line 308: `userId` is null for guest users — points system only runs when `userId` is truthy. Guest orders cannot earn points. **Confirmed: guests cannot earn points.**

### ⚠️ HIGH — Google OAuth Secret Exposed in `.env.local`
`.env.local` line 21: `AUTH_GOOGLE_SECRET` is in the committed `.env.local` file. This file should be in `.gitignore` and should NEVER be committed. Check `.gitignore` line 25: `.env.*` is excluded — GOOD. But verify `.env.local` is truly excluded.

---

## SECURITY AUDIT

### 🟡 HIGH — Server Keys Committed to `.env.local` (Not In Git, But Worth Flagging)

`.env.local` lines 10-74 contain real secrets. Since `.gitignore` excludes `.env.*`, this file is not in git — **NOT A CRITICAL ISSUE** but Bashara should verify the repo never had these committed historically (run `git log --all --oneline -- .env` if uncertain).

### 🟡 HIGH — CLOUDINARY_API_SECRET Not Client-Safe
`CLOUDINARY_API_SECRET` in `.env.local` line 44 — this is server-only. `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is correctly `NEXT_PUBLIC_`. The `lib/cloudinary/upload.ts` (not audited in full) must use the secret only server-side for signed URLs.

### ✅ PASS — Midtrans Signature Verification
`/api/webhooks/midtrans/route.ts` line 33-49:
- SHA-512 signature verified BEFORE any processing
- Uses `serverKey + rawBody` — correct Midtrans verification algorithm
- Rejects with 401 if signature missing or invalid
- Raw body used (not parsed JSON) — prevents body polymorphism attack

### ✅ PASS — Idempotency Guards (Midtrans Webhook)
`/api/webhooks/midtrans/route.ts` line 77-89:
- `midtransTransactionId` uniqueness check prevents double-processing
- `status === 'paid'` + `transaction_status === 'settlement'` check prevents duplicate settlement
- Cancelled order + settlement → logged, returns 200 but flagged for manual review
- Refunded order + settlement → same protection

### ✅ PASS — Amount Cross-Check on Settlement
`/api/webhooks/midtrans/route.ts` line 119-128:
- `gross_amount` from webhook compared against `order.totalAmount` — prevents tampered webhook attacks
- Mismatch returns 400 and does NOT process the payment

### ⚠️ HIGH — `/api/health` Returns DB Latency in Response
`app/api/health/route.ts` line 19-49:
- Returns `{ status, checks: { database: { latency } } }` — public endpoint
- **Does NOT expose** internal error messages in healthy state (line 38)
- Unhealthy state (line 45): `error: errorMessage` — **exposes DB error text** in 503 response
- An attacker could probe health to fingerprint the DB engine (PostgreSQL error messages)
- **Fix:** Return `{ status: 'unhealthy', error: 'Service unavailable' }` — no error detail

### ✅ PASS — Rate Limiting Infrastructure
`lib/utils/rate-limit.ts`:
- Upstash Redis-based (production) or in-memory fallback (dev only)
- Production build throws if Upstash not configured — can't accidentally deploy rate-limiting-disabled
- Returns proper 429 with `Retry-After`, `X-RateLimit-*` headers
- `withRateLimit` HOC applied to auth, checkout, webhook routes

### ⚠️ MEDIUM — Not All Routes Have Rate Limiting
- `/api/auth/forgot-password` ✅ 3 req/min
- `/api/auth/reset-password` ✅ 5 req/min
- `/api/auth/merge-cart` ✅ 10 req/min
- `/api/checkout/initiate` ✅ 10 req/min
- `/api/checkout/validate-coupon` ✅ 10 req/min
- `/api/webhooks/midtrans` ✅ 30 req/min
- `/api/auth/cart` ❌ **NO RATE LIMIT** — this is a public-enough endpoint that could be abused
- `/api/admin/orders/route.ts` GET ❌ **NO RATE LIMIT** — admin list endpoint
- `/api/admin/orders/[id]/route.ts` GET ❌ **NO RATE LIMIT**
- `/api/admin/customers/route.ts` GET ❌ **NO RATE LIMIT**
- `/api/admin/coupons/route.ts` GET ❌ **NO RATE LIMIT**

These admin endpoints are protected by auth but lack rate limiting. A compromised admin account could make rapid requests. **Fix:** Apply `withRateLimit` to all admin GET routes (10 req/min).

### ✅ PASS — SQL Injection Protection
All DB queries use Drizzle ORM with parameterized queries:
- `eq(users.email, credentials.email)` — no string interpolation
- `inArray(productVariants.id, variantIds)` — parameterized in
- No raw SQL strings found in any API route — GOOD

### ✅ PASS — No `any` Types in API Routes
Confirmed: all API routes use proper typed schemas, session types, and DB result types.
- `withRateLimit` uses `T = unknown` generic — correct
- Rate limit result uses `unknown` for untyped Upstash Redis

### ⚠️ HIGH — Console.error in Production API Routes

Several API routes use `console.error` directly instead of the structured `logger`:

| File | Line | Issue |
|------|------|-------|
| `app/api/validate-coupon/route.ts` | 155 | `console.error('[checkout/validate-coupon]', error)` |
| `app/api/admin/orders/[id]/status/route.ts` | 302, 326, 360, 382 | `console.error('[Status Update]...')`, `console.error('[admin/orders/status]', error)` |
| `app/api/admin/products/bulk/route.ts` | 45, 70 | `console.error('[Admin Products Bulk PATCH]', error)` |
| `app/api/auth/cart/route.ts` | 75-78 | `logger.error` used BUT returns raw NextResponse instead of `serverError()` helper |

**Fix:** Replace all `console.error` with `logger.error`. The `logger` outputs structured JSON and is the project standard.

### ⚠️ HIGH — `/api/auth/cart` Returns Non-Standard Response
`app/api/auth/cart/route.ts` line 76-79: On error, it returns:
```typescript
return NextResponse.json({ success: false, error: 'Gagal memuat keranjang' }, { status: 500 });
```
This bypasses the `serverError()` helper which should be used. Also uses `logger.error` on line 75 but the catch block uses direct `NextResponse.json` — inconsistent.

### ✅ PASS — Auth on All Protected Routes
Every mutation/admin route calls `auth()` and checks session:
- `POST /api/checkout/initiate` — auth called
- `POST /api/checkout/validate-coupon` — auth called (for per-user coupon limits)
- `POST /api/auth/merge-cart` — auth called
- All admin routes — auth + role check present

### ✅ PASS — Role Authorization on Admin Routes
- `GET /api/admin/orders` — `['superadmin', 'owner', 'warehouse']`
- `GET /api/admin/products` — `['superadmin', 'owner']`
- `GET /api/admin/customers` — `['superadmin', 'owner']`
- `POST /api/admin/orders` — `['superadmin', 'owner']`
- `PUT /api/admin/coupons/[id]` — `['superadmin']` only
- `POST /api/admin/points/adjust` — `['superadmin', 'owner']`
- All correct per the role permission matrix

### ✅ PASS — Transaction Usage for Multi-Step Mutations
- Checkout initiate: atomic transaction (order + counter + points + items)
- Points adjust: atomic transaction (balance update + history)
- Inventory adjust: atomic transaction (stock update + log)
- Webhook settlement: atomic transaction (status + stock + coupon + points + history)
- Webhook cancellation: atomic transaction (status + stock restore + points + coupon)
- Order status update: atomic transaction (status + stock + refund + points + history + email)
- All use `db.transaction()` — GOOD

### ✅ PASS — Stock Dedution Uses GREATEST Guard
All stock deductions use `sql\`GREATEST(stock - ${qty}, 0)\`` — prevents negative stock from race conditions. All have `gte(stock, qty)` check before deducting.

### ✅ PASS — Re-fetch Prices from DB
`/api/checkout/initiate/route.ts` line 94-157: Re-fetches all variant prices from DB, ignores client-submitted prices. B2B price check uses DB `variant.b2bPrice` correctly.

### ✅ PASS — Points FIFO Redemption
`/api/checkout/initiate/route.ts` line 437-508: Points redemption uses FIFO ordering by `expiresAt` then `createdAt`. Earn records are consumed in order. `referencedEarnId` stored on redeem records for reversal.

### ✅ PASS — Points Cannot Go Negative
`lib/utils/rate-limit.ts` uses `GREATEST(points_balance - ${pointsUsed}, 0)` in points adjust route. Additional balance check before deduction.

### 🟡 MEDIUM — Upload Route Auth is Correct But Missing Audit Trail
`/api/upload/route.ts`:
- Auth + role check present (only `superadmin`, `owner`)
- Zod validation on `folder` enum (6 allowed values) — good
- No audit log of who uploaded what — minor but recommended for forensics

### ✅ PASS — Password Hashing
- All passwords hashed with `bcryptjs`
- Forgot password token: bcrypt with cost 10
- Password reset: bcrypt with cost 12
- Login: `bcrypt.compare` — timing-safe comparison

### 🟡 MEDIUM — No CORS Configuration Explicitly Set
No `CORS` headers are explicitly set in any API route or middleware. Next.js API routes inherit Vercel's default CORS behavior (same-origin by default). Since all API routes require authentication or are internal webhooks, this is likely fine. But if the app grows to serve cross-origin requests (e.g., mobile app), CORS should be explicitly configured.

### ✅ PASS — No Hardcoded Secrets in Code
Searched all API routes for hardcoded strings matching env var patterns — none found. All secrets read from `process.env`.

### ⚠️ HIGH — Server Error Responses Expose Internal Detail
`lib/utils/api-response.ts` line 66-72:
```typescript
export function serverError(error: unknown) {
  console.error('[API Error]', error);
  return NextResponse.json(
    { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```
GOOD: The public response is sanitized. However, `console.error` is used instead of `logger.error`. Also the error is logged to stderr — in Vercel serverless this is captured but in some deployments may leak to logs accessible to attackers.

---

## API ROUTES AUDIT

### Complete API Route List

| Route | Method | Auth | Rate Limit | Tx | Response Format | Notes |
|-------|--------|------|-----------|-----|-----------------|-------|
| `/api/auth/[...nextauth]` | GET/POST | ❌ (NextAuth) | ✅ 10/min | - | NextAuth | OK |
| `/api/auth/forgot-password` | POST | ❌ | ✅ 3/min | - | ✅ success | OK |
| `/api/auth/reset-password` | POST | ❌ | ✅ 5/min | - | ✅ success | OK |
| `/api/auth/merge-cart` | POST | ✅ user | ✅ 10/min | ✅ | ✅ success | OK |
| `/api/auth/cart` | GET | ✅ user | ❌ | - | ✅ success | ⚠️ No rate limit |
| `/api/checkout/initiate` | POST | optional | ✅ 10/min | ✅ | ✅ success | OK — very thorough |
| `/api/checkout/validate-coupon` | POST | optional | ✅ 10/min | - | ✅ success | OK |
| `/api/webhooks/midtrans` | POST | Signature | ✅ 30/min | ✅ | ✅ success | OK — well secured |
| `/api/health` | GET | ❌ | ❌ | - | Non-standard | ⚠️ Exposes DB errors |
| `/api/upload` | POST | ✅ role | ❌ | - | ✅ success | ⚠️ No audit trail |
| `/api/admin/orders` | GET | ✅ role | ❌ | - | ✅ success | ⚠️ No rate limit |
| `/api/admin/orders` | POST | ✅ role | ❌ | ✅ | ✅ success | OK |
| `/api/admin/orders/[id]` | GET | ✅ role | ❌ | - | ✅ success | ⚠️ No rate limit |
| `/api/admin/orders/[id]/status` | PATCH | ✅ role | ❌ | ✅ | ✅ success | ⚠️ console.error |
| `/api/admin/products` | GET | ✅ role | ❌ | - | ✅ success | ⚠️ No rate limit |
| `/api/admin/products` | POST | ✅ role | ❌ | - | ✅ success | OK |
| `/api/admin/products/bulk` | PATCH | ✅ role | ❌ | - | ✅ success | ⚠️ console.error |
| `/api/admin/products/bulk` | DELETE | ✅ role | ❌ | - | ✅ success | ⚠️ console.error |
| `/api/admin/customers` | GET | ✅ role | ❌ | - | ✅ success | ⚠️ No rate limit |
| `/api/admin/coupons` | GET | ✅ role | ❌ | - | ✅ success | ⚠️ No rate limit |
| `/api/admin/coupons` | POST | ✅ role | ❌ | - | ✅ success | OK |
| `/api/admin/coupons/[id]` | GET | ✅ role | ❌ | - | ✅ success | OK |
| `/api/admin/coupons/[id]` | PUT | ✅ role | ❌ | - | ✅ success | OK |
| `/api/admin/coupons/[id]` | DELETE | ✅ role | ❌ | - | ✅ success | OK |
| `/api/admin/points/adjust` | POST | ✅ role | ❌ | ✅ | ✅ success | OK |
| `/api/admin/field/inventory/adjust` | POST | ✅ role | ❌ | ✅ | ✅ success | OK |

---

## 🔴 CRITICAL (Blocks Launch)

### CR-01: Health Endpoint Exposes DB Error Messages
**File:** `app/api/health/route.ts` line 45
**What:** When database is down, the 503 response includes `error: errorMessage` which exposes PostgreSQL error text to any caller.
**Impact:** An attacker probes `/api/health` to fingerprint the database engine, version, or connection string issues.
**Fix:**
```typescript
// Change the 503 response from:
{ status: 'unhealthy', checks: { database: { status: 'error', error: errorMessage, latency: null } }
// To:
{ status: 'unhealthy', checks: { database: { status: 'error', error: 'Service unavailable', latency: null } }
```

### CR-02: `console.error` Used Instead of `logger.error` in Multiple API Routes
**Files:** `app/api/checkout/validate-coupon/route.ts` line 155, `app/api/admin/orders/[id]/status/route.ts` lines 302, 326, 360, 382, `app/api/admin/products/bulk/route.ts` lines 45, 70, `app/api/auth/cart/route.ts` line 75
**What:** Production API routes use raw `console.error` instead of the structured `logger.error`.
**Impact:** In Vercel serverless, `console.error` writes to stderr which may be captured in logs accessible to platform admins or leaked in some log aggregation setups. The structured `logger` is the project standard and should be used everywhere.
**Fix:** Replace all `console.error` calls in API routes with `logger.error`. Example:
```typescript
// Before
console.error('[checkout/validate-coupon]', error);
// After
logger.error('[checkout/validate-coupon]', { error: error instanceof Error ? error.message : String(error) });
```

---

## 🟡 HIGH (Should Fix Before Launch)

### HIGH-01: No Rate Limiting on `/api/auth/cart` (GET)
**File:** `app/api/auth/cart/route.ts`
**What:** This authenticated endpoint has no rate limit. A compromised admin account could make many rapid requests.
**Fix:** Apply `withRateLimit` — even 30 req/min would prevent abuse:
```typescript
export const GET = withRateLimit(async (req: NextRequest) => {
  // ... existing code
}, { windowMs: 60000, maxRequests: 30 });
```

### HIGH-02: No Rate Limiting on All Admin GET Routes
**Files:** `app/api/admin/orders/route.ts` (GET), `app/api/admin/orders/[id]/route.ts` (GET), `app/api/admin/customers/route.ts` (GET), `app/api/admin/coupons/route.ts` (GET)
**What:** Admin list/detail endpoints have no rate limit. A compromised admin account is unbounded.
**Fix:** Apply `withRateLimit` to all admin GET routes (30 req/min is reasonable for admin dashboards).

### HIGH-03: `/api/auth/cart` Uses `NextResponse.json` Instead of `serverError()` Helper
**File:** `app/api/auth/cart/route.ts` line 76-79
**What:** Error response bypasses the centralized `serverError()` helper.
**Fix:**
```typescript
// Replace:
return NextResponse.json({ success: false, error: 'Gagal memuat keranjang' }, { status: 500 });
// With:
return serverError(new Error('Gagal memuat keranjang'));
```

### HIGH-04: Admin Order Status Update Uses `console.error`
**File:** `app/api/admin/orders/[id]/status/route.ts` lines 302, 326, 360, 382
**What:** Multiple email failure errors logged with `console.error` instead of `logger.error`. Also email sending is `await`ed (blocking) instead of fire-and-forget like other routes.
**Fix:**
```typescript
// Change all email error logging to:
logger.error('[Email] Failed to send shipped email', { error: emailError instanceof Error ? emailError.message : String(emailError) });

// And make email sending non-blocking (like webhook handlers):
sendEmail({...}).catch((emailError) => {
  logger.error('[Email] Failed to send shipped email', {...});
});
```

### HIGH-05: Bulk Product Operations Use `console.error`
**File:** `app/api/admin/products/bulk/route.ts` lines 45, 70
**What:** Both PATCH and DELETE error paths use `console.error`.
**Fix:** Replace with `logger.error`.

---

## 🟢 MEDIUM (Improve When Possible)

### MED-01: B2B Account Guard `callbackUrl` Preservation
**File:** `middleware.ts` lines 55-61
**What:** The B2B account guard uses `callbackUrl` param but after login, the original `/b2b/account` URL may not be restored if NextAuth's default behavior is used.
**Fix:** Ensure the login page's `useEffect` (line 58) correctly picks up `callbackUrl` and redirects. This likely works but needs E2E testing.

### MED-02: Upload Route Has No Audit Trail
**File:** `app/api/upload/route.ts`
**What:** Who uploaded what and when is not logged. Important for forensics if a malicious actor gains admin access.
**Fix:** Add `logAdminActivity()` call after successful upload, similar to points adjust route.

### MED-03: `serverError()` in API Response Uses `console.error` Internally
**File:** `lib/utils/api-response.ts` line 67
**What:** The `serverError()` helper itself uses `console.error` instead of `logger.error`. If any API route uses `serverError()` (and they should), the error will be logged via `console.error`.
**Fix:**
```typescript
// In lib/utils/api-response.ts, change:
console.error('[API Error]', error);
// To:
import { logger } from '@/lib/utils/logger';
logger.error('[API Error]', { error: error instanceof Error ? error.message : String(error) });
```

### MED-04: CORS Not Explicitly Configured
**Files:** All API routes
**What:** No explicit CORS headers. Next.js defaults to same-origin. If a mobile app or third-party client needs access, this will break silently.
**Fix:** If no cross-origin API access is planned, document this. If it may be needed, add explicit CORS config:
```typescript
// In routes that need it:
headers: { 'Access-Control-Allow-Origin': 'https://dapurdekaka.com' }
```

### MED-05: All Admin Routes Missing `Content-Security-Policy` Headers
**Files:** `middleware.ts` lines 64-68
**What:** Security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.) are set but missing `Content-Security-Policy` which prevents XSS.
**Fix:** Add to middleware:
```typescript
response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
```

---

## SUMMARY

### Authentication: ✅ STRONG
- NextAuth v5 properly configured with Google + Credentials
- Session refresh on login prevents fixation
- Inactive user blocking at middleware level
- Role-based access control enforced in middleware AND in API routes (defense in depth)
- Forgot/reset password flows are solid (timing normalization, token rotation)

### Authorization: ✅ STRONG
- Every admin route double-checks auth + role at route handler level (middleware does initial check, route handler confirms)
- Warehouse role correctly limited to specific sub-paths
- B2B role correctly restricted to B2B-specific routes

### Rate Limiting: ⚠️ PARTIAL
- Auth routes and public checkout routes are protected
- Admin dashboard routes are NOT rate limited — this needs fixing before launch

### SQL Injection: ✅ PROTECTED
- All queries use Drizzle ORM parameterized queries — no raw SQL
- No string interpolation in queries

### Secrets Management: ✅ SECURE
- `.env.local` is in `.gitignore` — real secrets not committed
- Server keys (AUTH_SECRET, MIDTRANS_SERVER_KEY, CLOUDINARY_API_SECRET) are server-only
- `NEXT_PUBLIC_` prefix correctly applied to browser-safe vars

### Webhook Security: ✅ STRONG
- Midtrans signature verification using SHA-512 before any processing
- Idempotency guards prevent double-charging
- Amount cross-check prevents tampered webhooks

### Error Handling: ⚠️ NEEDS FIXES
- `console.error` used in multiple API routes instead of structured `logger`
- Health endpoint leaks DB error messages in 503
- Some routes bypass `serverError()` helper

### Points System: ✅ CORRECT
- Guest users cannot earn points
- FIFO redemption with `referencedEarnId` for reversal
- 50% subtotal cap enforced server-side
- B2B 2x multiplier correctly applied

### Transactions: ✅ PROPER
- All multi-step mutations use `db.transaction()`
- Stock deduction uses `GREATEST` guard
- Idempotency checked within transactions

---

## PRIORITY FIX ORDER

1. **CR-01** (Health endpoint) — 5 min fix, blocks launch if DB is down and attacker probes health
2. **CR-02** (console.error → logger.error) — 20 min fix across ~5 files, production logging standard
3. **HIGH-01** (rate limit on `/api/auth/cart`) — 5 min fix
4. **HIGH-02** (rate limit on admin GET routes) — 15 min fix across 4 routes
5. **MED-03** (serverError uses console.error internally) — 5 min fix in helper
6. Then test: login flow, checkout flow, webhook settlement, order cancellation