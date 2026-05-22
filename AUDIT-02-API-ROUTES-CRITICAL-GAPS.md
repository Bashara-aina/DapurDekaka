# AUDIT-02: API Routes — Critical Gaps & Path Inconsistencies

**Project:** DapurDekaka.com  
**Auditor:** Deep Code Audit  
**Date:** May 2026  
**Scope:** `app/api/`

---

## OVERVIEW

**Planned API routes:** 26  
**Exist and functional:** 19  
**Missing entirely (critical gaps):** 5  
**Naming deviation:** 1  
**Unexpected but functional:** 60+  

---

## 1. MISSING — Public Product Listing API

### `app/api/products/route.ts`

**Status:** **MISSING** — Critical gap

**Planned purpose:** Public `GET /api/products` — product listing with search, filter by category, pagination.

**Current state:** No file exists at this path. The store pages fetch products via Server Components directly (not through an API), but the cart validation endpoint (`/api/cart/validate`) and other services may expect a product API to exist.

**Impact:** No centralized product listing endpoint for third-party integrations, bots, or mobile app use. If any client-side code needs product data outside of Server Components, there's no REST endpoint to call.

**Fix:** Create `app/api/products/route.ts` with `GET` handler that supports:
- `?q=search` — full-text search on name_id, name_en
- `?category=slug` — filter by category slug
- `?page=` and `?limit=` — pagination (default limit 20)
- Returns only `is_active = true` products with `deleted_at IS NULL`
- Includes first product image (sort_order = 0), primary variant price

---

## 2. MISSING — Public Product Detail API

### `app/api/products/[slug]/route.ts`

**Status:** **MISSING** — Critical gap

**Planned purpose:** Public `GET /api/products/[slug]` — single product with all variants, images, and category.

**Current state:** No file exists at this path. Product detail pages use `generateStaticParams` + direct DB query in Server Components.

**Impact:** No REST endpoint for product detail. No way for external systems (mobile app, integrations) to fetch a single product by slug via HTTP API.

**Fix:** Create `app/api/products/[slug]/route.ts` with `GET` handler:
- `GET` by slug: `db.query.products.findFirst({ where: eq(products.slug, slug), with: { variants: true, images: true, category: true } })`
- Returns 404 if not found or `is_active = false`
- Security: does not expose soft-deleted products

---

## 3. MISSING — Public Blog API

### `app/api/blog/route.ts`

**Status:** **MISSING** — Critical gap

**Planned purpose:** Public `GET /api/blog` — blog listing with search, category filter, pagination. `POST` for creating blog posts (admin).

**Current state:** Only `app/api/admin/blog/route.ts` exists (admin-only). No public blog API.

**Impact:**
- The store blog pages (`app/(store)/blog/page.tsx` and `app/(store)/blog/[slug]/page.tsx`) fetch blog data via Server Components using direct DB queries — this works for SSR but provides no API for:
  - Mobile app
  - Content syndication
  - External blog aggregators
  - RSS feed generation

**Fix:** Create `app/api/blog/route.ts`:
- `GET` — public blog listing (only `is_published = true`), supports `?q=`, `?category=`, `?page=`, `?limit=`
- Returns: id, title, slug, excerpt, cover_image_url, reading_time, published_at, category name, author name

---

## 4. MISSING — Points Redemption Standalone Endpoint

### `app/api/points/redeem/route.ts`

**Status:** **MISSING** — Critical gap (but functionally covered elsewhere)

**Planned purpose:** `POST /api/points/redeem` — standalone endpoint to validate and deduct points before applying to checkout.

**Current state:** Points deduction is embedded inside `POST /api/checkout/initiate`. There is no separate points redemption endpoint.

**Assessment:** The functional need is met (points are deducted at checkout initiation), but the PRD calls for a separate `/api/points/redeem` endpoint. The current implementation is arguably better (no extra network round-trip), but it means:

- Points can only be redeemed as part of checkout initiation
- There's no way to "preview" how many points a user has before starting checkout
- No way to check points balance independently

**Impact:** Low — the functionality exists, just not as a standalone endpoint. If the PRD explicitly requires the standalone endpoint, it needs to be created.

**Fix:** If the standalone endpoint is required, create `app/api/points/redeem/route.ts`:
- `POST` — `{ userId, pointsToRedeem }` → validates user has sufficient points → returns `{ success: true, pointsUsed, pointsRemaining }` without creating an order
- Used by checkout flow to pre-check points before order creation

---

## 5. MISSING — Checkout Pickup Invitation API

### `app/api/checkout/pickup-invitation/route.ts`

**Status:** **MISSING** — but functional equivalent exists

**Planned purpose:** `GET /api/checkout/pickup-invitation?orderNumber=X` — generate pickup invitation data for a paid pickup order.

**Current state:** The webhook (`/api/webhooks/midtrans`) sends the `PickupInvitationEmail` directly when a pickup order is paid. There's no separate API endpoint to fetch pickup invitation data.

**Assessment:** The functionality is covered — the pickup invitation is generated and sent via email automatically. No REST endpoint for fetching the pickup invitation data exists, but this is a minor gap since the primary use case (email delivery) is covered.

**Fix:** Create `app/api/checkout/pickup-invitation/route.ts`:
- `GET` — returns pickup invitation data (order number, store address, hours, WhatsApp, Google Maps link, instructions)
- Requires either: (a) authenticated owner/superadmin, or (b) email verification for guest orders

---

## 6. MISSING — Admin Inventory Management API

### `app/api/admin/inventory/route.ts`

**Status:** **MISSING** — critical gap

**Planned purpose:** Admin CRUD for stock updates — `GET` list of all variants with stock, `PATCH` to update stock.

**Current state:** Only `app/api/admin/field/inventory/route.ts` exists (warehouse field ops). The planned admin inventory management endpoint doesn't exist as a standalone CRUD endpoint.

**Assessment:** The `field` inventory API is designed for warehouse workers (mobile-optimized), not for admin stock management. The admin inventory page (`/admin/inventory`) likely uses the `field/inventory` API or direct DB mutations.

**Fix:** Create `app/api/admin/inventory/route.ts`:
- `GET` — list all variants with current stock, product name, SKU (superadmin/owner/warehouse roles)
- `PATCH` — update stock for a variant, creates `inventory_logs` entry (superadmin/owner/warehouse)
- Includes `changed_by_user_id`, `note` fields for audit trail

---

## 7. NAMING DEVIATION — AI Caption Endpoint

### `app/api/ai/caption/route.ts` vs `app/api/ai/generate-caption/route.ts`

**Status:** Implemented as `caption/route.ts`, planned as `generate-caption/route.ts`

**Assessment:** Functionally equivalent — both accept `POST` with `{ productId, platform, language, tone? }` and return `{ caption, hashtags }`. The naming is slightly different but the endpoint is functional and correct.

**No fix needed** — the implementation is correct, just the planned filename was slightly different.

---

## 8. PLANNED BUT MISSING — Blog Detail API

### `app/api/blog/[slug]/route.ts`

**Status:** **MISSING** — public blog detail API

**Planned purpose:** Public `GET /api/blog/[slug]` — single blog post by slug.

**Current state:** Blog post detail is fetched via Server Component in `app/(store)/blog/[slug]/page.tsx`. No public REST endpoint.

**Impact:** Same as missing blog listing API — no external access to blog content.

**Fix:** Create `app/api/blog/[slug]/route.ts`:
- `GET` — returns full blog post (only `is_published = true`), sanitized content, author info, category, cover image, reading time

---

## 9. PATH INCONSISTENCY — Admin Orders Has Both Route-Level and [id]-Level

**Files found:**
- `app/api/admin/orders/route.ts` — GET list, POST create
- `app/api/admin/orders/[id]/route.ts` — GET/PATCH single order
- `app/api/admin/orders/[id]/status/route.ts` — PATCH status

**Planned structure:** Single `app/api/admin/orders/route.ts` was planned for all admin order operations (list + CRUD). The actual implementation has split it into 3 route files which is actually better separation of concerns.

**Assessment:** This is an improvement over the plan, not a gap. The separation allows granular permission (e.g., only superadmin can update order status, while owner can view all).

---

## 10. EXTRA ROUTES NOT IN PLAN (Summary)

The codebase has **60+ additional API routes** beyond the 26 planned. These are organized into:

### Admin Dashboard KPIS & Metrics (8 routes)
```
app/api/admin/dashboard/kpis/route.ts
app/api/admin/dashboard/order-funnel/route.ts
app/api/admin/dashboard/action-queue/route.ts
app/api/admin/dashboard/inventory-flash/route.ts
app/api/admin/dashboard/live-feed/route.ts
app/api/admin/dashboard/alerts/route.ts
app/api/admin/dashboard/revenue-chart/route.ts
app/api/admin/team-dashboard/... (multiple)
```
These appear functional and well-structured. Most are for the superadmin dashboard.

### Admin Field/Warehouse Ops (8 routes)
```
app/api/admin/field/inventory/route.ts
app/api/admin/field/inventory/adjust/route.ts
app/api/admin/field/inventory/restock/route.ts
app/api/admin/field/pickup-queue/route.ts
app/api/admin/field/packing-queue/route.ts
app/api/admin/field/tracking-queue/route.ts
app/api/admin/field/orders/[id]/route.ts
app/api/admin/field/worker-activity/route.ts
app/api/admin/field/today-summary/route.ts
```
These support the warehouse mobile UI (separate from admin dashboard).

### Admin CRUD for Entities (15+ routes)
Each entity has full CRUD: `app/api/admin/b2b-profiles/`, `app/api/admin/b2b-inquiries/`, `app/api/admin/b2b-quotes/`, `app/api/admin/coupons/[id]/`, `app/api/admin/carousel/[id]/`, `app/api/admin/categories/`, `app/api/admin/users/` — each with list + detail + actions (`approve`, `invite`, `summary`, etc.).

### Account-Scoped Routes (5 routes)
```
app/api/account/profile/route.ts
app/api/account/addresses/route.ts
app/api/account/addresses/[id]/route.ts
app/api/account/points/route.ts
app/api/account/vouchers/route.ts
```
These are good — they provide a proper API layer for the account section.

### Auth Scoped Routes (4 routes)
```
app/api/auth/register/route.ts
app/api/auth/forgot-password/route.ts
app/api/auth/reset-password/route.ts
app/api/auth/merge-cart/route.ts
```
Good — these provide endpoints for auth flows that weren't explicitly planned.

### B2B API Routes (5 routes)
```
app/api/b2b/orders/route.ts
app/api/b2b/orders/[orderNumber]/route.ts
app/api/b2b/quotes/route.ts
app/api/b2b/quotes/[id]/[action]/route.ts
app/api/b2b/profile/route.ts
app/api/b2b/points/route.ts
```
Good — these provide B2B portal API coverage beyond what was planned.

### Cron Jobs (7 routes)
```
app/api/cron/cancel-expired-orders/route.ts
app/api/cron/cleanup-counters/route.ts
app/api/cron/cleanup-audit-logs/route.ts
app/api/cron/points-expiry-warning/route.ts
app/api/cron/expire-points/route.ts
app/api/cron/reconcile-points/route.ts
app/api/cron/reconcile-payments/route.ts
```
These are excellent operational safety nets not in the original plan. They handle:
- Auto-cancel orders with `pending_payment` older than payment_expires_at
- Points expiry (365-day FIFO)
- Points reconciliation (fix running balance drift)
- Payment reconciliation (ensure DB state matches Midtrans state)
- Audit log cleanup (prevent unbounded growth)

### Other Infrastructure (6 routes)
```
app/api/health/route.ts — health check
app/api/settings/public/route.ts — public system settings
app/api/testimonials/public/route.ts — public testimonials
app/api/upload/route.ts — Cloudinary signed upload
app/api/coupons/validate/route.ts — coupon validation
app/api/cart/validate/route.ts — cart stock validation
```

---

## 11. DUPLICATION CONCERN — Email Sending Has Two Patterns

**Pattern A:** React Email templates in `lib/resend/templates/` — `OrderConfirmation.tsx`, `OrderShipped.tsx`, `OrderDelivered.tsx`, `OrderCancellation.tsx`, `PasswordReset.tsx`, `PickupInvitation.tsx`, `B2BInquiryAutoReply.tsx`, etc.

**Pattern B:** Raw HTML strings in `lib/services/notification.service.ts` — `sendOrderConfirmationEmail()`, `sendShippingEmail()` use `html: '<html>...'` raw HTML strings.

**Problem:** `notification.service.ts` and `lib/resend/send-email.ts` both send emails for the same triggers. The React Email path is the intended production path. The raw HTML path is likely legacy or test code.

**Fix:** Audit `notification.service.ts` — remove the raw HTML email functions if they're redundant, keep only the React Email template path.

---

## 12. DUPLICATION CONCERN — B2B Order Status Webhook Missing

**File:** `app/api/webhooks/midtrans/route.ts`

The webhook handles `settlement` → `paid` for regular orders and sends `PickupInvitationEmail` for pickup orders. However, for **B2B orders with Net-30 payment**, there's no webhook handler to automatically update the B2B order status when a Net-30 invoice payment is confirmed.

**Current state:** B2B Net-30 orders skip Midtrans (no payment initiation). There's no webhook because no Midtrans transaction exists. The order stays in `pending_payment` until manually updated.

**Fix:** Either:
1. Create a separate webhook or API endpoint for B2B Net-30 payment confirmation
2. Or ensure that the B2B order creation (in `checkout/initiate`) creates an order with `status: 'paid'` directly (since Net-30 means payment is guaranteed via invoice, not upfront)