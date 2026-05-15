# NEW AUDIT 03 — Security & Authorization
# DapurDekaka.com — Auth Gaps, Role Enforcement, Attack Surfaces, Hardening
**Date:** May 2026 | **Scope:** All auth flows, middleware, API protection, OWASP Top 10 surface

---

## LEGEND
- ✅ Secure and correct
- ⚠️ Present but incomplete or bypassed in edge cases
- ❌ Not implemented or actively insecure
- 🔴 Exploitable — direct security risk
- 🟡 Risk under specific conditions
- 🟢 Hardening recommendation

---

## 1. CRITICAL: RATE LIMITER IN PRODUCTION

### 1.1 In-Memory Rate Limiter — Completely Ineffective on Vercel
**Status:** ❌ 🔴  
**File:** `lib/utils/rate-limit.ts`

The `InMemoryRateLimiter` uses a JavaScript `Map` as its store. On Vercel serverless:
- Each function invocation is a **separate process** with zero shared memory
- Rate limit state does not persist between invocations
- A single attacker can send 10,000 requests per second — each one starts with a fresh counter = 0

The in-memory limiter provides **zero protection in production**. It only works in local development (`next dev`) where there's a single long-running process.

**Impact:**
- `/api/checkout/initiate` — unlimited brute-force order creation attacks
- `/api/auth/forgot-password` — unlimited email spam via Resend (costs money)
- `/api/coupons/validate` — unlimited coupon enumeration
- `/api/auth/register` — unlimited bot account creation

**Fix Required — Upstash Redis Rate Limiter:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/utils/rate-limit.ts — REPLACE entire implementation
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export function createRateLimiter(requests: number, window: string) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
  });
}

// Usage in routes:
const limiter = createRateLimiter(10, '1 m');
const { success, limit, reset, remaining } = await limiter.limit(ip);
if (!success) return new Response('Too Many Requests', { status: 429 });
```

**Add to `.env.example`:**
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

---

## 2. WAREHOUSE STAFF — CANNOT ACCESS FIELD OPERATIONS PAGE

### 2.1 `/admin/field` Blocked by Middleware
**Status:** ❌ 🔴  
**File:** `app/middleware.ts` (lines 17–21)

The middleware restricts warehouse staff to ONLY `/admin/inventory` and `/admin/shipments`:
```typescript
if (role === 'warehouse') {
  const allowed = ['/admin/inventory', '/admin/shipments'];
  if (!allowed.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/admin/inventory', req.url));
  }
}
```

But the primary warehouse workflow page is at `/admin/field`. This page contains:
- Packing queue
- Tracking queue
- Pickup queue
- Today's summary
- Inventory management

**Warehouse staff cannot access `/admin/field` — they are immediately redirected to `/admin/inventory`.** This breaks the entire warehouse workflow.

**Fix Required:** Add `/admin/field` to the allowed paths for warehouse staff:
```typescript
if (role === 'warehouse') {
  const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
  if (!allowed.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/admin/field', req.url));
  }
}
```

---

## 3. ROLE-BASED ACCESS CONTROL

### 3.1 API Role Checks — Inconsistent Pattern
**Status:** ⚠️ 🟡  

Every admin API route manually checks role using the cast pattern:
```typescript
const role = (session.user as { role?: string }).role;
if (!role || !['superadmin', 'owner'].includes(role)) { ... }
```

This duplication means one misconfigured route could miss the check. A centralized `requireAdmin()` helper exists at `lib/auth/require-admin.ts` but it's not used consistently across all routes.

**Fix Required:** Audit every file under `app/api/admin/` to confirm it uses either `requireAdmin()` from `lib/auth/require-admin.ts` or has an explicit role check. Create a policy doc listing which roles can call which route families.

---

### 3.2 Owner Role — Can Access Settings & Coupons
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 9.3 — "Owner: cannot manage coupons, cannot access settings"

The role permission matrix in PRD states Owner cannot manage coupons or access system settings. But the API routes at `app/api/admin/coupons/route.ts` and `app/api/admin/settings/route.ts` check:
```typescript
if (!['superadmin', 'owner'].includes(role)) { ... } // ← Owner allowed
```

The owner role is incorrectly permitted on coupon management and settings APIs.

**Fix Required:**
```typescript
// Coupons: superadmin only
if (role !== 'superadmin') return forbidden('Hanya superadmin');

// Settings: superadmin only
if (role !== 'superadmin') return forbidden('Hanya superadmin');
```

---

### 3.3 B2B Profile Approval — No Check on B2B Order Pricing
**Status:** ⚠️ 🟡  
**File:** `app/(b2b)/b2b/products/page.tsx` or equivalent

B2B users see B2B pricing in the catalog. But there is no check whether a B2B user has been **approved** (`b2b_profiles.isApproved = true`) before showing B2B prices. Any user with `role = 'b2b'` (set manually by superadmin) sees B2B prices, even if their profile hasn't been formally approved yet.

**Fix Required:** In the B2B product catalog, check `b2bProfiles.isApproved` before showing B2B pricing. Show regular pricing with a "Pending approval" banner for unapproved B2B users.

---

### 3.4 Midtrans Webhook — No IP Allowlist
**Status:** ⚠️ 🟢  
**File:** `app/api/webhooks/midtrans/route.ts`

The webhook validates the signature hash correctly. However, there is no IP allowlist for Midtrans webhook IPs. While signature validation is the primary defense, IP allowlisting adds a second layer. Midtrans publishes their webhook IP ranges.

**Consider Adding:**
```typescript
const MIDTRANS_IP_RANGES = ['103.208.23.0/24', '103.208.23.6', ...]; // From Midtrans docs
const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.ip;
if (!isIPAllowed(clientIP, MIDTRANS_IP_RANGES)) {
  return new Response('Forbidden', { status: 403 });
}
```

---

## 4. INPUT VALIDATION & INJECTION

### 4.1 Rich Text (TipTap) — HTML Sanitization
**Status:** ⚠️ 🟡  
**Files:** `app/api/admin/blog/route.ts`, `app/api/admin/blog/[id]/route.ts`

Blog post content is HTML from TipTap. `isomorphic-dompurify` is installed but verify it's actually applied to `contentId` and `contentEn` before database insertion. If raw HTML is stored and rendered server-side without sanitization, this is a **stored XSS vector**.

**Fix Required:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

const cleanContentId = DOMPurify.sanitize(data.contentId, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img', 'blockquote'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class'],
});
```

---

### 4.2 Address Fields — No SQL Injection Beyond ORM
**Status:** ✅  
All DB queries use Drizzle ORM parameterized queries. No raw SQL string concatenation with user input.

---

### 4.3 Order Notes — XSS via Customer Note
**Status:** ⚠️ 🟢  
**File:** `app/api/checkout/initiate/route.ts`

`customerNote` is stored and displayed in the admin order detail page. If the admin order page renders `customerNote` using `dangerouslySetInnerHTML` instead of as text content, a customer can inject HTML/JS via the order notes field.

**Fix Required:** Ensure `customerNote` is always rendered as plain text:
```tsx
<p className="...">{order.customerNote}</p>  // ← Correct (escaped by React)
// NOT:
<p dangerouslySetInnerHTML={{ __html: order.customerNote }} />  // ← XSS risk
```

---

### 4.4 Coupon Code Enumeration
**Status:** ⚠️ 🟡  
**File:** `app/api/coupons/validate/route.ts`

The coupon validation endpoint has a 20-request-per-minute rate limit (which is non-functional in production — see Issue 1.1). Even with functioning rate limits, the response distinguishes between:
- "Kupon tidak ditemukan" (code doesn't exist)
- "Kupon tidak aktif" (code exists but inactive)
- "Kupon sudah kadaluarsa" (code expired)

This allows attackers to enumerate which coupon codes exist. Return a generic "Kupon tidak valid" for all non-applicable cases.

---

## 5. CLOUDINARY SECURITY

### 5.1 Upload Signed Correctly
**Status:** ✅  
`lib/cloudinary/upload.ts` uses the Cloudinary SDK with `api_key` and `api_secret` (server-side only). No unsigned upload presets. Upload only goes through `/api/admin/upload` which has auth checks.

### 5.2 Cloudinary Public ID — Deletion Risk
**Status:** ⚠️ 🟢  
When a product image is deleted via `DELETE /api/admin/products/[id]/images/[imageId]`, the Cloudinary `publicId` must be used to delete the asset from Cloudinary CDN. If the route only deletes the DB record but not the Cloudinary asset, the CDN object remains accessible via direct URL forever and accumulates storage costs.

**Fix Required:** After deleting from DB, call:
```typescript
await cloudinary.uploader.destroy(image.cloudinaryPublicId);
```

---

## 6. CONTENT SECURITY POLICY

### 6.1 CSP Analysis
**File:** `next.config.ts`

| Directive | Value | Assessment |
|-----------|-------|------------|
| `script-src` | `'unsafe-inline'` allowed | ⚠️ Needed for Midtrans Snap.js — document this |
| `frame-src` | Midtrans only | ✅ |
| `img-src` | Cloudinary, Google, CDN | ✅ |
| `connect-src` | Midtrans, RajaOngkir, Cloudinary | ⚠️ RajaOngkir is server-side only, remove from CSP |
| `frame-ancestors` | `'none'` | ✅ Clickjacking protected |

**Issues:**
- `'unsafe-inline'` in `script-src` weakens XSS protection. Use a Midtrans-specific nonce or hash instead if possible.
- RajaOngkir in `connect-src` is unnecessary (server-side only) and leaks implementation details.

---

### 6.2 Missing CSP Directives
**Status:** ⚠️ 🟢  

- **`form-action`** — Not set. Should be `'self'` to prevent form hijacking.
- **`base-uri`** — Not set. Should be `'self'` to prevent base-tag injection.
- **`upgrade-insecure-requests`** — Add to force HTTPS for all sub-resources.

```typescript
// Add to cspDirectives array:
"form-action 'self'",
"base-uri 'self'",
"upgrade-insecure-requests",
```

---

## 7. ENVIRONMENT VARIABLE SECURITY

### 7.1 No Runtime Env Validation on Boot
**Status:** ⚠️ 🟡  
**File:** `lib/config/validate-env.ts`

A validation file exists. Verify it's actually called on server startup (in `lib/db/index.ts` or `next.config.ts`). If env vars are missing, errors should surface at startup, not at runtime when the first request hits a broken integration.

**Fix Required:** Import and call `validateEnv()` at the top of `lib/db/index.ts` or in `next.config.ts`:
```typescript
// lib/db/index.ts
import { validateEnv } from '@/lib/config/validate-env';
validateEnv(); // Throws if required vars missing
```

---

### 7.2 `NEXT_PUBLIC_` Variables — What's Exposed to Browser
**Status:** ✅  
Currently exposed to client:
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — Safe (read-only cloud name)
- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` — Safe (public Midtrans key, expected to be public)
- `NEXT_PUBLIC_APP_URL` — Safe
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — Safe

All sensitive keys (`MIDTRANS_SERVER_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`) correctly lack `NEXT_PUBLIC_` prefix.

---

## 8. PASSWORD SECURITY

### 8.1 Password Reset Token — Single-Use Verified
**Status:** ✅  
**File:** `app/api/auth/reset-password/route.ts`

Reset tokens are stored as bcrypt hashes, have `expiresAt`, and `usedAt` fields. The route checks `usedAt IS NULL` and sets `usedAt = NOW()` on use. Single-use enforcement is correct.

---

### 8.2 Password Reset — Token Expiry
**Status:** ⚠️ 🟢  

Verify that reset tokens expire after a reasonable period (1 hour is standard). If `expiresAt` is set to 24 hours or more, a leaked reset email can be exploited long after the user requested it.

---

### 8.3 Bcrypt Rounds — 10
**Status:** ✅  
bcrypt with 10 rounds is the current industry standard balance between security and performance. Acceptable.

---

## 9. COOKIE & SESSION SECURITY

### 9.1 NextAuth Session Cookie Flags
**Status:** ⚠️ 🟢  

NextAuth sets `HttpOnly`, `Secure`, and `SameSite=Lax` by default. On Vercel (HTTPS), `Secure` flag is active. However, if the application is ever tested via plain HTTP (non-Vercel preview), session cookies could leak.

**Recommendation:** Explicitly set cookie flags in the NextAuth config:
```typescript
cookies: {
  sessionToken: {
    name: `__Secure-next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    },
  },
},
```

---

## 10. ADMIN AREA HARDENING

### 10.1 Admin Login Attempt Logging
**Status:** ❌ 🟢  

Failed admin login attempts are not logged to `admin_activity_logs`. An attacker brute-forcing admin credentials would leave no trace (beyond server logs). Add failed login attempt logging to the NextAuth `signIn` callback.

---

### 10.2 Two-Factor Authentication
**Status:** ❌ 🟢  
**PRD Reference:** Section 9.4 — "Add 2FA for admin accounts" (recommendation)

No 2FA for admin accounts. For a production e-commerce platform, consider TOTP-based 2FA for superadmin and owner roles using a library like `otpauth`.

---

### 10.3 Admin Session Invalidation
**Status:** ⚠️ 🟢  

If an admin's role is changed (e.g., warehouse staff downgraded to customer), their existing sessions in the `sessions` table retain the old role until expiry (up to 30 days). The role is read from the `sessions` table join, not re-checked on every request.

**Fix Required:** When `PATCH /api/admin/users/[id]` changes a user's role, also delete all their active sessions:
```typescript
await db.delete(sessions).where(eq(sessions.userId, id));
```

---

## SUMMARY — SECURITY ISSUES BY PRIORITY

| Priority | Issue | Impact | File |
|----------|-------|--------|------|
| 🔴 Critical | In-memory rate limiter — useless in production | Unlimited brute force | `lib/utils/rate-limit.ts` |
| 🔴 Critical | Warehouse staff blocked from `/admin/field` | Operations broken | `app/middleware.ts` |
| 🟡 Major | Owner can manage coupons/settings (shouldn't) | Privilege escalation | `api/admin/coupons/route.ts`, `api/admin/settings/route.ts` |
| 🟡 Major | Blog content not sanitized (stored XSS risk) | XSS via TipTap HTML | `api/admin/blog/route.ts` |
| 🟡 Major | Coupon validation leaks existence info | Code enumeration | `api/coupons/validate/route.ts` |
| 🟡 Major | Admin role change doesn't invalidate sessions | Privilege retained 30 days | `api/admin/users/[id]/route.ts` |
| 🟢 Minor | TypeScript role types lack proper declaration | Type safety | `lib/auth/index.ts` |
| 🟢 Minor | CSP missing `form-action`, `base-uri` | Defense in depth | `next.config.ts` |
| 🟢 Minor | Cloudinary deletion doesn't remove CDN asset | Storage leak | `api/admin/products/[id]/images/[imageId]/route.ts` |
| 🟢 Minor | B2B approval not checked before showing prices | Unapproved B2B sees prices | `b2b/products/page.tsx` |
| 🟢 Minor | Failed admin logins not logged | Forensic gap | `lib/auth/index.ts` |
| 🟢 Minor | No env validation on startup | Runtime errors not caught early | `lib/config/validate-env.ts` |
