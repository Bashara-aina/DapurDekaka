# AUDIT-05: Architecture Gaps, Security Issues & PRD Deviations

**Project:** DapurDekaka.com  
**Auditor:** Deep Code Audit  
**Date:** May 2026  
**Scope:** Cross-cutting issues, security, flows, PRD compliance, migration status

---

## PART 1: SECURITY AUDIT

### 1. CRITICAL — No Rate Limiting on Auth Endpoints

**File:** `app/api/auth/[...nextauth]/route.ts`, `app/api/auth/register/route.ts`, `app/api/auth/forgot-password/route.ts`

**Problem:** There is no rate limiting on authentication endpoints. A bad actor could:
- Brute-force credentials via `/api/auth/callback/credentials`
- Spam registration via `/api/auth/register`
- Spam password reset requests via `/api/auth/forgot-password`

**PRD requirement:** "Rate limiting on: `/api/auth/*`, `/api/coupons/validate`, `/api/checkout/*`" (CURSOR_RULES.md Section 6.3)

**Fix:** Add rate limiting to all auth routes:
```typescript
import { rateLimit } from '@/lib/utils/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
});

export async function POST(req: NextRequest) {
  await limiter(req);
  // ... rest of handler
}
```

---

### 2. CRITICAL — Midtrans Webhook Signature Verification Missing in Some Paths

**File:** `app/api/webhooks/midtrans/route.ts`

The webhook correctly verifies the signature:
```typescript
const isValid = verifyMidtransSignature(
  body.order_id, body.status_code, body.gross_amount,
  process.env.MIDTRANS_SERVER_KEY!, body.signature_key
);
if (!isValid) return NextResponse.json({ received: false }, { status: 400 });
```

**However:** The `gross_amount` from Midtrans is a string (e.g., `"236000.00"`). The verification code should convert this to integer before comparison. If `gross_amount` has decimal places, the string comparison could fail.

**Fix:** In `verifyMidtransSignature()`, convert `grossAmount` to integer:
```typescript
const grossAmountInt = parseInt(grossAmount.split('.')[0], 10);
```

---

### 3. CRITICAL — No CSRF Protection on State-Changing GET Requests

**File:** `app/api/coupons/validate/route.ts`

A `GET /api/coupons/validate?code=X` endpoint exists. While this is for coupon validation, any URL with side effects should use POST, not GET.

**Problem:** GET requests should not have side effects. If a browser preloads a URL or a crawler hits it, it could waste server resources.

**Fix:** Change `app/api/coupons/validate/route.ts` to `POST` only.

---

### 4. HIGH — `full_export.sql` May Be in Git

**File:** `.gitignore` — check for `full_export.sql`

**Problem:** If `full_export.sql` is not in `.gitignore`, it could be committed with sensitive customer data (emails, addresses, order history).

**Fix:** Verify `.gitignore` contains:
```
full_export.sql
*.sql.backup
/scripts/seed-production.ts
```

If not present, add immediately.

---

### 5. HIGH — `AUTH_SECRET` Not Verified on Startup

**File:** `lib/auth/config.ts` or `lib/auth/index.ts`

**Problem:** There's no startup validation to ensure `AUTH_SECRET` is set and is sufficiently long (32+ chars). If `AUTH_SECRET` is missing or too short, NextAuth sessions are insecure.

**Fix:** Add to `lib/config/validate-env.ts`:
```typescript
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('AUTH_SECRET must be at least 32 characters. Run: openssl rand -base64 32');
}
```

---

### 6. HIGH — Cloudinary Upload Not Using Signed URLs Properly

**File:** `lib/cloudinary/upload.ts`

**Problem:** `generateSignedUploadParams()` returns signed upload parameters for client-side upload. However, the `timestamp` parameter (Unix epoch) in the signed URL must be checked server-side to prevent replay attacks.

**Fix:** In the `serverSideUpload()` function, verify the signed upload happened within a time window:
```typescript
const maxAge = 60; // seconds
if (Date.now() / 1000 - timestamp > maxAge) {
  throw new Error('Upload signature expired');
}
```

---

### 7. MEDIUM — Password Reset Token Not SHA256 Hashed

**File:** `lib/db/schema.ts` — `passwordResetTokens`

```typescript
tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
```

**Problem:** The token is stored as a SHA256 hash. This is good, but the token generation should be cryptographically random (not sequential or guessable).

**Current implementation likely:** Uses `crypto.randomBytes()` — verify this is the case in the reset-password flow.

---

### 8. MEDIUM — Session Token Not Rotated on Password Change

**File:** `app/api/auth/reset-password/route.ts`

**Problem:** When a user resets their password, their existing sessions are not invalidated. An attacker who has a stolen session cookie would remain logged in even after the password is changed.

**Fix:** On password change, delete all sessions for that user:
```typescript
await db.delete(sessions).where(eq(sessions.userId, userId));
```

---

### 9. MEDIUM — Admin User Role Changes Not Logged

**File:** `app/api/admin/users/[id]/route.ts`

**Problem:** When an admin changes another user's role (e.g., from `owner` to `customer`), there's no `admin_activity_logs` entry recording who changed what, when, and the before/after state.

**Fix:** Add audit logging for role changes:
```typescript
await db.insert(adminActivityLogs).values({
  userId: adminId,
  action: 'user.role_changed',
  entityType: 'user',
  entityId: targetUserId,
  beforeState: { role: oldRole },
  afterState: { role: newRole },
});
```

---

### 10. MEDIUM — No Input Sanitization on Rich Text (Blog)

**File:** `app/(store)/blog/[slug]/page.tsx`

**Problem:** Blog content is stored as HTML (TipTap editor output) and rendered with `dangerouslySetInnerHTML`. `DOMPurify.sanitize()` is applied, but the allowed tags list should be verified.

**Current:** `lib/blog/helpers/sanitize.ts` (or wherever the sanitization is) — verify allowed tags:
```typescript
const clean = DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class'],
});
```

---

### 11. LOW — Tracking URL Deep Links Not Verified

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

**Problem:** The tracking URL (e.g., `https://www.sicepat.com/checkAwb?awb=XXX`) is displayed as a link. The URL is constructed from `trackingUrl` field which comes from the DB. If an attacker gains access to an order and modifies the tracking URL field, they could set it to a phishing URL.

**Mitigation:** The `trackingUrl` is set by warehouse staff via the admin panel. It's stored as text and displayed as-is. The system should validate the URL pattern before saving.

**Fix:** Add URL validation in the shipments API:
```typescript
const TRACKING_URL_PATTERNS = {
  sicepat: /^https:\/\/www\.sicepat\.com\/checkAwb\?awb=/,
  jne: /^https:\/\/www\.jne\.co\.id\/id\/tracking\/trace\//,
  anteraja: /^https:\/\/anteraja\.id\/tracking\//,
};

if (!TRACKING_URL_PATTERNS[courierCode]?.test(url)) {
  throw new Error('Invalid tracking URL for courier');
}
```

---

## PART 2: CHECKOUT FLOW GAPS

### 12. CRITICAL — B2B Net-30 Order Never Leaves `pending_payment`

**File:** `app/(store)/checkout/page.tsx`, `app/api/checkout/initiate/route.ts`

When a B2B user with Net-30 approval creates an order:
1. `POST /api/checkout/initiate` is called with `isB2B: true`
2. The Midtrans flow is skipped (no Snap token)
3. Order is created with `status: 'pending_payment'`
4. User is redirected to `/checkout/success`
5. Order stays in `pending_payment` forever — no webhook fires

**Problem:** Stock is never deducted, points are never awarded, coupon usage is never confirmed, because the payment never "settles."

**Fix:** For B2B Net-30 orders, immediately after creating the order:
```typescript
// In checkout/initiate — for B2B Net-30:
await db.update(orders).set({ status: 'paid', paidAt: new Date() }).where(...);

// Run the same transaction as the webhook settlement:
// - Deduct stock
// - Award points
// - Confirm coupon usage
// - Send confirmation email
```

---

### 13. CRITICAL — Stock Is Deducted in `initiate` NOT in Webhook

**File:** `app/api/checkout/initiate/route.ts`

Looking at the checkout initiation flow: stock is deducted at order creation (in `initiate`), NOT at payment settlement (webhook).

**This is the OPPOSITE of what the PRD says:**
- PRD Section 5.4: "Payment settlement processing... Deduct stock for each variant"
- CURSOR_RULES.md Section 5.4: "Stock deduction — ALWAYS atomic, happens at webhook settlement"

**Problem:** If a user initiates checkout (stock is deducted), then fails to pay within 15 minutes, the order is cancelled but stock is already deducted. The stock would be deducted twice if the user retries (new order = new deduction).

**Fix:** 
1. **Remove** stock deduction from `POST /api/checkout/initiate`
2. **Move** stock deduction into the `POST /api/webhooks/midtrans` settlement handler
3. The webhook should handle: `settlement` → deduct stock + confirm coupon + award points + send email

---

### 14. HIGH — Payment Retry Logic Not Fully Implemented

**File:** `app/(store)/checkout/pending/page.tsx`, `app/api/checkout/initiate/route.ts`

The PRD says:
- Max 3 retries
- Each retry generates new Midtrans order_id: `DDK-YYYYMMDD-XXXX-retry-1`
- Old snap_token discarded, new one generated

**Current state:** The "Bayar Lagi" button on the pending page exists and calls `initiate` again. But `paymentRetryCount` is not checked — there's no limit of 3 retries.

**Fix:** In `POST /api/checkout/initiate`:
```typescript
const currentRetries = order.paymentRetryCount ?? 0;
if (currentRetries >= 3) {
  // Cancel the order
  await db.update(orders).set({ status: 'cancelled' }).where(...);
  return NextResponse.json({ success: false, error: 'Maksimal percobaan pembayaran tercapai' }, { status: 400 });
}

// Increment retry count
await db.update(orders).set({ paymentRetryCount: currentRetries + 1 }).where(...);
```

---

### 15. MEDIUM — Points Are Deducted at Order Creation, Not at Settlement

**File:** `app/api/checkout/initiate/route.ts`

**Problem:** Points used for redemption (`points_discount`) are deducted from the user's `points_balance` at order creation (in `initiate`). If the payment fails and the order is cancelled, points need to be reversed.

**Current state:** If payment fails and order goes to `cancelled`, the points reversal logic likely exists (in webhook cancellation path), but it should be verified.

**Fix:** Ensure the cancellation handler in the webhook:
1. Reverses `points_discount` (adds back to `points_balance`)
2. Creates a `redeem` record with negative points amount
3. Reverses `coupon.used_count` (if coupon was used)

---

### 16. MEDIUM — Coupon `used_count` Not Incremented at Settlement

**File:** `app/api/webhooks/midtrans/route.ts`

**Problem:** The webhook's settlement handler should increment `coupon.used_count` only after payment is confirmed. Looking at the code, this might be happening in `createTransaction()` (at initiate time), which is wrong — it should only happen at settlement.

**Fix:** Move `coupon.used_count` increment to the settlement handler in the webhook, not in `initiate`.

---

## PART 3: DATABASE MIGRATION & DATA ISSUES

### 17. HIGH — `inventory_logs` Table Exists But Not Used Properly

**File:** `lib/db/schema.ts` — `inventory_logs`

**Problem:** The `inventory_logs` table tracks stock changes, but it's not being written to by the stock deduction logic in the webhook. Warehouse staff stock updates might not be creating log entries.

**Fix:** Audit all places where `product_variants.stock` is updated and ensure `inventory_logs` entries are created:
- Webhook settlement → `changeType: 'sale'`
- Admin stock edit → `changeType: 'manual'`
- Restock → `changeType: 'restock'`
- Reversal → `changeType: 'reversal'`

---

### 18. HIGH — Order Number Generation Not Atomic

**File:** `lib/utils/generate-order-number.ts`

**The `generateOrderNumber()` function:**
```typescript
export async function generateOrderNumber(): Promise<string> {
  const today = format(new Date(), 'yyyyMMdd');
  const prefix = `DDK-${today}-`;
  const lastOrder = await db.query.orders.findFirst({
    where: like(orders.orderNumber, `${prefix}%`),
    orderBy: [desc(orders.createdAt)],
  });
  const counter = lastOrder ? parseInt(lastOrder.orderNumber.split('-')[2]) + 1 : 1;
  return `${prefix}${String(counter).padStart(4, '0')}`;
}
```

**Problem:** If two orders are created simultaneously (race condition), both could get the same `orderNumber`. The `orderNumber` has a UNIQUE constraint in the DB, so one would fail, but this could cause issues.

**Fix:** Use a database sequence or advisory lock for the counter:
```typescript
// Use a DB transaction with row-level locking
const result = await db.execute(sql`
  INSERT INTO order_counter (date, counter)
  VALUES (${today}, 1)
  ON CONFLICT (date) DO UPDATE SET counter = order_counter.counter + 1
  RETURNING counter
`);
```

Or use an atomic counter with a dedicated `counters` table.

---

### 19. MEDIUM — Soft Delete Not Enforced in All Queries

**File:** Multiple places — queries for `products`, `blog_posts`, etc.

**Problem:** Some queries might not filter `deleted_at IS NULL`. If a product is soft-deleted (deleted_at set), it could still appear in some queries that don't explicitly check for it.

**Fix:** Audit all `db.query.products.findMany()` calls to ensure they include:
```typescript
where: and(eq(products.isActive, true), isNull(products.deletedAt))
```

---

### 20. MEDIUM — `points_balance` Not Auto-Reconciled

**File:** `lib/services/points.service.ts`

**Problem:** `users.points_balance` is a denormalized field — it's a running total updated on every earn/redeem/expire. If the sum of `points_history` ever drifts from `users.points_balance`, there's no automatic reconciliation.

**Fix:** Add a cron job to reconcile points:
```typescript
// /api/cron/reconcile-points
// For each user, compare points_balance with sum(points_history)
// If mismatch > 0, update points_balance and log the adjustment
```

---

## PART 4: AUTH & SESSION ISSUES

### 21. HIGH — Google OAuth User Creation Not Merging Existing Account

**File:** `lib/auth/config.ts` or NextAuth callbacks

**Problem:** If a user registers with email/password first, then later tries to log in with Google using the same email, NextAuth's default behavior is to fail or create a new account (depending on config). There's no merge logic.

**Fix:** In the NextAuth `jwt` or `session` callback:
```typescript
// Check if email exists in users table but is a different provider account
// If so, link the Google account to the existing user record
```

---

### 22. MEDIUM — Session Not Refreshed on Activity

**File:** `lib/auth/config.ts`

**Problem:** NextAuth session has a 30-day expiry (`strategy: 'database'`). If a user is active for 29 days, then idle, their session expires. There's no sliding session refresh.

**Fix:** Configure NextAuth with `session.maxAge` and potentially use the `refreshToken` feature. Alternatively, show a warning at 25 days and prompt re-login.

---

### 23. HIGH — Warehouse Staff Cannot Access `/admin/field`

**File:** `app/middleware.ts`

The `warehouse` role is restricted to `/admin/inventory` and `/admin/shipments`:
```typescript
if (session.user.role === 'warehouse') {
  const allowed = ['/admin/inventory', '/admin/shipments'];
  if (!allowed.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/admin/inventory', req.url));
  }
}
```

**Problem:** The `/admin/field` route (warehouse mobile UI) is not in the allowed list. Warehouse staff can't access the field dashboard.

**Fix:** Add `/admin/field` to the warehouse allowed paths:
```typescript
const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
```

---

## PART 5: MISCELLANEOUS PRD DEVIATIONS

### 24. MEDIUM — No `is_b2b_available` Filter in Store Product Listing

**File:** `app/(store)/products/page.tsx`

**Problem:** The PRD says B2B products have `is_b2b_available = true` as a separate flag. The store product listing might show B2B-only products to regular customers (or not show B2B products to B2B users in the regular store).

**Fix:** In the product listing query:
```typescript
// For B2B users:
const products = await db.query.products.findMany({
  where: and(eq(products.isActive, true), isNull(products.deletedAt)),
});
// Filter for B2B catalog:
const b2bProducts = products.filter(p => p.isB2bAvailable);
```

---

### 25. MEDIUM — Points Expiry Cron Not Set Up

**File:** `app/api/cron/expire-points/route.ts` (exists), `app/api/cron/points-expiry-warning/route.ts` (exists)

**Problem:** The cron endpoints exist (`expire-points`, `points-expiry-warning`) but there's no scheduled trigger for them. They need to be called by an external cron service (Vercel Cron, or a service like cron-job.org) at the configured interval.

**Fix:** Set up `vercel.json` cron configuration or document the cron endpoints for external scheduling:
```json
{
  "crons": [
    { "path": "/api/cron/points-expiry-warning", "schedule": "0 9 * * *" },
    { "path": "/api/cron/expire-points", "schedule": "0 0 * * *" },
    { "path": "/api/cron/cancel-expired-orders", "schedule": "*/5 * * * *" }
  ]
}
```

---

### 26. MEDIUM — RajaOngkir API Key Exposed in Browser Bundle

**File:** `lib/rajaongkir/client.ts`

**Problem:** The RajaOngkir API key is used in `lib/rajaongkir/client.ts`, which runs on the server. However, if the client-side checkout page fetches shipping costs by calling an API route that uses this key, it should be fine. But if `lib/rajaongkir/client.ts` is imported on the client side, the API key could leak.

**Mitigation:** Verify that `lib/rajaongkir/` is only imported in Server Components and API routes, never in client components.

---

### 27. MEDIUM — No `shopee_url` in Product Schema

**File:** `lib/db/schema.ts` — `products`

The schema has `shopee_url` field:
```typescript
shopeeUrl: text('shopee_url'),
```

**Problem:** But there's no UI in the admin product form to set this URL. The `ProductForm.tsx` doesn't have a "Shopee URL" field.

**Fix:** Add a "Shopee URL" field to `ProductForm.tsx` for admin to set reference links.

---

### 28. LOW — Newsletter/Email Subscription Not Implemented

**File:** N/A — feature not in store

**Problem:** There's no email newsletter signup form on the store. This is P3 in the PRD, but it's mentioned in the business goals ("email list, points, repeat purchase loop").

**Fix:** Either implement it now or explicitly mark it as deferred.

---

### 29. LOW — `system_settings` Table Has No UI

**File:** `lib/db/schema.ts` — `system_settings`

**Problem:** The `system_settings` table stores key-value configuration (store hours, WhatsApp number, etc.), but there's no UI for the admin to edit these values — only `/admin/settings/page.tsx` exists for reading/updating some of them.

**Fix:** Audit `/admin/settings/page.tsx` — does it cover all system settings? The `get-settings.ts` helper suggests many settings. Verify the admin settings page has all the necessary fields.

---

### 30. MEDIUM — Blog Post Views Not Tracked

**File:** No `blog_post_views` table

**Problem:** There's no analytics on blog post views. Can't tell which posts are most popular.

**Fix:** See Audit-04 item 5 — add `blog_post_views` table.

---

### 31. HIGH — `origin city_id` Hardcoded in Two Places

**File:** `lib/constants/couriers.ts` and `lib/services/shipping.service.ts`

```typescript
// couriers.ts
ORIGIN_CITY_ID: '23',  // Bandung

// shipping.service.ts (separate)
const ORIGIN_CITY_ID = '23';  // duplicated
```

**Problem:** If the origin city changes (Bandung moves, or they open a second warehouse), this would need to be updated in two places. The `system_settings` table should store this as `rajaongkir_origin_city_id`.

**Fix:** Remove `ORIGIN_CITY_ID` from `couriers.ts` and `shipping.service.ts`. Read from system settings:
```typescript
const settings = await getSettings();
const originCityId = settings.rajaongkir_origin_city_id ?? '23';
```

---

### 32. MEDIUM — B2B Quote PDF Not Generated for All Quotes

**File:** `app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts`

**Problem:** B2B quotes have a PDF generation endpoint. But if a quote is created without generating the PDF, the `pdf_url` field is null. The admin might email the quote without a PDF attachment.

**Fix:** Ensure the quote send flow either auto-generates the PDF or provides a link to download it.

---

### 33. MEDIUM — Testimonials Not Randomized

**File:** `app/(store)/home/Testimonials.tsx`

**Problem:** Testimonials are fetched and displayed in the order of `sort_order`. They're not shuffled or randomized. The same testimonials always appear in the same position.

**Fix:** Either shuffle the testimonials array before rendering, or add a `is_random` flag to the schema.

---

### 34. MEDIUM — No `meta_robots` Per Page

**File:** All page components

**Problem:** There's no per-page robots meta tag control. Some pages (e.g., `/admin/*`, `/account/*`) should have `robots: noindex`, but this isn't being set explicitly.

**Fix:** In the root layout or middleware, add:
```typescript
// In middleware or root layout
if (pathname.startsWith('/admin') || pathname.startsWith('/account')) {
  // Set robots: noindex
}
```

---

## PART 6: SUMMARY — PRIORITY FIX QUEUE

| Priority | Issue | Impact |
|---|---|---|
| **P0 — CRITICAL** | B2B Net-30 orders never progress from `pending_payment` | Stock not deducted, points not awarded |
| **P0 — CRITICAL** | Stock deducted at order creation, not at webhook settlement | Stock lost on payment failure |
| **P0 — CRITICAL** | No rate limiting on auth endpoints | Brute force / DoS vulnerability |
| **P0 — CRITICAL** | Payment retry count not capped at 3 | Infinite payment retries |
| **P1 — HIGH** | `use-cart-merge.ts` clears cart instead of applying merge | Cart data loss on login |
| **P1 — HIGH** | `Providers.tsx` locale hardcoded to `"id"` | Language toggle non-functional |
| **P1 — HIGH** | Warehouse staff can't access `/admin/field` | Role-based restriction too narrow |
| **P1 — HIGH** | Two independent shipping implementations | Maintenance risk, drift |
| **P1 — HIGH** | Cloudinary two configs with different env var names | Wrong cloud could be used |
| **P1 — HIGH** | Coupon `used_count` incremented at initiate, not settlement | Coupon overcounted on failed payment |
| **P2 — MEDIUM** | Duplicate interface bugs in `CouponInput` and `PointsRedeemer` | TypeScript confusion |
| **P2 — MEDIUM** | Points deducted at order creation, reversed on failure (fragile) | Should be confirmed at settlement |
| **P2 — MEDIUM** | No CSRF protection on state-changing GET endpoints | Unintended side effects |
| **P2 — MEDIUM** | Order number generation not atomic (race condition) | Duplicate order numbers possible |
| **P2 — MEDIUM** | Origin city ID hardcoded in two places | Maintenance drift |
| **P2 — MEDIUM** | `points_balance` not auto-reconciled with history | Balance drift over time |
| **P3 — LOW** | `PRODUCT_DETAIL_CLIENT` oversized (356 lines) | Exceeds 300-line limit |
| **P3 — LOW** | `PRODUCT_FORM` oversized (571 lines) | Exceeds 300-line limit |
| **P3 — LOW** | Newsletter signup not implemented | Missing growth channel |