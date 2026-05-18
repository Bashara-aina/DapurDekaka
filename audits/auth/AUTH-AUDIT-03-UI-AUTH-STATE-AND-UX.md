# AUTH-AUDIT-03: UI Auth State & Login UX

**Priority: HIGH**
**Scope:** `components/store/layout/Navbar.tsx`, `components/store/layout/BottomNav.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(store)/account/layout.tsx`

---

## Overview

After the technical auth bugs are fixed, there are multiple UX gaps in the auth flow. Some of these cause the "nothing changed" feeling even when login actually succeeded.

---

## BUG 1 — Navbar Never Shows Logged-In State

**File:** `components/store/layout/Navbar.tsx`

**Already documented in AUDIT-01 Bug 1.** Full fix is there.

Summary: The Navbar doesn't call `useSession()`. It shows the same User icon regardless of auth state. After login, nothing visually changes in the nav. The fix adds an avatar/name display when logged in and a "Masuk" button when logged out.

---

## BUG 2 — BottomNav's B2B Link Uses Wrong Role Check

**File:** `components/store/layout/BottomNav.tsx` (lines 27-28)

```typescript
const isB2bUser = session?.user?.role === 'b2b' || session?.user?.role === 'superadmin';
```

This is correct logic, BUT because `session.user.role` is currently always undefined (AUDIT-01 Bug 4), `isB2bUser` is always false and B2B users never see the B2B link. Fix AUDIT-01 Bug 4 first; this code will then work.

Additionally, the BottomNav has a **badge positioning bug** (line 72):

```tsx
{item.badge && item.badge > 0 && (
  <span className="absolute -top-1 -right-2 ...">
```

This `absolute` is positioned relative to the parent `<Link>`, but the `<Link>` doesn't have `relative` positioning. Add `relative` to the Link:

```tsx
<Link
  key={index}
  href={item.href}
  className={`relative flex flex-col items-center gap-0.5 py-2 px-3 ...`}
  //           ^^^^^^^^ Add this
>
```

---

## BUG 3 — Register Page Doesn't Offer Google Sign-Up

**File:** `app/(auth)/register/page.tsx`

The register page only offers email/password registration. There's no Google option. Users who click Register expecting to use Google are stuck. This is especially problematic because the Login page HAS Google but Register doesn't — inconsistent.

### Fix — Add Google button to RegisterPage:

```tsx
// Add after existing imports:
import { signIn } from 'next-auth/react';

// Add at the top of the form, before the existing form:
<button
  type="button"
  onClick={() => signIn('google', { callbackUrl: '/account' })}
  className="w-full h-12 border border-brand-cream-dark rounded-button flex items-center justify-center gap-3 font-medium hover:bg-brand-cream transition-colors mb-6"
>
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    {/* Same Google SVG paths as in login/page.tsx */}
  </svg>
  Daftar dengan Google
</button>

<div className="relative mb-6">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-brand-cream-dark"></div>
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="px-2 bg-white text-text-secondary">atau daftar dengan email</span>
  </div>
</div>
```

---

## BUG 4 — Register Page Redirects to Login Instead of Auto-Logging In

**File:** `app/(auth)/register/page.tsx` (lines 52-53)

```typescript
// After successful registration:
router.push('/login?registered=true');
```

After creating an account, the user is sent to the login page to log in again. This is unnecessary friction. The registration API creates the user with a password hash. We can auto-login them immediately after.

### Fix:

```typescript
// In register/page.tsx, after successful registration:
import { signIn } from 'next-auth/react';

// Replace router.push('/login?registered=true') with:
const loginResult = await signIn('credentials', {
  email: formData.email,
  password: formData.password,
  redirect: false,
  callbackUrl: '/account',
});

if (loginResult?.url) {
  // Merge guest cart before redirecting
  try {
    const cartItems = JSON.parse(localStorage.getItem('cart-storage') || '{}');
    if (cartItems?.state?.items?.length > 0) {
      await fetch('/api/auth/merge-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems.state.items }),
      });
    }
  } catch {
    // Non-critical
  }
  router.push('/account');
} else {
  // Login failed for some reason, fall back to login page
  router.push('/login?registered=true');
}
```

---

## BUG 5 — Login Page Shows No Success Message for Newly Registered Users

**File:** `app/(auth)/login/page.tsx`

When users complete registration and are redirected to `/login?registered=true`, the login page currently shows nothing special. The `registered=true` query param is completely ignored.

### Fix — Add to LoginForm's useEffect (alongside the error param handling from AUDIT-02):

```typescript
// In the useEffect that reads searchParams:
if (searchParams.get('registered') === 'true') {
  // Could show a green banner: "Akun berhasil dibuat! Silakan masuk."
  // For now, pre-fill noting this was a registration:
  setError(''); // Ensure no error shown
  // Consider using a success state:
}
```

Better: add a `successMessage` state:
```typescript
const [successMessage, setSuccessMessage] = useState('');

// In useEffect:
if (searchParams.get('registered') === 'true') {
  setSuccessMessage('Akun berhasil dibuat! Silakan masuk.');
}

// In JSX, before the form:
{successMessage && (
  <div className="p-3 bg-success-light text-success text-sm rounded-lg mb-4">
    {successMessage}
  </div>
)}
```

---

## BUG 6 — Account Layout Shows Session While Loading, Causing Flash

**File:** `app/(store)/account/layout.tsx` (lines 31-32)

```typescript
const { data: session, status } = useSession();
```

The `status` is used nowhere. When the page first loads, `status === 'loading'` and `session === null`. The layout renders immediately with no user context. If the sidebar shows user-specific info, it would flash.

Currently the sidebar doesn't show user info, so this is a minor issue. But if you add the user's name to the sidebar, you need to handle the loading state:

```tsx
// If adding user info to sidebar:
{status === 'loading' ? (
  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
) : (
  <span>{session?.user?.name}</span>
)}
```

---

## BUG 7 — Account Sidebar Missing "Vouchers" Navigation

**File:** `app/(store)/account/layout.tsx` (lines 21-27)

```typescript
const navItems = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard },
  { href: '/account/orders', label: 'Pesanan', icon: Package },
  { href: '/account/addresses', label: 'Alamat', icon: MapPin },
  { href: '/account/points', label: 'Poin', icon: Gift },
  { href: '/account/profile', label: 'Profil', icon: User },
  // ← MISSING: /account/vouchers
];
```

The `app/(store)/account/vouchers/page.tsx` exists and has a full implementation, but it's not linked in the sidebar. Users can't navigate to it.

### Fix — Add to navItems:
```typescript
import { Ticket } from 'lucide-react'; // Add to imports

// Add to navItems array:
{ href: '/account/vouchers', label: 'Voucher', icon: Ticket },
```

---

## BUG 8 — No Mobile Sign-Out Button Outside Account Section

**Files:** `components/store/layout/Navbar.tsx`, `components/store/layout/BottomNav.tsx`

The only sign-out button is in the Account section sidebar (`app/(store)/account/layout.tsx`). On mobile, users navigate to `/account`, see the account content, but there's no sign-out in the bottom nav or mobile header menu.

The mobile Navbar hamburger menu (`line 145-151`) links to "Akun Saya" but has no sign-out option. Users who want to sign out on mobile have to navigate to `/account` and use the button buried in the sidebar.

### Fix — Add sign-out to Navbar mobile menu (after the `Akun Saya` link):

```tsx
// In Navbar's mobile menu, after 'Akun Saya' link:
{session?.user && (
  <button
    onClick={async () => {
      setMobileMenuOpen(false);
      await signOut({ callbackUrl: '/' });
    }}
    className="block w-full text-left py-3 px-4 text-error hover:bg-error-light rounded-lg transition-colors min-h-[44px] flex items-center"
  >
    Keluar
  </button>
)}
```

This requires `useSession()` and `signOut` from `next-auth/react` in Navbar — which you're already adding for Bug 1 above.

---

## BUG 9 — Login Page Google Button Has No Loading State

**File:** `app/(auth)/login/page.tsx` (lines 65-68)

```typescript
const handleGoogleLogin = () => {
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  signIn('google', { callbackUrl });
};
```

After clicking "Masuk dengan Google", the button stays active and the page appears frozen for 1-2 seconds while the redirect happens. Users may click multiple times.

### Fix:

```typescript
const [googleLoading, setGoogleLoading] = useState(false);

const handleGoogleLogin = async () => {
  setGoogleLoading(true);
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  await signIn('google', { callbackUrl });
  // Note: if signIn redirects, this line never runs. That's fine.
  // If it returns (error case), we reset:
  setGoogleLoading(false);
};

// In JSX:
<button
  onClick={handleGoogleLogin}
  disabled={googleLoading || isLoading}
  className="w-full h-12 border ... disabled:opacity-50 disabled:cursor-not-allowed"
>
  {googleLoading ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin w-4 h-4" .../>
      Menghubungkan ke Google...
    </span>
  ) : (
    <>
      <svg className="w-5 h-5" .../>
      Masuk dengan Google
    </>
  )}
</button>
```

---

## Complete UX Flow After All Fixes

```
New User Journey:
Register → Auto login → /account (with welcome state)

Returning User Journey (Email):
Login → Credential check → Cart merge → /account (navbar shows avatar)

Returning User Journey (Google):
Login → Google OAuth → /account (navbar shows Google avatar)
         ↓ If error:
         /login?error=OAuthCallback (shows error message)

Logged-Out State:
Navbar: "Masuk" button (red, prominent)
BottomNav: "Akun" link → redirects to /login if not logged in

Logged-In State:
Navbar: Shows user avatar/first name
BottomNav: Same links + B2B link for b2b/superadmin users
Account sidebar: Overview, Pesanan, Alamat, Poin, Voucher, Profil + Keluar
```
