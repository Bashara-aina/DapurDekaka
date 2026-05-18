# AUTH-AUDIT-02: Middleware & Session Architecture

**Priority: CRITICAL**
**Scope:** `app/middleware.ts`, `lib/auth/index.ts`, `components/Providers.tsx`

---

## Overview

After fixing the dual-instance problem (AUDIT-01), the middleware and session read architecture still has issues that will cause login redirects to fail or create infinite loops.

---

## BUG 1 — Middleware Calls `auth()` Without Request in Edge Runtime

**File:** `app/middleware.ts` (lines 5-7)

```typescript
export async function middleware(req: NextRequest) {
  const session = await auth();   // ← NO request argument passed
  ...
}
```

The middleware runs in the **Edge runtime** (Next.js default). In the Edge runtime, Next.js provides request context via a special mechanism. NextAuth v5's `auth()` function, when called without arguments, reads cookies via `next/headers`. In the Edge runtime, this works only if Next.js has properly injected the request context.

This is fragile and undocumented behavior. The **correct NextAuth v5 middleware pattern** is:

### Option A (recommended): Use NextAuth as middleware wrapper

```typescript
// app/middleware.ts — REPLACE ENTIRE FILE WITH THIS
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const middleware = auth(async (req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;   // ← Session is on req.auth, no separate call needed

  if (pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (role === 'warehouse') {
      const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
      if (!allowed.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/field', req.url));
      }
    }
  }

  if (pathname.startsWith('/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
  }

  if (pathname.startsWith('/b2b/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.url));
    }
    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/b2b', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};
```

> **Important:** `auth` from `@/lib/auth` must now export the auth function from a single NextAuth instance (see AUDIT-01 fix). The `req.auth` property is automatically populated by NextAuth when used as middleware.

> **Note:** With database sessions and the Edge runtime, NextAuth v5 may have limitations reading the session in the Edge runtime because the NeonHTTP driver does HTTP requests which have cold-start latency. Consider adding `export const runtime = 'nodejs'` to the middleware if you see timeouts — though this changes the middleware to Node.js runtime.

### Option B: Keep current pattern but pass request explicitly

If you want to keep the current structure, pass the request to `auth()`:

```typescript
// This works if NextAuth supports auth(req) signature
const session = await auth(req as any);
```

Option A is strongly preferred.

---

## BUG 2 — Middleware Doesn't Add `callbackUrl` to Redirect

**File:** `app/middleware.ts` (lines 25-28)

```typescript
if (pathname.startsWith('/account')) {
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url));  // ← No callbackUrl
  }
}
```

When an unauthenticated user tries to access `/account/orders`, they're redirected to `/login` with no callbackUrl. After logging in, the login page redirects to `/account` (default), not `/account/orders`. The user loses their intended destination.

### Fix (included in Option A above):
```typescript
return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
```

---

## BUG 3 — Login Page `callbackUrl` Not Validated

**File:** `app/(auth)/login/page.tsx` (line 22, 33, 66)

```typescript
const callbackUrl = searchParams.get('callbackUrl') || '/account';
```

This raw string is used directly in `router.push(callbackUrl)` and `signIn('google', { callbackUrl })`. If an attacker crafts a URL like:
`/login?callbackUrl=https://evil.com`

The user will be redirected to `evil.com` after login (open redirect).

### Fix:
```typescript
function getSafeCallbackUrl(raw: string | null): string {
  const fallback = '/account';
  if (!raw) return fallback;
  try {
    // Only allow relative URLs (must start with /)
    if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}

// Usage:
const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
```

---

## BUG 4 — Login Page Doesn't Handle Error Query Param from Google OAuth

**File:** `app/(auth)/login/page.tsx`

When Google OAuth fails (user denies access, or Google returns an error), NextAuth redirects to:
`/login?error=OAuthSignin` or `/login?error=OAuthCallback` etc.

Because `pages: { error: '/login' }` in the NextAuth config.

The login page has:
```typescript
const [error, setError] = useState('');
```

But it **never reads the `error` query param from searchParams**. Users who encounter an OAuth error see a blank login form with no explanation.

### Fix — Add to the LoginForm component (after the searchParams line):

```typescript
// Add after line 11 in login/page.tsx (after useSearchParams):
useEffect(() => {
  const errorParam = searchParams.get('error');
  if (errorParam) {
    const errorMessages: Record<string, string> = {
      OAuthSignin: 'Terjadi kesalahan saat memulai login Google. Coba lagi.',
      OAuthCallback: 'Google menolak koneksi. Pastikan kamu memberi izin akses.',
      OAuthCreateAccount: 'Gagal membuat akun baru. Email mungkin sudah terdaftar.',
      EmailSignin: 'Link masuk tidak valid atau sudah kadaluarsa.',
      CredentialsSignin: 'Email atau password salah.',
      SessionRequired: 'Silakan masuk untuk mengakses halaman ini.',
      Default: 'Terjadi kesalahan. Silakan coba lagi.',
    };
    setError(errorMessages[errorParam] ?? errorMessages.Default);
  }
  // Show success message after registration
  if (searchParams.get('registered') === 'true') {
    // Could show a toast here
  }
}, [searchParams]);
```

---

## BUG 5 — `Providers.tsx` `SessionProvider` Has No `refetchInterval`

**File:** `components/Providers.tsx` (line 29)

```tsx
<SessionProvider>
```

The `SessionProvider` defaults to polling the session every 5 minutes AND on window focus. For a D2C store, this means if a user's session expires mid-session, they find out only after their next page navigation.

More importantly, after Google OAuth redirects back to the site, the `SessionProvider` needs to refetch to pick up the new session. The current setup DOES handle this via the `useSession()` hook detecting the session change from the server, but explicit configuration helps:

### Fix:
```tsx
<SessionProvider
  refetchInterval={5 * 60}      // Refetch every 5 minutes
  refetchOnWindowFocus={true}   // Refetch when window regains focus (good for mobile)
>
```

---

## BUG 6 — `useCartMerge` Won't Fire for Google Login if `session.user.id` is Missing

**File:** `hooks/use-cart-merge.ts` (line 13-14)

```typescript
if (status !== 'authenticated' || !session?.user?.id) {
  return;
}
```

This hook runs the merge when `session.status === 'authenticated'`. For Google OAuth users, after the OAuth callback, the page reloads and `SessionProvider` fetches the session. If `session.user.id` is not populated (due to the role/id bug in AUDIT-01 Bug 4), this check fails and the cart is never merged.

The fix is AUDIT-01 Bug 4 — once `session.user.id` is reliably set in the session callback, this hook will work correctly for both credential and Google login.

However, there's a separate bug: `clearCart()` is only called if `res.ok`, but if the merge API returns a 401 (because auth is not working), the cart is NOT cleared. This is actually correct behavior. But if the merge succeeds and `clearCart()` is called, but the user then navigates and the session is refreshed showing a different state, this can cause a flash of empty cart.

No fix needed beyond AUDIT-01.

---

## Architecture Diagram (After Fix)

```
Google OAuth Flow:
1. User clicks "Masuk dengan Google" on /login
2. signIn('google', { callbackUrl: '/account' })  [next-auth/react client]
3. Browser → GET /api/auth/signin/google
4. SINGLE NextAuth instance → redirects to Google
5. Google → POST /api/auth/callback/google
6. SINGLE NextAuth instance → creates session in DB → sets cookie
7. Redirect to /account
8. Middleware runs → auth(req) → reads cookie → DB lookup → session found
9. session.user.id and session.user.role are set (fixed in AUDIT-01)
10. User accesses /account → server component calls auth() → same session → renders
11. SessionProvider on client → useSession() → picks up session → Navbar updates
```

---

## Session Strategy Note

The project uses `strategy: 'database'` (not JWT). This means:

- Sessions are stored in the `sessions` DB table
- Each request reads from the DB (via NeonHTTP) to verify the session
- This adds ~50-100ms latency per authenticated page load (the HTTP roundtrip to Neon)
- Sessions can be revoked server-side instantly (admin can kill a user session)
- The downside: heavier DB load than JWT-based sessions

This is the right choice for this app (e-commerce with role management), but be aware that the NeonHTTP cold-start latency affects auth performance. Consider adding a session cache in production if you see slowness.
