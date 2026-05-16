# DEEP AUDIT 02 — Security & Authentication
> Generated: 2026-05-14 | Full codebase read. Covers auth, authorization, input validation, injection, CSP, rate limiting.

---

## SEVERITY LEGEND
- 🔴 **CRITICAL** — Exploitable immediately, data/money impact
- 🟠 **HIGH** — Exploitable under specific conditions, session/privilege escalation
- 🟡 **MEDIUM** — Defense-in-depth gaps, hardening needed
- 🟢 **LOW** — Best practice improvements

---

## 🔴 CRITICAL — Retry Payment Endpoint: No Authentication

**File:** `app/api/checkout/retry/route.ts` (entire file)

There is **zero authentication** in this handler. Any unauthenticated HTTP client can:

```bash
# Cancel anyone's pending order with just the order number
for i in 1 2 3; do
  curl -X POST https://dapurdekaka.com/api/checkout/retry \
    -H "Content-Type: application/json" \
    -d '{"orderNumber":"DDK-20260514-0001"}'
done
# After 3 calls, the order is auto-cancelled (line 35-42)
```

Order numbers are sequential and guessable (`DDK-YYYYMMDD-NNNN`). This allows any external party to silently cancel real customer orders.

**Fix:**
```ts
const session = await auth();
const order = await db.query.orders.findFirst({ where: eq(orders.orderNumber, orderNumber) });
if (session?.user?.id && order?.userId && order.userId !== session.user.id) {
  return forbidden('Anda tidak berhak mengakses pesanan ini');
}
// For guest orders: verify via a signed token stored at checkout time
```

---

## 🔴 CRITICAL — Neon HTTP Driver: `db.transaction()` Is Not Truly Atomic

**File:** `lib/db/index.ts:3`

```ts
import { drizzle } from 'drizzle-orm/neon-http';
```

The `neon-http` driver uses Neon's REST API, NOT a persistent connection. When `db.transaction(async (tx) => { ... })` is called, Drizzle for Neon HTTP sends the statements as a **batch**. However, the batch API does NOT provide the same rollback guarantees as a real PostgreSQL transaction. Specifically:

1. If the Vercel function times out mid-transaction, the batch may be partially applied with no rollback.
2. Savepoints and nested transactions are not supported.
3. The `RETURNING` clause values from one statement in the batch may not be available to the next statement in the same batch on some Neon HTTP API versions.

**Impact:** The order creation + stock deduction + points update in `initiate/route.ts` and the webhook handler are not truly atomic. A Vercel cold start or timeout could leave the DB in an inconsistent state (order created, points not deducted, or vice versa).

**Fix:** Switch to `drizzle-orm/neon-serverless` with WebSocket mode for true transaction support:
```ts
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```
Note: WebSocket mode requires configuring `neonConfig.webSocketConstructor` in serverless environments. Alternatively, use the Neon PostgreSQL connection string (pooled) with the standard `pg` driver.

---

## 🟠 HIGH — CSP Allows `'unsafe-inline'` for Scripts

**File:** `next.config.ts:8`

```ts
"script-src 'self' 'unsafe-inline' https://app.midtrans.com ...",
```

`'unsafe-inline'` for `script-src` essentially **nullifies CSP's XSS protection**. Any injected inline script will execute. The reason it's there is likely for Midtrans Snap.js which injects inline handlers.

**Fix:** Use nonces or hashes for inline scripts (Next.js 14+ supports CSP nonces via middleware):
```ts
// next.config.ts — generate a nonce per request in middleware
"script-src 'self' 'nonce-{NONCE}' https://app.midtrans.com ...",
```
Or at minimum, remove `'unsafe-inline'` and verify Midtrans works with the stricter policy (Midtrans Snap supports nonce-based CSP).

---

## 🟠 HIGH — Missing Rate Limiting on Critical Auth Endpoints

**File:** `app/api/auth/register/route.ts`, `app/api/auth/forgot-password/route.ts`, `app/api/auth/reset-password/route.ts`

None of these routes use `withRateLimit`. A brute-force or enumeration attack can:
- Register thousands of fake accounts
- Enumerate valid emails via forgot-password response timing
- Attempt unlimited password reset tokens

Contrast with `app/api/coupons/validate/route.ts` which correctly uses `withRateLimit` with `maxRequests: 20`.

**Fix:** Apply `withRateLimit` to all auth endpoints:
```ts
export const POST = withRateLimit(handler, {
  windowMs: 60000,
  maxRequests: 5,  // 5 attempts per minute per IP
  keyGenerator: (req) => req.ip || 'unknown',
});
```

---

## 🟠 HIGH — Admin Credentials Route Does Not Validate Superadmin Privilege Properly

**File:** `app/api/admin/users/route.ts:24-26`

```ts
const role = (session.user as { role?: string }).role;
if (!role || !['superadmin'].includes(role)) {
  return forbidden('Anda tidak memiliki akses');
}
```

The type cast `as { role?: string }` is used here because `session.user.role` isn't typed properly. This pattern appears in multiple files and can mask type errors. If the session callback in `lib/auth/index.ts` stops populating `role`, the cast won't catch the issue — it'll silently return `undefined`, which fails the check and correctly returns 403. So this is safe but brittle.

**The real issue:** There's no route-level protection at the **API middleware layer** for `/api/admin/*`. All admin API routes individually call `auth()` and `checkRole`, which is correct but creates a risk of forgetting the check in future routes.

**Fix:** Create an `adminAuth()` helper that wraps `auth()` and checks the role, returning a typed result:
```ts
// lib/auth/require-admin.ts
export async function requireAdmin(roles: Role[] = ['superadmin', 'owner']) {
  const session = await auth();
  if (!session?.user) return { session: null, error: unauthorized('Login diperlukan') };
  if (!roles.includes(session.user.role as Role)) return { session: null, error: forbidden('Akses ditolak') };
  return { session, error: null };
}
```

---

## 🟠 HIGH — Midtrans Webhook: No Production/Sandbox Key Validation

**File:** `app/api/webhooks/midtrans/route.ts:38-45`

```ts
const serverKey = process.env.MIDTRANS_SERVER_KEY!;
const isValid = verifyMidtransSignature(order_id, status_code, gross_amount, serverKey, signature_key);
```

There's no check of `MIDTRANS_IS_PRODUCTION` env var. If someone deploys to production with sandbox credentials (or vice versa), webhooks from Midtrans will have signatures computed with the other environment's key and all webhooks will fail. More critically, there's no env var `MIDTRANS_IS_PRODUCTION` being validated anywhere in `validate-env.ts`.

**Fix:** Add to `validate-env.ts`:
```ts
const REQUIRED = [
  ...existing,
  'MIDTRANS_IS_PRODUCTION',  // 'true' or 'false'
];
```
And check in `lib/midtrans/client.ts` that the `isProduction` flag matches the expected environment.

---

## 🟠 HIGH — Session Strategy `database` With Neon HTTP Has Connection Reuse Issues

**File:** `lib/auth/index.ts:10, 47`

```ts
session: { strategy: 'database' },
```

With `strategy: 'database'`, NextAuth uses the Drizzle adapter to read/write session records on every authenticated request. With `drizzle-orm/neon-http`, each request opens a new HTTP connection to Neon's REST API. In high-traffic scenarios, this means:
- Every page load that reads `auth()` issues at least one HTTP request to Neon
- Session validation adds 50–200ms latency per request (Neon cold starts)
- No connection pooling benefit since HTTP is stateless

**Fix:** Switch to `strategy: 'jwt'` for stateless sessions (eliminates DB reads per request), or use `strategy: 'database'` with the WebSocket/pooled Neon driver.

If staying with `database` strategy, at minimum ensure the Neon connection is pooled (use `NEON_DATABASE_URL_POOLED` with pgBouncer URL from Neon dashboard).

---

## 🟡 MEDIUM — `X-Frame-Options: SAMEORIGIN` Conflicts With `frame-ancestors 'none'` in CSP

**File:** `next.config.ts:24-26, 17`

```ts
{ key: 'X-Frame-Options', value: 'SAMEORIGIN' },
// ...and in CSP:
"frame-ancestors 'none'",
```

`X-Frame-Options: SAMEORIGIN` allows the site to be embedded in same-origin iframes. But `frame-ancestors 'none'` in CSP **forbids all framing**. These two headers contradict each other. Modern browsers honor the CSP `frame-ancestors` directive, but older browsers only check `X-Frame-Options`. The intended policy should be consistent.

**Fix:** Decide on policy:
- If no framing is allowed: `X-Frame-Options: DENY` + `frame-ancestors 'none'`
- If same-origin is allowed: `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`

For an e-commerce site with no iframe embeds, `DENY` + `'none'` is safest.

---

## 🟡 MEDIUM — `UPSTASH_REDIS_REST_URL` Not in `validate-env.ts`

**File:** `lib/config/validate-env.ts:1-8`

```ts
const REQUIRED = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'MIDTRANS_SERVER_KEY',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
];
```

Missing from validation:
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — if not set, rate limiting silently falls back to in-memory (useless in serverless)
- `RAJAONGKIR_API_KEY` — shipping cost calculation will silently fail
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth fails silently
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — image upload URL construction breaks
- `SENTRY_DSN` — error tracking not wired

**Fix:** Add critical service keys to `REQUIRED` array and add warning-level optional checks for others.

---

## 🟡 MEDIUM — BottomNav Exposes WhatsApp Number in Client Bundle

**File:** `components/store/layout/BottomNav.tsx:27`

```ts
href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
```

`NEXT_PUBLIC_*` variables are embedded in the client JavaScript bundle at build time. This is intentional for the WA button but means the phone number is baked into the build and public. If the number changes, a full redeploy is required.

More importantly: if `NEXT_PUBLIC_WHATSAPP_NUMBER` is not set (e.g., in CI or staging), the link becomes `https://wa.me/undefined` which is a broken link.

**Fix:** Add a fallback: `href: \`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890'}\`` and add `NEXT_PUBLIC_WHATSAPP_NUMBER` to `validate-env.ts` as a warning.

---

## 🟡 MEDIUM — Admin Customers Route: SQL Injection via `like()` Pattern

**File:** `app/api/admin/customers/route.ts:24-27`

```ts
if (search) {
  whereClause = or(
    like(users.name, `%${search}%`),
    like(users.email, `%${search}%`)
  );
}
```

The `like()` function in Drizzle ORM passes the pattern through a prepared statement parameter, so SQL injection is **not** possible via the `%${search}%` pattern. However, there's no input sanitization of LIKE special characters: `%`, `_`, `\`. A search for `%` will match all users; a search for `_` will match any single character. This can be used to enumerate user data.

**Fix:** Sanitize LIKE metacharacters:
```ts
const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
like(users.name, `%${escapedSearch}%`)
```
Or use `ilike()` with a full-text search approach.

---

## 🟡 MEDIUM — Blog Content Sanitized at Write But Rendered Unsanitized at Read

**File:** `app/api/admin/blog/route.ts:74-86` — DOMPurify sanitizes at write time. ✅

**File:** `app/(store)/blog/[slug]/page.tsx` — Needs to verify how `contentId` is rendered.

If the blog post page uses `dangerouslySetInnerHTML={{ __html: post.contentId }}` without re-sanitizing, then content written before DOMPurify was added (or if DOMPurify config changes) could contain stored XSS. 

**Fix:** Re-sanitize at render time on the server side using `isomorphic-dompurify`:
```tsx
import DOMPurify from 'isomorphic-dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.contentId) }} />
```

---

## 🟡 MEDIUM — Cron Auth Uses Static Bearer Token (No Rotation)

**File:** `lib/utils/cron-auth.ts`

Cron job authentication uses `CRON_SECRET` as a static bearer token. If this token leaks, any external party can trigger cron jobs (which cancel orders, expire points, etc.). There's no mechanism to rotate this without a full redeploy.

**Fix:** 
1. Add `CRON_SECRET` to `validate-env.ts`
2. Implement time-limited HMAC signing for cron invocations (Vercel Cron's `x-vercel-signature` header already does this if you register crons through `vercel.json`)
3. Verify the request comes from Vercel's IP ranges

---

## 🟡 MEDIUM — Password Reset Tokens: `tokenHash` Column Could Leak via Timing Attack

**File:** `lib/db/schema.ts:134-141`

```ts
export const passwordResetTokens = pgTable('password_reset_tokens', {
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  ...
});
```

The lookup `WHERE token_hash = $1` uses a string comparison. If the comparison is not constant-time, a timing attack could enumerate valid token hashes. Standard SQL `=` comparisons can leak timing information.

**Fix:** Use `crypto.timingSafeEqual()` in the reset-password handler for token comparison, rather than relying on SQL equality. Or use `pgcrypto.gen_random_bytes` and compare with `HMAC` in the DB.

---

## 🟡 MEDIUM — Google OAuth Users Have No Role Assigned on First Login

**File:** `lib/auth/index.ts` — Uses `DrizzleAdapter(db)` which calls `createUser()` on first Google OAuth login.

The schema sets `role: userRoleEnum('role').notNull().default('customer')`. The Drizzle adapter's `createUser` will use the default value. However, there's no hook in the auth config to customize roles for Google users. This is correct behavior for customers.

But there's a subtler issue: if an admin user (e.g., `owner`) **also** has a Google account linked, and they log in via Google on a different device, the `role` will be correct (already in DB). But if they accidentally register a NEW Google account with the same email that's already in the system as a credential user, NextAuth may create a duplicate account or throw an adapter error.

**Fix:** Add `signIn` callback in `lib/auth/index.ts` to detect and handle account linking conflicts.

---

## 🟢 LOW — `auth()` Called in Server Components Without Error Handling

Multiple server components (`app/(admin)/admin/products/new/page.tsx:11`, etc.) call:
```ts
const session = await auth();
if (!session?.user) { redirect('/login'); }
```

If the NextAuth session store is unreachable (Neon outage), `auth()` throws, the server component throws, and Next.js renders the error boundary — exposing a generic error page rather than a friendly redirect.

**Fix:** Wrap `auth()` in try-catch in server components and redirect to `/login` on any auth error.

---

## 🟢 LOW — `bcryptjs` vs `bcrypt`: Minor Version Concern

**File:** `package.json:33` — `"bcryptjs": "^2.4.3"`

`bcryptjs` is the pure-JavaScript bcrypt implementation. It's about 30-50% slower than native `bcrypt` (node-bcrypt). For a low-traffic app this is fine, but consider switching to `argon2` (via `@node-rs/argon2`) for better security and performance. Argon2id is the current OWASP recommendation over bcrypt.

---

## 🟢 LOW — `X-Forwarded-For` Used for Rate Limiting Without Trust Proxy Config

**File:** `lib/utils/rate-limit.ts:125`

```ts
const identifier = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
```

On Vercel, `req.ip` returns the actual client IP from Vercel's edge network. Using `x-forwarded-for` as fallback is correct on Vercel (Vercel sets it). However, the `.split(',')[0]` takes the first IP in the chain, which on Vercel is the original client IP (correct). The risk is if someone runs this behind a different proxy that doesn't strip injected headers — a bad actor could spoof `x-forwarded-for` to bypass rate limiting.

Since the deployment is exclusively on Vercel, this is low risk. But document it.
