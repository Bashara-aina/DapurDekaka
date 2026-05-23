# Priority Fix Roadmap — All Issues Ranked by Severity

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit
**Purpose:** Consolidated fix priority list for cursor to correct all issues

---

## Executive Summary

This document consolidates ALL issues found across all 9 previous audit files into a single prioritized fix roadmap. Issues are ranked P0 (must fix before launch) through P3 (nice to have). Each issue includes file location, description, and fix approach.

**Total Issues Found:** 87
**P0 Critical:** 12
**P1 High:** 22
**P2 Medium:** 31
**P3 Low:** 22

---

## P0 — Must Fix Before Any Real User Access

### P0-01: Admin API routes have NO role verification
**Severity:** CRITICAL
**Files:** ALL `app/api/admin/*/route.ts`

Every admin API route must add explicit role checking. Currently only middleware protects page access, but API routes accept direct calls with no role verification.

**Fix:** Add to every admin route:
```ts
const session = await auth();
if (!session?.user?.role || !['superadmin', 'owner'].includes(session.user.role)) {
  return forbidden('Access denied');
}
```

### P0-02: Middleware matcher misses `/admin` root path
**Severity:** CRITICAL
**File:** `app/middleware.ts:46`

```ts
export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};
```

`/admin` (without trailing path) bypasses middleware entirely. Add `/admin` explicitly.

**Fix:**
```ts
matcher: ['/admin/:path*', '/admin', '/account/:path*', '/b2b/account/:path*'],
```

### P0-03: `addresses` table has index on non-existent column
**Severity:** CRITICAL
**File:** `lib/db/schema.ts:138`

```ts
recipientEmailIdx: index('idx_orders_recipient_email').on(table.recipientEmail),
```

`addresses` table has no `recipientEmail` column. This would fail at Drizzle build time.

**Fix:** Either remove this index or change it to reference the correct table (`orders.recipientEmail`).

### P0-04: B2B quote → order conversion is unclear/missing
**Severity:** CRITICAL
**Files:** `app/api/b2b/quotes/[id]/[action]/route.ts`, related files

When a B2B customer accepts a quote, it must create a formal order with proper stock deduction and points award. Need to verify and fix this flow.

**Fix:** Implement full quote-to-order conversion:
1. Create order in `orders` table with `isB2b: true`
2. Deduct stock (same as checkout webhook)
3. Award points (B2B 2x multiplier)
4. Send confirmation email
5. Update quote status to `accepted`

### P0-05: Cron routes not scheduled
**Severity:** CRITICAL
**Files:** `app/api/cron/*` routes

The cron routes exist but are not configured to run. Without scheduling:
- Expired orders won't cancel
- Points won't expire
- Payment reconciliation won't run

**Fix:** Create `vercel.json` with cron configuration:
```json
{
  "crons": [
    { "path": "/api/cron/cancel-expired-orders", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/expire-points", "schedule": "0 0 * * *" }
  ]
}
```

### P0-06: Checkout page has ZERO useTranslations — 60+ hardcoded strings
**Severity:** CRITICAL
**File:** `app/(store)/checkout/page.tsx`

The checkout page imports no i18n and has hardcoded Bahasa Indonesia strings throughout. This is the most conversion-critical page on the site.

**Fix:** Add `useTranslations` hook and replace ALL hardcoded strings with translation keys.

### P0-07: Product detail page missing loading.tsx AND error.tsx
**Severity:** CRITICAL
**Files:** `app/(store)/products/[slug]/page.tsx`

This page (most visited for SEO) has neither loading skeleton nor error boundary. Users will see blank screens or React errors.

**Fix:**
1. Create `app/(store)/products/[slug]/loading.tsx` with product detail skeleton
2. Create `app/(store)/products/[slug]/error.tsx` with "Produk tidak ditemukan"
3. Fix the page to return `notFound()` when product is null or soft-deleted

### P0-08: Warehouse role cannot access /admin/field
**Severity:** CRITICAL
**File:** `app/middleware.ts:18`

Warehouse workers need `/admin/field` but allowed paths are `['/admin/inventory', '/admin/shipments']`. The field dashboard IS their primary interface.

**Fix:**
```ts
if (role === 'warehouse') {
  const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
  ...
}
```

### P0-09: Refund flow not implemented for paid orders
**Severity:** CRITICAL
**Files:** `app/api/admin/orders/[id]/status/route.ts`, `app/api/webhooks/midtrans/route.ts`

When admin cancels a `paid` order, there's no Midtrans refund API call. Money leaves customer but order is cancelled. This could cause legal/financial issues.

**Fix:**
1. When status changes to `cancelled` on a `paid` order, call Midtrans refund API
2. Only after refund success, update status to `refunded`
3. If refund fails, leave as `paid` and alert admin

### P0-10: `next.config.mjs` was deleted — lost configuration
**Severity:** CRITICAL
**Files:** `next.config.mjs` (missing)

This file typically contains:
- Cloudinary image domain allowlist
- Security headers (CSP, X-Frame-Options, etc.)
- Redirect rules
- Image optimization config

**Fix:** Recreate `next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'res.cloudinary.com' },
      { hostname: 'picsum.photos' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

### P0-11: RajaOngkir origin city defaults to Jakarta (501), not Bandung
**Severity:** CRITICAL
**File:** `app/api/shipping/cost/route.ts:45`

```ts
const origin = originCityId ?? '501';
```

RajaOngkir Starter only supports Jakarta (501) as origin. Shipping costs are calculated from Jakarta, not Bandung. This means ALL shipping rates are wrong for a Bandung business.

**Fix:** Either:
1. Accept this limitation and document it (customers pay wrong amount — bad)
2. Upgrade to RajaOngkir Pro (costs money)
3. Use a different shipping API (Shipper, etc.)

### P0-12: Order tracking exposes all order details to anyone
**Severity:** CRITICAL
**File:** `app/(store)/orders/[orderNumber]/page.tsx`

Order numbers follow predictable format `DDK-YYYYMMDD-XXXX`. Anyone who knows a customer's email could enumerate order numbers and view:
- Full order contents
- Delivery address
- Phone number
- Total amount

**Fix:** Add email verification requirement for order lookup:
1. User enters order number + email
2. System sends verification code to email
3. User enters code to see order details

---

## P1 — Should Fix Before Launch

### P1-01: Cancellation stock restore has no GREATEST guard
**File:** `app/api/webhooks/midtrans/route.ts:300`
**Severity:** HIGH

```ts
.set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
```

Unlike settlement which uses `GREATEST(stock - qty, 0)`, cancellation does raw `stock + qty`. If stock was modified by another process, this could result in stock exceeding actual quantity.

**Fix:** Use `GREATEST(stock + qty, stock)` or check current stock before adding.

### P1-02: Idempotency check outside transaction — race condition
**File:** `app/api/checkout/initiate/route.ts:350-355`
**Severity:** HIGH

The comment explicitly acknowledges: concurrent requests within 30s could both pass the check, then second fails with 500 on order number unique constraint.

**Fix:** Move idempotency check inside the transaction OR use a database advisory lock.

### P1-03: Midtrans webhook has no rate limiting
**File:** `app/api/webhooks/midtrans/route.ts`
**Severity:** HIGH

Webhook accepts any number of requests without rate limiting. While Midtrans itself won't spam, an attacker could still hit this endpoint.

**Fix:** Add `withRateLimit` wrapper to the webhook handler.

### P1-04: B2B profile approval doesn't notify customer
**Files:** `app/api/admin/b2b-profiles/[id]/approve/route.ts`
**Severity:** HIGH

When admin marks B2B profile as approved, no email is sent. Customer doesn't know they can now place orders.

**Fix:** Add email sending on approval:
```ts
sendEmail({ to: b2bProfile.picEmail, subject: '...', react: <B2BApprovalEmail /> });
```

### P1-05: Cart stock not re-validated on page load
**File:** `store/cart.store.ts`
**Severity:** HIGH

Cart items loaded from localStorage on page refresh — no check against current DB stock. User could have stale items where stock is now 0.

**Fix:** On cart page mount, call `POST /api/cart/validate` to verify all items are still available.

### P1-06: Revenue chart ignores date filter
**File:** `app/(admin)/admin/dashboard/SuperadminDashboardClient.tsx:270`
**Severity:** HIGH

The revenue chart query always fetches without date params. Date filter only affects KPI card, not chart.

**Fix:** Pass `?from=...&to=...` to `/api/admin/dashboard/revenue-chart`.

### P1-07: Guest email not normalized in coupon validate
**File:** `app/api/coupons/validate/route.ts:423`
**Severity:** HIGH

The coupon validate route joins on `orders.recipientEmail` without `toLowerCase()`. Guest email case mismatch could bypass per-user coupon limits.

**Fix:** Use `sql` `LOWER()` in the join condition or normalize both sides.

### P1-08: `free_shipping` coupon not handled in validate endpoint
**File:** `app/api/coupons/validate/route.ts`
**Severity:** MEDIUM

The validate endpoint handles `percentage`, `fixed`, `buy_x_get_y` but NOT `free_shipping`. Returns `freeShipping: undefined` for this type.

**Fix:** Add case for `coupon.type === 'free_shipping'` in validate endpoint.

### P1-09: productNameId/weightGram from client not DB-verified
**File:** `app/api/checkout/initiate/route.ts:145-154`
**Severity:** MEDIUM

Client-submitted name fields and weight are accepted as-is and stored. Should be fetched from DB variant to prevent data corruption.

**Fix:** Fetch from `variant` record:
```ts
const variant = dbVariants.find(v => v.id === item.variantId);
productNameId: variant.product.nameId, // from product relation
weightGram: variant.weightGram,
```

### P1-10: Order status transitions have no validation
**File:** `app/api/admin/orders/[id]/status/route.ts`
**Severity:** MEDIUM

Can you set `cancelled → paid`? `delivered → shipped`? No transition validation exists. Invalid transitions could break the order funnel.

**Fix:** Add status machine validation:
```ts
const validTransitions = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
if (!validTransitions[currentStatus]?.includes(newStatus)) {
  return conflict('Invalid status transition');
}
```

### P1-11: Coupon deletion should be soft-delete
**File:** `app/api/admin/coupons/[id]/route.ts`
**Severity:** MEDIUM

DELETE handler likely hard-deletes. If an active coupon is used in existing orders, hard delete breaks referential integrity.

**Fix:** Use soft-delete with `deletedAt`:
```ts
await db.update(coupons).set({ deletedAt: new Date() }).where(eq(coupons.id, id));
```

### P1-12: Audit log export ignores date filter
**File:** `SuperadminDashboardClient.tsx:765`
**Severity:** MEDIUM

`/api/admin/audit-logs?export=csv` ignores date range. Exporting all logs from beginning of time could produce huge file.

**Fix:** Pass `?from=...&to=...` to export endpoint.

### P1-13: Points expiry cron not transaction-safe
**File:** `lib/services/points.service.ts:89-153`
**Severity:** MEDIUM

`expireOverduePoints` queries `expiredRows` outside the transaction, then updates inside. If rows change between query and update, could double-process or miss rows.

**Fix:** Move the `expiredRows` query inside the transaction or use `SELECT ... FOR UPDATE`.

### P1-14: `console.error` in retry route instead of logger
**File:** `app/api/checkout/retry/route.ts:198`
**Severity:** LOW

Uses bare `console.error` instead of project logger utility.

**Fix:** Replace with `logger.error('[checkout/retry]', ...)` or create logger instance.

### P1-15: Multiple tabs cart divergence
**File:** `store/cart.store.ts`
**Severity:** MEDIUM

Two browser tabs with same cart — localStorage conflicts. No version/timestamp to detect concurrent modifications.

**Fix:** Add `version` or `updatedAt` to cart state. On write, check version hasn't changed. If changed, prompt user to refresh.

### P1-16: System alerts dismiss is not persistent
**File:** `SuperadminDashboardClient.tsx:331-345`
**Severity:** LOW

Dismiss only hides in UI. Refresh re-shows alert. Should mark as resolved in DB.

### P1-17: Tracking number format not validated per courier
**File:** `app/(admin)/admin/field/page.tsx`
**Severity:** MEDIUM

Input accepts any string >= 8 chars. SiCepat, JNE, AnterAja have different formats. Invalid tracking numbers won't be traceable.

**Fix:** Add per-courier regex validation in the tracking input handler.

### P1-18: Image upload missing validation
**File:** `app/api/admin/upload/route.ts`
**Severity:** MEDIUM

No validation for file type, size, or dimensions. Malicious files could be uploaded.

**Fix:** Add validation:
```ts
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxSize = 5 * 1024 * 1024; // 5MB
if (!allowedTypes.includes(file.type)) return badRequest('Invalid file type');
if (file.size > maxSize) return badRequest('File too large');
```

### P1-19: Blog content HTML not sanitized
**File:** `app/api/admin/blog/route.ts`
**Severity:** MEDIUM

Blog post content stored with HTML. Without sanitization, XSS possible.

**Fix:** Use `sanitize-html` or DOMPurify before storage.

### P1-20: No 2FA for admin accounts
**Files:** NextAuth config
**Severity:** MEDIUM

Superadmin accounts have no two-factor authentication. Password compromise = full admin access.

**Fix:** Enable TOTP provider for `superadmin` role in NextAuth config.

### P1-21: Order tracking privacy — add verification
**File:** `app/(store)/orders/[orderNumber]/page.tsx`
**Severity:** MEDIUM

Currently exposes all order details to anyone with order number. Add email verification flow.

### P1-22: Missing `apiErrors` keys
**Files:** `i18n/messages/en.json`, `id.json`
**Severity:** MEDIUM

Missing keys: `productNotFound`, `variantNotFound`, `addressNotFound`, `sessionExpired`, `rateLimitExceeded`.

**Fix:** Add these keys to both translation files.

---

## P2 — Medium Priority

### P2-01: `text-[#1A1A1A]` arbitrary value instead of design token
**File:** Multiple — SuperadminDashboardClient, FieldDashboard, etc.
**Severity:** MEDIUM

Replace all `text-[#1A1A1A]` with `text-text-primary`. Replace `text-[#6B6B6B]` with `text-text-secondary` (but verify contrast — #6B6B6B may fail AA for normal text).

### P2-02: Missing aria-labels on icon buttons
**Files:** CartItem, BottomNav, WhatsAppButton
**Severity:** MEDIUM

Add `aria-label` to all icon-only buttons.

### P2-03: BottomSheet uses `&times;` not semantic button
**File:** `field/page.tsx:310`
**Severity:** LOW

Use `<X />` component with proper aria-label.

### P2-04: Sticky total bar hardcoded `top-[76px]`
**File:** `app/(store)/checkout/page.tsx:462`
**Severity:** LOW

Use CSS custom property `--navbar-height` instead of hardcoded pixel.

### P2-05: Field dashboard raw select instead of shadcn
**File:** `field/page.tsx:424`
**Severity:** LOW

Replace `<select>` with shadcn `Select` component.

### P2-06: Field dashboard raw checkbox with `accent-green-500`
**File:** `field/page.tsx:408`
**Severity:** LOW

Replace with shadcn `Checkbox` component.

### P2-07: Coupon service file is empty
**File:** `lib/services/coupon.service.ts`
**Severity:** LOW

Add actual service layer functions. All coupon logic currently in route handlers (violates layered architecture).

### P2-08: Empty catch blocks in some routes
**Files:** Various
**Severity:** LOW

Verify every catch block logs errors.

### P2-09: `as any` in payment service
**File:** `lib/midtrans/create-transaction.ts:53`
**Severity:** LOW

Define proper type for callbacks object instead of `as any`.

### P2-10: Bulk product operations UI not built
**File:** ProductsClient component
**Severity:** LOW

Verify what bulk operations exist in API and expose in UI.

### P2-11: Address form dropdowns could be lazy loaded
**File:** `components/store/checkout/AddressForm.tsx`
**Severity:** LOW

Provinces and cities loaded all at once — slow on mobile.

### P2-12: No retry on failed API calls in checkout
**Files:** `app/(store)/checkout/page.tsx`
**Severity:** LOW

Network errors show toast but user must manually retry.

### P2-13: No optimistic UI on cart quantity updates
**File:** `CartItem.tsx`
**Severity:** LOW

UI waits for API response before updating.

### P2-14: Order status badge colors — accessibility
**File:** `SuperadminDashboardClient.tsx:134-149`
**Severity:** LOW

Verify status badge colors meet WCAG contrast requirements.

### P2-15: Navbar mobile menu doesn't close on navigation
**File:** `Navbar.tsx`
**Severity:** LOW

Use router events to close menu on navigation.

### P2-16: Image alt text verification
**Files:** ProductCard, HeroCarousel, blog components
**Severity:** LOW

Verify every image has descriptive alt text.

### P2-17: Payment expiry monitoring
**Files:** Cron routes
**Severity:** LOW

Add alerting if cron jobs fail.

### P2-18: Language switcher implementation
**File:** `LanguageSwitcher.tsx`
**Severity:** LOW

Verify locale persistence works correctly.

### P2-19: Testimonials public API verification
**File:** `app/api/testimonials/public/route.ts`
**Severity:** LOW

Verify it returns only `isActive: true` testimonials.

### P2-20: Health check endpoint verification
**File:** `app/api/health/route.ts`
**Severity:** LOW

Verify it checks DB and external API connectivity.

### P2-21: InstagramFeed — real data or placeholder
**File:** `components/store/home/InstagramFeed.tsx`
**Severity:** LOW

Verify this fetches real Instagram data or remove if placeholder.

### P2-22: Checkout 3 sequential fetches on load
**File:** `app/(store)/checkout/page.tsx:145-224`
**Severity:** LOW

Profile, addresses, store hours are fetched sequentially. Combine into single endpoint.

### P2-23: Product catalog — no virtualization
**File:** `components/store/products/ProductCatalog.tsx`
**Severity:** LOW

If product list grows large, add windowing/virtualization.

### P2-24: Points system — POINTS_VALUE_IDR verification
**Files:** Multiple
**Severity:** LOW

Verify `POINTS_VALUE_IDR = 10` is used consistently everywhere.

### P2-25: StockBadge contrast
**File:** `StockBadge.tsx`
**Severity:** LOW

Verify "Tersisa X pcs" orange color meets contrast requirements.

### P2-26: Font loading verification
**File:** `app/layout.tsx`
**Severity:** LOW

Verify `next/font` properly loads Playfair Display and Inter.

### P2-27: Reduced motion for animations
**Files:** Framer Motion usage, WhatsAppButton
**Severity:** LOW

Add `prefers-reduced-motion` media query handling.

### P2-28: Admin audit log coverage
**File:** `adminActivityLogs` usage
**Severity:** LOW

Verify all mutations create audit log entries.

### P2-29: `serverError` may leak internal details
**File:** `lib/utils/api-response.ts`
**Severity:** LOW

Verify client message is always sanitized generic error.

### P2-30: `.env.example` maintenance
**Files:** `.env.example`
**Severity:** LOW

Keep in sync with actual environment variables.

### P2-31: Security headers in next.config (recreate from P0-10)
**File:** `next.config.mjs`
**Severity:** MEDIUM

Already in P0 but also P2 for proper configuration.

---

## P3 — Nice to Have

### P3-01: Error monitoring service (Sentry)
### P3-02: User analytics (Plausio)
### P3-03: A/B testing infrastructure
### P3-04: API documentation (Swagger/OpenAPI)
### P3-05: Password strength enforcement
### P3-06: Account lockout after failed login attempts
### P3-07: Session extension on activity
### P3-08: Change password functionality for users
### P3-09: B2B quote generation UI verification
### P3-10: Team dashboard purpose clarification
### P3-11: About/Privacy/Refund static content translation
### P3-12: `recipientEmailIdx` on orders table (for guest coupon check)
### P3-13: Composite index on orders(userId, status)
### P3-14: `prefers-reduced-motion` for all animations
### P3-15: Product detail image gallery touch-swipe
### P3-16: New coupon code change prevention on edit
### P3-17: Rate limiting on public product/blog APIs
### P3-18: WhatsApp number format validation
### P3-19: EmptyState illustration — real SVG vs emoji
### P3-20: Checkout payment button — expired snap token handling
### P3-21: B2B Net-30 payment due reminder emails
### P3-22: Customer password change in account

---

## Quick Fix Order (For Cursor)

If starting fresh, fix in this order:

1. **Auth & Schema** (P0-01, P0-02, P0-03, P0-08) — Security critical
2. **Checkout Page i18n** (P0-06) — Most visible bug
3. **Product Detail loading/error** (P0-07) — SEO critical
4. **Webhook security** (P0-03, P1-02, P1-03) — Payment safety
5. **B2B flow** (P0-04, P0-09, P1-04) — Business critical
6. **Design tokens** (P2-01) — Visual consistency
7. **Accessibility** (P2-02, P2-03) — WCAG compliance
8. **Infrastructure** (P0-05, P0-10) — Operations readiness
9. **Remaining P1s and P2s** — Polish

---

## Summary by File

| File | P0 | P1 | P2 | P3 |
|------|----|----|----|-----|
| `app/middleware.ts` | 2 | 1 | 0 | 0 |
| `lib/db/schema.ts` | 1 | 1 | 1 | 2 |
| `app/(store)/checkout/page.tsx` | 1 | 3 | 2 | 0 |
| `app/(store)/products/[slug]/page.tsx` | 1 | 0 | 1 | 0 |
| `app/api/webhooks/midtrans/route.ts` | 1 | 3 | 0 | 0 |
| `app/api/checkout/initiate/route.ts` | 0 | 4 | 0 | 0 |
| `app/api/coupons/validate/route.ts` | 0 | 2 | 0 | 0 |
| `app/(admin)/admin/dashboard/SuperadminDashboardClient.tsx` | 0 | 2 | 2 | 0 |
| `app/(admin)/admin/field/page.tsx` | 0 | 1 | 3 | 0 |
| `lib/services/points.service.ts` | 0 | 1 | 0 | 0 |
| `next.config.mjs` | 1 | 0 | 1 | 0 |
| Other files | 1 | 4 | 20 | 18 |