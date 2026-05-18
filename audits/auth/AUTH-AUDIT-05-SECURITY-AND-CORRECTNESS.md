# AUTH-AUDIT-05: Security & Correctness Issues

**Priority: CRITICAL to MEDIUM depending on item**
**Scope:** Multiple auth-related files

---

## Overview

Security and correctness gaps in the auth system. Some of these can be exploited on a production store. Fix all CRITICAL items before going live.

---

## SECURITY BUG 1 — User Enumeration via Timing in Forgot Password

**File:** `app/api/auth/forgot-password/route.ts`

**Severity: MEDIUM** (leaks email existence to attackers)

The forgot-password endpoint likely returns different responses for:
- `{ error: 'Email tidak terdaftar' }` — when email not found
- `{ success: true }` — when email found and reset link sent

This lets an attacker enumerate which emails are registered: send 1000 emails to the API, see which ones return success.

### Fix — Always return the same response:

```typescript
// In /api/auth/forgot-password/route.ts:
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email } = body;

  // Always lookup
  const user = await db.query.users.findFirst({
    where: eq(users.email, email?.toLowerCase?.() ?? ''),
  });

  // Always return success to prevent enumeration
  if (!user) {
    // Wait a fake delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    return success({ message: 'Jika email terdaftar, link reset akan dikirim.' });
  }

  // Create token and send email...
  // ...

  return success({ message: 'Jika email terdaftar, link reset akan dikirim.' });
}
```

---

## SECURITY BUG 2 — Open Redirect in Login Page

**File:** `app/(auth)/login/page.tsx` (lines 22, 33, 66)

**Severity: HIGH** (phishing vector)

**Already documented in AUDIT-02 Bug 3.** Full fix is there.

The `callbackUrl` from the URL query string is used without validation. An attacker can craft:
`https://dapurdekaka.com/login?callbackUrl=https://evil-phishing-site.com`

After login, the user is redirected to the phishing site.

The `getSafeCallbackUrl()` function from AUDIT-02 fixes this.

---

## SECURITY BUG 3 — No Rate Limiting on Credential Login

**File:** `app/api/auth/[...nextauth]/route.ts` (the NextAuth route handler)

**Severity: HIGH** (enables brute-force password attacks)

The credential login endpoint (`/api/auth/callback/credentials`) is handled by NextAuth's route handler. There is no rate limiting applied to it. An attacker can try thousands of password combinations against a known email address.

NextAuth v5 doesn't have built-in rate limiting on the credentials callback. You need to add it externally.

### Fix — Add rate limiting middleware to the NextAuth route:

```typescript
// app/api/auth/[...nextauth]/route.ts:
import { withRateLimit } from '@/lib/utils/rate-limit';
import { handlers } from '@/lib/auth';

// Wrap the POST handler (which handles credential sign-in):
const rateLimitedPOST = withRateLimit(
  handlers.POST,
  { windowMs: 15 * 60 * 1000, maxRequests: 10 }  // 10 attempts per 15 minutes per IP
);

export const GET = handlers.GET;
export const POST = rateLimitedPOST;
```

Check if `withRateLimit` in `lib/utils/rate-limit.ts` is compatible with NextAuth's handler signature. If not, wrap it differently:

```typescript
// Alternative: use rate limiter inside NextAuth's authorize callback
// In lib/auth/config.ts credentials authorize:
async authorize(credentials, req) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  // Check rate limit for this IP
  const key = `login:${ip}`;
  // Use Redis or in-memory store
  // ...
}
```

---

## SECURITY BUG 4 — `AUTH_SECRET` Not Validated at Startup

**File:** `lib/config/validate-env.ts`

The `validate-env.ts` file likely validates environment variables at startup. Check if it validates:
- `AUTH_SECRET` — must be at least 32 random bytes (if missing, NextAuth uses an insecure default)
- `AUTH_GOOGLE_ID` — must be set for Google to work
- `AUTH_GOOGLE_SECRET` — must be set for Google to work

The current `lib/auth/index.ts` does check for `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (lines 38-41) but only logs an error — it doesn't fail hard. In production, a missing secret should crash the build.

### Fix — In `lib/config/validate-env.ts`, add:
```typescript
const required = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
  'NEXTAUTH_URL',  // or AUTH_URL
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// Validate AUTH_SECRET length
if ((process.env.AUTH_SECRET?.length ?? 0) < 32) {
  throw new Error('AUTH_SECRET must be at least 32 characters');
}
```

---

## SECURITY BUG 5 — Missing `NEXTAUTH_URL` / `AUTH_URL` in Production

**Severity: HIGH** (OAuth redirects to wrong domain in production)

NextAuth v5 uses `AUTH_URL` (or the older `NEXTAUTH_URL`) to determine the base URL for OAuth redirects. Without it:
- In development: NextAuth auto-detects from `localhost:3000`
- In production (Vercel): NextAuth might detect the Vercel preview URL instead of `dapurdekaka.com`

This causes Google OAuth to redirect to a wrong URL after authentication, resulting in a "redirect_uri_mismatch" error from Google.

### Verify in Vercel:
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add `AUTH_URL=https://dapurdekaka.com` (or `NEXTAUTH_URL=https://dapurdekaka.com`)
3. Apply only to **Production** environment (not Preview, which has dynamic URLs)

### Also verify in Google Cloud Console:
1. Go to APIs & Services → Credentials → OAuth 2.0 Client IDs
2. The authorized redirect URI must include EXACTLY: `https://dapurdekaka.com/api/auth/callback/google`
3. Also add your Vercel preview domain if you want Google login on previews

---

## SECURITY BUG 6 — Session Token Exposure in Logs

**File:** `lib/auth/index.ts` (lines 25-28)

```typescript
console.log('[Auth] Initializing NextAuth...');
console.log('[Auth] AUTH_GOOGLE_ID:', process.env.AUTH_GOOGLE_ID ? 'set' : 'MISSING');
console.log('[Auth] AUTH_GOOGLE_SECRET:', process.env.AUTH_GOOGLE_SECRET ? 'set' : 'MISSING');
console.log('[Auth] IS_BUILD:', IS_BUILD);
```

These debug logs are fine — they don't log secret values. But if other parts of the codebase log session objects (e.g., `console.log('[Auth] Session:', session)`), session tokens could appear in server logs, creating a security issue.

### Fix — Remove debug logs from `lib/auth/index.ts` after the unified config fix:
```typescript
// After replacing with the simple re-export, these logs disappear automatically.
```

---

## SECURITY BUG 7 — `bcryptjs` in Production Bundle (Credential Provider)

**File:** `app/api/auth/[...nextauth]/route.ts` (line 4)

```typescript
import bcrypt from 'bcryptjs';
```

This is a pure JavaScript bcrypt implementation. For server-side hash comparison, this is acceptable but slow. `bcryptjs` runs synchronously and blocks the Node.js event loop for ~100ms per comparison.

For a D2C store with low traffic, this is fine. But it's worth noting:
- Use `rounds: 10` (not higher) to keep comparison under 100ms
- Do NOT use `bcrypt` (native) in Edge runtime — `bcryptjs` is the right choice

No fix needed, but verify the rounds in the registration API:
```typescript
// In /api/auth/register/route.ts:
const hash = await bcrypt.hash(password, 10);  // 10 is the right balance
```

---

## CORRECTNESS BUG 1 — `pages: { error: '/login' }` Hides Auth Errors

**File:** `lib/auth/config.ts` (after fix), currently both auth files

```typescript
pages: { signIn: '/login', error: '/login' },
```

Setting `error: '/login'` means ALL NextAuth errors redirect to `/login?error=...`. If you don't handle the `error` query param in the login page (AUDIT-02 Bug 4), users see a blank login form when an error occurs.

This creates a silent failure loop:
1. Google OAuth error → redirect to `/login?error=OAuthCallback`
2. Login page renders without showing the error
3. User thinks login page just opened randomly
4. User tries Google login again → same error → infinite loop appearance

Fix: Implement the error handling from AUDIT-02 Bug 4.

---

## CORRECTNESS BUG 2 — Users Can Have `role: null` in Edge Cases

**File:** `lib/db/schema.ts` (line 83)

```typescript
role: userRoleEnum('role').notNull().default('customer'),
```

The schema has `.notNull()` with a `.default('customer')`. This should prevent null roles. But with DrizzleAdapter creating users without specifying the role column (when DrizzleAdapter doesn't know about `role`), the adapter might not include `role` in the INSERT statement. If the DB column has a DEFAULT, Postgres will fill it. This SHOULD work.

But if there are existing users in the DB who were created before the schema migration added `role`, they might have null roles. The middleware role check could fail for those users:

```typescript
// middleware:
if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
  return NextResponse.redirect(new URL('/', req.url));
}
```

For `/admin` routes, `null` role causes a redirect to `/`. This might prevent legitimate admin users from accessing admin if their role somehow got nulled.

### Fix — Add a data check:
```sql
-- Run in Neon console to check:
SELECT id, email, role FROM users WHERE role IS NULL;

-- Fix any nulls:
UPDATE users SET role = 'customer' WHERE role IS NULL;
```

---

## CORRECTNESS BUG 3 — `isActive` Check Missing from Auth Flow

**File:** `lib/auth/index.ts` (and the route handler)

The `users` table has `isActive: boolean` (line 80 in schema.ts). When a user is set to `isActive = false` (banned/suspended), the credential login's `authorize` function doesn't check this:

```typescript
async authorize(credentials) {
  ...
  const user = await db.query.users.findFirst({
    where: eq(users.email, credentials.email as string),
  });
  if (!user?.passwordHash) return null;
  const isValid = await bcrypt.compare(...);
  if (!isValid) return null;
  return { id: user.id, ... };  // ← No isActive check!
}
```

A banned user can still log in with email/password. Google OAuth users can also sign in freely regardless of `isActive`.

### Fix — Add `isActive` check in credentials authorize AND in the session callback:

**In credentials authorize (in `lib/auth/config.ts`):**
```typescript
async authorize(credentials) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, credentials.email as string),
  });
  if (!user?.passwordHash) return null;
  if (!user.isActive) return null;  // ← Add this
  const isValid = await bcrypt.compare(...);
  if (!isValid) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
},
```

**In session callback (already handled in AUDIT-01 Bug 4 fix):**
```typescript
async session({ session, user }) {
  ...
  if (dbUser?.isActive === false) {
    return {} as typeof session;  // Invalidates the session
  }
  ...
}
```

For Google OAuth users, the `isActive` check happens in the session callback since we can't intercept the OAuth flow as easily.

---

## CORRECTNESS BUG 4 — Account Page Uses `session.user.id` Without Null Check

**File:** `app/(store)/account/page.tsx` (lines 17-18)

```typescript
const user = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, session.user.id!),  // ← Force unwrap
});
```

The `!` non-null assertion is used on `session.user.id`. If AUDIT-01 bugs persist and `session.user.id` is undefined, this crashes the page with an unhandled error (shows Next.js error boundary).

The page does check:
```typescript
if (!session?.user?.id) {
  redirect('/login');
}
```

...BUT there's a window between the `auth()` call and the `redirect()` where TypeScript still doesn't know the type is narrowed (depending on version). The forced unwrap `!` is therefore technically correct after the redirect guard, but it's a code smell.

No immediate fix needed, but consider:
```typescript
const userId = session.user.id;
if (!userId) redirect('/login');

const user = await db.query.users.findFirst({
  where: (u, { eq }) => eq(u.id, userId),  // No non-null assertion needed
});
```

---

## Full Checklist for Security Before Production

| Item | Status | Priority |
|------|--------|----------|
| AUTH_SECRET set (32+ chars) | ❓ Verify in Vercel | CRITICAL |
| AUTH_URL / NEXTAUTH_URL set | ❓ Verify in Vercel | CRITICAL |
| Google OAuth redirect URI in GCP | ❓ Verify | CRITICAL |
| Rate limit on credential login | ❌ Missing | HIGH |
| Open redirect in callbackUrl | ❌ Broken | HIGH |
| User enumeration in forgot-password | ❌ Leaks emails | MEDIUM |
| Error messages show on /login | ❌ Silent failures | MEDIUM |
| isActive check in auth flow | ❌ Banned users can login | MEDIUM |
| bcrypt rounds at 10 | ❓ Verify | LOW |
| Debug logs removed from auth | ❌ Present | LOW |
| next-auth.d.ts type augmentation | ❌ Missing | LOW |

---

## Recommended Auth Testing Checklist (After All Fixes)

Run through these scenarios in staging before production:

1. **New Google user** — Click Google login → Complete OAuth → Should land on `/account` with welcome
2. **Returning Google user** — Login again → Should land on `/account` (no error)
3. **New email registration** → Auto-login → `/account`
4. **Email login** → Correct credentials → `/account`
5. **Email login** → Wrong password → Error message in form (NOT redirect)
6. **Forgot password** — Enter email → Same response regardless of email existence
7. **Reset password** — Follow link → Set new password → Redirect to login
8. **Admin login** → Admin user (`role: owner`) → Access `/admin/dashboard`
9. **Non-admin login** → Customer user → Cannot access `/admin` (redirect to `/`)
10. **Inactive user** — `isActive: false` → Cannot login (error or redirect)
11. **Google error** — Deny Google access → See error message on `/login`
12. **Cart merge** — Add items as guest → Login → Items saved to server cart
13. **B2B user** — `role: b2b` → B2B link visible in BottomNav
14. **Session expiry** — Wait for session to expire → Next page navigation redirects to login
