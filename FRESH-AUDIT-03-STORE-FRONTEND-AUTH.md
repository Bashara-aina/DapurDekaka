# AUDIT 03 — STORE FRONTEND & AUTH
**Date**: 2026-05-22 | **Branch**: currently on `fix/multiple-audit-fixes-may-2026`
**Scope**: Store pages, auth flows, middleware, components
**If 100 users hit this tomorrow**: Unauthenticated users can access B2B portal; 6 account pages have no loading state; most pages show hardcoded Indonesian strings instead of next-intl; Chinese characters leak into Indonesian UI.

---

## BUG-01 — CRITICAL: B2B Products Page Is Publicly Accessible

**File**: `app/middleware.ts:46`
**Severity**: CRITICAL — security gap

**What's wrong**: The middleware `matcher` config at line 46 is:
```ts
matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
```

The `/b2b/products` page is NOT in the matcher. The middleware checks at lines 31-38 only apply to routes that are matched. Since `/b2b/products` is not matched, the middleware never runs for that route, meaning the B2B products page is publicly accessible without authentication.

The route `app/(b2b)/b2b/products/page.tsx` has a `auth()` check inside it (line 119), but that's defense-in-depth — the primary protection (middleware) is missing.

**Fix** — Add `/b2b/products` to the matcher:
```ts
matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*', '/b2b/products/:path*'],
```

---

## BUG-02 — HIGH: Missing `pb-20 md:pb-0` on Account Pages

**File**: `app/(store)/account/page.tsx:60`, `app/(store)/account/orders/page.tsx:93`, `app/(store)/account/points/page.tsx:71`, `app/(store)/account/vouchers/page.tsx:50`
**Severity**: HIGH — bottom nav obscures content on mobile

**What's wrong**: The project rules mandate "Apply pb-20 md:pb-0 on all store pages for mobile bottom nav clearance." The account pages are missing this padding:

| Page | File | pb-20 md:pb-0 present? |
|------|------|------------------------|
| account/overview | account/page.tsx:60 | ❌ Missing (has `pb-24` but not `md:pb-0`) |
| account/orders | orders/page.tsx:93 | ❌ Missing |
| account/points | points/page.tsx:71 | ❌ Missing |
| account/vouchers | vouchers/page.tsx:50 | ❌ Missing |

**Fix**: Add `pb-20 md:pb-0` to the root wrapper div of each page:
```tsx
// Example — account/page.tsx root wrapper:
<div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
```

---

## BUG-03 — HIGH: Missing `loading.tsx` on Multiple Account Pages

**File**: `app/(store)/account/loading.tsx` (root layout), but missing per-page
**Severity**: HIGH — no skeleton loading states

**What's wrong**: The project rules mandate "Add loading.tsx for every route group." The account layout has `app/(store)/account/loading.tsx` (a root loading for all account sub-pages), but individual pages that fetch data server-side don't have their own `loading.tsx`:

| Page | loading.tsx exists? |
|------|---------------------|
| `app/(store)/account/page.tsx` | ❌ MISSING |
| `app/(store)/account/orders/page.tsx` | ❌ MISSING |
| `app/(store)/account/points/page.tsx` | ❌ MISSING |
| `app/(store)/account/vouchers/page.tsx` | ❌ MISSING |
| `app/(store)/account/profile/page.tsx` | ✅ EXISTS |

The root `account/loading.tsx` provides a loading skeleton for the layout navigation, but for data-heavy pages like `/account/orders` and `/account/points`, each page should have its own `loading.tsx` that matches the page's specific content structure.

**Fix**: Create `loading.tsx` files for each missing page, showing skeleton states appropriate to that page's content (order list, points chart, etc.).

---

## BUG-04 — HIGH: Missing `error.tsx` on All Account Sub-Pages

**File**: Multiple locations
**Severity**: HIGH — no custom error boundary

**What's wrong**: No account sub-page has an `error.tsx`:
- `app/(store)/account/error.tsx` — ❌ MISSING
- `app/(store)/account/orders/error.tsx` — ❌ MISSING
- `app/(store)/account/points/error.tsx` — ❌ MISSING
- `app/(store)/account/vouchers/error.tsx` — ❌ MISSING
- `app/(store)/account/profile/error.tsx` — ❌ MISSING

**Fix**: Create `error.tsx` files for each route, showing a user-friendly error message with a retry button.

---

## BUG-05 — HIGH: `/account/addresses` Route Does Not Exist

**File**: `app/(store)/account/layout.tsx:25`
**Severity**: HIGH — broken navigation link

**What's wrong**: The account layout has a nav item at line 25 linking to `/account/addresses`:
```tsx
<Link href="/account/addresses" ...>
  <MapPin className="w-4 h-4" />
  Alamat
</Link>
```

This route does not exist. Any user who clicks "Alamat" in the account sidebar gets a 404. There is no `app/(store)/account/addresses/page.tsx`.

**Fix**: Either create the addresses management page (`app/(store)/account/addresses/page.tsx`) with full CRUD for saved addresses, OR remove the nav item from the layout if addresses management is not yet built.

---

## BUG-06 — MEDIUM: Hardcoded Strings Everywhere — No next-intl

**File**: All store and auth pages
**Severity**: MEDIUM — i18n incomplete

**What's wrong**: The project rules mandate "Never hardcode Indonesian/English strings in components — use next-intl." The only store component using `useTranslations()` is `BottomNav.tsx`. Every other page has hardcoded strings:

- `app/(store)/account/layout.tsx:23–80` — All nav labels hardcoded (`'Overview', 'Pesanan', 'Alamat', 'Poin', 'Voucher', 'Profil', 'Keluar'`)
- `app/(store)/account/page.tsx` — All strings hardcoded
- `app/(store)/account/orders/page.tsx` — All strings hardcoded
- `app/(store)/account/points/page.tsx` — All strings hardcoded
- `app/(store)/account/vouchers/page.tsx` — All strings hardcoded
- `app/(store)/account/profile/page.tsx` — All strings hardcoded
- `app/(store)/blog/page.tsx` — All strings hardcoded
- `app/(auth)/login/page.tsx` — All strings hardcoded
- `app/(auth)/register/page.tsx` — All strings hardcoded
- `app/(auth)/reset-password/[token]/page.tsx` — All strings hardcoded

This is a massive migration task. Priority should be given to the pages users interact with most: login, register, account pages.

**Fix**: For each page, import `useTranslations` from `next-intl` and replace all hardcoded strings with translation keys. The translation files exist at `i18n/messages/id.json` and `i18n/messages/en.json`.

---

## BUG-07 — MEDIUM: Chinese Character Leak in Vouchers Page

**File**: `app/(store)/account/vouchers/page.tsx:70`
**Severity**: MEDIUM — UI contamination

**What's wrong**: Line 70 has:
```tsx
'Tidak perlu输入kode.'
```
The Chinese character `输入` (meaning "enter/input") leaked into the Indonesian UI. It should be `'Tidak perlu masukkan kode.'`

---

## BUG-08 — MEDIUM: Language Toggle in Profile is Non-Functional Placeholder

**File**: `app/(store)/account/profile/page.tsx:377`
**Severity**: MEDIUM — misleading UX

**What's wrong**: The profile page shows a language preference section with:
- `🇮🇩 Indonesia` label
- A badge saying `"Bahasa Inggris segera hadir"` (English coming soon)
- The toggle is display-only — clicking it does nothing

This is a documented placeholder, but it gives users the impression that language switching is about to be implemented when it's not. Users may try to toggle it and be confused.

**Fix**: Either remove the language toggle entirely until it's implemented, or show it as disabled with a tooltip "Coming soon" instead of a misleading badge.

---

## BUG-09 — MEDIUM: HeroCarousel Empty State Has Hardcoded Brand Text

**File**: `components/store/home/HeroCarousel.tsx:60–71`
**Severity**: MEDIUM — next-intl violation

**What's wrong**: The empty state fallback for the carousel has hardcoded brand text:
```tsx
<div className="absolute inset-0 bg-gradient-to-r from-brand-red to-brand-red-dark flex items-center justify-center">
  <div className="text-center text-white">
    <h2 className="text-4xl font-display mb-4">Cita Rasa Warisan, kini di Rumahmu</h2>
    <Link href="/products" className="px-8 py-3 bg-white text-brand-red font-bold rounded-full hover:bg-brand-cream">
      Lihat Produk
    </Link>
  </div>
</div>
```

**Fix**: Use `useTranslations()` and replace with `{t('hero.empty_cta')}` style keys.

---

## BUG-10 — MEDIUM: InstagramFeed Hardcoded Indonesian Strings

**File**: `components/store/home/InstagramFeed.tsx:23–36`
**Severity**: MEDIUM — next-intl violation

**What's wrong**: Lines 23-36 have hardcoded strings like:
- `'Galeri Kami'`
- `'Koleksi foto produk dan momen dari dapur kami'`
- `'Follow @dapurdekaka'`

---

## BUG-11 — MEDIUM: BlogSearchForm Hardcoded Strings

**File**: `components/store/blog/BlogSearchForm.tsx:35–44`
**Severity**: MEDIUM — next-intl violation

**What's wrong**: Search form has hardcoded strings: `'Cari artikel...'`, `'Mencari...'`, `'Cari'`

---

## BUG-12 — MEDIUM: QuoteForm Hardcoded Strings + Typo

**File**: `components/b2b/QuoteForm.tsx:12, all`
**Severity**: MEDIUM — next-intl violation + typo

**What's wrong**:
1. All form strings are hardcoded (name, email, phone labels, button text, error messages)
2. Line 12 has a typo in VOLUME_OPTIONS:
```ts
{ value: '10-20-juta', label: 'Rp 20 - 20 juta/bulan' }
// Should be:
{ value: '10-20-juta', label: 'Rp 10 - 20 juta/bulan' }
```

---

## BUG-13 — MEDIUM: B2B Products Page Missing loading.tsx and error.tsx

**File**: `app/(b2b)/b2b/products/page.tsx`
**Severity**: MEDIUM — no loading/error states

**What's wrong**: The B2B products page has no `loading.tsx` or `error.tsx`. Also `pb-20 md:pb-0` is missing — the page only has `pb-20` (line 126).

---

## BUG-14 — LOW: Dead Code — `setGoogleLoading(false)` in Login

**File**: `app/(auth)/login/page.tsx:108`
**Severity**: LOW — dead code

**What's wrong**: Line 108 has `setGoogleLoading(false)` which will never execute because `signIn('google')` causes a redirect (expected behavior). This is dead code.

---

## BUG-15 — LOW: `User` Icon Used as Wrapper Div

**File**: `app/(store)/account/page.tsx:79`
**Severity**: LOW — semantic error

**What's wrong**: The User icon import at line 8 is used as a JSX wrapper `<User ...>` without being rendered as an icon. It looks like a copy-paste error where the profile completion banner expects a User icon but it's incorrectly used as a wrapper div.

---

## INCOMPLETE FEATURE: Blog Page Missing loading.tsx and error.tsx

**File**: `app/(store)/blog/page.tsx`
**Severity**: HIGH — Next.js will provide default loader

**What's wrong**: No `loading.tsx` at `app/(store)/blog/loading.tsx` and no `error.tsx` at `app/(store)/blog/error.tsx`. The blog page fetches data and should have proper loading states showing skeleton cards.

---

## INCOMPLETE FEATURE: Reset Password Token API

**File**: `app/api/auth/forgot-password/route.ts`
**Severity**: MEDIUM — verify implementation

**What's wrong**: The forgot-password API route should handle both password reset request (generate token) and password reset confirmation (consume token). The reset-password page at `app/(auth)/reset-password/[token]/page.tsx` POSTs to `/api/auth/reset-password` — verify this route exists and handles both `action=forgot` and `action=reset` based on request body.

---

## VERIFIED OK (No Action Needed)

1. **HeroCarousel.tsx** — Framer Motion with dynamic import, image error fallback, empty state — well implemented
2. **InstagramFeed.tsx** — 6 static Cloudinary images, `next/image`, hover effects, external link security ✅
3. **BlogSearchForm.tsx** — Uses `useTransition`, preserves category, proper loading state ✅
4. **Login page** — Google OAuth + credentials, cart merge, proper error handling ✅
5. **Register page** — Auto-login after registration, terms acceptance, Google OAuth ✅
6. **Reset password page** — Token validation, password confirmation, success state ✅
7. **RSS feed** — Valid RSS 2.0, proper XML escaping, cache headers ✅

---

## Priority Summary

| ID | Severity | File | Issue |
|----|----------|------|-------|
| BUG-01 | CRITICAL | middleware.ts:46 | `/b2b/products` not in matcher — route unprotected |
| BUG-02 | HIGH | account/page.tsx:60, orders/points/vouchers | Missing `pb-20 md:pb-0` on 4 account pages |
| BUG-03 | HIGH | account/page.tsx, orders, points, vouchers | Missing `loading.tsx` on 4 account pages |
| BUG-04 | HIGH | account/error.tsx, orders/points/vouchers/error | Missing `error.tsx` on all account sub-pages |
| BUG-05 | HIGH | account/layout.tsx:25 | `/account/addresses` nav item 404s |
| BUG-06 | MEDIUM | ALL store/auth pages | All strings hardcoded — no next-intl (massive task) |
| BUG-07 | MEDIUM | account/vouchers/page.tsx:70 | Chinese character `输入` in Indonesian UI |
| BUG-08 | MEDIUM | account/profile/page.tsx:377 | Language toggle is non-functional placeholder |
| BUG-09 | MEDIUM | HeroCarousel.tsx:60 | Hardcoded brand text in empty state |
| BUG-10 | MEDIUM | InstagramFeed.tsx:23 | Hardcoded Indonesian strings |
| BUG-11 | MEDIUM | BlogSearchForm.tsx:35 | Hardcoded strings |
| BUG-12 | MEDIUM | QuoteForm.tsx:12 | VOLUME_OPTIONS label typo + hardcoded strings |
| BUG-13 | MEDIUM | b2b/products/page.tsx | Missing loading/error.tsx + missing `md:pb-0` |
| BUG-14 | LOW | login/page.tsx:108 | Dead code `setGoogleLoading(false)` |
| BUG-15 | LOW | account/page.tsx:79 | `User` icon used as wrapper div |
| MF-01 | HIGH | blog/loading.tsx, blog/error.tsx | Missing loading/error for blog |
| MF-02 | MEDIUM | forgot-password/route.ts | Verify token API completeness |