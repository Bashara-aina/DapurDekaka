# AUDIT 01 — STORE FRONTEND
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** `app/(store)/`, `components/store/`, `store/`
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## 🔴 CRITICAL

### C-01: Missing `error.tsx` for Account Sub-pages

**Files:** `app/(store)/account/addresses/error.tsx`, `app/(store)/account/points/error.tsx`, `app/(store)/account/vouchers/error.tsx`, `app/(store)/account/profile/error.tsx`

**Issue:** These four route groups have **no `error.tsx`**. If a data fetch fails inside these pages, Next.js will render the root `global-error.tsx` instead of a contextual error boundary.

**Expected:** Create each `error.tsx` using the store's branded error UI pattern (empty state with sad dimsum illustration + message + retry CTA).

**Action:** Create 4 new error boundary files.

---

### C-02: Missing `loading.tsx` for Account Root Page

**Files:** `app/(store)/account/loading.tsx`

**Issue:** `app/(store)/account/page.tsx` has no `loading.tsx` sibling. Per CURSOR_RULES.md Section 8: every route group must have `loading.tsx`. The `account/` route is the parent layout — without it, navigation to `/account` during data fetch shows a blank page instead of a branded skeleton.

**Expected:** Create `app/(store)/account/loading.tsx`.

**Action:** Create `app/(store)/account/loading.tsx`.

---

### C-03: Missing `loading.tsx` for About Page

**Files:** `app/(store)/about/loading.tsx`

**Issue:** `about/` route group has no `loading.tsx`.

**Action:** Create `app/(store)/about/loading.tsx`.

---

### C-04: Duplicate `formatIDR` in `VoucherCard.tsx`

**File:** `components/store/account/VoucherCard.tsx`, lines 12–19

```typescript
function formatIDR(value: number): string {
 const formatted = value.toLocaleString('id-ID');
 return `Rp ${formatted}`;
}
```

**Issue:** This local function is a duplicate of `@/lib/utils/format-currency`. If the canonical implementation ever changes (e.g., adds currency symbol customization), this one diverges silently. Every other component correctly imports from the canonical path.

**Expected:** Replace with `import { formatIDR } from '@/lib/utils/format-currency'` and remove the local function.

**Action:** Edit `VoucherCard.tsx` to remove local `formatIDR`, add import from canonical path.

---

### C-05: Duplicate `formatIDR` in `OrderTrackingClient.tsx`

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`, lines 66–73

**Issue:** Same as C-04. Local `formatIDR` re-declared. Should import from `@/lib/utils/format-currency`.

**Action:** Edit to remove local `formatIDR`, import from canonical path.

---

## 🟠 HIGH

### H-01: `console.error` in Production Code — Cart Page

**File:** `app/(store)/cart/page.tsx`, line 56 (fetch catch block)

**Issue:** `console.error` in a production code path. Per project rules: "No console.log in production code." While `console.error` is technically different from `console.log`, the rule intent is to eliminate all console output in browser production code. More importantly, this catch block silently swallows the error — no toast, no UI feedback to the user.

**Expected:** Replace with toast notification (`toast.error('Gagal memuat keranjang')`). Use a structured logger if the project adopts one.

**Action:** Replace `console.error` + silent catch with toast error feedback.

---

### H-02: `console.error` in Production Code — Account Addresses

**File:** `app/(store)/account/addresses/page.tsx`, lines 44, 62, 81, 100, 132 (5 occurrences)

**Issue:** Five separate `console.error` calls across different fetch handlers. Each catch block is silent — user gets no feedback.

**Action:** Replace all 5 `console.error` calls with toast error feedback.

---

### H-03: `console.error` in Production Code — Account Points

**File:** `app/(store)/account/points/page.tsx`, line 44

**Action:** Replace with toast error feedback.

---

### H-04: `console.error` in Production Code — Account Vouchers

**File:** `app/(store)/account/vouchers/page.tsx`, line 29

**Action:** Replace with toast error feedback.

---

### H-05: Inline Loading Skeleton in Addresses Page

**File:** `app/(store)/account/addresses/page.tsx`, lines 143–151

```typescript
if (isLoading) {
 return (<div className="p-4 space-y-3">{/* skeleton items */}</div>);
}
```

**Issue:** Loading state is rendered inline inside the page component instead of via a `loading.tsx` file. Per project convention, loading states should be in a dedicated `loading.tsx` sibling file.

**Action:** Create `app/(store)/account/addresses/loading.tsx` with the skeleton content, remove inline loading from the page component.

---

### H-06: Inline Loading State in Points Page

**File:** `app/(store)/account/points/page.tsx`, lines 54–61

**Issue:** Page itself acts as the loading state with inline check. Should use a proper `loading.tsx` file instead.

**Action:** Create `app/(store)/account/points/loading.tsx`.

---

### H-07: Hardcoded WhatsApp Green Color

**File:** `components/store/layout/WhatsAppButton.tsx`, line 42

```tsx
className="bg-[#25D366] hover:bg-[#1DA851]"
```

**Issue:** `#25D366` is an arbitrary Tailwind hex value. CURSOR_RULES.md Section 3 "Never Do" rules say: "Never use arbitrary Tailwind color values like bg-[#C8102E]". This applies to all arbitrary values, not just brand colors.

**Action:** Add `#25D366` as a design system token (e.g., `whatsapp-green: #25D366` in the Tailwind config) and reference it as `bg-whatsapp-green`.

---

### H-08: `console.error` in `OrderTrackingClient.tsx` Fetch Handlers

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`, lines 8–12

**Issue:** `console.error` in fetch catch blocks. This component also has the duplicate `formatIDR` (C-05).

**Action:** Replace `console.error` with toast error feedback.

---

## 🟡 MEDIUM

### M-01: Stale FIX Comment in Checkout Failed Page

**File:** `app/(store)/checkout/failed/page.tsx`, lines 59–61

```typescript
// FIX 8: Cart restored with stock=0 may block addItem — use 999 (will be re-validated at checkout)
```

**Issue:** Comment references "FIX 8" which implies a known issue was addressed with a workaround (`999` as a placeholder stock value). This is technical debt — either the underlying stock handling should be fixed properly or the comment should be removed.

**Action:** Investigate and either fix the root issue or remove the comment with explanation of why the workaround is intentional.

---

### M-02: `formatWIB` Duplicate in `OrderTrackingClient.tsx`

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`, lines 75–84

**Issue:** Local `formatWIB` function defined. Should import from `@/lib/utils/format-date` like other components do.

**Action:** Remove local `formatWIB`, import from `@/lib/utils/format-date`.

---

### M-03: Inline Style for Timeline Step Colors

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`, lines 47–64

**Issue:** `TIMELINE_STEPS` array uses hardcoded color strings directly in data, not CSS classes. The component then applies these inline.

**Action:** Use CSS classes or design system tokens for timeline step colors instead of hardcoded strings.

---

### M-04: `blog/page.tsx` uses `pb-20 md:pb-12` instead of `pb-20 md:pb-0`

**File:** `app/(store)/blog/page.tsx`, line 118

**Issue:** Uses `pb-20 md:pb-12` instead of the project convention `pb-20 md:pb-0`. Inconsistent with all other store pages.

**Action:** Change to `pb-20 md:pb-0`.

---

### M-05: `CheckoutStepper` missing `pb-20 md:pb-0` on desktop

**File:** `app/(store)/checkout/page.tsx`, line 460

**Issue:** Only has `pb-24` for mobile bottom bar clearance. On desktop, the page has no bottom padding, meaning content may clip against the browser chrome on shorter viewports.

**Action:** Change `pb-24` to `pb-24 md:pb-0`.

---

## 🟢 LOW — VERIFIED OK

| Check | Result |
|-------|--------|
| No `any` types in store pages/components | ✅ PASS |
| `formatIDR` used for all prices in ProductCard, CartItem, CartSummary, OrderSummaryCard | ✅ PASS |
| Cart store enforces max 99 per item | ✅ PASS (`Math.min(99, item.stock ?? 99)` on add and update) |
| Prices are integer IDR (not float) | ✅ PASS |
| `pb-20 md:pb-0` on most store pages | ✅ PASS (with exceptions noted above) |
| Empty states on cart, orders, addresses, points, vouchers | ✅ PASS |
| Server/Client component separation | ✅ PASS |
| `loading.tsx` present for most routes | ✅ PASS (exceptions listed in CRITICAL) |
| Homepage has no placeholder content | ✅ PASS |
| Products listing has proper data fetching + pagination | ✅ PASS |
| Checkout page has full multi-step flow | ✅ PASS |

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | Multiple | Missing `error.tsx` for 4 account sub-pages | Create 4 error.tsx files |
| C-02 | 🔴 CRITICAL | `account/` | Missing `loading.tsx` for account root | Create loading.tsx |
| C-03 | 🔴 CRITICAL | `about/` | Missing `loading.tsx` for about page | Create loading.tsx |
| C-04 | 🔴 CRITICAL | `VoucherCard.tsx` | Duplicate `formatIDR` function | Replace with canonical import |
| C-05 | 🔴 CRITICAL | `OrderTrackingClient.tsx` | Duplicate `formatIDR` function | Replace with canonical import |
| H-01 | 🟠 HIGH | `cart/page.tsx:56` | `console.error` + silent catch | Replace with toast |
| H-02 | 🟠 HIGH | `account/addresses/page.tsx` | 5x `console.error` | Replace all with toast |
| H-03 | 🟠 HIGH | `account/points/page.tsx:44` | `console.error` | Replace with toast |
| H-04 | 🟠 HIGH | `account/vouchers/page.tsx:29` | `console.error` | Replace with toast |
| H-05 | 🟠 HIGH | `account/addresses/page.tsx` | Inline loading skeleton | Move to loading.tsx |
| H-06 | 🟠 HIGH | `account/points/page.tsx` | Inline loading state | Create loading.tsx |
| H-07 | 🟠 HIGH | `WhatsAppButton.tsx:42` | Hardcoded `#25D366` | Add to design system tokens |
| H-08 | 🟠 HIGH | `OrderTrackingClient.tsx` | `console.error` | Replace with toast |
| M-01 | 🟡 MEDIUM | `checkout/failed/page.tsx:59` | FIX 8 comment — placeholder stock | Investigate root cause |
| M-02 | 🟡 MEDIUM | `OrderTrackingClient.tsx:75` | Duplicate `formatWIB` | Import from canonical |
| M-03 | 🟡 MEDIUM | `OrderTrackingClient.tsx:47` | Inline hardcoded colors | Use CSS classes |
| M-04 | 🟡 MEDIUM | `blog/page.tsx:118` | Inconsistent `pb-` value | Change to `pb-20 md:pb-0` |
| M-05 | 🟡 MEDIUM | `checkout/page.tsx:460` | Missing desktop bottom padding | Add `md:pb-0` |

**Total: 5 CRITICAL · 8 HIGH · 5 MEDIUM**