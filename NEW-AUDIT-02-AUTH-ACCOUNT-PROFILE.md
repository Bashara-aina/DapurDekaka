# AUDIT 02 — AUTH, ACCOUNT & PROFILE FLOWS
**Date**: 2026-05-22 | **Branch**: fix/multiple-audit-fixes-may-2026  
**Scope**: `app/(auth)/`, `app/(store)/account/`, `app/api/auth/`, `app/api/account/`  
**If 100 users hit this tomorrow**: 100% of password reset links broken; Google users who forget they used Google will be confused; account orders page missing Pay Now CTA.

---

## BUG-01 — CRITICAL: Reset Password Token Is Always Null

**File**: `app/(auth)/reset-password/[token]/page.tsx:9–14`  
**Severity**: CRITICAL — password reset is 100% broken for all users  

**What's wrong**: The page route is `/reset-password/[token]` — the token is a **dynamic path segment**. The forgot-password API generates the URL as:
```ts
`${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`
```

But the page component reads the token using:
```ts
const searchParams = useSearchParams();
const token = searchParams.get('token'); // ALWAYS returns null
```

`useSearchParams()` reads **query parameters** (e.g. `?token=xxx`), not path segments. The token is never in a query parameter — it's in the path. So `token` is always `null`, and every user who clicks a password reset link sees:
> "Link Tidak Valid — Token reset password sudah tidak berlaku atau tidak ditemukan."

**Fix**: Use `useParams()` to read the path segment:
```tsx
// app/(auth)/reset-password/[token]/page.tsx

// DELETE these lines:
const searchParams = useSearchParams();
const token = searchParams.get('token');

// ADD:
import { useParams } from 'next/navigation';
// ...
const params = useParams();
const token = params.token as string;
```

Also remove `useSearchParams` import if it's no longer used elsewhere in the file. No other changes needed — the `handleSubmit` function already uses `token` correctly.

---

## BUG-02 — MEDIUM: Login Page Double-Redirect Race Condition

**File**: `app/(auth)/login/page.tsx:54–60, 85–90`  
**Severity**: MEDIUM — double navigation after credentials login  

**What's wrong**: After a successful credentials `signIn`, TWO things trigger navigation:
1. **`handleSubmit`** (line 88): calls `router.push(callbackUrl)` after cart merge completes
2. **`useEffect`** (line 54–60): fires when `session` becomes truthy — calls `router.push(callbackUrl)` again

These race against each other. NextAuth updates the session asynchronously after `signIn` resolves. The `useEffect` fires when `useSession` detects the new session, which may happen before or after `handleSubmit` reaches its own `router.push`. Result: the router navigates twice, causing a flash or a broken history entry.

**Fix**: The `useEffect` is needed to handle already-logged-in users visiting `/login`. Add a ref to suppress the effect during form submission:

```tsx
const isFormSubmitting = useRef(false);

// In handleSubmit, before signIn:
isFormSubmitting.current = true;

// In useEffect:
useEffect(() => {
  if (session && !isFormSubmitting.current) {
    // Only redirect via effect for already-logged-in visits
    const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
    router.push(callbackUrl);
  }
}, [session, router, searchParams]);

// In handleSubmit after success:
if (result?.url) {
  // cart merge...
  isFormSubmitting.current = false;
  router.push(callbackUrl);
}
```

---

## BUG-03 — HIGH: Forgot Password Doesn't Handle Google-Only Accounts

**File**: `app/api/auth/forgot-password/route.ts`  
**Severity**: HIGH — Google users who try to reset password get a confusing UX  

**What's wrong**: Users who registered via Google OAuth have no `passwordHash` in the DB. If they try forgot-password, the API sends a reset email (because the email exists and there's a user). When they click the reset link and set a password, this now works (creates a password for their account, which is actually a useful feature). However, the UX flow is confusing — the user doesn't know they registered with Google.

A better approach: detect Google-only accounts and show a clear message.

**Fix in API** (`app/api/auth/forgot-password/route.ts`): Before generating the reset token, check if the user has no password:
```ts
const user = await db.query.users.findFirst({
  where: eq(users.email, email.toLowerCase()),
});

if (user && !user.passwordHash) {
  // User registered via Google — still allow password setup, but clarify
  // For security: don't reveal if the account exists. Just return success.
  // The email should say "Set a password for your account (registered via Google)"
}
```

**Fix in email template**: The `PasswordReset.tsx` email should have a variant message for Google accounts: "Akun kamu terdaftar dengan Google. Klik link ini untuk menambahkan password ke akunmu."

---

## BUG-04 — MEDIUM: Account Orders List — No "Bayar Sekarang" CTA for Pending Payment

**File**: `app/(store)/account/orders/page.tsx`  
**Severity**: HIGH — users with unpaid orders can't easily complete payment  

**What's wrong**: The account orders page lists all orders with status badges. Orders with `pending_payment` status show "Menunggu Pembayaran" badge but have no action button to complete payment. The user must:
1. Know to go to `/checkout/pending?order=XXX`
2. Or click the order and hope there's a Pay button in the detail page

**Fix**: In the orders list, add a conditional "Bayar Sekarang" button for `pending_payment` orders:
```tsx
{order.status === 'pending_payment' && (
  <a
    href={`/checkout/pending?order=${order.orderNumber}`}
    className="inline-block px-3 py-1.5 bg-brand-red text-white text-xs font-bold rounded-lg hover:bg-brand-red-dark"
    onClick={e => e.stopPropagation()}
  >
    Bayar Sekarang
  </a>
)}
```

---

## BUG-05 — MEDIUM: Account Layout — No Sign-Out Confirmation

**File**: `app/(store)/account/layout.tsx:36–39`  
**Severity**: LOW — UX polish  

**What's wrong**: Clicking "Keluar" immediately calls `signOut()` without confirmation. On mobile where touch targets are close together, accidental sign-out is plausible.

**Fix**:
```ts
const handleSignOut = async () => {
  if (!confirm('Yakin ingin keluar dari akun?')) return;
  setIsSigningOut(true);
  await signOut({ callbackUrl: '/' });
};
```

---

## BUG-06 — MEDIUM: Account Vouchers Page Shows All Public Coupons, Not User Vouchers

**File**: `app/(store)/account/vouchers/page.tsx`, `app/api/account/vouchers/route.ts`  
**Severity**: MEDIUM — misleading UX  

**What's wrong**: The "Voucher Saya" page at `/account/vouchers` fetches two things:
1. Coupons the user has used in the past
2. All currently active public coupons

It presents both under the label "Voucher Saya" as if they're personalized vouchers the user earned or received. But the "available" section is literally just all public coupons that anyone can use. This creates a misleading "reward" expectation.

**Fix**: Rename the UI label:
- "Voucher Tersedia untuk Kamu" → "Kupon Publik"
- Remove the "Voucher Saya" framing; instead show "Kupon yang Pernah Kamu Pakai" for used section
- Add explanatory text: "Kupon-kupon berikut bisa dipakai siapa saja — masukkan kode saat checkout"

---

## BUG-07 — MEDIUM: Account Points Page Uses `useEffect` Instead of `useQuery`

**File**: `app/(store)/account/points/page.tsx:24–54`  
**Severity**: LOW — caching/UX gap  

**What's wrong**: The points page uses raw `useEffect` + `useState` to fetch data:
```ts
useEffect(() => {
  fetchPoints(page);
}, [page]);
```

This means:
- No stale-while-revalidate — navigating away and back shows loading spinner every time
- No deduplication of in-flight requests
- No automatic retry on failure

**Fix**: Use `useQuery` from TanStack Query (already installed):
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['account', 'points', page],
  queryFn: () => fetch(`/api/account/points?page=${page}&limit=20`).then(r => r.json()).then(r => r.data),
  staleTime: 60_000,
  keepPreviousData: true, // Prevents flicker during pagination
});
```

---

## BUG-08 — LOW: Register Page Has No Privacy Policy/Terms Acceptance

**File**: `app/(auth)/register/page.tsx`  
**Severity**: MEDIUM (legal risk for commercial site)  

**What's wrong**: Users can create an account without accepting the privacy policy or terms of service. This is a legal requirement for GDPR-adjacent jurisdictions and is considered best practice for e-commerce.

**Fix**: Add a checkbox before the submit button:
```tsx
const [termsAccepted, setTermsAccepted] = useState(false);

// In form:
<label className="flex items-start gap-2 text-sm text-text-secondary">
  <input
    type="checkbox"
    required
    checked={termsAccepted}
    onChange={e => setTermsAccepted(e.target.checked)}
    className="mt-0.5 w-4 h-4 accent-brand-red"
  />
  <span>
    Saya setuju dengan{' '}
    <Link href="/privacy-policy" className="text-brand-red underline" target="_blank">Kebijakan Privasi</Link>
    {' '}dan{' '}
    <Link href="/refund-policy" className="text-brand-red underline" target="_blank">Syarat & Ketentuan</Link>
  </span>
</label>

<button type="submit" disabled={isLoading || !termsAccepted} ...>
```

---

## BUG-09 — HIGH: Account Order Detail — No Order Tracking Info for Guest Orders

**File**: `app/(store)/account/orders/[orderNumber]/page.tsx`  
**Severity**: MEDIUM  

**What's wrong**: The account order detail page has an ownership check — it shows the order only if `order.userId === session.user.id`. But the public order tracking page at `/orders/[orderNumber]` requires email verification for guests. There is no way for a logged-in user to see orders placed as a guest (before they created an account). These orders have `userId = null`.

**Impact**: Users who placed an order as guest, then created an account, cannot see those orders in their account history.

**Fix**: In `app/(store)/account/orders/page.tsx`, when fetching orders, also include orders where `recipientEmail = user.email AND userId IS NULL`. This requires a query change:
```ts
const orders = await db.query.orders.findMany({
  where: or(
    eq(orders.userId, session.user.id),
    and(
      isNull(orders.userId),
      eq(orders.recipientEmail, user.email)
    )
  ),
  ...
});
```

---

## BUG-10 — MEDIUM: Profile Page Exists but Not Linked From Anywhere Obvious

**File**: `app/(store)/account/layout.tsx:28`  
**Severity**: LOW — discoverability  

**What's wrong**: The profile page IS in the navItems list as `{ href: '/account/profile', label: 'Profil', icon: User }`. So it's accessible. But there's no CTA on the account home page to "Complete your profile" — users who haven't filled in their phone number won't know they should. The checkout page tries to pre-fill from `profileData.phone`, so if it's empty, the phone field in checkout is blank.

**Fix**: On `account/page.tsx`, add a banner if `user.phone` is null:
```tsx
{!user.phone && (
  <div className="bg-warning-light border border-warning/30 rounded-card p-4">
    <p className="text-sm font-medium text-text-primary">Lengkapi profilmu</p>
    <p className="text-xs text-text-secondary mt-1">
      Tambahkan nomor HP agar checkout lebih cepat.
    </p>
    <Link href="/account/profile" className="text-sm text-brand-red font-medium hover:underline mt-2 inline-block">
      Lengkapi Profil →
    </Link>
  </div>
)}
```

---

## INCOMPLETE FEATURE: No "Tambah Nomor HP" Flow Post-Registration

**File**: `app/(auth)/register/page.tsx`, `app/(store)/account/profile/page.tsx`  
**Severity**: MEDIUM  

**What's wrong**: After registering, users are sent to `/account`. There's no prompt to add a phone number. The checkout then fails to pre-fill phone, making every checkout start from scratch for new users.

**Fix**: After successful registration+login, redirect to `/account/profile?onboarding=true` with a banner: "Halo! Sebelum berbelanja, lengkapi nomor HP-mu agar checkout lebih mudah."

---

## INCOMPLETE FEATURE: Google User Password Status Unclear

**File**: `app/(store)/account/profile/page.tsx`  
**Severity**: MEDIUM  

**What's wrong**: The profile page conditionally shows "Ubah Password" or "Set Password" based on `profile.hasPassword`. But if the user registered via Google, they see "Set Password" — which is correct. However, there's no explanation why — the user might think they don't have a password because something went wrong.

**Fix**: Add a note below the form when `!profile.hasPassword`:
```tsx
<p className="text-xs text-text-secondary mt-2">
  Akunmu terdaftar via Google. Kamu bisa menambahkan password untuk bisa login dengan email juga.
</p>
```
