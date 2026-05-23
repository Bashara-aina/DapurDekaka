# AUDIT 08 — MISSING LOADING/ERROR FILES CONSOLIDATED
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** All route groups — `loading.tsx` and `error.tsx` coverage audit
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## Purpose

CURSOR_RULES.md Section 8: "Add loading.tsx and error.tsx for every route group." This audit consolidates ALL missing or broken `loading.tsx` and `error.tsx` files across the entire project into a single actionable checklist.

---

## 🔴 CRITICAL

### C-01: `app/(auth)/` Route Group — No loading.tsx or error.tsx

**Files missing:**
- `app/(auth)/login/loading.tsx` ❌
- `app/(auth)/login/error.tsx` ❌
- `app/(auth)/register/loading.tsx` ❌
- `app/(auth)/register/error.tsx` ❌
- `app/(auth)/forgot-password/loading.tsx` ❌
- `app/(auth)/forgot-password/error.tsx` ❌
- `app/(auth)/reset-password/[token]/loading.tsx` ❌
- `app/(auth)/reset-password/[token]/error.tsx` ❌

**Issue:** All auth pages will show blank page or Next.js skeleton while loading. Errors show Next.js default error UI instead of branded error handling.

**Fix:** Create 8 files with appropriate content. The `loading.tsx` files should show a centered card skeleton. The `error.tsx` files should show a branded error with "Kembali ke Login" or similar CTA.

**Template for auth loading.tsx:**
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginLoading() {
 return (
 <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
 <div className="w-full max-w-md space-y-6">
 <Skeleton className="h-8 w-48 mx-auto" />
 <div className="space-y-4">
 <Skeleton className="h-12 w-full rounded-lg" />
 <Skeleton className="h-12 w-full rounded-lg" />
 <Skeleton className="h-12 w-full rounded-lg" />
 </div>
 </div>
 </div>
 );
}
```

**Template for auth error.tsx:**
```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LoginError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 console.error(error);
 }, [error]);

 return (
 <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
 <div className="text-center space-y-4">
 <h2 className="text-2xl font-display text-text-primary">Terjadi Kesalahan</h2>
 <p className="text-text-secondary">Silakan coba lagi.</p>
 <div className="flex gap-3 justify-center">
 <button
 onClick={reset}
 className="px-6 py-3 bg-brand-red text-white rounded-lg font-body"
 >
 Coba Lagi
 </button>
 <Link
 href="/login"
 className="px-6 py-3 bg-white border border-brand-red text-brand-red rounded-lg font-body"
 >
 Kembali ke Login
 </Link>
 </div>
 </div>
 </div>
 );
}
```

---

### C-02: Account Sub-pages — Missing error.tsx Files

**Files missing:**
- `app/(store)/account/addresses/error.tsx` ❌
- `app/(store)/account/points/error.tsx` ❌
- `app/(store)/account/vouchers/error.tsx` ❌
- `app/(store)/account/profile/error.tsx` ❌

**Also missing:**
- `app/(store)/account/loading.tsx` ❌ (parent account page)

**Fix:** Create 5 files using the store error/loading pattern. The error.tsx should use the EmptyState-style sad bowl illustration + message + retry CTA. The loading.tsx should show a skeleton matching the page layout.

---

### C-03: `app/(store)/orders/success/[orderNumber]/` — No page.tsx

**File missing:** `app/(store)/orders/success/[orderNumber]/page.tsx` ❌

**Issue:** Only `loading.tsx` exists. Navigating to `/orders/success/[orderNumber]` returns a 404. This is a CRITICAL broken flow — after payment, customers cannot see their order confirmation.

**Fix:** Create `page.tsx` that:
1. Fetches order data by `orderNumber` and `email` (for guest) or session (for logged-in)
2. Displays order confirmation with items, total, points earned
3. Shows courier/delivery info
4. Has CTA buttons to "Lihat Pesanan" and "Kembali ke Beranda"

---

### C-04: `app/(admin)/admin/products/new/` — No loading.tsx or error.tsx

**Files missing:**
- `app/(admin)/admin/products/new/loading.tsx` ❌
- `app/(admin)/admin/products/new/error.tsx` ❌

**Fix:** Create both files. The loading.tsx should show a skeleton matching the `ProductForm` layout. The error.tsx should use the admin error pattern.

---

### C-05: `app/(store)/about/` — No loading.tsx

**File missing:** `app/(store)/about/loading.tsx` ❌

**Fix:** Create `app/(store)/about/loading.tsx`.

---

## 🟠 HIGH

### H-01: `app/(store)/account/addresses/` — Inline Loading Instead of loading.tsx

**File:** `app/(store)/account/addresses/page.tsx` lines 143–151

**Issue:** Loading state is rendered inline inside the page component. Should be in a sibling `loading.tsx` file.

**Fix:** Move skeleton content to `app/(store)/account/addresses/loading.tsx` and remove inline loading check from the page component.

---

### H-02: `app/(store)/account/points/` — Inline Loading Instead of loading.tsx

**File:** `app/(store)/account/points/page.tsx` lines 54–61

**Fix:** Move to `loading.tsx`.

---

### H-03: Multiple Admin Pages — Plain Text Loading Fallback

**Files:**
- `app/(admin)/admin/settings/loading.tsx` ❌ — line 127 uses plain text "Memuat..."
- `app/(admin)/admin/users/loading.tsx` ❌ — line 158 uses plain text
- `app/(admin)/admin/testimonials/loading.tsx` ❌ — no route-level loading.tsx
- `app/(admin)/admin/b2b-inquiries/[id]/loading.tsx` ❌ — no loading.tsx for detail

**Fix:** Create proper loading.tsx files using shadcn/ui Skeleton component for each.

---

### H-04: Checkout Failed Page — FIX 8 Comment Indicates Placeholder

**File:** `app/(store)/checkout/failed/page.tsx` lines 59–61

```typescript
// FIX 8: Cart restored with stock=0 may block addItem — use 999
```

**Issue:** A numbered "FIX 8" comment implies a known issue was worked around with a placeholder. This needs root cause investigation and a proper fix.

**Fix:** Investigate the stock=0 issue. Either fix properly or document why the workaround is acceptable.

---

### H-05: `app/(store)/account/orders/error.tsx` — Missing

**File missing:** `app/(store)/account/orders/error.tsx` ❌

**Fix:** Create `error.tsx` using the store error pattern.

---

## 🟡 MEDIUM

### M-01: `app/(store)/checkout/pending/page.tsx` — Countdown Timer UseEffect

**File:** `app/(store)/checkout/pending/page.tsx` lines 96–98

**Issue:** `updateCountdown` is recreated on each render (not in `useCallback`), causing the interval to reference stale closures. Minor memory leak risk.

**Fix:** Wrap `updateCountdown` in `useCallback`:
```typescript
const updateCountdown = useCallback(() => {
 setTimeLeft(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
}, [expiresAt]);

useEffect(() => {
 const interval = setInterval(updateCountdown, 1000);
 return () => clearInterval(interval);
}, [updateCountdown]);
```

---

### M-02: Checkout Pending Page — No Auto-Navigate on Expiry

**File:** `app/(store)/checkout/pending/page.tsx`

**Issue:** The countdown timer displays but doesn't trigger any action when it reaches 0. User must manually click "Bayar Lagi" after expiry.

**Fix:** Add a `useEffect` that watches `timeLeft` and navigates to retry when it hits 0:
```typescript
useEffect(() => {
 if (timeLeft === 0) {
 router.push(`/checkout/retry?orderId=${orderId}`);
 }
}, [timeLeft, router, orderId]);
```

---

### M-03: `app/(store)/orders/loading.tsx` — Verify It Exists

**File:** `app/(store)/orders/loading.tsx` — confirmed exists ✅ (from git status)

**Status:** OK.

---

### M-04: `app/(store)/orders/success/loading.tsx` — Verify It Exists

**File:** `app/(store)/orders/success/loading.tsx` — confirmed exists ✅ (from git status)

**Status:** OK.

---

## 🟢 LOW — Already OK

| File | Status |
|------|--------|
| `app/(store)/page.tsx` loading.tsx | ✅ EXISTS |
| `app/(store)/products/loading.tsx` | ✅ EXISTS |
| `app/(store)/cart/loading.tsx` | ✅ EXISTS (via parent?) |
| `app/(store)/account/loading.tsx` | ❌ MISSING (see C-02) |
| `app/(store)/account/error.tsx` | ✅ EXISTS |
| `app/(store)/account/addresses/loading.tsx` | ✅ EXISTS (git status shows) |
| `app/(store)/account/addresses/error.tsx` | ❌ MISSING (see C-02) |
| `app/(store)/account/orders/loading.tsx` | ✅ EXISTS (git status shows) |
| `app/(store)/account/orders/error.tsx` | ❌ MISSING (see H-05) |
| `app/(store)/account/points/loading.tsx` | ✅ EXISTS (git status shows) |
| `app/(store)/account/points/error.tsx` | ❌ MISSING (see C-02) |
| `app/(store)/account/vouchers/loading.tsx` | ✅ EXISTS (git status shows) |
| `app/(store)/account/vouchers/error.tsx` | ❌ MISSING (see C-02) |
| `app/(store)/checkout/loading.tsx` | ✅ EXISTS |
| `app/(store)/checkout/error.tsx` | ✅ EXISTS |
| `app/(store)/checkout/success/loading.tsx` | ✅ EXISTS (git status shows) |
| `app/(store)/orders/loading.tsx` | ✅ EXISTS |
| `app/(store)/orders/[orderNumber]/loading.tsx` | ✅ EXISTS |
| `app/(store)/orders/[orderNumber]/error.tsx` | ✅ EXISTS |
| `app/(store)/orders/success/[orderNumber]/loading.tsx` | ✅ EXISTS |
| `app/(store)/orders/success/[orderNumber]/page.tsx` | ❌ MISSING (see C-03) |
| `app/(store)/blog/loading.tsx` | ✅ EXISTS |
| `app/(store)/blog/error.tsx` | ✅ EXISTS |
| `app/(store)/refund-policy/loading.tsx` | ✅ EXISTS |
| `app/(store)/refund-policy/error.tsx` | ✅ EXISTS |
| `app/(store)/privacy-policy/loading.tsx` | ✅ EXISTS |
| `app/(store)/privacy-policy/error.tsx` | ✅ EXISTS |
| `app/(admin)/admin/**/loading.tsx` | Multiple MISSING (see H-03) |
| `app/(auth)/**/loading.tsx` | ALL MISSING (see C-01) |
| `app/(auth)/**/error.tsx` | ALL MISSING (see C-01) |

---

## COMPLETE ACTION CHECKLIST

### Create These Files (Priority Order):

**CRITICAL (create today):**
- [ ] `app/(auth)/login/loading.tsx`
- [ ] `app/(auth)/login/error.tsx`
- [ ] `app/(auth)/register/loading.tsx`
- [ ] `app/(auth)/register/error.tsx`
- [ ] `app/(auth)/forgot-password/loading.tsx`
- [ ] `app/(auth)/forgot-password/error.tsx`
- [ ] `app/(auth)/reset-password/[token]/loading.tsx`
- [ ] `app/(auth)/reset-password/[token]/error.tsx`
- [ ] `app/(store)/account/loading.tsx`
- [ ] `app/(store)/account/addresses/error.tsx`
- [ ] `app/(store)/account/points/error.tsx`
- [ ] `app/(store)/account/vouchers/error.tsx`
- [ ] `app/(store)/account/profile/error.tsx`
- [ ] `app/(store)/orders/success/[orderNumber]/page.tsx` ← **CRITICAL: this breaks order confirmation**
- [ ] `app/(admin)/admin/products/new/loading.tsx`
- [ ] `app/(admin)/admin/products/new/error.tsx`
- [ ] `app/(store)/about/loading.tsx`

**HIGH (create this week):**
- [ ] Move inline loading from `account/addresses/page.tsx` → `account/addresses/loading.tsx`
- [ ] Move inline loading from `account/points/page.tsx` → `account/points/loading.tsx`
- [ ] `app/(admin)/admin/settings/loading.tsx`
- [ ] `app/(admin)/admin/users/loading.tsx`
- [ ] `app/(admin)/admin/testimonials/loading.tsx`
- [ ] `app/(admin)/admin/b2b-inquiries/[id]/loading.tsx`
- [ ] `app/(store)/account/orders/error.tsx`
- [ ] Investigate FIX 8 in `checkout/failed/page.tsx`

**MEDIUM:**
- [ ] Fix `checkout/pending/page.tsx` countdown useEffect cleanup (useCallback)
- [ ] Add auto-navigate on expiry in checkout/pending/page.tsx

---

## SUMMARY

| ID | Severity | Files Affected | Issue | Fix Action |
|----|----------|---------------|-------|------------|
| C-01 | 🔴 CRITICAL | 8 files in `app/(auth)/` | No loading.tsx or error.tsx for any auth route | Create all 8 files |
| C-02 | 🔴 CRITICAL | 5 files in `account/` sub-pages | Missing error.tsx for addresses/points/vouchers/profile + loading.tsx | Create all 5 files |
| C-03 | 🔴 CRITICAL | `orders/success/[orderNumber]/page.tsx` | No page.tsx — order confirmation 404 | Create page.tsx |
| C-04 | 🔴 CRITICAL | `products/new/` | No loading.tsx or error.tsx | Create both files |
| C-05 | 🔴 CRITICAL | `about/loading.tsx` | No loading.tsx | Create file |
| H-01 | 🟠 HIGH | `account/addresses/page.tsx` | Inline loading instead of loading.tsx | Move to loading.tsx |
| H-02 | 🟠 HIGH | `account/points/page.tsx` | Inline loading instead of loading.tsx | Move to loading.tsx |
| H-03 | 🟠 HIGH | 4 admin pages | Plain text loading fallback | Create loading.tsx with Skeleton |
| H-04 | 🟠 HIGH | `checkout/failed/page.tsx:59` | FIX 8 comment — placeholder stock | Investigate root cause |
| H-05 | 🟠 HIGH | `account/orders/error.tsx` | Missing error.tsx | Create file |
| M-01 | 🟡 MEDIUM | `checkout/pending/page.tsx:96` | useEffect cleanup issue | Add useCallback |
| M-02 | 🟡 MEDIUM | `checkout/pending/page.tsx` | No auto-navigate on expiry | Add router.push in useEffect |
| M-03 | 🟡 MEDIUM | Multiple pages | Verify loading.tsx coverage | Full sweep + create missing |

**Total: 5 CRITICAL · 5 HIGH · 2 MEDIUM**