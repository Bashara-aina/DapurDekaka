# AUDIT 04 — Authentication, Authorization, Middleware & Security

**Project:** DapurDekaka.com
**Date:** May 24, 2026

---

## EXECUTIVE SUMMARY

The auth system is well-implemented with NextAuth v5, proper session management, and good security patterns. Critical issues: rate limiting silently disabled in production without visible failure signal, multiple console.error violations in auth routes, missing AUTH_SECRET validation, and a potential auth bypass in the guest order retry flow. HIGH severity: missing rate limiting on `validate-coupon` (coupon enumeration possible).

---

## AUTH CONFIG (`lib/auth/config.ts`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — No AUTH_SECRET Validation:**
- `AUTH_SECRET` is never validated at startup — no check that it exists and has minimum length (32+ chars)
- A missing or short AUTH_SECRET would cause silent authentication failures in production

**Fix:** Add startup validation:
```typescript
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('AUTH_SECRET must be set and at least 32 characters long');
}
```

**Also noted:**
- `trustHost: true` — correct for Vercel/proxy setups
- Session strategy `'database'` — secure
- `secure` cookie flag correctly set to `true` only in production

---

## MIDDLEWARE (`app/middleware.ts`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

**FINDING — Warehouse Role Can Access Order Details:**
- Warehouse role allowed to access `/admin/orders/[id]` — exposes all order data (item names, prices, customer PII)
- Several admin sub-routes (`/admin/customers`, `/admin/coupons`, `/admin/blog`, `/admin/carousel`, `/admin/ai-content`) not in warehouse allowed paths — redirected to `/admin/inventory`
- Redirect is silent (no "Access Denied" message shown to user)

**Also noted:**
- No rate limiting at middleware layer
- No explicit "forbidden" page — user just gets redirected to dashboard

---

## CHECK-ROLE HELPER (`lib/auth/check-role.ts`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- `requireRole()` uses `redirect()` for forbidden — acceptable but no user-facing message about why denied
- `requireGuest()` correctly prevents logged-in users from accessing guest-only pages

---

## LOGIN PAGE (`app/(auth)/login/page.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — console.error Violation (Line 105):**
```typescript
console.error('[Cart merge failed]', err);
```
- Violates "no console.log in production" rule
- Should use `logger.error` from `lib/utils/logger`

**Also noted:**
- Cart merge logic uses localStorage directly — no server validation of cart items (API route has rate limiting so this is acceptable)

---

## REGISTER ROUTE (`app/api/auth/register/route.ts`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Rate limit: 5 requests per 60 seconds ✅
- Zod validation: name min 2, email format, password complexity (uppercase+lowercase+digit) ✅
- Email normalized to lowercase before DB check — prevents email case exploits ✅
- Password hashed with bcrypt, cost factor 12 ✅
- Returns 409 Conflict if email exists ✅

---

## FORGOT PASSWORD ROUTE (`app/api/auth/forgot-password/route.ts`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Multiple console.error Violations:**
- Line 61: `console.error('[auth/forgot-password] Email send failed:', err);`
- Line 71: `console.error('[auth/forgot-password]', error);`

**Also noted:**
- Timing normalization implemented correctly (line 64-65) — no user enumeration ✅
- Token uses `crypto.randomBytes(32)` — cryptographically secure ✅
- Token hash stored as bcrypt, prefix stored in plaintext — correct pattern ✅
- Rate limit: 3 requests per 60 seconds (appropriate for password reset)

---

## RESET PASSWORD ROUTE (`app/api/auth/reset-password/route.ts`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — console.error Violation (Line 57):**
```typescript
console.error('[auth/reset-password]', error);
```

**Also noted:**
- Session invalidation on password reset (line 48) — prevents session fixation ✅
- Password complexity not re-validated server-side (client enforces min 8 chars) — acceptable

---

## NEXTAUTH HANDLER (`app/api/auth/[...nextauth]/route.ts`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Rate limiting: 10 requests/minute on both GET and POST ✅
- Key generator uses `x-forwarded-for` then `x-real-ip` — good for proxy setups ✅

---

## CART AUTH ROUTES

### `app/api/auth/cart/route.ts`

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — console.error Violation (Line 74):**
```typescript
console.error('[GET /api/auth/cart]', error);
```

**Also noted:**
- Auth protected with `unauthorized()` response ✅
- Filters out out-of-stock variants from returned cart ✅
- No rate limiting applied — lower risk for protected route but should still have it

### `app/api/auth/merge-cart/route.ts`

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDINGS:**
1. `console.error` violation (Line 80): `console.error('[auth/merge-cart]', error);`
2. No Zod validation on incoming `CartItem` array — interface is used for type assertion only, not runtime validation. Malformed body could crash or cause unexpected behavior.

**Also noted:**
- Quantity capped at 99 ✅
- Auth check with unauthorized response ✅
- Uses `db.transaction` for atomic merge ✅
- Rate limiting: 10 requests per 60 seconds ✅

---

## RATE LIMITING ASSESSMENT

### `lib/utils/rate-limit.ts`

| Status | 🟠 CRITICAL |
|--------|-------------|
| Severity | **CRITICAL** |

**CRITICAL FINDING — Silent Failure in Production:**

```typescript
// In production (NODE_ENV=production), if Upstash Redis is not configured:
if (process.env.NODE_ENV === 'production') {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    logger.error('[Rate limit] Upstash Redis not configured...');
    return nextHandler(req); // ← RETURNS WITHOUT RATE LIMITING
  }
}
```

This means:
- A production deployment WITHOUT `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` has **ZERO rate limiting**
- The code logs an error but continues silently — no crash, no failure mode
- The in-memory fallback is explicitly marked as "not effective in serverless production"
- No visible indicator in the app that rate limiting is disabled

**Fix Options:**
1. Add a startup check that throws/fails build if Upstash is not configured in production
2. Use Vercel's built-in rate limiting (if on Vercel Pro/Enterprise)
3. Fall back to a simple in-memory rate limiter with a visible warning

---

## GUEST CHECKOUT SECURITY

### `app/api/checkout/retry/route.ts` — Auth Bypass on Retry

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Guest Order Retry Auth Check:**
- Lines 41-45 check: `session.user.id !== order.userId` — only order owner or superadmin/owner can retry
- But for guests: `session.user.id` would be undefined/null, and `order.userId` is also null
- The check `null !== null` evaluates to `false` — so the subsequent role check for superadmin/owner would need to pass
- This means a guest who has the order number could potentially access someone else's guest order if the order IDs collide

**Note:** Guest order dedup is based on email + cart hash within 60 seconds — order IDs are UUIDs so collision risk is extremely low. But the auth bypass possibility should be verified.

---

## CONSOLIDATED ISSUES

| Severity | Count | Issues |
|---|---|---|
| **CRITICAL** | 1 | Rate limiting disabled in production without failure signal |
| **HIGH** | 2 | Warehouse role access to order details; coupon enumeration via missing rate limit |
| **MEDIUM** | 7 | AUTH_SECRET not validated; 5x console.error violations; merge-cart missing Zod validation |
| **LOW** | 2 | No "access denied" messaging; no rate limiting on auth/cart route |

---

## PRIORITY FIX LIST

### 🔴 CRITICAL
1. **`lib/utils/rate-limit.ts`** — Add startup validation that throws/fails if Upstash is not configured in production

### 🟠 HIGH
2. **`app/middleware.ts`** — Review warehouse role access to order details — consider restricting to orders from their assigned warehouse/city only
3. **`app/api/checkout/validate-coupon/route.ts`** — Add `withRateLimit` wrapper (10 req/min) to prevent coupon enumeration (also in Audit 02)

### 🟡 MEDIUM
4. **`lib/auth/config.ts`** — Add AUTH_SECRET startup validation (length >= 32)
5. **`app/api/auth/forgot-password/route.ts`** — Replace `console.error` with `logger.error` (lines 61, 71)
6. **`app/api/auth/reset-password/route.ts`** — Replace `console.error` with `logger.error` (line 57)
7. **`app/(auth)/login/page.tsx`** — Replace `console.error` with `logger.error` (line 105)
8. **`app/api/auth/cart/route.ts`** — Replace `console.error` with `logger.error` (line 74)
9. **`app/api/auth/merge-cart/route.ts`** — Replace `console.error` with `logger.error` (line 80); add Zod validation for CartItem array
10. **`app/api/checkout/retry/route.ts`** — Verify guest order auth bypass is not exploitable

### 🟢 LOW
11. **`lib/auth/check-role.ts`** — Consider adding `ctx` parameter to `logger.warn` for failed role checks
12. **`app/middleware.ts`** — Add explicit "access denied" messaging when warehouse tries to access restricted routes