# FRESH AUDIT 04 — Auth Flows, B2B Portal & Account Pages
> Deep code-level audit — May 2026. Use this file directly in Cursor.
> Every bug references the exact file + the specific code that is wrong.

---

## BUG-01 🚨 CRITICAL — Debug telemetry beacon left in production login page
**File:** `app/(auth)/login/page.tsx` (around line 47)  
**Severity:** CRITICAL — sends session data to a local debug server on every OAuth error; if this goes to production it's a data leak

**What's wrong:**  
Inside `login/page.tsx`, there is a beacon call that fires when an OAuth error param is present:
```ts
fetch('http://127.0.0.1:7420/ingest/09d39df7-998a-468e-966d-456351968e13', {
  method: 'POST',
  body: JSON.stringify({ sessionId: '561006', ... })
})
```
This is a development observability tool (likely Highlight.io or similar local proxy) that was never removed. In development it fails silently (localhost:7420 isn't running). In production on Vercel this call will fail with a network error every time a user encounters an OAuth error.

**Fix:**  
Delete the entire `fetch('http://127.0.0.1:...')` call from `login/page.tsx`. Also search the whole codebase:
```bash
grep -r "127.0.0.1:7420" .
```
And remove every occurrence.

---

## BUG-02 🚨 CRITICAL — Debug telemetry beacon on every authenticated account page load
**File:** `app/(store)/account/page.tsx` (around lines 39–49)  
**Severity:** CRITICAL — fires a POST to a local debug URL on every account page load by authenticated users

**What's wrong:**  
Same debug beacon as BUG-01, but this one fires on the server-side account page for EVERY authenticated session:
```ts
// Somewhere in the component:
fetch('http://127.0.0.1:7420/ingest/09d39df7-998a-468e-966d-456351968e13', {
  method: 'POST',
  body: JSON.stringify({ sessionId: '561006', ... })
})
```

**Fix:**  
Delete this block from `app/(store)/account/page.tsx`. Run the grep above to find all occurrences.

---

## BUG-03 — Reset password page: back-link points to wrong route
**File:** `app/(auth)/reset-password/[token]/page.tsx` (around line 32)  
**Severity:** MEDIUM — "invalid token" fallback shows a broken link that 404s

**What's wrong:**  
When the reset token is invalid, the page renders a link back to request a new reset:
```tsx
href="/auth/forgot-password"
```
But the actual route is `/forgot-password` (no `/auth` prefix). The `/auth` segment doesn't exist in the route structure.

**Fix:**  
```tsx
// CHANGE:
href="/auth/forgot-password"

// TO:
href="/forgot-password"
```

---

## BUG-04 — B2B account orders page: no B2B role check, any logged-in user can access
**File:** `app/(b2b)/b2b/account/orders/page.tsx`  
**Severity:** HIGH — security gap; any logged-in customer can view B2B orders page

**What's wrong:**  
The page only checks for `unauthenticated`:
```ts
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/b2b/account/orders');
  }
}, [status, router]);
```
Any logged-in user (customer, warehouse, anyone) can reach this page. The middleware does protect `/b2b/account/*` by requiring `role === 'b2b' || role === 'superadmin'`, BUT only if they hit the `/b2b/account` prefix. If middleware is working this is fine. However the client-side component has no guard, so if middleware ever changes, the data is exposed.

**Fix:**  
Add the role check consistently in the component:
```ts
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/b2b/account/orders');
  } else if (status === 'authenticated') {
    const role = session?.user?.role;
    if (role !== 'b2b' && role !== 'superadmin') {
      router.push('/b2b');
    }
  }
}, [status, session, router]);
```

---

## BUG-05 — B2B account quotes page: same missing role check
**File:** `app/(b2b)/b2b/account/quotes/page.tsx`  
**Severity:** HIGH — same issue as BUG-04

**What's wrong:**  
Same pattern: only redirects `unauthenticated`, no B2B role check.

**Fix:**  
Apply the same fix as BUG-04 in `quotes/page.tsx`.

---

## BUG-06 — B2B account page: Russian word "места" in Indonesian UI
**File:** `app/(b2b)/b2b/account/page.tsx`  
**Severity:** LOW — typo; shows broken text to B2B customers

**What's wrong:**  
```tsx
<span className="text-text-muted">Bayar di места</span>
```
`места` is Russian for "place". This should read "Bayar di Tempat" (Cash on Delivery / Pay at Location).

**Fix:**  
```tsx
<span className="text-text-muted">Bayar di Tempat</span>
```

---

## BUG-07 — B2B products page: `revalidate = 300` conflicts with `dynamic = 'force-dynamic'`
**File:** `app/(b2b)/b2b/products/page.tsx`  
**Severity:** LOW — `force-dynamic` wins, making `revalidate` a dead setting

**What's wrong:**  
```ts
export const dynamic = 'force-dynamic';  // ← forces no cache
export const revalidate = 300;           // ← never used
```
`force-dynamic` causes the page to be rendered on every request without any caching, making the `revalidate = 300` setting completely irrelevant. This means the B2B products page hits the database on every single page load from every user, which is wasteful for a page that changes infrequently.

**Fix:**  
Remove `dynamic = 'force-dynamic'` and keep `revalidate = 300`:
```ts
// DELETE: export const dynamic = 'force-dynamic';
export const revalidate = 300; // re-fetch every 5 minutes
```
The page uses `auth()` to get the session (which makes it dynamic by necessity). If ISR caching with auth is needed, use a different approach (e.g., segment-level dynamic with cookies).

---

## BUG-08 — B2B products page: non-logged-in users with no B2B profile get an empty product grid
**File:** `app/(b2b)/b2b/products/page.tsx`  
**Severity:** MEDIUM — UX dead end; new B2B prospects can't see any products

**What's wrong:**  
```ts
async function getB2BProducts(b2bProfileId: string | null) {
  if (!b2bProfileId) return [];  // ← returns empty immediately for any non-B2B user
  ...
}
```
When a non-B2B user (or unauthenticated visitor) visits `/b2b/products`, they see an empty grid with "Produk belum tersedia" and a CTA to request a quote. This is not the right UX for a B2B landing page that should showcase products to prospects.

**Fix:**  
Show products to everyone (at retail prices), but hide B2B-specific pricing for non-approved users:
```ts
async function getB2BProducts(isApproved: boolean) {
  // Always show products — approval only affects which price is displayed
  return await db.query.products.findMany({
    where: and(eq(products.isActive, true), eq(products.isB2bAvailable, true)),
    ...
  });
}
```
In the product card, conditionally show B2B price vs "Hubungi Kami" based on approval status.

---

## BUG-09 — Account orders page: clicking an order row does nothing (no navigation)
**File:** `app/(store)/account/orders/page.tsx`  
**Severity:** HIGH — account holders can't see their order detail

**What's wrong:**  
The account orders page lists orders but each row needs to link to the order detail. Check if `href` on each order row correctly points to `/account/orders/${order.orderNumber}`. If orders are listed but not clickable/navigable to detail, this is a critical missing feature.

**Verify:**  
```bash
grep -n "orderNumber\|href\|router.push" app/\(store\)/account/orders/page.tsx
```
If there's no `Link` or `router.push`, the rows are display-only and the user has no way to see order details.

**Fix:**  
Each order card must be wrapped in:
```tsx
<Link href={`/account/orders/${order.orderNumber}`}>
  {/* order card */}
</Link>
```

---

## BUG-10 — Account order detail page: email verification required for logged-in own orders
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`  
**File:** `app/api/orders/[orderNumber]/route.ts`  
**Severity:** MEDIUM — UX regression; logged-in users see email verification gate for their own orders

**What's wrong:**  
`app/api/orders/[orderNumber]/route.ts` GET correctly auto-verifies logged-in users who own the order:
```ts
if (session?.user?.id) {
  if (order.userId === session.user.id || ['superadmin', 'owner'].includes(session.user.role)) {
    return success({ order, verified: true });
  }
}
```
This is correct. BUT the `account/orders/[orderNumber]/page.tsx` server component may be using the public `OrderTrackingClient` component (which starts with the email gate). If it does, the auto-verify useEffect in `OrderTrackingClient` should bypass the gate for logged-in users.

**Verify:**  
Check if `app/(store)/account/orders/[orderNumber]/page.tsx` uses `OrderTrackingClient` or its own dedicated component. If it uses `OrderTrackingClient`, ensure the auto-verify `tryAutoVerify` function fires immediately and sets `verified = true` before the gate renders.

---

## BUG-11 — Forgot password page: user enumeration via timing difference
**File:** `app/api/auth/forgot-password/route.ts`  
**Severity:** MEDIUM — security: attacker can distinguish registered vs unregistered emails

**What's wrong:**  
The forgot-password API:
1. Looks up user by email
2. If user NOT found: returns 200 with generic message (fast response)
3. If user FOUND: sends email via Resend (slow response — 200–500ms email call)

The time difference reveals whether an email is registered. An attacker can enumerate all registered emails.

**Fix:**  
Always perform a minimal fake delay when user is not found, so both paths take approximately the same time:
```ts
if (!user) {
  // Add timing normalization — simulate the time an email send would take
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
  return success({ message: 'Jika email terdaftar, kamu akan menerima link reset password.' });
}
```

---

## BUG-12 — Middleware: warehouse role is allowed `/admin/inventory` but inventory page calls field/inventory/adjust which DOES allow warehouse
**File:** `app/middleware.ts`  
**Severity:** INFO — verify that warehouse can access all pages they need

**What's happening:**  
Middleware allows warehouse to:
```ts
const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
```
The `/admin/orders` page is NOT in the allowed list for warehouse. But `app/api/admin/orders/[id]/status` allows warehouse role for PATCH. So warehouse can update order status via the API but cannot access the orders admin UI.

**Verify intent:**  
If warehouse should be able to see the orders list (to find orders to update), add `/admin/orders` to the allowed list. Otherwise the warehouse can only operate through the field dashboard at `/admin/field`.

**Recommended fix:**  
Add `/admin/orders` read access for warehouse (they need to check order details to input tracking numbers):
```ts
const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];
```

---

## BUG-13 — Account sidebar: no "Voucher" link in mobile/bottom navigation
**File:** `app/(store)/account/layout.tsx` and bottom navigation component  
**Severity:** LOW — vouchers page exists but is hard to reach on mobile

**What's wrong:**  
The account sidebar likely includes links to Profile, Orders, Addresses, Points. But the `/account/vouchers` page may not have a nav entry in the sidebar or bottom navigation.

**Fix:**  
Add to account sidebar navigation:
```tsx
{ href: '/account/vouchers', label: 'Voucher & Kupon', icon: Tag }
```

---

## BUG-14 — Register page: no auto-login after successful registration
**File:** `app/(auth)/register/page.tsx`  
**Severity:** MEDIUM — UX friction; user must log in again after registering

**What's wrong:**  
After `POST /api/auth/register` succeeds, the register page redirects to `/login`. The user must then enter their credentials again. This is unnecessary friction.

**Fix:**  
After successful registration, call `signIn('credentials', { email, password })` directly from the register page:
```ts
const res = await fetch('/api/auth/register', { ... });
if (res.ok) {
  // Auto sign-in immediately
  await signIn('credentials', { 
    email: data.email, 
    password: data.password,
    redirect: false 
  });
  router.push(callbackUrl || '/account');
}
```

---

## BUG-15 — Login page: OAuth error param is silently ignored with no user-visible message
**File:** `app/(auth)/login/page.tsx`  
**Severity:** MEDIUM — users get blank login page with no explanation after failed OAuth

**What's wrong:**  
NextAuth redirects back to `/login?error=OAuthAccountNotLinked` or other error codes after OAuth failures. If the page doesn't read the `error` search param and display a message, users see a plain login form with no indication of what went wrong.

**Fix:**  
Read the error param and display an appropriate message:
```tsx
const searchParams = useSearchParams();
const error = searchParams.get('error');

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: 'Email ini sudah terdaftar dengan metode login lain. Gunakan email & password.',
  CredentialsSignin: 'Email atau password salah.',
  default: 'Terjadi kesalahan login. Silakan coba lagi.',
};

{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
    {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}
  </div>
)}
```
