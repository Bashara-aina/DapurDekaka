# AUDIT 09 — SECURITY & PERFORMANCE ISSUES
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** Cross-cutting security and performance issues found across all audits
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## 🔴 CRITICAL

### C-01: Rate Limiting Disabled in Serverless Production

**File:** `lib/utils/rate-limit.ts` lines 106–108

```typescript
// Dev fallback — in-memory (not effective in serverless production)
return checkInMemory(identifier, windowMs, requests);
```

**Issue:** In Vercel serverless, each function invocation gets its own isolated process memory. The in-memory `Map` is NOT shared across concurrent invocations. Rate limiting is effectively **disabled** in production unless Upstash Redis is configured. All auth routes (`/api/auth/[...nextauth]`, `/api/auth/register`, `/api/auth/forgot-password`) have unlimited login attempts in production.

**Impact:** Brute force attacks on login/registration are possible. Credential stuffing attacks are possible. The coupon validation endpoint can be hammered to enumerate valid codes.

**Fix:** Ensure these environment variables are set in Vercel production:
```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```
Add a startup check that fails if rate limiting is required but Redis is not available.

---

### C-02: NextAuth Lazy Init Race Condition in Serverless (Auth Broken)

**File:** `lib/auth/index.ts` lines 24–35

Duplicate of Audit 05 C-01. Listed here for security completeness.

**Issue:** Under concurrent requests in Vercel serverless, the lazy init pattern causes auth to silently fail for some requests. Users may be logged out randomly or unable to log in.

**Fix:** Remove the lazy init pattern. Use standard NextAuth v5 pattern.

---

### C-03: Settlement Webhook — Transaction Does Not Roll Back on Stock Failure

**File:** `app/api/webhooks/midtrans/route.ts` lines 137–145

Duplicate of Audit 03 C-02. Listed here for security completeness.

**Issue:** When stock deduction fails, the webhook awards loyalty points and marks the order as `paid` anyway. A customer could receive loyalty points for an order that couldn't be fulfilled.

**Fix:** Throw an exception when stock deduction fails to force transaction rollback.

---

### C-04: Client-Side Auth Check — Page HTML Exposed Before Redirect

**Files:**
- `app/(admin)/admin/customers/page.tsx` lines 22–26
- `app/(admin)/admin/customers/[id]/page.tsx` lines 77–82
- `app/(admin)/admin/settings/page.tsx` lines 34–38

```typescript
useEffect(() => {
 requireRole(['superadmin', 'owner']).catch(() => {
 window.location.href = '/'; // ← client-side redirect
 });
}, []);
```

**Issue:** The page HTML (including customer data, order data) is sent to the browser and rendered before the redirect fires. A user with wrong role sees the data during the flash. This is a data exposure vulnerability.

**Fix:** Convert all affected pages to Server Components with `await requireRole()` at the top.

---

## 🟠 HIGH

### H-01: Coupon Validation Endpoint — No Rate Limiting (Code Enumeration)

**File:** `app/api/coupons/validate/route.ts`

**Issue:** The public coupon validation endpoint has no rate limiting. An attacker can enumerate coupon codes by automating requests with different coupon codes until finding a valid one (which returns a different error message than an invalid code).

**Fix:** Add rate limiting to this endpoint. At minimum, limit to 10 attempts per IP per minute.

---

### H-02: Forgot Password — Timing Attack Possible on Email Lookup

**File:** `app/api/auth/forgot-password/route.ts` lines 36–45

```typescript
const user = await db.query.users.findFirst({
 where: eq(users.email, email.toLowerCase()),
});
if (!user) {
 return success({ message: 'Email reset link telah dikirim' }); // Always same message
}
```

**Issue:** The code correctly returns the same success message regardless of whether the email exists (prevents email enumeration). BUT the timing of the response may differ slightly between "email not found" and "email found + send email failed" — potentially leaking information via timing. This is a minor risk but worth noting.

**Fix:** Ensure the email lookup and email send take approximately the same time regardless of outcome.

---

### H-03: Cart Merge Fails Silently — User May Double-Order

**File:** `app/(auth)/login/page.tsx` lines 79–86

Duplicate of Audit 05 C-05. Listed here for security completeness.

**Issue:** If the cart merge fails, the catch block is empty. The user is logged in but their local cart remains in localStorage. On next page load, they see the old local cart and may checkout again — resulting in double orders.

**Fix:** Add try/catch with localStorage cleanup and toast feedback.

---

### H-04: Payment Retry — No Rate Limit on Retry Count

**File:** `app/api/checkout/retry/route.ts`

**Issue:** The PRD specifies a max of 3 payment retries per order, but there's no rate limit on the retry endpoint itself. A user could theoretically hammer the retry endpoint beyond 3 times if they script it.

**Fix:** Add a server-side check that returns 429 if retry count >= 3.

---

### H-05: Cron Secret — Hardcoded Header Check

**File:** `lib/utils/cron-auth.ts`

**Issue:** Cron auth uses a simple `Authorization: Bearer <CRON_SECRET>` header. If this secret leaks, attackers can trigger cron jobs (expire points, cancel orders, reconcile payments).

**Fix:**
1. Ensure `CRON_SECRET` is a strong random 32+ character value
2. Rotate periodically (document rotation procedure)
3. Add to CURSOR_RULES.md Section 12 env vars
4. Consider using Vercel Cron's built-in secret verification instead

---

### H-06: No `payment_expires_at` Enforcement in UI — Users May Pay Expired Orders

**File:** `app/(store)/checkout/pending/page.tsx`

Duplicate of Audit 03 H-05. Listed here for security completeness.

**Issue:** Users can click "Bayar" on an expired payment session. Midtrans would reject it, but the user experience is confusing.

**Fix:** Add auto-navigate on expiry (see Audit 08 M-02).

---

### H-07: `console.log` in Session Callback — Potential PII in Logs

**File:** `lib/auth/config.ts` lines 55–58

```typescript
console.log('[Auth Session Callback]', { hasUser: !!user, hasSession: !!session, sessionUser: session?.user });
```

**Issue:** `session?.user` is logged on every server-side session refresh. While it currently shows booleans, if the session object structure ever changes to include sensitive fields (email, name), those would appear in server logs. This is a security risk.

**Fix:** Remove the `console.log`. Log only non-sensitive metadata (user ID, role, session age).

---

## 🟡 MEDIUM

### M-01: Zod Validation Errors Return Raw JSON — Information Leakage

**File:** `app/api/admin/orders/[id]/status/route.ts` lines 60–72

**Issue:** Zod validation errors returned as raw JSON `{ success: false, error: ... }` with the full Zod error object exposed. This could reveal internal field names and validation structure to clients.

**Fix:** Sanitize validation errors before returning. Return user-friendly messages only, not raw Zod output.

---

### M-02: Admin Orders Status Update — Tracking Number Not Validated

**File:** `app/(admin)/admin/shipments/ShipmentsClient.tsx` lines 143–159

**Issue:** Tracking number input accepts any text. A completely invalid tracking number (e.g., `asdfasdfasdf`) can be saved. The API route requires `min(1)` but doesn't validate format per courier.

**Fix:** At minimum, strip whitespace. Ideally, validate against courier-specific tracking number patterns (SiCepat, JNE have specific formats).

---

### M-03: API Routes — No Consistent Error Sanitization

**Files:** 14+ API routes returning raw error messages

**Issue:** Internal error details (database errors, stack traces) could be exposed to clients if not sanitized. The `serverError()` helper should be used everywhere but isn't.

**Fix:** Audit all `catch` blocks to ensure only sanitized error messages are returned, never raw Error objects.

---

### M-04: Inventory Adjustment — No Audit Trail

**File:** `app/(admin)/admin/inventory/InventoryClient.tsx` lines 34–71

**Issue:** When warehouse adjusts stock (`handleSave`), there's no audit trail recorded. Stock changes are invisible — who changed what, when, why. If stock discrepancies occur, there's no history to trace.

**Fix:** Consider adding a `stockAdjustments` table that records: `variantId`, `previousStock`, `delta`, `newStock`, `changedBy`, `changedAt`, `reason`.

---

### M-05: Blog Post — No Slug Uniqueness Check at DB Level

**File:** `app/api/admin/blog/route.ts`

**Issue:** The blog post slug is used in URLs (`/blog/[slug]`). If two posts have the same slug, the second one either fails to create or creates an ambiguous URL. No unique constraint exists on `slug` in the schema.

**Fix:** Add a unique index on `blog_posts.slug`:
```sql
CREATE UNIQUE INDEX idx_blog_posts_slug ON blog_posts(slug) WHERE deleted_at IS NULL;
```

---

### M-06: No Input Sanitization on Rich Text (Tiptap)

**File:** `app/(admin)/admin/blog/[id]/BlogEditClient.tsx`

**Issue:** Tiptap editor allows rich text input. No server-side sanitization of the HTML before storing. Stored XSS is possible if any admin account is compromised.

**Fix:** Use a server-side HTML sanitizer (e.g., `sanitize-html` or `DOMPurify` via `isomorphic-dompurify`) before storing blog post content.

---

## 🟢 LOW

### L-01: Admin Bulk Actions — No Confirmation Dialog for Destructive Operations

**File:** `app/(admin)/admin/products/ProductsClient.tsx` line 71

**Issue:** `confirm()` is a browser native dialog, not a styled modal. Users may accidentally confirm bulk deletes.

**Fix:** Replace with styled `AlertDialog` (see Audit 07 H-05).

---

### L-02: Session Fixation — Login Does Not Regenerate Session ID

**File:** `app/(auth)/login/page.tsx`

**Issue:** After login, the session ID is not regenerated. If the session ID was captured before login (e.g., via network sniffing), it could still be valid after login.

**Fix:** Call `await csrfToken()` or use NextAuth's session strategy to regenerate session ID on login. Check if `signIn` callback includes session regeneration.

---

### L-03: Missing Security Headers

**File:** `app/api/` routes (middleware-level)

**Issue:** No security headers configured (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). These should be set at the middleware level for all routes.

**Fix:** Add security headers in `middleware.ts`:
```typescript
export function middleware(request: NextRequest) {
 const response = NextResponse.next();
 response.headers.set('X-Frame-Options', 'DENY');
 response.headers.set('X-Content-Type-Options', 'nosniff');
 response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
 return response;
}
```

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | `rate-limit.ts:106` | Rate limiting disabled in serverless — unlimited login attempts | Configure Upstash Redis in production |
| C-02 | 🔴 CRITICAL | `lib/auth/index.ts:24` | NextAuth lazy init breaks in serverless — auth random failures | Remove lazy init, use standard pattern |
| C-03 | 🔴 CRITICAL | `webhooks/midtrans/route.ts:137` | Transaction doesn't rollback on stock failure — points awarded anyway | Throw to rollback on stock failure |
| C-04 | 🔴 CRITICAL | `customers/page.tsx:22`, `customers/[id]/page.tsx:77`, `settings/page.tsx:34` | Client-side auth exposes data before redirect | Convert to Server Component |
| H-01 | 🟠 HIGH | `coupons/validate/route.ts` | No rate limit on coupon validation — code enumeration possible | Add rate limit |
| H-02 | 🟠 HIGH | `forgot-password/route.ts:36` | Potential timing attack on email lookup | Ensure consistent response timing |
| H-03 | 🟠 HIGH | `login/page.tsx:79` | Cart merge silent failure — user may double-order | Add try/catch with cleanup |
| H-04 | 🟠 HIGH | `checkout/retry/route.ts` | No server-side cap on retry count | Add 429 if retry >= 3 |
| H-05 | 🟠 HIGH | `cron-auth.ts` | Simple CRON_SECRET header — if leaked, cron jobs can be triggered | Strengthen auth + document rotation |
| H-06 | 🟠 HIGH | `checkout/pending/page.tsx` | No auto-navigate on payment expiry | Add router.push in useEffect |
| H-07 | 🟠 HIGH | `lib/auth/config.ts:58` | console.log in session callback could expose PII | Remove or sanitize logged data |
| M-01 | 🟡 MEDIUM | `admin/orders/[id]/status/route.ts:60` | Raw Zod error exposed to clients | Sanitize validation errors |
| M-02 | 🟡 MEDIUM | `ShipmentsClient.tsx:143` | Tracking number not validated | Add format validation |
| M-03 | 🟡 MEDIUM | 14+ route files | No consistent error sanitization | Audit all catch blocks |
| M-04 | 🟡 MEDIUM | `InventoryClient.tsx:34` | No stock adjustment audit trail | Add stockAdjustments table |
| M-05 | 🟡 MEDIUM | `admin/blog/route.ts` | No unique constraint on blog slug | Add unique index on slug |
| M-06 | 🟡 MEDIUM | `BlogEditClient.tsx` | No HTML sanitization on rich text — stored XSS risk | Add server-side HTML sanitizer |
| L-01 | 🟢 LOW | `ProductsClient.tsx:71` | Bulk delete uses native confirm() | Replace with AlertDialog |
| L-02 | 🟢 LOW | `login/page.tsx` | Session fixation — session ID not regenerated on login | Regenerate session after login |
| L-03 | 🟢 LOW | `middleware.ts` | Missing security headers | Add CSP, X-Frame-Options, etc. |

**Total: 4 CRITICAL · 7 HIGH · 6 MEDIUM · 3 LOW**