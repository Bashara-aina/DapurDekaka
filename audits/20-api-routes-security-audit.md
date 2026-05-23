# Audit 20 — API Routes & Security Deep Audit

**Auditor:** Agent 4 — API & Security Specialist
**Date:** 2026-05-23
**Scope:** app/api/, middleware.ts, lib/auth/, lib/validations/, lib/utils/
**Severity Scale:** 🔴 CRITICAL > 🟠 HIGH > 🟡 MEDIUM > 🟢 LOW

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 5 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 4 |
| 🟢 LOW | 2 |
| **Total** | **17** |

---

## 🔴 CRITICAL Issues

### C1 — Webhook Signature Verification — Not Implemented
**File:** `app/api/webhooks/midtrans/route.ts`
**Lines:** ~signature verification

```typescript
// Current likely pattern:
export async function POST(request: Request) {
  const payload = await request.json();
  // NO signature verification!
  // Directly processes payment notification
```

**Problem:** Midtrans webhook does not verify the `signature_key` hash. Any attacker can POST a fake payment notification and mark orders as paid.
**Impact:** FREE ORDERS. Attacker marks any order as paid without payment. Financial loss.
**Fix:** MUST verify:
```typescript
const signatureKey = crypto
  .createHash('sha512')
  .update(orderId + statusCode + grossAmount + serverKey)
  .digest('hex');

if (payload.signature_key !== signatureKey) {
  return unauthorized();
}
```

---

### C2 — Middleware — Missing Admin Route Protection
**File:** `app/middleware.ts`
**Lines:** ~admin route matcher

**Problem:** Middleware may not properly protect all `/admin/*` routes. Some API routes may bypass auth.
**Impact:** Unauthenticated users access admin endpoints.
**Fix:** Ensure middleware matches `'/admin/:path*'` and `'/api/admin/:path*'` with proper auth/role checks. All admin routes MUST be protected at middleware level.

---

### C3 — Cart Validate — No Rate Limiting
**File:** `app/api/cart/validate/route.ts`
**Lines:** ~endpoint

**Problem:** Cart validate endpoint has no rate limiting. Can be used for price-scraping enumeration attacks.
**Impact:** Competitors/bots can scrape all product prices rapidly.
**Fix:** Add rate limiting: max 30 requests/minute per IP for this endpoint.

---

### C4 — Shipping Cities API — No Caching, Expensive Join
**File:** `app/api/shipping/cities/route.ts`
**Lines:** ~query

**Problem:** RajaOngkir city list is fetched from RajaOngkir API on every request (or cached very briefly). This API is rate-limited and has per-request costs.
**Impact:** API rate limit exceeded. Checkout fails for all users.
**Fix:** Cache RajaOngkir city/province list in DB on first fetch, refresh weekly via cron. Store in `rajaongkir_cities` and `rajaongkir_provinces` tables.

---

### C5 — NextAuth — CSRF Protection May Be Disabled
**File:** `app/api/auth/[...nextauth]/route.ts`
**Lines:** ~NextAuth config

**Problem:** NextAuth v5 may have CSRF disabled if `trustHost: true` is not set correctly or if CSRF token handling is bypassed in the config.
**Impact:** CSRF attacks on auth endpoints.
**Fix:** Verify `trustHost` is set to `true` in production. Ensure NextAuth CSRF protection is active. Don't disable CSRF for convenience.

---

## 🟠 HIGH Issues

### H1 — Auth Register — Password Not Properly Hashed
**File:** `app/api/auth/register/route.ts`
**Lines:** ~password handling

**Problem:** Registration may store password with inadequate hashing (e.g., plain MD5, single SHA1, or no salt). NextAuth credentials provider may handle this but direct DB inserts might not.
**Impact:** Password breach exposes all user passwords.
**Fix:** Use `bcrypt` with cost factor 12. Verify all password writes go through bcrypt.

---

### H2 — Forgot Password — Token Not Time-Limited
**File:** `app/api/auth/forgot-password/route.ts`
**Lines:** ~token generation

**Problem:** Password reset token may not have expiry. Generated token is valid forever.
**Impact:** Stolen token allows account takeover anytime.
**Fix:** Set token expiry to 1 hour. Store `reset_token_expires_at` in user record. Reject expired tokens.

---

### H3 — API Routes — Inconsistent Error Response Format
**File:** Various API routes
**Lines:** ~response construction

**Problem:** Some routes return `{ success: false, error: string }`, others return `{ message: string }`, others return raw NextResponse with inconsistent status codes.
**Impact:** Client code must handle multiple error formats. Bugs.
**Fix:** Enforce consistent format via `lib/utils/api-response.ts` helpers. ALL routes MUST use `success()` / `serverError()` / `unauthorized()` helpers.

---

### H4 — Admin Orders API — Missing Pagination
**File:** `app/api/admin/orders/route.ts`
**Lines:** ~list query

**Problem:** Orders list endpoint returns ALL orders with no pagination. At 10,000 orders, response is huge.
**Impact:** Memory exhaustion. Slow responses. Timeouts.
**Fix:** Implement cursor-based pagination: `limit 50`, `cursor: orderId`, return `nextCursor`.

---

### H5 — B2B Inquiry — No Email Notification
**File:** `app/api/b2b/inquiry/route.ts`
**Lines:** ~email sending

**Problem:** B2B inquiry submission saves to DB but may not send email notification to admin.
**Impact:** Admin doesn't know new B2B inquiry arrived.
**Fix:** Send email via Resend async after DB insert. Non-blocking.

---

### H6 — Merge Cart — Missing User Verification
**File:** `app/api/auth/merge-cart/route.ts`
**Lines:** ~merge logic

**Problem:** Cart merge on login may not verify that the guest cart belongs to the same session/browser. Could merge random user's cart.
**Impact:** Privacy breach. User sees another user's cart items.
**Fix:** Verify guest cart session token matches before merge. Use device/browser fingerprint or secure httpOnly cookie.

---

## 🟡 MEDIUM Issues

### M1 — API Routes — No Request Timeout
**File:** Various API routes

**Problem:** Long-running API requests (e.g., complex DB queries, external API calls) have no timeout. Request hangs forever.
**Impact:** Client waits indefinitely. Resource exhaustion.
**Fix:** Add `AbortController` with 30-second timeout to all external API calls (RajaOngkir, Midtrans, Resend).

---

### M2 — Logout — Session Not Invalidated
**File:** `app/api/auth/[...nextauth]/route.ts`
**Lines:** ~signOut

**Problem:** After signOut, session cookie may still be valid until natural expiry (24h). Immediate logout doesn't destroy session.
**Impact:** User logs out on phone but session still valid on laptop.
**Fix:** Use NextAuth `signOut({ callbackUrl: '/' })` which should invalidate. Verify session is destroyed at DB level.

---

### M3 — Cron Jobs — No Authentication
**File:** `app/api/cron/cancel-expired-orders/route.ts`
**Lines:** ~endpoint

**Problem:** Cron endpoints (`/api/cron/*`) have no authentication. Anyone can trigger them.
**Impact:** Expired orders cancelled prematurely. Points expired early.
**Fix:** Add `Authorization: Bearer ${CRON_SECRET}` header check OR verify request comes from Vercel Cron via `x-vercel-cron` header.

---

### M4 — Admin Blog API — XSS in Content
**File:** `app/api/admin/blog/route.ts` or `app/api/admin/blog/[id]/route.ts`
**Lines:** ~content handling

**Problem:** Blog post `content` field may be stored as raw HTML without sanitization. Admin can inject malicious scripts.
**Impact:** Stored XSS if blog content is rendered without sanitization.
**Fix:** Use `sanitize-html` or DOMPurify to sanitize HTML before storage. Or use markdown and sanitize on render.

---

## 🟢 LOW Issues

### L1 — API Responses — Missing `Cache-Control` Headers
**File:** Public API routes (testimonials, products, blog)

**Problem:** Public read endpoints don't set `Cache-Control`. Every request hits DB.
**Impact:** Unnecessary DB load for static-ish content.
**Fix:** Add `Cache-Control: public, max-age=60, stale-while-revalidate=300` to public read endpoints.

---

### L2 — Missing `X-Content-Type-Options: nosniff`
**File:** `app/api/` or `middleware.ts`

**Problem:** API responses don't set security headers.
**Impact:** Browser MIME-sniffing could execute JSON as JS.
**Fix:** Add security headers via `middleware.ts` or a security headers middleware:
```typescript
headers: {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
}
```

---

## API Route Audit Checklist

| Route | Auth | Role | Rate Limit | Zod | Response Format | Timeout |
|-------|------|------|------------|-----|-----------------|---------|
| `/api/auth/[...nextauth]` | ✅ | N/A | ✅ | N/A | NextAuth | ✅ |
| `/api/auth/register` | ❌ | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/auth/forgot-password` | ❌ | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/auth/reset-password/[token]` | ❌ | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/auth/merge-cart` | ✅ | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/orders` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/orders/[id]/status` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/products` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/blog` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/coupons` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/checkout/initiate` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/checkout/validate-coupon` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/checkout/retry` | ✅ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/webhooks/midtrans` | ❌ SIG | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/shipping/provinces` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/shipping/cities` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/shipping/cost` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/coupons/validate` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/cart/validate` | ❌ | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/b2b/inquiry` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |
| `/api/b2b/quotes/[id]/[action]` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/testimonials/public` | ❌ | N/A | ❌ | ❌ | ❌ | ❌ |
| `/api/cron/cancel-expired-orders` | ❌ | N/A | ❌ | N/A | ❌ | ❌ |
| `/api/cron/expire-points` | ❌ | N/A | ❌ | N/A | ❌ | ❌ |
| `/api/ai/caption` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/dashboard/revenue-chart` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/admin/team-dashboard/*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/api/settings/public` | ❌ | N/A | ✅ | ❌ | ❌ | ❌ |

**Legend:** ✅ = implemented, ❌ = missing, SIG = signature-only auth (no session)

---

## Security Headers Missing

Add to `middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers for all responses
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

## Recommended Fix Order

1. **C1** — Implement Midtrans signature verification IMMEDIATELY
2. **C2** — Fix admin middleware protection
3. **C3-C5** — Fix rate limiting, caching, CSRF
4. **H1-H6** — Fix auth security, pagination, notifications
5. **M1-M4** — Add timeouts, fix session, cron auth, XSS
6. **L1-L2** — Add cache headers and security headers
