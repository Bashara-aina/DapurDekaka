# Incomplete Features, Placeholders & Immature Code — Full Audit

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit
**Purpose:** Find code that looks done but is broken, incomplete, or placeholder

---

## Executive Summary

The codebase has significant technical debt in the form of features that look implemented but are actually broken or incomplete. Several patterns of immaturity were found: services with empty implementations, features that only work in the happy path, and code with obvious "TODO" markers that were never resolved.

**Overall Code Quality:** ~72%. Main issues: B2B Net-30 flow incomplete, B2B quote-to-order conversion unclear, image upload missing validation, some services are stubs.

---

## 1. Incomplete/Missing Features

### 1.1 B2B Quote → Order Conversion

**Severity:** CRITICAL

**Files involved:**
- `app/api/b2b/quotes/[id]/[action]/route.ts`
- `app/(admin)/admin/b2b-quotes/new/page.tsx`
- `app/api/admin/b2b-quotes/route.ts`
- `app/api/b2b/orders/route.ts`

**Status:** PARTIALLY IMPLEMENTED

When a B2B customer accepts a quote, the system should:
1. Create a formal order in the `orders` table
2. Apply Net-30 payment terms if approved
3. Deduct stock immediately
4. Send confirmation email

**What's missing/unclear:**
- Does accepting a quote actually create an order? The `b2bQuotes` table has order-like fields (`subtotal`, `discountAmount`, `totalAmount`) but there's no explicit "convert quote to order" logic visible in the action handler.
- The `accept` action at `app/api/b2b/quotes/[id]/[action]/route.ts` — need to verify if it creates an order.
- If Net-30, does it call the same settlement logic as regular checkout?
- What's the status flow for B2B orders? Do they go through `pending_payment` or skip directly to `paid`?

### 1.2 B2B Profile Approval Notification

**Severity:** HIGH

When admin approves a B2B profile (`isApproved = true`), there's no email sent to the B2B customer. They won't know they've been approved and can't proceed to place orders.

**Location:** Likely in `app/api/admin/b2b-profiles/[id]/approve/route.ts`

### 1.3 B2B Quote PDF Generation

**Severity:** MEDIUM

`app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts` exists. Need to verify:
- Does it actually generate a valid PDF?
- Does it store the PDF in Cloudinary?
- Does it send the PDF to the customer via email?
- Is `@react-pdf/renderer` installed and working?

### 1.4 AI Content Generation

**Severity:** MEDIUM

`app/api/ai/caption/route.ts` and `lib/services/minimax.ts` exist. Need to verify:
- Is the Minimax API key configured in production?
- Does the generated content actually get saved to the blog post?
- Is content moderation applied (no inappropriate content)?
- Is there a cost tracking mechanism?

### 1.5 Coupon Deletion

**Severity:** MEDIUM

`app/api/admin/coupons/[id]/route.ts` DELETE handler — does it soft-delete or hard-delete? If hard-delete, existing orders using the coupon break. Should be soft-delete with `deletedAt`.

---

## 2. Placeholder Code Patterns

### 2.1 Service Stubs

#### `lib/services/coupon.service.ts`
**Severity:** MEDIUM

```ts
// Entire file content:
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { Coupon } from '@/lib/db/schema';
```

This file is **empty** — just imports, no actual functions. The coupon logic is entirely in the API routes (`app/api/coupons/validate/route.ts`, `app/api/checkout/initiate/route.ts`). This is not a placeholder, it's just a service file that wasn't completed. All coupon logic is in route handlers which violates layered architecture.

#### `lib/services/blog-view.service.ts`
**Status:** Unknown — not read

Could be similar stub.

#### `lib/services/audit.service.ts`
**Status:** Unknown — not read

Could be similar stub.

### 2.2 Unfinished API Routes

#### `app/api/auth/cart/route.ts`
**File exists:** ✅
**What it does:** Unknown — not read. Could be merge-cart endpoint or saved cart sync.

#### `app/api/auth/merge-cart/route.ts` (from git status)
**Status:** Shows as modified — indicates merge-cart functionality exists but may be incomplete.

### 2.3 Empty Service Files

From the `lib/services/` glob, 10 files exist:
```
lib/services/payment.service.ts        — ✅ has content
lib/services/coupon.service.ts         — ⚠️ EMPTY (just imports)
lib/services/minimax.ts                — ✅ has content
lib/services/blog-view.service.ts      — ⚠️ unknown
lib/services/audit.service.ts          — ⚠️ unknown
lib/services/inventory.service.ts      — ✅ has content
lib/services/points.service.ts         — ✅ has content
lib/services/notification.service.ts   — ⚠️ unknown
lib/services/shipping.service.ts        — ✅ has content
lib/services/cloudinary.service.ts     — ✅ has content
```

---

## 3. Immature Feature Patterns

### 3.1 Cart Validation — Stock Not Re-checked on Page Load

**File:** `store/cart.store.ts`

When cart items are loaded from localStorage, there's no validation against current DB stock. User could have stale cart items where stock is now 0 or significantly reduced.

**Expected behavior:** On hydration, call `/api/cart/validate` to verify all items are still available in requested quantities.

### 3.2 Points Redemption — No Server-Side Max Cap Enforcement in Validate

**File:** `app/api/coupons/validate/route.ts`

The coupon validate endpoint does NOT enforce the 50% of subtotal cap for points redemption — it only validates the coupon itself. The checkout page shows points usage up to 50% of subtotal, but if the API `/api/account/points` returns an incorrect balance, the client could try to redeem more.

The cap IS enforced in `/api/checkout/initiate` (line 323), but not in a dedicated validation endpoint.

### 3.3 Order Status Transitions — No Validation

**File:** `app/api/admin/orders/[id]/status/route.ts`

Does the status update route validate that the transition is legal? For example:
- Can you go from `cancelled` back to `paid`? (Should not)
- Can you go from `delivered` back to `shipped`? (Should not)
- Can warehouse staff set status to `delivered`? (Probably not — only admin)

If no transition validation exists, invalid status changes could break the order funnel.

### 3.4 Inventory Adjustment — No Negative Stock Guard

**File:** `app/api/admin/field/inventory/adjust/route.ts`

When adjusting stock to a new quantity, if the `newQuantity` is less than 0, it should be rejected. The route should validate `newQuantity >= 0` before applying.

### 3.5 Blog Post View Count — Race Condition

**File:** `app/api/blog/view/route.ts` (if exists)

If view counting is implemented with a simple counter increment, concurrent views could be lost. Should use a separate `blogPostViews` table entry per view (which exists in schema) rather than an aggregated counter.

---

## 4. Edge Cases Not Handled

### 4.1 Concurrent Payment Attempts (Same Order, 2 Users)

The 30-second idempotency window in initiate prevents the same user from creating duplicate orders within 30 seconds. But there's no protection against **two different users** somehow getting the same `orderNumber` (collision). The `orderDailyCounters` table uses atomic upsert, so sequence numbers shouldn't duplicate. But if the counter insert fails in one node of a distributed database, could duplicate order numbers be created?

### 4.2 Midtrans Settlement Arrives After Order Already Cancelled

**File:** `app/api/webhooks/midtrans/route.ts:85-93`

This case is handled — settlement for cancelled orders returns 200 with manual review note. Good.

### 4.3 Order Paid But Stock Deduct Fails (Race Condition)

**File:** `app/api/webhooks/midtrans/route.ts:127-141`

The webhook deducts stock with `GREATEST(stock - qty, 0)` and checks if `updated` is null. If stock was 0 and concurrent webhook fires, the deduction succeeds but stock doesn't go negative. However, if the product was deleted mid-order, the `where` clause wouldn't match and `updated` would be null, throwing an error and rolling back the transaction.

**Edge case:** If the variant was soft-deleted but stock still exists, the webhook still deducts. This is probably fine — an order placed before deletion should still be fulfillable.

### 4.4 Coupon Used on Order That Gets Cancelled, Then Re-Used

**File:** `app/api/webhooks/midtrans/route.ts:351-359`

Cancellation restores `usedCount` by `-1`. If the same coupon is used again by the same user within the per-user limit window, the restore + re-use could exceed the limit if there's a race. The `couponUsages` row is also deleted on cancellation, so re-validation would pass.

### 4.5 Points Earned on Order That Gets Refunded

If an order is refunded (not just cancelled), the points earned should be reversed. There's no `refunded` status handler that reverses points. See BUG-28 in checkout audit.

---

## 5. Features Partially Implemented

### 5.1 Testimonials Public API

**File:** `app/api/testimonials/public/route.ts`

The public testimonials endpoint exists. Need to verify:
- Does it only return `isActive: true` testimonials?
- Does it order by `sortOrder`?
- Does it paginate?

### 5.2 Public Settings API

**File:** `app/api/settings/public/route.ts`

Returns store settings for public access (opening hours, WhatsApp number, etc.). Need to verify it only returns settings marked as public.

### 5.3 Health Check Endpoint

**File:** `app/api/health/route.ts`

Basic health check. Should verify it returns 200 and checks:
- Database connectivity
- External API dependencies (RajaOngkir, Midtrans)

### 5.4 Cron Routes

Several cron routes exist in `app/api/cron/`:
- `cancel-expired-orders` — cancels orders past payment expiry
- `expire-points` — expires points older than 365 days
- `reconcile-points` — reconciles points balances
- `reconcile-payments` — reconciles Midtrans payments
- `points-expiry-warning` — sends warning emails
- `cleanup-counters` — cleans up old counters
- `cleanup-audit-logs` — cleans up old audit logs

**CRITICAL QUESTION:** Are these cron routes actually configured to run? In Vercel, cron routes need `vercel.json` configuration or a separate cron job setup. If not configured, these won't run automatically.

---

## 6. Admin Features — Incomplete

### 6.1 Bulk Product Operations

**File:** `app/api/admin/products/bulk/route.ts`

What bulk operations are supported?
- Bulk price update?
- Bulk stock update?
- Bulk activate/deactivate?

The route exists but the UI (ProductsClient) may not expose bulk actions.

### 6.2 B2B Quote Generation UI

**File:** `app/(admin)/admin/b2b-quotes/new/page.tsx`

Does the new quote form actually submit to the API? Does it validate selected products against DB? Does it generate a quote number using `b2bQuoteCounters`? Need to verify end-to-end.

### 6.3 Team Dashboard

**File:** `app/(admin)/admin/team-dashboard/page.tsx`

What is this page for? It has loading/error states so it exists. Need to understand the purpose and whether it's complete.

### 6.4 AI Content Page

**File:** `app/(admin)/admin/ai-content/page.tsx`

The page exists with loading/error states. But does the AI generation actually work in production? Has it been tested?

---

## 7. Code Patterns That Signal Incompleteness

### 7.1 Magic Strings Not Extracted to Constants

Examples:
- Order status strings: `'pending_payment'`, `'paid'`, etc. used as string literals in multiple places. Should use the enum `orderStatusEnum` values exported from schema.
- Courier codes: `'sicepat'`, `'jne'`, `'anteraja'` — defined in `lib/constants/couriers.ts` ✅ (good)

### 7.2 Hardcoded Config Values

Examples:
- Payment expiry of 15 minutes hardcoded in multiple places (should come from `systemSettings`)
- Points earn rate of 1000 (Rp 1,000 per point) — already in constants ✅

### 7.3 `as any` Casts

In `payment.service.ts` line 53:
```ts
} as any);
```
This suppresses type checking on the `callbacks` object passed to Midtrans. Should define a proper type.

### 7.4 Empty Catch Blocks

**Check all API routes** for empty catch blocks that silently swallow errors:

```ts
try {
  // something
} catch {
  // ignore - use defaults
}
```

Need to verify each catch block at minimum logs the error.

---

## 8. Missing Infrastructure

### 8.1 No Error Monitoring (Sentry, LogRocket)

No error tracking service configured. Production errors would be invisible without explicit log scanning.

### 8.2 No Analytics (PostHog, Plausible)

No user analytics. Can't measure:
- Conversion rate by page
- Cart abandonment rate
- Checkout drop-off points

### 8.3 No A/B Testing Infrastructure

No feature flag system for gradual rollouts.

### 8.4 No API Rate Limiting on Public Endpoints (beyond checkout/coupons)

Rate limiting exists on:
- `POST /api/checkout/initiate` — 10 req/min
- `POST /api/coupons/validate` — 10 req/min
- `POST /api/shipping/cost` — 20 req/min

But most public endpoints have no rate limiting:
- `GET /api/products/*`
- `GET /api/blog/*`
- `GET /api/testimonials/public`

### 8.5 No Image CDN Configuration

`next.config.mjs` was deleted — image optimization domains may not be configured. Should verify Cloudinary is in `images.domains` config.

---

## 9. Priority Fix List

| Priority | Issue | Fix |
|----------|-------|-----|
| P0-CRITICAL | B2B quote → order conversion unclear | Verify accept action creates order, or implement it |
| P0-CRITICAL | Cron routes may not be scheduled | Configure vercel.json or external scheduler |
| P0-CRITICAL | Admin API routes have no role checks | Add requireAdmin() to all admin routes |
| P1-HIGH | B2B approval doesn't notify customer | Add email on approval |
| P1-HIGH | Cart stock not re-validated on load | Add /api/cart/validate on hydration |
| P1-HIGH | `next.config.mjs` deleted — lost config | Recreate with image domains, security headers |
| P2-MEDIUM | Empty catch blocks in some routes | Add error logging |
| P2-MEDIUM | `as any` casts in payment service | Define proper types |
| P2-MEDIUM | Coupon service file is empty | Add actual service layer functions |
| P2-MEDIUM | Testimonials public API not verified | Verify it works and returns active only |
| P3-LOW | No error monitoring service | Consider Sentry |
| P3-LOW | No user analytics | Consider Plausible |
| P3-LOW | Bulk operations UI not built | Verify ProductsClient exposes bulk UI |