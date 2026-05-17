# AUTH-AUDIT-01: Google Login Root Cause — "Nothing Changed"

**Priority: CRITICAL — Fix this first before anything else**
**Scope:** `app/api/auth/[...nextauth]/route.ts`, `lib/auth/index.ts`, `components/store/layout/Navbar.tsx`, `components/Providers.tsx`

---

## Why "Nothing Changed" After Google Login

There are **3 compounding bugs** causing this. They all need to be fixed together.

---

## BUG 1 — The Navbar Has No Logged-In State (THE Visual "Nothing Changed")

**File:** `components/store/layout/Navbar.tsx`

The Navbar never calls `useSession()`. It always renders the same User icon regardless of whether the user is logged in or not. After a successful Google login, the navbar looks **completely identical** to before login — the user has zero visual confirmation they're authenticated.

### Current code (line 80-88):
```tsx
<Link
  href="/account"
  className="p-2 text-text-secondary hover:text-brand-red transition-colors"
  aria-label="Akun"
>
  <User className="w-5 h-5" />
</Link>
```

### Fix — Add `useSession()` and show avatar/name when logged in:

Replace the entire Navbar function (convert to client component or extract the auth part to a child component):

```tsx
// Add to top of file:
'use client';
import { useSession } from 'next-auth/react';

// Add inside Navbar():
const { data: session } = useSession();

// Replace the User icon Link (desktop, line 80-88) with:
{session?.user ? (
  <Link
    href="/account"
    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-cream hover:bg-brand-cream-dark transition-colors"
    aria-label="Akun"
  >
    {session.user.image ? (
      <Image
        src={session.user.image}
        alt={session.user.name ?? 'User'}
        width={28}
        height={28}
        className="rounded-full object-cover"
      />
    ) : (
      <div className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center">
        <span className="text-white text-xs font-bold">
          {(session.user.name ?? session.user.email ?? 'U')[0].toUpperCase()}
        </span>
      </div>
    )}
    <span className="text-sm font-medium text-text-primary hidden lg:block">
      {session.user.name?.split(' ')[0] ?? 'Akun'}
    </span>
  </Link>
) : (
  <Link
    href="/login"
    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors"
  >
    <User className="w-4 h-4" />
    Masuk
  </Link>
)}
```

**The Navbar is currently a Client Component already** (it uses `useState`, `usePathname`), so adding `useSession()` works without any file-level changes.

> **Side effect:** When Navbar becomes aware of session, the `href="/account"` link for logged-out users should point to `/login` (which it now does above). This prevents the middleware redirect loop impression.

---

## BUG 2 — Dual NextAuth Instances Create Session Read Failures

**Files:** `lib/auth/index.ts` (the lazy one), `app/api/auth/[...nextauth]/route.ts` (the real one)

There are **two completely separate NextAuth instances running in parallel:**

| Instance | File | Role |
|----------|------|------|
| DIRECT | `app/api/auth/[...nextauth]/route.ts` | Handles all `/api/auth/*` requests — OAuth, sign-in, sign-out, callbacks |
| LAZY | `lib/auth/index.ts` | Used by middleware, server components, API route handlers for `auth()` calls |

The DIRECT instance handles Google OAuth and creates sessions. The LAZY instance reads sessions in server components. They share the same database, so sessions transfer. But the LAZY instance has a fatal flaw:

### The lazy `_signIn` export is broken:
```typescript
// lib/auth/index.ts lines 14-16:
let _signIn: () => Promise<void> = async () => {};
let _signOut: () => Promise<void> = async () => {};
export { _signIn as signIn, _signOut as signOut };
```

If any server-side code imports `signIn` from `@/lib/auth` and calls it, it calls a **no-op stub**. The real `signIn` is never exported properly. (Currently unused server-side, but a footgun.)

### The lazy init races in Edge middleware:
`app/middleware.ts` imports `auth` from `@/lib/auth`. The lazy init runs on every middleware invocation and uses dynamic `await import()` calls. In the **Edge runtime**, dynamic imports of large modules like `next-auth`, `bcryptjs`, and `@auth/drizzle-adapter` can fail or time out. This means `auth()` returns `null` → middleware sees no session → redirects `/account` to `/login`.

### The fix — Unify into a single canonical auth config:

**Step 1:** Create `lib/auth/config.ts` (the single source of truth):

```typescript
// lib/auth/config.ts
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });
        if (!user?.passwordHash) return null;
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      if (!session.user) return session;
      if (user?.id) {
        session.user.id = user.id as string;
        // Fetch role directly — DrizzleAdapter may not include custom fields
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { role: true, isActive: true },
        });
        if (dbUser?.role) {
          session.user.role = dbUser.role;
        }
        if (dbUser?.isActive === false) {
          // Invalidate session for deactivated users
          return {} as typeof session;
        }
      }
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
};
```

**Step 2:** Rewrite `lib/auth/index.ts` to a simple re-export:

```typescript
// lib/auth/index.ts  — REPLACE THE ENTIRE FILE WITH THIS
import NextAuth from 'next-auth';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

**Step 3:** Rewrite `app/api/auth/[...nextauth]/route.ts` to use the same config:

```typescript
// app/api/auth/[...nextauth]/route.ts — REPLACE ENTIRE FILE WITH THIS
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

This gives you one NextAuth instance everywhere. The lazy init and stub exports disappear.

---

## BUG 3 — DrizzleAdapter Not Configured with Explicit Tables

**Files:** `lib/auth/index.ts` (line 33), `app/api/auth/[...nextauth]/route.ts` (line 12)

Both call `DrizzleAdapter(db)` without specifying which tables to use. The `@auth/drizzle-adapter` v1.7.0 requires explicit table definitions when your schema has custom fields. Without them, the adapter may fail to insert users during Google OAuth (silently returning null instead of the created user), causing the OAuth callback to return an error or redirect to the error page (`/login?error=...`).

The fix is shown in Bug 2's Step 1 — `DrizzleAdapter(db, { usersTable: users, ... })`.

---

## BUG 4 — Session Callback Doesn't Reliably Get `role`

**Both NextAuth instances' session callbacks have this:**
```typescript
const role = (user as { role?: string }).role;
if (typeof role === 'string' && role.length > 0) {
  session.user.role = role;
}
```

With `strategy: 'database'`, the `user` parameter in the session callback comes from the adapter's `getUser()`. The standard DrizzleAdapter maps only the core NextAuth user fields: `id, name, email, emailVerified, image`. The `role` field from our custom schema is NOT reliably included.

**Impact:** `session.user.role` is undefined for ALL users (both credential and Google). This means:
- `BottomNav` never shows B2B link for B2B users
- `requireAdmin()` rejects all logged-in users (role check fails)
- Admin middleware redirects all logged-in users to home

The fix is in Bug 2's `lib/auth/config.ts` — the session callback now fetches role directly from DB.

---

## BUG 5 — Missing TypeScript Type Augmentation for Session

There is **no `types/next-auth.d.ts`** file in the project. The code uses `session.user.id` and `session.user.role` everywhere, but NextAuth's default `Session.user` type only has `name, email, image`. Without type augmentation, TypeScript either errors or uses `any`, which can cause subtle runtime issues.

### Create `types/next-auth.d.ts`:

```typescript
// types/next-auth.d.ts — CREATE THIS FILE
import type { DefaultSession } from 'next-auth';

type UserRole = 'customer' | 'b2b' | 'warehouse' | 'owner' | 'superadmin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role?: UserRole;
  }
}
```

---

## BUG 6 — JWT Callback is Dead Code

**File:** `lib/auth/index.ts` (lines 73-79), `app/api/auth/[...nextauth]/route.ts` (lines 41-47)

Both NextAuth instances define:
```typescript
async jwt({ token, user }) {
  if (user?.id) {
    token.role = ...
    token.sub = user.id;
  }
  return token;
},
```

With `session: { strategy: 'database' }`, **the JWT callback is never called**. It only runs with JWT sessions. This is dead code and should be removed to avoid confusion.

Remove the entire `jwt` callback block from both instances (it's removed in the unified `config.ts` fix above).

---

## Complete Fix Order for Cursor

1. Create `types/next-auth.d.ts` (Bug 5)
2. Create `lib/auth/config.ts` (Bugs 2, 3, 4)
3. Replace `lib/auth/index.ts` with simple re-export (Bug 2)
4. Replace `app/api/auth/[...nextauth]/route.ts` with simple re-export (Bug 2)
5. Update `components/store/layout/Navbar.tsx` to show auth state (Bug 1)
6. Test: Click "Masuk dengan Google" → Complete OAuth → Navbar should update → Account page should load

---

## Environment Variable Checklist

The app uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (not `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). Verify in Vercel:
- `AUTH_SECRET` — must be set (32+ random bytes, used to sign session tokens)
- `AUTH_GOOGLE_ID` — Google OAuth client ID
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- `NEXTAUTH_URL` / `AUTH_URL` — must be the production URL (e.g., `https://dapurdekaka.com`). **Without this, OAuth redirect URIs will be wrong in production.**

Also verify in Google Cloud Console that the OAuth redirect URI is:
`https://dapurdekaka.com/api/auth/callback/google`
