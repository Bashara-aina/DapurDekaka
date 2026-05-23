# AUDIT 05 — AUTHENTICATION & GLOBAL INFRASTRUCTURE
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** `lib/auth/`, `app/api/auth/`, `app/(auth)/`, `app/middleware.ts`, `app/global-error.tsx`, `lib/config/validate-env.ts`, `public/sw.js`
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## 🔴 CRITICAL

### C-01: NextAuth Lazy Init Race Condition — Broken in Serverless

**File:** `lib/auth/index.ts` lines 24–35

```typescript
let _initialized = false;
let _initPromise: Promise<void> | null = null;

async function initNextAuth() {
 if (_initialized) return;
 if (_initPromise) return _initPromise; // ← Two concurrent calls BOTH create promises
 // ... initialization runs twice in concurrent requests
```

**Issue:** In Vercel serverless (per-invocation warmth), two concurrent requests before `_initPromise` is set will BOTH enter `initNextAuth`. The first creates a promise, the second creates a different promise. Both resolve independently, but `_initialized = true` is set by whichever finishes last. The `_auth` / `_nextAuth` exports may reference an incomplete or wrong handler. Auth will silently fail for some requests.

Additional issues:
- `_nextAuth` typed as `unknown` (line 25) — all usage is `(_nextAuth as {...}).auth(req)` — completely untyped, any API mismatch fails silently
- `validateAuthSecret()` swallows errors silently in catch block (line 30–35) — an invalid `AUTH_SECRET` passes at module load and fails at runtime

**CRITICAL FIX:** Remove the entire lazy init pattern. Use the standard NextAuth v5 pattern:

```typescript
// lib/auth/index.ts — standard NextAuth v5 export:
import { auth } from './config';
export { auth };
```

The `_initialized` pattern was an attempt to work around a non-existent serverless init problem. NextAuth v5 handles serverless correctly without manual lazy init.

---

### C-02: `app/(auth)/` Route Group — Missing `loading.tsx` and `error.tsx`

**Files:** `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/[token]/page.tsx`

**Issue:** Per CURSOR_RULES.md Section 8: every route group must have `loading.tsx` and `error.tsx`. The `app/(auth)/` group has neither. Navigation to `/login`, `/register`, `/forgot-password`, `/reset-password` while loading shows blank page or Next.js skeleton. Errors show Next.js default error UI, not a branded experience.

**CRITICAL ACTION:** Create `loading.tsx` and `error.tsx` for each auth sub-route. At minimum, create:
- `app/(auth)/**/loading.tsx` — skeleton with centered card layout
- `app/(auth)/**/error.tsx` — branded error with "Kembali ke Login" CTA

---

### C-03: Auth Route Handler Cast is Structurally Unsafe

**File:** `app/api/auth/[...nextauth]/route.ts`

```typescript
const wrappedHandlers = {
 GET: withRateLimit(handlers.GET as (req: NextRequest) => Promise<Response>, {...}),
 POST: withRateLimit(handlers.POST as (req: NextRequest) => Promise<Response>, {...}),
};
```

**Issue:** `handlers.GET` from `lib/auth/index.ts` is typed as `async (req?: unknown) => Promise<Response>`. The cast to `(req: NextRequest) => Promise<Response>` is invalid — the actual handler accepts `req?: unknown`. If NextAuth's internal handler signature changes, the rate limit wrapper will pass wrong arguments. This is a type safety violation that only works by accident.

**Fix:** Remove the unsafe cast and fix the type signature of the rate-limited handlers to match what `initNextAuth` actually returns.

---

### C-04: Cart Merge — Delete-then-Insert Instead of Merging Quantities

**File:** `app/api/auth/merge-cart/route.ts` lines 32–45

```typescript
await db.transaction(async (tx) => {
 await tx.delete(savedCarts).where(eq(savedCarts.userId, session.user.id)); // DELETE all
 await tx.insert(savedCarts).values(...) // INSERT new items
});
```

**Issue:** This DELETES all existing saved cart items and replaces them with local cart items. If a user had 2x variant A in DB and adds 3x variant A locally, after login they only have 3x — the original 2x are lost. CURSOR_RULES.md Section 11.2 explicitly says: "if same variantId → add quantities (cap at 99)".

**CRITICAL FIX:** Change to merge logic:
```typescript
// For each local cart item:
const existing = await tx.select().from(savedCarts)
 .where(and(eq(savedCarts.userId, userId), eq(savedCarts.variantId, item.variantId)));
if (existing.length > 0) {
 // Add quantities, cap at 99
 const newQty = Math.min(existing[0].quantity + item.quantity, 99);
 await tx.update(savedCarts).set({ quantity: newQty }).where(...);
} else {
 await tx.insert(savedCarts).values(...);
}
```

---

### C-05: Cart Merge Uses Zustand Key Assumption + Silent Failure

**File:** `app/(auth)/login/page.tsx` lines 79–86

```typescript
const cartItems = JSON.parse(localStorage.getItem('cart-storage') || '{}');
if (cartItems?.state?.items?.length > 0) {
 await fetch('/api/auth/merge-cart', {...});
}
```

**Issue:**
1. Assumes Zustand persisted cart uses `cart-storage` key and `state.items` shape — if the store config differs, silently fails
2. No error handling on merge failure — the catch block swallows the error without logging or user feedback
3. If merge fails, local cart remains in localStorage but user is logged in. On next page load, local cart still appears but merge was never recorded — user may double-order

**Fix:** Add try/catch with toast feedback and localStorage cleanup on failure.

---

## 🟠 HIGH

### H-01: `lib/auth/require-admin.ts` — `as never` Suppresses Real Type Error

**File:** `lib/auth/require-admin.ts` lines 39–46

```typescript
if (!session?.user) {
 return unauthorized() as never; // ← unauthorized() returns NextResponse, not the function's declared return type
}
```

**Issue:** `unauthorized()` returns `NextResponse.json(...)`. The function declares it returns a session object. Using `as never` suppresses the TypeScript error but makes the actual return type unpredictable. Callers that don't do a type guard will get a `NextResponse` instead of a session and crash.

**Fix:** Change the return type to `Session | NextResponse` or use a Result pattern with discriminated unions.

---

### H-02: `lib/auth/config.ts` — `as any` on Adapter Table Shapes

**File:** `lib/auth/config.ts` lines 19–21

```typescript
const adapter = DrizzleAdapter(db, {
 accountsTable: accounts as any, // ← as any
 sessionsTable: sessions as any, // ← as any
});
```

**Issue:** `as any` bypasses all type checking. If DrizzleAdapter's expected table shape diverges from the actual schema, this will silently pass TypeScript and fail at runtime.

**Fix:** Either:
1. Use `@ts-expect-error` with a comment explaining why (documented limitation)
2. Align the table definitions exactly with what DrizzleAdapter expects

---

### H-03: `lib/auth/config.ts` — `console.log` in Session Callback

**File:** `lib/auth/config.ts` lines 55–58

```typescript
async session({ session, user }) {
 if (typeof window === 'undefined') {
 console.log('[Auth Session Callback]', { hasUser: !!user, hasSession: !!session, sessionUser: session?.user });
 }
```

**Issue:** `console.log` in production server code. Additionally, `session?.user` is logged — if this object ever includes sensitive fields, they would appear in server logs.

**Fix:** Remove `console.log`. Use a structured logger with appropriate log levels if needed.

---

### H-04: `lib/auth/check-role.ts` — Role Typed as `string` Not `UserRole`

**File:** `lib/auth/check-role.ts` lines 14–16

```typescript
const userRole = session.user.role; // typed as string from NextAuth Session
if (!allowedRoles.includes(userRole)) { // allowedRoles is UserRole[]
```

**Issue:** `session.user.role` is `string`. `includes()` on a `string` argument widens the array type. If a new role is added to the enum but not updated in the local types, TypeScript won't catch it.

**Fix:** Ensure the NextAuth Session type is properly extended with the `UserRole` type.

---

### H-05: `middleware.ts` — `/admin/field` Route Does Not Exist

**File:** `app/middleware.ts` lines 18–20

```typescript
const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];
```

**Issue:** `/admin/field` does not exist in the folder structure (CURSOR_RULES.md Section 4). Warehouse users get redirected to a non-existent route. The documented warehouse routes per CURSOR_RULES.md are only `/admin/inventory` and `/admin/shipments`.

**Fix:** Remove `/admin/field` from the allowed list. Only allow `inventory` and `shipments` for warehouse role.

---

### H-06: Forgot Password — `sendEmail` Blocks HTTP Response

**File:** `app/api/auth/forgot-password/route.ts` lines 52–59

```typescript
await sendEmail({
 to: user.email,
 subject: 'Reset Password — Dapur Dekaka',
 react: PasswordResetEmail({...}),
});
// Response sent after email completes — blocks if Resend is slow
```

**Issue:** `sendEmail` is called synchronously and blocks the HTTP response. If Resend API is slow, the request hangs. If it throws, the user gets a 500 error even though their email lookup succeeded.

**Fix:** Make email sending non-blocking in the API route. If `sendEmail` fails, log and swallow the error — the user should see "Check your email" regardless of whether the email actually sent.

---

### H-07: `app/middleware.ts` — 4 Warehouse Routes vs 2 Documented

**File:** `app/middleware.ts` lines 18–20

**Issue:** CURSOR_RULES.md says warehouse role accesses only `/admin/inventory` and `/admin/shipments`, but the middleware allows 4 routes. This is an inconsistency — if a warehouse user accesses `/admin/orders`, they can see the orders list (which the permission matrix says they should not).

**Fix:** Narrow the allowed list to exactly what the permission matrix specifies.

---

## 🟡 MEDIUM

### M-01: `lib/config/validate-env.ts` — `CRON_SECRET` Required But Undocumented

**File:** `lib/config/validate-env.ts` line 8

**Issue:** `CRON_SECRET` is in the `REQUIRED` array but absent from TECH_STACK.md Section 5 and CURSOR_RULES.md Section 12.

**Fix:** Add `CRON_SECRET` to the documented env vars, or remove it from `REQUIRED` if it's truly optional.

---

### M-02: `app/global-error.tsx` — `console.error` in Browser

**File:** `app/global-error.tsx` line 13

**Issue:** `console.error(error)` in browser console. Per project rules, should use a logger.

**Fix:** Remove or use a logger utility.

---

### M-03: `public/sw.js` — Limited Offline Support

**File:** `public/sw.js`

**Issue:** `APP_SHELL_ASSETS` hardcodes only `['/', '/products', '/cart', '/manifest.json']`. Other important routes (checkout, account pages) are not included for offline access. The stale-while-revalidate pattern adds latency on every navigation.

**Fix:** Expand `APP_SHELL_ASSETS` to include key routes. Consider cache versioning for API responses.

---

### M-04: `app/middleware.ts` — Hardcoded `/admin/field` Redirect (Duplicate of H-05)

**File:** `app/middleware.ts` line 20

Duplicate of H-05. Listed for completeness.

---

### M-05: `i18n/messages/I18N_SURVEY.md` — English Locale Non-Functional

**File:** `i18n/messages/I18N_SURVEY.md`

**Issue:** Survey lists ~225 hardcoded Indonesian strings needing i18n migration. The English locale is described as "NON-FUNCTIONAL — components don't use these keys". With 100 real users, English-speaking B2B visitors get no localization.

**Fix:** Migrate all identified strings to i18n files. Prioritize error messages and status labels first.

---

### M-06: `audits/` Folder — 80+ Audit Files Documenting Persistent Issues

**File:** `audits/`

**Issue:** Multiple rounds of audits (80+ files across `legacy/`, `auth/`, `new/`, `v2/`, `deep/`, `may2026/`, `ui-ux/`, `final/`, `production/`, `cursor/`) indicate issues have been documented repeatedly but not fully resolved. The same areas (auth, checkout, UI) appear in multiple audit rounds.

**Fix:** Use THIS audit to drive a single focused fix sprint. Prioritize CRITICAL items first.

---

### M-07: `lib/auth/require-admin.ts` — Local `UserRole` Type Drift Risk

**File:** `lib/auth/require-admin.ts` line 20

**Issue:** Local `UserRole` type defined separately from `check-role.ts`. If `userRoleEnum` is updated in schema but these local types aren't, TypeScript won't catch the mismatch.

**Fix:** Import `UserRole` from a single shared type definition.

---

### M-08: `lib/auth/merge-cart.ts` — Dead Code

**File:** `lib/auth/merge-cart.ts`

**Issue:** `mergeLocalCartToDb` function is never imported or called anywhere. The actual merge happens via direct `fetch('/api/auth/merge-cart')` in the login page. The service function is dead code.

**Fix:** Either use the service function from the API route or delete `lib/auth/merge-cart.ts`.

---

## 🟢 LOW

### L-01: `lib/utils/rate-limit.ts` — `@ts-ignore any` for Redis Types

**File:** `lib/utils/rate-limit.ts` lines 14–17

```typescript
// @ts-ignore
let redisInstance: any = null;
```

### L-02: No `console.log` in Lib Auth Files (Except Session Callback)

### L-03: Service Worker — No Cache Versioning

**File:** `public/sw.js`

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | `lib/auth/index.ts:24` | NextAuth lazy init race condition — breaks in serverless | Remove lazy init, use standard NextAuth v5 export |
| C-02 | 🔴 CRITICAL | `app/(auth)/**/` | Missing loading.tsx + error.tsx for all auth routes | Create both files for all 4 auth route groups |
| C-03 | 🔴 CRITICAL | `app/api/auth/[...nextauth]/route.ts` | Unsafe handler type cast | Fix types to match actual handler signature |
| C-04 | 🔴 CRITICAL | `app/api/auth/merge-cart/route.ts:32` | Delete-then-insert instead of merge quantities | Rewrite to merge with quantity caps |
| C-05 | 🔴 CRITICAL | `app/(auth)/login/page.tsx:79` | Cart merge hardcoded Zustand key + silent failure | Add error handling + toast |
| H-01 | 🟠 HIGH | `lib/auth/require-admin.ts:39` | `as never` suppresses real type mismatch | Fix return type to Session \| NextResponse |
| H-02 | 🟠 HIGH | `lib/auth/config.ts:19` | `as any` on adapter tables | Document with @ts-expect-error or fix alignment |
| H-03 | 🟠 HIGH | `lib/auth/config.ts:58` | `console.log` in session callback | Remove or use structured logger |
| H-04 | 🟠 HIGH | `lib/auth/check-role.ts:14` | Role typed as `string` not `UserRole` | Extend NextAuth Session type properly |
| H-05 | 🟠 HIGH | `app/middleware.ts:20` | `/admin/field` route doesn't exist | Remove from allowed list |
| H-06 | 🟠 HIGH | `app/api/auth/forgot-password/route.ts:52` | sendEmail blocks response | Make non-blocking |
| H-07 | 🟠 HIGH | `app/middleware.ts:18` | 4 warehouse routes vs 2 documented | Narrow to match permission matrix |
| M-01 | 🟡 MEDIUM | `lib/config/validate-env.ts:8` | CRON_SECRET required but undocumented | Add to docs or remove from REQUIRED |
| M-02 | 🟡 MEDIUM | `app/global-error.tsx:13` | console.error in browser | Remove |
| M-03 | 🟡 MEDIUM | `public/sw.js` | Limited offline support | Expand APP_SHELL_ASSETS |
| M-04 | 🟡 MEDIUM | `app/middleware.ts:20` | Duplicate of H-05 | (Same fix) |
| M-05 | 🟡 MEDIUM | `i18n/messages/I18N_SURVEY.md` | English locale non-functional | Migrate strings to en.json |
| M-06 | 🟡 MEDIUM | `audits/` folder | 80+ audit files — persistent issues not fixed | Use THIS audit for focused fix sprint |
| M-07 | 🟡 MEDIUM | `lib/auth/require-admin.ts:20` | Local UserRole type drift risk | Single shared type import |
| M-08 | 🟡 MEDIUM | `lib/auth/merge-cart.ts` | Dead code — function never imported | Delete or use from API route |
| L-01 | 🟢 LOW | `rate-limit.ts:14` | @ts-ignore any for Redis | Acceptable — document as known limitation |
| L-02 | 🟢 LOW | `lib/auth/config.ts:58` | Only session callback console.log | (See H-03) |
| L-03 | 🟢 LOW | `public/sw.js` | No cache versioning | Add cache versioning |

**Total: 5 CRITICAL · 7 HIGH · 8 MEDIUM · 3 LOW**