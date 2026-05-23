# Audit 15 — Security & Infrastructure

**Auditor:** Deep Code Audit Agent  
**Date:** 2026-05-23  
**Scope:** Security, Infrastructure, Auth, Payments, Middleware, Rate Limiting  
**Standard:** Production-ready for 100 concurrent users with real attackers  

---

## SUMMARY

| Severity | Count |
|---|---|
| CRITICAL | 5 |
| HIGH | 7 |
| MEDIUM | 7 |
| LOW | 3 |

---

## SECTION 1: ENVIRONMENT VARIABLES

### CRITICAL-01: CRON_SECRET Not in validate-env.ts REQUIRED Array

**File:** `lib/config/validate-env.ts`  
**Lines:** 1-12

**Problem:** `CRON_SECRET` is in `.env.example` (line 47) and used in all 7 cron routes via `vercel.json`, but `validate-env.ts` does NOT include it in the `REQUIRED` array. No startup validation.

**Impact:** If cron secrets are accidentally unset, cron jobs run with no authentication. Anyone who discovers a cron endpoint URL can trigger order cancellations, point expiry, and payment reconciliation.

**Fix:** Add `CRON_SECRET` to the `REQUIRED` array in `lib/config/validate-env.ts`.

---

### CRITICAL-02: Upstash Redis Not Enforced in Production — Rate Limiting Silently Disabled

**File:** `lib/utils/rate-limit.ts` lines 31-36

**Problem:** `validateRedisConfig()` only **warns** in production when Upstash Redis is not configured. The comment says "CRITICAL" but the code logs a warning and continues. Rate limiting falls back to in-memory, which is ineffective in serverless (Vercel) environments where each function invocation has its own memory.

**Impact:** All public API routes (`/api/checkout/initiate`, `/api/auth/register`, etc.) have NO effective rate limiting in production if Upstash credentials are missing.

**Fix:** Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to the `REQUIRED` array in `validate-env.ts`, OR change `validateRedisConfig()` to throw in production instead of warn.

---

### MEDIUM-01: NEXT_PUBLIC_APP_URL Falls Back to localhost in Production

**File:** `lib/midtrans/create-transaction.ts` line 24

**Code:**
```typescript
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
```

**Problem:** If `NEXT_PUBLIC_APP_URL` is unset in production, Midtrans callbacks redirect to `localhost`. Payment completion webhooks break entirely — orders stay `pending_payment` forever.

**Impact:** Payment flow silently fails. Customer pays but never sees success page.

**Fix:** Validate `NEXT_PUBLIC_APP_URL` is set in `validate-env.ts`, or change fallback to `https://dapurdekaka.com`.

---

## SECTION 2: AUTH & MIDDLEWARE

### CRITICAL-03: Missing Rate Limiting on Login Endpoint

**File:** `app/(auth)/login/page.tsx` (API route `app/api/auth/[...nextauth]/route.ts`)

**Problem:** `register` route has `withRateLimit` at 5 req/min. Login has NO rate limit. Credential stuffing and brute force attacks are unmitigated.

**Impact:** Attacker can try unlimited password combinations against user accounts.

**Fix:** Add `withRateLimit` wrapper to the NextAuth handlers in `lib/auth/config.ts`:
```typescript
const handler = withRateLimit(authHandle, {
 key: 'auth-login',
 limit: 5,
 window: 60 * 1000,
});
```

---

### CRITICAL-04: Warehouse Role Allowed Paths Missing /admin/orders

**File:** `app/middleware.ts` line 18

**Code:**
```typescript
const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
```

**Problem:** Warehouse staff need to view `/admin/orders` to pack orders and enter tracking numbers, but it's not in the allowed list. They are blocked from the orders page even though the role matrix says they can access it.

**Impact:** Warehouse staff cannot do their primary job function.

**Fix:** Add `/admin/orders` to the allowed array:
```typescript
const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];
```

---

### HIGH-01: requireAdmin Returns Dummy Static SessionUser

**File:** `lib/auth/require-admin.ts` lines 39-55

**Problem:** `requireAdmin()` returns a static placeholder `SessionUser` with empty `id` instead of actual session data. Downstream admin API routes checking `session.user.id` get `''`. Audit logs, order ownership checks fail silently.

**Full details:** See Audit 14, BUG-04.

**Fix:** Return `{ user: session.user }` with actual session data from `auth()`.

---

### MEDIUM-02: AUTH_SECRET Length Check Only — No Entropy Validation

**File:** `lib/config/validate-env.ts` line 23

**Code:**
```typescript
if (secret.length < 32)
```

**Problem:** Only checks length, not character quality. A 32-char string of spaces or repeated characters passes.

**Fix:** Add entropy check or recommend `openssl rand -base64 32` in error message.

---

### MEDIUM-03: Auth Config Returns null Session for Inactive Users

**File:** `lib/auth/config.ts` lines 75-77

**Problem:** `dbUser.isActive === false` returns `null`. "Not logged in" and "logged in but deactivated" are indistinguishable downstream.

**Fix:** Return session with `isActive: false` flag instead of null.

---

## SECTION 3: MIDTRANS WEBHOOK

### CRITICAL-05: Invalid Webhook Signature Returns 400 Instead of 401

**File:** `app/api/webhooks/midtrans/route.ts` line 54

**Code:**
```typescript
return NextResponse.json({ received: false }, { status: 400 });
```

**Problem:** Invalid signature returns HTTP 400 (Bad Request). Midtrans may interpret 400 as malformed request and stop retrying, rather than treating as auth failure and retrying with correct signature.

**Impact:** If signature verification fails transiently (e.g., server key rotation), orders may not auto-reconcile via `reconcile-payments` cron, causing payment delays.

**Fix:**
```typescript
return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
```

---

### HIGH-02: No CRON_SECRET Verification in Cron Handlers

**Files:** All 7 cron route handlers:
- `app/api/cron/cancel-expired-orders/route.ts`
- `app/api/cron/expire-points/route.ts`
- `app/api/cron/points-expiry-warning/route.ts`
- `app/api/cron/reconcile-points/route.ts`
- `app/api/cron/reconcile-payments/route.ts`
- `app/api/cron/cleanup-counters/route.ts`
- `app/api/cron/cleanup-audit-logs/route.ts`

**Problem:** Vercel cron requires `Authorization: Bearer <CRON_SECRET>` header. None of the handlers verify this header. Anyone who discovers a cron endpoint URL can trigger it manually.

**Impact:** Unauthorized order cancellations, point expiry, counter corruption.

**Fix:** Add verification at the top of each cron handler:
```typescript
const auth = req.headers.get('authorization');
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## SECTION 4: API SECURITY

### HIGH-03: B2B Net-30 Bypasses Midtrans — No Signature Verification

**File:** `app/api/checkout/initiate/route.ts` lines 389-402, 533-536, 612-687

**Problem:** B2B Net-30 orders are marked `paid` immediately at initiate time with no payment gateway verification. `isNet30Approved` flag on `b2bProfiles` controls access, but there's no additional verification (e.g., signed quote document).

**Impact:** If `isNet30Approved` is accidentally set to `true`, an attacker with that B2B account can create fraudulent orders marked paid without actual payment.

**Fix:** Require `approvedQuoteId` reference for Net-30 orders — order should only be marked paid when a corresponding approved B2B quote exists and is verified by superadmin.

---

### HIGH-04: Shipping Cost API Has No Rate Limit

**File:** `app/api/shipping/cost/route.ts`

**Problem:** Public endpoint not rate-limited. An attacker can spam it to enumerate valid city IDs or stress RajaOngkir API (which has rate limits on their side too).

**Fix:** Apply `withRateLimit` wrapper:
```typescript
export const POST = withRateLimit(
  async (req) => { ... },
  { key: 'shipping-cost', limit: 30, window: 60 * 1000 }
);
```

---

### MEDIUM-04: Checkout Initiate — Zod Schema Missing Discriminated Union for Delivery Address

**File:** `app/api/checkout/initiate/route.ts` lines 49-58

**Problem:** Address fields (`addressLine`, `district`, `city`, `cityId`, `province`, `provinceId`, `postalCode`) are all `.optional()`. For delivery orders, these are required, but the schema doesn't enforce them when `deliveryMethod === 'delivery'`.

**Impact:** Client can send `deliveryMethod: 'delivery'` with all address fields empty, creating an order with no delivery address.

**Fix:** Use discriminated union Zod schema:
```typescript
z.discriminatedUnion('deliveryMethod', [
  z.object({
    deliveryMethod: z.literal('delivery'),
    addressLine: z.string().min(5),
    cityId: z.string(),
    city: z.string(),
    provinceId: z.string(),
    province: z.string(),
    postalCode: z.string().min(5),
    district: z.string().optional(),
  }),
  z.object({
    deliveryMethod: z.literal('pickup'),
    addressLine: z.string().optional(),
    city: z.string().optional(),
    // delivery fields not required
  }),
])
```

---

### MEDIUM-05: Points Redemption Not Logged with Structured Logger

**File:** `app/api/checkout/initiate/route.ts`

**Problem:** Points redeemed in Net-30 order but not logged with order number context. Only `console.error` in catch blocks.

**Fix:** Add `logger.info('[checkout/initiate] Points redeemed', { userId, pointsUsed, orderNumber })` after points deduction in transaction.

---

### MEDIUM-06: Register Route Uses console.error Instead of Structured Logger

**File:** `app/api/auth/register/route.ts` line 66

**Code:**
```typescript
console.error('[auth/register]', error);
```

**Problem:** Per project rules, `console.error` in production should use structured `logger`.

**Fix:**
```typescript
logger.error('[auth/register]', { error: String(error), email: payload.email });
```

---

## SECTION 5: INFRASTRUCTURE

### MEDIUM-07: CSP Allows `unsafe-inline` for Scripts

**File:** `next.config.mjs` line 7

**Code:**
```typescript
"script-src 'self' 'unsafe-inline' https://app.midtrans.com https://app.sandbox.midtrans.com",
```

**Problem:** `'unsafe-inline'` weakens XSS protection. Next.js already hashes scripts, so this is likely needed for Next.js internals but is still a best-practice violation.

**Impact:** LOW — `unsafe-inline` in script-src is redundant in modern browsers with CSP nonces.

**Note:** Common pattern in Next.js apps. Acceptable but document why it's needed.

---

### MEDIUM-08: CSP Missing `upgrade-insecure-requests` Directive

**File:** `next.config.mjs`

**Problem:** CSP does not include `upgrade-insecure-requests`, meaning HTTP resources on an HTTPS page load without upgrade.

**Fix:** Add `"upgrade-insecure-requests"` to CSP directives.

---

### LOW-01: Vercel Functions No Region Specified

**File:** `vercel.json`

**Problem:** No `regions` specified for serverless functions. Vercel defaults to closest region. For a Bandung business serving Indonesian customers, `regions: ['jakarta']` would minimize latency.

**Fix:**
```json
{ "functions": { "runtime": "nodejs18.x", "region": "jakarta" } }
```

---

### LOW-02: lh3.googleusercontent.com Over-Permissioned in next.config.mjs

**File:** `next.config.mjs` line 58

**Problem:** Allows all paths from Google avatars. Should be restricted to `/` or `/s64/` only.

**Fix:** Change to `https://lh3.googleusercontent.com/*`.

---

## SECTION 6: CROSS-CUTTING ISSUES

### HIGH-05: Race Condition — Guest Checkout Idempotency Window Only 60 Seconds

**File:** `app/api/checkout/initiate/route.ts` lines 330-349

**Problem:** Guest checkout deduplication covers only 60-second window. After that, a new order is created even if previous one is still `pending_payment`. Potential duplicate order creation for same guest email.

**Fix:** Extend dedup window to 15 minutes (match payment expiry).

---

### HIGH-06: Rate Limiting Throws in Production Without Graceful Fallback

**File:** `lib/utils/rate-limit.ts` lines 31-36

**Problem:** In production, if Upstash env vars are missing, app throws during startup. Hard dependency on Upstash for deployment.

**Fix:** Instead of throwing, fall back to in-memory and log critical warning. See Audit 14, BUG-21.

---

### MEDIUM-09: No Idempotency Key for Midtrans Transaction Creation Beyond Retry Count

**File:** `lib/midtrans/create-transaction.ts`

**Assessment:** Correctly handled via retry count in `getMidtransOrderId(n, retryCount)`. ✅

---

## SUMMARY TABLE

| Bug | Severity | File | Line(s) | Description |
|---|---|---|---|---|
| CRITICAL-01 | CRITICAL | validate-env.ts | 1-12 | CRON_SECRET not in REQUIRED array |
| CRITICAL-02 | CRITICAL | rate-limit.ts | 31-36 | Rate limiting silently disabled in production if Upstash missing |
| CRITICAL-03 | CRITICAL | auth/[...nextauth]/route.ts | — | Login endpoint has no rate limiting |
| CRITICAL-04 | CRITICAL | middleware.ts | 18 | Warehouse role can't access /admin/orders |
| CRITICAL-05 | CRITICAL | webhooks/midtrans | 54 | Invalid signature returns 400 not 401 |
| HIGH-01 | HIGH | require-admin.ts | 39-55 | Returns dummy static SessionUser |
| HIGH-02 | HIGH | cron routes | all | No CRON_SECRET verification in any cron handler |
| HIGH-03 | HIGH | checkout/initiate | 389-402 | B2B Net-30 bypasses Midtrans without quote verification |
| HIGH-04 | HIGH | shipping/cost | all | Shipping cost API has no rate limit |
| HIGH-05 | HIGH | checkout/initiate | 330-349 | Guest dedup window 60s not 15min |
| HIGH-06 | HIGH | rate-limit.ts | 31-36 | Production throws if Upstash not configured |
| MEDIUM-01 | MEDIUM | midtrans/create-transaction.ts | 24 | localhost fallback if APP_URL not set |
| MEDIUM-02 | MEDIUM | validate-env.ts | 23 | AUTH_SECRET only checks length not entropy |
| MEDIUM-03 | MEDIUM | auth/config.ts | 75-77 | null session for inactive users conflates auth states |
| MEDIUM-04 | MEDIUM | checkout/initiate | 49-58 | Zod schema has optional address fields for delivery orders |
| MEDIUM-05 | MEDIUM | checkout/initiate | — | Points redemption not logged with structured logger |
| MEDIUM-06 | MEDIUM | auth/register/route.ts | 66 | console.error instead of logger.error |
| MEDIUM-07 | MEDIUM | next.config.mjs | 7 | CSP has unsafe-inline |
| MEDIUM-08 | MEDIUM | next.config.mjs | — | CSP missing upgrade-insecure-requests |
| LOW-01 | LOW | vercel.json | — | No region specified for functions |
| LOW-02 | LOW | next.config.mjs | 58 | Google avatars domain over-permissioned |

---

## PRIORITY FIX ORDER

1. Add `CRON_SECRET` to `validate-env.ts` REQUIRED array
2. Add `UPSTASH_REDIS_REST_URL/TOKEN` to REQUIRED or make `validateRedisConfig` throw in production
3. Add `withRateLimit` to NextAuth login handler
4. Add `/admin/orders` to warehouse allowed paths in middleware
5. Fix `requireAdmin` to return actual session user data
6. Add discriminated union Zod schema for delivery vs pickup address validation
7. Add CRON_SECRET verification to all 7 cron handlers
8. Add `upgrade-insecure-requests` to CSP
9. Replace `console.error` with `logger.error` in register route
10. Add rate limiting to `/api/shipping/cost`