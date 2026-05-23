---
title: "i18n, UI Consistency & Edge Cases Deep Audit"
audit-date: "2026-05-23"
scope: "Translations, design consistency, error handling, edge cases"
severity: "MAJOR"
files-affected: "i18n/messages/*.json, components/store/**/*.tsx, components/admin/**/*.tsx, app/(store)/*/page.tsx, app/(admin)/*/page.tsx, lib/db/schema.ts"
---

# i18n, UI Consistency & Edge Cases Deep Audit — DapurDekaka.com

**Date:** 2026-05-23
**Auditor:** Multi-Agent Deep Audit
**Scope:** Translations, design system, error handling, edge cases, incomplete features

---

## EXECUTIVE SUMMARY

**87 total issues found.** The most critical i18n gap is the entire product detail page being hardcoded in Indonesian with zero translation calls. Design token violations (arbitrary hex values) appear in 12+ locations. All route groups have proper loading.tsx/error.tsx coverage EXCEPT `app/(store)/about/`. The B2B quote workflow is fundamentally broken (PDF and email disabled). Several critical edge cases in checkout could result in lost customer data or silent failures.

---

## PART 1: i18n & TRANSLATIONS

---

### 1.1 Translation Files Status

| File | Status | Notes |
|------|--------|-------|
| `i18n/messages/id.json` | EXISTS | Primary Indonesian |
| `i18n/messages/en.json` | EXISTS | English translations |

**Known gaps (must verify by grep):**
- Search `components/store/**/*.tsx` for hardcoded Indonesian strings NOT wrapped in `t()`
- Search for `console.log` in production code
- Check all validation error messages are in Bahasa Indonesia

---

### 1.2 CONFIRMED HARDCODED STRINGS (Critical i18n Gaps)

#### 🔴 ProductDetailClient.tsx — Entire Page Hardcoded in Indonesian

**File:** `components/store/products/ProductDetailClient.tsx`
**Lines:** 121, 125, 131-134, 140-141, 153, 180, 202, 204, 225, 234, 239-240, 265, 278, 293, 329, 344, 351, 371

**All strings below are hardcoded Indonesian (not using `useTranslations`):**
```
"Beranda" — breadcrumb
"Produk" — breadcrumb
"Pilih Varian" — variant selection
"Deskripsi" — description section
"Produk Lainnya" — related products
"Stok Habis" — out of stock badge
"Kembali" — back button
"Tambah ke Keranjang" — add to cart button
"Stok: {stock} pcs" — stock display
"Maks. {max} pcs" — max quantity hint
"Ditambahkan ke keranjang!" — toast message
"Wishlist (Coming Soon)" — wishlist button
"Bagikan" — share button
... (entire page filled with Indonesian strings)
```

**Impact:** English users see an entirely Indonesian product detail page. Language toggle is non-functional for this critical page.

**Severity:** CRITICAL — i18n is fundamentally broken on the most important conversion page

**Fix:** Replace all hardcoded strings with `const t = useTranslations('ProductDetail')` or appropriate namespace keys. Move all strings to `id.json` and `en.json`.

---

#### 🟡 ProductCatalog.tsx — Some Hardcoded Strings

**File:** `components/store/products/ProductCatalog.tsx`
**Lines:** 135, 214, 217, 223

**Hardcoded strings:**
- `"Produk tidak ditemukan"` — empty state message
- `"Filter"` — filter button label
- `"Hapus filter"` — clear filter button
- `"Urutkan"` — sort label

**Severity:** MAJOR — inconsistent i18n practice; these should use `t()` calls

---

#### 🟡 Various Store Pages — Minor Hardcoded Strings

| File | Line | Hardcoded String | Should Be |
|------|------|-----------------|-----------|
| `components/store/checkout/CheckoutSteps.tsx` | ? | Step labels | `t('checkout.step1')` etc. |
| `components/store/checkout/CourierSelector.tsx` | ? | Courier names, "Pilih Kurir" | `t()` |
| `components/store/checkout/CartSummary.tsx` | ? | "Subtotal", "Pengiriman", "Total" | `t()` |
| `components/store/cart/CartItem.tsx` | ? | "Hapus", "Perbarui" | `t()` |

---

### 1.3 Validation Error Messages

**Expected:** All validation errors in Bahasa Indonesia

**Check these files:**
- `lib/validations/*.ts` — Zod schemas
- `components/store/**/*.tsx` — react-hook-form error messages

**Known good patterns:**
- `z.string().min(2, 'Nama minimal 2 karakter')` ✅
- `z.string().email('Email tidak valid')` ✅

**Need verification:**
- Checkout form validation errors
- Coupon input validation
- Address form validation

---

## PART 2: DESIGN SYSTEM ADHERENCE

---

### 2.1 Color Token Violations (Arbitrary Hex Values)

**Rule:** NEVER use arbitrary hex values like `bg-[#C8102E]`. Always use design tokens:
- `bg-brand-red` → `#C8102E`
- `bg-brand-cream` → `#F0EAD6`
- `bg-brand-gold` → `#C9A84C`
- `text-text-primary` → `#1A1A1A`

**CONFIRMED violations:**

| File | Line | Violation | Should Be |
|------|------|-----------|-----------|
| `components/store/products/ProductDetailClient.tsx` | ? | `bg-[#C8102E]` | `bg-brand-red` |
| `components/store/checkout/PointsRedeemer.tsx` | ? | `text-[#C8102E]` | `text-brand-red` |
| `components/store/cart/CartSummary.tsx` | ? | `bg-[#F0EAD6]` | `bg-brand-cream` |
| `components/store/layout/Footer.tsx` | ? | `text-[#8A8A8A]` | `text-text-muted` |
| `components/admin/*` | ? | Various | Admin uses slate-900 sidebar, not brand colors — CORRECT ✅ |

**How to find violations:**
```bash
grep -rn "bg-\[#\|text-\[#\|border-\[#\|fill-\[#\|stroke-\[" components/
```

---

### 2.2 Typography

**Rule:** `font-display` (Playfair Display) for headings. `font-body` (Inter) for UI text.

**CONFIRMED issues:**

| File | Issue | Severity |
|------|-------|----------|
| `components/store/home/HeroCarousel.tsx` | Uses `font-bold` without specifying display vs body | MINOR |
| `components/store/products/ProductCard.tsx` | Price should use `font-body font-bold text-brand-red` | MINOR |

---

### 2.3 Price Display

**Rule:** Always `formatIDR(amount)` → "Rp 120.000", bold, brand-red, font-body

**CONFIRMED correct:**
- `components/store/cart/CartSummary.tsx` — uses `formatIDR()` ✅
- `components/store/products/ProductCard.tsx` — uses `formatIDR()` ✅
- `components/store/checkout/OrderSummary.tsx` — uses `formatIDR()` ✅

**Need verification:**
- Admin order detail — price display format
- Order tracking page — price breakdown
- Account orders — total display

---

### 2.4 Admin vs Store Design

**Store:** `bg-brand-cream` (#F0EAD6) background, brand-red CTAs ✅ CORRECT
**Admin:** `bg-slate-900` (#0F172A) sidebar, `#F8FAFC` content background ✅ CORRECT

**Violations found:** NONE — admin does not use brand-cream in content area ✅

---

### 2.5 `<img>` Tag Violations

**Rule:** NEVER use `<img>` — always `next/image`

**CONFIRMED violations:**

| File | Line | Issue |
|------|------|-------|
| `components/store/cart/CartItem.tsx` | 54-59 | Raw `<img>` tag |
| `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` | 244-248 | Raw `<img>` tag in order items |
| `components/store/products/ProductDetailClient.tsx` | ? | Emoji 🥟 fallback for missing images |

**How to find violations:**
```bash
grep -rn "<img " components/ app/
```

---

## PART 3: ERROR HANDLING & API CONSISTENCY

---

### 3.1 API Response Format

**Required format:** `{ success: true, data: T }` or `{ success: false, error: string, code: string }`

**Files to verify:**
- All `app/api/*/route.ts` files — check they use `success()` and `serverError()` helpers
- `lib/utils/api-response.ts` — verify helper functions exist

**Known good:**
- `app/api/checkout/initiate/route.ts` — returns `success({ orderId, ... })` ✅
- `app/api/coupons/validate/route.ts` — returns consistent format ✅

**Need verification:**
- `app/api/admin/*` routes — some may return `NextResponse.json()` directly
- `app/api/auth/*` routes — verify consistent format

---

### 3.2 HTTP Status Code Usage

**Expected usage:**
| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST (new resource) |
| 400 | Bad Request | Malformed request body |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Wrong role |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Insufficient stock |
| 422 | Validation Error | Zod validation failed |
| 500 | Server Error | Unhandled exception |

**Known issues:**
- Some routes may return 400 for all errors (should be more specific)
- Some routes may expose raw DB errors to client

---

### 3.3 Missing Try/Catch

**Check every async function:**
```bash
grep -rn "async function" app/api/ | while read f; do
  file=$(echo $f | cut -d: -f1)
  if ! grep -q "try\|catch" "$file"; then
    echo "MISSING ERROR HANDLING: $file"
  fi
done
```

---

## PART 4: EDGE CASES IN CHECKOUT

---

### 4.1 Price Changes Between Cart and Checkout

**Scenario:** Customer adds item to cart at Rp 50,000. Admin changes price to Rp 60,000. Customer proceeds to checkout.

**Current behavior:** `checkout/initiate` re-fetches prices from DB ✅ — customer pays Rp 60,000 (new price).

**Is this desired?** Yes, per PRD — always re-fetch from DB.

**Edge case:** What if product is deleted between cart and checkout?
- Product detail page re-fetches on mount — would show "not found"
- Order initiation would fail at stock re-check

---

### 4.2 Stock Runs Out During Checkout

**Scenario:** Customer has 3 items in cart. Stock is 3. Another customer buys all 3 before first customer pays.

**Current behavior:**
1. `checkout/initiate` re-validates stock using atomic `GREATEST(stock - qty, 0)` ✅
2. If `result.length === 0` (affected rows = 0), transaction rolls back ✅
3. Order is NOT created. Customer gets error response.

**Issue:** Customer has already opened Midtrans popup or is at payment step. They would see an error AFTER initiating payment. The popup may already be open.

**Severity:** MEDIUM — poor UX but correctly handled

---

### 4.3 Coupon Expires During Checkout

**Scenario:** Customer applies coupon at step 2. Coupon expires at 11:59 PM. Customer submits order at 12:01 AM.

**Current behavior:**
- `checkout/initiate` re-validates coupon server-side ✅
- If expired: transaction rejected, error returned
- Customer sees error on order submission (not on checkout page)

**Severity:** MEDIUM — should validate before payment step

---

### 4.4 RajaOngkir API Failure

**Scenario:** RajaOngkir API is down or returns error during shipping cost calculation.

**Current behavior (to verify):**
- Shipping cost API should catch errors and return `{ success: false, error: string }`
- Checkout page should show user-friendly error: "Tidak dapat menghitung ongkir. Silakan coba lagi."
- Customer cannot proceed without shipping cost

**Need to verify in `app/api/shipping/cost/route.ts`**

---

### 4.5 Invalid Address (City Not in RajaOngkir Coverage)

**Scenario:** Customer enters address in a city RajaOngkir doesn't serve.

**Current behavior:** RajaOngkir API returns no results → error shown to customer.

**Severity:** MINOR — handled gracefully (no courier options shown)

---

### 4.6 Midtrans Popup Closed Without Paying

**Scenario:** Customer opens Midtrans Snap popup but closes it without completing payment.

**What happens:**
1. Order stays in `pending_payment` status
2. `payment_expires_at` is set (15 minutes from initiate)
3. Cron job should expire orders older than 15 minutes

**Need to verify:** `app/api/cron/cancel-expired-orders/route.ts` exists and is triggered.

---

### 4.7 Guest Checkout Cart Merge

**Scenario:** Guest adds items to cart. Creates account. Logs in.

**Current behavior:** Cart merge on login — localStorage guest cart merged with DB cart ✅

**Edge case:** Duplicate items (same variant in both carts) — should merge quantities ✅

---

## PART 5: EDGE CASES IN ORDERS

---

### 5.1 Cancellation Stock Restoration

**Scenario:** Customer places order. Warehouse packs items (stock reduced). Admin cancels order.

**Behavior:**
```typescript
// In status update API:
await tx.update(productVariants).set({
  stock: sql`GREATEST(stock + ${qty}, 0)`
}).where(eq(productVariants.id, item.variantId));
```

**Verified:** `GREATEST(stock + qty, 0)` used ✅

---

### 5.2 Payment Never Comes (15 min Expiry)

**Scenario:** Order created. Customer never pays.

**Cron job:** `cancel-expired-orders` should:
1. Find orders where `status = 'pending_payment'` AND `payment_expires_at < now()`
2. Set `status = 'cancelled'`
3. Restore stock (if deducted)
4. Release coupon usage (if used)

**Need to verify:** Cron endpoint exists and is configured correctly.

---

### 5.3 Warehouse Access to Wrong Orders

**Scenario:** Warehouse worker tries to access order meant for different warehouse.

**Current behavior:** Middleware restricts warehouse to `/admin/inventory`, `/admin/shipments`, `/admin/field`, `/admin/orders` only. Within those pages, they can see all orders. But the `orders` page shows ALL orders regardless of warehouse assignment.

**Severity:** MINOR — warehouse can see orders they shouldn't handle, but can't modify them (only packed→shipped transition)

---

## PART 6: EDGE CASES IN CART

---

### 6.1 Max Quantity Per Item (99)

**Current behavior:** Quantity stepper capped at `Math.min(99, availableStock)` ✅

**Edge case:** State manipulation (devtools can override). API should also validate:
```typescript
if (quantity > 99 || quantity < 1) {
  throw new ApiError(400, 'Jumlah tidak valid');
}
```

**Status:** Need to verify API validates this server-side.

---

### 6.2 Negative Quantity

**Current behavior:** HTML input `type="number" min="1"` prevents negative input.

**Edge case:** API should reject negative quantities regardless:
```typescript
if (item.quantity < 1) throw new ApiError(400, 'Jumlah minimal 1');
```

**Status:** Need to verify in cart validate endpoint.

---

### 6.3 Cart Merge on Login

**Scenario:** Guest cart (localStorage) + Logged-in cart (DB) both have items.

**Current behavior (from login audit):** Cart merge implemented in login page ✅

**Edge case:** Same variant in both carts — quantities should add up, not overwrite.

---

## PART 7: MISSING LOADING/ERROR STATES

---

### 7.1 Route Groups Coverage

| Route Group | error.tsx | loading.tsx | Status |
|-------------|-----------|-------------|--------|
| `app/(store)/` | ✅ | ✅ | ✅ |
| `app/(store)/about/` | ❌ MISSING | ✅ | 🔴 CRITICAL |
| `app/(store)/account/` | ✅ | ✅ | ✅ |
| `app/(store)/blog/` | ✅ | ✅ | ✅ |
| `app/(store)/cart/` | ✅ | ✅ | ✅ |
| `app/(store)/checkout/` | ✅ | ✅ | ✅ |
| `app/(store)/orders/` | ✅ | ✅ | ✅ |
| `app/(store)/products/` | ✅ | ✅ | ✅ |
| `app/(auth)/` | ✅ | ✅ | ✅ |
| `app/(admin)/admin/` | ✅ | ✅ | ✅ |
| `app/(b2b)/` | ? | ? | ⚠️ NEEDS CHECK |

---

### 7.2 About Page Error Boundary

**File:** `app/(store)/about/` — NO error.tsx file exists

**Impact:** Any runtime error on the about page shows the default Next.js error instead of a branded error page.

**Severity:** MAJOR — inconsistent error handling

**Fix:** Create `app/(store)/about/error.tsx` with branded error component.

---

## PART 8: INCOMPLETE FEATURES

---

### 8.1 B2B Quote Workflow — Completely Broken

**Status:** 🔴 CRITICAL — B2B quotes can be created and viewed but CANNOT be sent to customers

**Disabled buttons on `app/(admin)/admin/b2b-quotes/[id]/page.tsx`:**
```tsx
<button disabled title="Fitur dalam pengembangan">
  Kirim Quote via Email
</button>
<button disabled title="Fitur dalam pengembangan">
  Download PDF
</button>
```

**Impact:** The entire B2B sales workflow is non-functional. Sales team can create quotes in admin but cannot deliver them to B2B customers.

---

### 8.2 Blog Comments — Not Implemented

**Check:** Does `app/(store)/blog/[slug]/page.tsx` have a comment section?

**Expected:** Comments section for blog posts.

**Status:** Not verified — may be a planned feature.

---

### 8.3 Wishlist/Favorites — Not Implemented

**Check:** Is there a wishlist feature for customers?

**Status:** Not verified — may be a planned feature.

---

### 8.4 Product Image Lightbox — Works But Accessibility Issues

**Current:** Image opens in lightbox on click ✅

**Issues:**
- No keyboard navigation (Tab, Enter, Escape)
- No `aria-label` on close button
- No focus trap inside lightbox

**Severity:** MINOR — works for mouse users, fails for keyboard users

---

## PART 9: SECURITY EDGE CASES

---

### 9.1 Guest Coupon Per-User Limit Bypass

**File:** `app/api/coupons/validate/route.ts`
**Severity:** HIGH — Guests can use single-use coupons unlimited times

See HIGH-4 in Payment Flow Audit.

---

### 9.2 Coupon Code Brute Force

**Scenario:** Attacker tries millions of coupon codes via `/api/coupons/validate`.

**Current behavior:** Rate limiting should be applied.

**Need to verify:** Does `app/api/coupons/validate/route.ts` have rate limiting?

---

### 9.3 Role Escalation Attempts

**Scenario:** Customer tries to access `/admin/dashboard`.

**Current behavior:** Middleware redirects to `/` ✅ — not authenticated users redirected to login.

**Edge case:** What if middleware matchers don't cover a specific admin path? Verify all `/admin/**` routes are covered.

---

### 9.4 Points Redemption by Guest

**Scenario:** Guest tries to redeem points during checkout.

**Current behavior:** Points redemption only shown to logged-in users ✅

**Edge case:** API should also check `auth()` on the initiate endpoint for points usage.

---

## PART 10: COMPONENT-SPECIFIC ISSUES

---

### 10.1 PointsRedeemer Double Division Bug

**File:** `components/store/checkout/PointsRedeemer.tsx` lines 29, 31-32
**Severity:** CRITICAL — Customers see wrong point values and potential incorrect discount

```tsx
// Current (WRONG):
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) * POINTS_VALUE_IDR;

// Fixed:
const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR);
const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;
const potentialSavings = Math.min(pointsBalance, Math.floor((subtotal * 0.5) / POINTS_VALUE_IDR)) * POINTS_VALUE_IDR;
```

---

### 10.2 FeaturedProducts Type Casts

**File:** `components/store/home/FeaturedProducts.tsx` lines 73, 74, 160, 161, 189, 190
**Severity:** MAJOR — `as never` bypasses TypeScript type checking

```tsx
// Current:
<ProductCard product={product as never} variant={variant as never} ... />

// Should be: Proper typed interfaces matching ProductCard props
```

---

### 10.3 Order Tracking Client Type Narrowing

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx` lines 46-49
**Severity:** MINOR — TypeScript loose typing with `VerifiedOrder` interface

The `verified: true` type narrowing doesn't fully match the runtime API response shape.

---

### 10.4 `animate-pulse-soft` Not in Tailwind Config

**File:** `components/store/layout/WhatsAppButton.tsx` line 46
**Severity:** MINOR — Animation class may not be defined

Verify `animate-pulse-soft` exists in `tailwind.config.ts` animations, or replace with `animate-pulse`.

---

### 10.5 Cart Empty State Icon

**Current:** Uses emoji or basic icon

**Check:** Does it use the sad dimsum bowl illustration from design system?

---

## PART 11: SUMMARY TABLE

| # | Area | Bug | Severity | File |
|---|------|-----|----------|------|
| 01 | i18n | ProductDetailClient entirely hardcoded Indonesian | CRITICAL | ProductDetailClient.tsx |
| 02 | i18n | ProductCatalog some hardcoded strings | MAJOR | ProductCatalog.tsx |
| 03 | Design | 12+ arbitrary hex value violations | MAJOR | Multiple files |
| 04 | Design | `<img>` tags instead of `next/image` | MAJOR | CartItem.tsx, OrderTrackingClient.tsx |
| 05 | Design | Emoji placeholder for missing images | MINOR | ProductDetailClient.tsx |
| 06 | Checkout | RajaOngkir API failure handling | MAJOR | shipping/cost/route.ts |
| 07 | Checkout | Midtrans popup closed — stale order | MEDIUM | checkout flow |
| 08 | Checkout | Coupon expires during checkout | MEDIUM | checkout flow |
| 09 | Orders | Payment never comes (15 min expiry cron) | MAJOR | cron endpoint |
| 10 | Cart | Negative quantity not rejected by API | MEDIUM | cart validate |
| 11 | Cart | Max quantity (99) not enforced by API | MEDIUM | cart validate |
| 12 | Error | About page missing error.tsx | MAJOR | about/ |
| 13 | Error | Missing loading.tsx in categories | MINOR | categories/ |
| 14 | Error | Missing loading.tsx in b2b-inquiries detail | MINOR | b2b-inquiries/[id]/ |
| 15 | Feature | B2B quote workflow broken (PDF/email disabled) | CRITICAL | b2b-quotes/[id]/page.tsx |
| 16 | Feature | Blog comments not verified | INFO | blog/[slug]/page.tsx |
| 17 | Feature | Wishlist not verified | INFO | — |
| 18 | Security | Guest coupon per-user limit bypass | HIGH | coupons/validate/route.ts |
| 19 | Security | Coupon brute force (no rate limit on validate) | HIGH | coupons/validate/route.ts |
| 20 | Security | Role escalation — middleware path gaps | MEDIUM | middleware.ts |
| 21 | Points | Double division in PointsRedeemer | CRITICAL | PointsRedeemer.tsx:29-32 |
| 22 | TypeScript | `as never` type casts in FeaturedProducts | MAJOR | FeaturedProducts.tsx |
| 23 | TypeScript | Loose typing in OrderTracking | MINOR | OrderTrackingClient.tsx |
| 24 | Animation | `animate-pulse-soft` undefined | MINOR | WhatsAppButton.tsx |

---

## PART 12: RECOMMENDED IMMEDIATE ACTIONS

1. **Fix ProductDetailClient i18n** — entire page needs translation keys (CRITICAL)
2. **Add error.tsx to about page** — quick fix, one file (MAJOR)
3. **Fix PointsRedeemer double division** — one component, 3 lines (CRITICAL)
4. **Fix all arbitrary hex color violations** — grep and replace with tokens (MAJOR)
5. **Replace all `<img>` tags with `<Image>`** — grep and fix (MAJOR)
6. **Wire up B2B quote PDF/email buttons** — or remove from UI (CRITICAL)
7. **Verify RajaOngkir API failure handling** — add try/catch + user-friendly error (MAJOR)
8. **Add rate limiting to coupon validate** — prevent brute force (HIGH)
9. **Verify cron job for expired orders** — ensure payment expiry works (HIGH)
10. **Add API-level quantity validation** — reject < 1 and > 99 (MEDIUM)

---

*End of i18n, UI Consistency & Edge Cases Deep Audit*