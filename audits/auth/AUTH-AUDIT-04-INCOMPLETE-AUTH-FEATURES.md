# AUTH-AUDIT-04: Incomplete Auth Features

**Priority: HIGH (some are blocking for production)**
**Scope:** Multiple files — see each bug

---

## Overview

These are features that are partially implemented or completely missing from the auth system. They don't prevent basic login but significantly hurt user experience and are expectations users have from a modern e-commerce platform.

---

## INCOMPLETE FEATURE 1 — Google Users Can't Set a Password (Password Section Always Shows)

**File:** `app/(store)/account/profile/page.tsx` (lines 321-418)

The "Ubah Password" (Change Password) section always renders for all users. But Google OAuth users have `passwordHash = null` in the database. If a Google user tries to change their password, the API will reject it because `currentPassword` check fails against a null hash.

The profile page doesn't know whether the user is an OAuth-only account. It blindly shows the password form.

### What's needed:
1. Detect if the user has a password (`passwordHash` is non-null)
2. For OAuth-only users: show "Set Password" (first-time setup, no current password required)
3. For email+password users: show the full "Change Password" form

### Fix — In `account/profile/page.tsx`:

Step 1: Fetch `hasPassword` from the profile API:

```typescript
// In /api/account/profile GET handler, add to response:
hasPassword: !!user.passwordHash,
linkedProviders: accounts.map(a => a.provider), // ['google'] or []
```

Step 2: In `profile/page.tsx`, add state:

```typescript
const [hasPassword, setHasPassword] = useState(false);
const [linkedProviders, setLinkedProviders] = useState<string[]>([]);

// In fetchProfile:
if (response.success && response.data) {
  setHasPassword(response.data.hasPassword);
  setLinkedProviders(response.data.linkedProviders ?? []);
  ...
}
```

Step 3: Conditionally render password section:

```tsx
{/* Password Section */}
{hasPassword ? (
  // Show full change-password form (existing code)
) : (
  // Show "Set Password" for OAuth users
  <div className="bg-white rounded-card shadow-card p-6">
    <h2 className="font-display font-semibold text-text-primary mb-2">Buat Password</h2>
    <p className="text-sm text-text-secondary mb-4">
      Akun kamu terhubung via Google. Buat password untuk bisa masuk dengan email juga.
    </p>
    {linkedProviders.includes('google') && (
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          {/* Google icon */}
        </svg>
        Terhubung dengan Google ({session?.user?.email})
      </div>
    )}
    {/* Form with only newPassword and confirmPassword — no currentPassword */}
  </div>
)}
```

---

## INCOMPLETE FEATURE 2 — No Account Profile API (GET/PATCH Profile)

**File:** `app/api/account/profile/route.ts`

**Wait — this file EXISTS** (`app/api/account/profile/route.ts` is in the file list). But checking the profile page, it fetches from `/api/account/profile`. Verify this file properly returns `hasPassword` and linked providers. If not, it needs to be updated to include those fields.

The profile GET likely needs to also fetch from the `accounts` table to get linked OAuth providers:

```typescript
// In GET handler of /api/account/profile/route.ts:
import { users, accounts } from '@/lib/db/schema';

const userWithAccounts = await db.query.users.findFirst({
  where: eq(users.id, session.user.id),
  with: {
    accounts: {
      columns: { provider: true }
    }
  }
});

return success({
  id: userWithAccounts.id,
  name: userWithAccounts.name,
  email: userWithAccounts.email,
  phone: userWithAccounts.phone,
  languagePreference: userWithAccounts.languagePreference,
  hasPassword: !!userWithAccounts.passwordHash,
  linkedProviders: userWithAccounts.accounts?.map(a => a.provider) ?? [],
});
```

Note: The `accounts` relation is NOT defined in `schema.ts` relations for `users`. The `usersRelations` has `accounts: many(accounts)` — so this SHOULD work with `with: { accounts: {...} }`.

---

## INCOMPLETE FEATURE 3 — No "Link Google Account" for Existing Email Users

**Files:** `app/(store)/account/profile/page.tsx`, new API endpoint needed

Users who registered with email/password cannot link their Google account later. This is a standard OAuth feature users expect.

### What's needed:

1. **UI in profile page** — Show "Hubungkan Google" button if Google is not linked:

```tsx
{/* In the profile page, add an "Accounts" section: */}
<div className="bg-white rounded-card shadow-card p-6">
  <h2 className="font-display font-semibold mb-4">Akun Terhubung</h2>
  
  <div className="flex items-center justify-between py-3 border-b border-brand-cream-dark">
    <div className="flex items-center gap-3">
      <svg className="w-5 h-5" viewBox="0 0 24 24">{/* Google icon */}</svg>
      <div>
        <p className="font-medium text-sm">Google</p>
        {linkedProviders.includes('google') ? (
          <p className="text-xs text-text-secondary">{session?.user?.email}</p>
        ) : (
          <p className="text-xs text-text-secondary">Belum terhubung</p>
        )}
      </div>
    </div>
    {linkedProviders.includes('google') ? (
      <span className="text-xs text-success font-medium">✓ Terhubung</span>
    ) : (
      <button
        onClick={() => signIn('google', { callbackUrl: '/account/profile?linked=google' })}
        className="text-xs text-brand-red font-medium hover:underline"
      >
        Hubungkan
      </button>
    )}
  </div>
</div>
```

2. **NextAuth handles the linking automatically** — When a logged-in user signs in with Google and the email matches, NextAuth's DrizzleAdapter links the OAuth account to the existing user. No extra endpoint needed IF `allowDangerousEmailAccountLinking: true` is set on the Google provider.

Add to `lib/auth/config.ts`:
```typescript
Google({
  clientId: process.env.AUTH_GOOGLE_ID ?? '',
  clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
  allowDangerousEmailAccountLinking: true,  // Add this
}),
```

> **Security note:** `allowDangerousEmailAccountLinking` allows linking accounts by email. This is "dangerous" because if someone creates an email account with your Google email before you, they could take over your Google account. For a controlled D2C store where you control user creation, this is acceptable.

---

## INCOMPLETE FEATURE 4 — Password Reset Doesn't Work for Google-Only Users

**File:** `app/api/auth/forgot-password/route.ts`, `app/(auth)/forgot-password/page.tsx`

When a Google-only user (no `passwordHash`) enters their email in the forgot password form, the API creates a reset token and sends an email. But when they follow the link and try to set a new password, the reset handler creates a `passwordHash` for the first time. This MIGHT work, but the flow is confusing because:

1. The email says "reset your password" but the user never had a password
2. The user is confused why they're getting a password reset for a Google account

### Fix — Add check in forgot-password route:

```typescript
// In forgot-password API, before sending the reset email:
const user = await db.query.users.findFirst({
  where: eq(users.email, body.email),
  with: { accounts: { columns: { provider: true } } },
});

if (user && !user.passwordHash && user.accounts.some(a => a.provider === 'google')) {
  // User has Google but no password
  // Option A: Send different email saying "you use Google, click here to sign in"
  // Option B: Allow setting a new password anyway (treated as "create password")
  // For now, we go with Option B but change the email subject/body
}
```

---

## INCOMPLETE FEATURE 5 — No "Forgot Password" Link in Reset Email Works for Token Expiry

**File:** `app/(auth)/reset-password/[token]/page.tsx`

The reset password page accepts a `[token]` URL param. But if the token is expired (tokens expire after 1 hour based on typical implementation), the page shows an error. The user has no way to request a new link from this page — they'd have to navigate back to `/forgot-password` manually.

### Fix — Add a "Request new link" button on error:

```tsx
// In reset-password page, when showing token-invalid error:
<div className="text-center">
  <p className="text-error mb-4">Link tidak valid atau sudah kadaluarsa.</p>
  <Link href="/forgot-password" className="text-brand-red font-medium hover:underline">
    Minta link baru
  </Link>
</div>
```

---

## INCOMPLETE FEATURE 6 — Account Orders Page References Wrong Data

**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`

The account order detail page (`/account/orders/:orderNumber`) exists. But checking `app/(store)/account/layout.tsx`, the nav links to `/account/orders`. The `[orderNumber]` sub-route should work IF the orders list page links to individual orders correctly.

Check `app/(store)/account/orders/page.tsx` to verify the order cards link to `/account/orders/${order.orderNumber}` (not `/orders/${order.orderNumber}`). If they link to the wrong URL, users click on orders and get a 404.

---

## INCOMPLETE FEATURE 7 — No Sign-In With Google for Checkout Guest Flow

**File:** `app/(store)/checkout/page.tsx`

The checkout page has an "Identity Form" for guest checkout. There's no prompt to sign in or create an account. Many users would prefer to sign in during checkout to save their address and earn points.

### What's needed (not urgent, but important for conversion):

Add a CTA at the top of the checkout identity form:
```tsx
{!session?.user && (
  <div className="bg-brand-cream rounded-lg p-4 mb-4">
    <p className="text-sm text-text-secondary">
      Sudah punya akun?{' '}
      <button
        onClick={() => signIn('google', { callbackUrl: '/checkout' })}
        className="text-brand-red font-medium hover:underline"
      >
        Masuk dengan Google
      </button>
      {' '}untuk simpan alamat dan dapatkan poin!
    </p>
  </div>
)}
```

---

## INCOMPLETE FEATURE 8 — No Session-Based Cart Restoration

**File:** `hooks/use-cart-merge.ts`

The `useCartMerge` hook merges the local (localStorage) cart to the server's `savedCarts` when the user logs in. But the **reverse** is missing: when a user logs in, if they have items saved in `savedCarts` from a previous session, those items are NOT loaded back into the local cart.

### What's needed:

After merge, fetch the user's saved cart from the server and populate the local store:

```typescript
// In useCartMerge, after the POST to /api/auth/merge-cart:
const mergedData = await res.json();
// Optionally: fetch saved cart and set it in the local store
// This requires a GET /api/account/cart endpoint
```

But this is a complex feature. For now, document it as a known gap: if a user adds items to cart on mobile, closes the browser, and reopens on desktop, their cart is gone even if they're logged in.

---

## Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Google users see password form (FEAT 1) | High — broken UX | Low | Fix Now |
| Profile API missing hasPassword (FEAT 2) | High | Low | Fix Now |
| Register no Google option (AUDIT-03 Bug 3) | High — conversion drop | Low | Fix Now |
| Register no auto-login (AUDIT-03 Bug 4) | Medium | Low | Fix Now |
| Account linking (FEAT 3) | Medium | Medium | Next Sprint |
| Forgot password for Google users (FEAT 4) | Medium | Low | Next Sprint |
| Reset token expiry UX (FEAT 5) | Low | Very Low | Quick Win |
| Checkout sign-in CTA (FEAT 7) | High — conversion | Medium | Next Sprint |
| Cart restoration on login (FEAT 8) | Medium | High | Later |
