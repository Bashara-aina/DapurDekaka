# AUDIT 02 — Backend API
# DapurDekaka.com — Full API Route Audit
**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** All API routes, missing endpoints, auth, security

---

## LEGEND
- ✅ Exists & implemented
- ⚠️ Exists but incomplete/broken
- ❌ Missing — referenced in frontend but not built
- 🔴 Critical
- 🟡 Major
- 🟢 Minor

---

## 1. COMPLETE API ROUTE INVENTORY

### 1.1 Auth Routes

| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | ALL | ✅ | NextAuth handlers |
| `/api/auth/register` | POST | ✅ | Email+password registration |
| `/api/auth/forgot-password` | POST | ✅ | Sends reset email via Resend |
| `/api/auth/reset-password` | POST | ✅ | Consumes token, updates password |
| `/api/auth/merge-cart` | POST | ✅ | Merges localStorage cart on login |

**Auth Route Issues:**
- ⚠️ 🟡 `/api/auth/register` creates user with role `customer` always. Google OAuth signup also creates `customer`. There is no mechanism for someone to register as `warehouse` or `b2b` directly — admin must manually change roles via DB. The admin `/admin/users` page shows users but has no role-edit UI (see Audit 03).
- ⚠️ 🟢 `forgot-password` sends email via Resend. Verify the email template exists and the `FROM` address is configured correctly in `.env`.

---

### 1.2 Store / Customer Routes

| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/shipping/provinces` | GET | ✅ | RajaOngkir provinces |
| `/api/shipping/cities` | GET | ✅ | RajaOngkir cities by province |
| `/api/shipping/cost` | POST | ✅ | RajaOngkir cost calculation |
| `/api/coupons/validate` | POST | ✅ | Validate + calculate discount |
| `/api/checkout/initiate` | POST | ✅ | Create order + Midtrans token |
| `/api/checkout/retry` | POST | ✅ | Retry payment (new Midtrans token) |
| `/api/webhooks/midtrans` | POST | ✅ | Payment webhook handler |
| `/api/orders/[orderNumber]` | GET | ✅ | Public order tracking |
| `/api/upload` | POST | ✅ | Cloudinary upload (signed) |
| `/api/b2b/inquiry` | POST | ✅ | B2B inquiry submission |

**Missing Public Routes:**
- ❌ 🔴 `/api/orders/[orderNumber]/receipt` — PDF receipt download. PRD requires this. Currently PDF is generated client-side only in `checkout/success/page.tsx`. No server-side PDF generation exists, meaning emailing PDF as attachment is impossible.
- ❌ 🟡 `/api/products` — No general product listing API. Store pages fetch directly from DB via server components (fine for SSR), but there's no REST API for products. This means the checkout validation reads DB directly, which is fine, but there's no way to integrate external tools or validate carts from non-Next.js contexts.
- ❌ 🟡 `/api/products/[slug]` — No product detail API route.

---

### 1.3 Account Routes (Protected — Customer)

| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/account/addresses` | GET | ✅ | List user addresses |
| `/api/account/addresses` | POST | ✅ | Add new address |
| `/api/account/addresses/[id]` | PATCH | ✅ | Update address |
| `/api/account/addresses/[id]` | DELETE | ✅ | Delete address |
| `/api/account/points` | GET | ✅ | Points balance + history |
| `/api/account/vouchers` | GET | ✅ | Available coupons (public ones) |

**Missing Account Routes:**
- ❌ 🔴 `/api/account/profile` — No endpoint to update user profile (name, phone, language preference). The `/account/profile` page doesn't exist (PRD requires it), so this is a double gap.
- ❌ 🟡 `/api/account/points/redeem` — PRD references this route but points redemption happens inside the checkout flow, not as a standalone operation. The checkout initiate route handles it inline. This is fine architecturally, but the route is listed in the PRD's API inventory.

---

### 1.4 Admin Routes

#### Orders
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/orders/[id]/status` | PATCH | ⚠️ | Only `shipped`/`delivered` transitions work |

**Missing Admin Order Routes:**
- ❌ 🔴 `/api/admin/orders` — No GET for all orders list. The admin orders page fetches directly from DB in server component. This works but means no client-side search/filter/pagination.
- ❌ 🔴 `/api/admin/orders/[id]` — No GET for individual order detail. The PRD requires `/admin/orders/[id]` page to show full order detail + status update buttons. The page file does not exist.
- ❌ 🔴 `/api/admin/orders/[id]/status` PATCH missing transitions: `paid→processing`, `processing→packed`, `any→cancelled`.

#### Products
| Route | Method | Status | Notes |
|---|---|---|---|
| ❌ `/api/admin/products` | GET | ❌ | No REST endpoint |
| ❌ `/api/admin/products` | POST | ❌ | Create product |
| ❌ `/api/admin/products/[id]` | PATCH | ❌ | Update product |
| ❌ `/api/admin/products/[id]` | DELETE | ❌ | Soft delete product |
| ❌ `/api/admin/products/[id]/images` | POST | ❌ | Upload product image |
| ❌ `/api/admin/products/[id]/images/[imageId]` | DELETE | ❌ | Delete product image |
| ❌ `/api/admin/products/[id]/variants` | POST | ❌ | Add variant |
| ❌ `/api/admin/products/[id]/variants/[variantId]` | PATCH | ❌ | Update variant (price, stock, active) |
| ❌ `/api/admin/products/[id]/variants/[variantId]` | DELETE | ❌ | Deactivate variant |

🔴 **This is the largest gap in the codebase. Zero product management API routes exist.**

#### Inventory
| Route | Method | Status | Notes |
|---|---|---|---|
| ❌ `/api/admin/inventory` | GET | ❌ | Stock listing |
| ❌ `/api/admin/inventory/[variantId]` | PATCH | ❌ | Update stock (manual) |

#### Coupons
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/coupons` | GET | ✅ | List coupons |
| `/api/admin/coupons` | POST | ✅ | Create coupon |
| `/api/admin/coupons/[id]` | GET | ✅ | Get coupon detail |
| `/api/admin/coupons/[id]` | PATCH | ✅ | Update coupon |
| `/api/admin/coupons/[id]` | DELETE | ✅ | Delete/deactivate coupon |

Note: Coupon API routes exist but need verification that the `CouponForm` component correctly submits to them with matching payload shape.

#### Upload
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/upload` | POST | ✅ | Cloudinary signed upload |

#### Blog
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/blog` | GET | ✅ | List blog posts |
| `/api/admin/blog` | POST | ✅ | Create blog post |
| `/api/admin/blog/[id]` | GET | ✅ | Get blog post |
| `/api/admin/blog/[id]` | PATCH | ✅ | Update blog post |
| `/api/admin/blog/[id]` | DELETE | ✅ | Delete blog post |

#### Carousel
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/carousel` | GET | ✅ | List slides |
| `/api/admin/carousel` | POST | ✅ | Create slide |
| `/api/admin/carousel/[id]` | PATCH | ✅ | Update slide |
| `/api/admin/carousel/[id]` | DELETE | ✅ | Delete slide |

#### B2B
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/b2b-inquiries` | GET | ✅ | List inquiries |
| `/api/admin/b2b-inquiries/[id]` | PATCH | ✅ | Update inquiry status |
| `/api/admin/b2b-quotes` | GET | ✅ | List quotes |
| `/api/admin/b2b-quotes` | POST | ✅ | Create quote |
| `/api/admin/b2b-quotes/[id]` | GET | ✅ | Get quote detail |
| `/api/admin/b2b-quotes/[id]` | PATCH | ✅ | Update quote |

**Missing B2B Admin Routes:**
- ❌ `/api/admin/b2b-profiles` — No endpoint to list/approve B2B profile applications.
- ❌ `/api/admin/b2b-profiles/[id]/approve` — No approval endpoint.

#### Points
| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/admin/points/expiry-reminders` | GET | ✅ | Lists expiring points for reminder |

**Missing Admin Points Routes:**
- ❌ 🟡 `/api/admin/points/adjust` — No endpoint for manual points adjustment (PRD P2 feature).

#### Dashboard (All Missing)
| Route | Method | Status | Notes |
|---|---|---|---|
| ❌ `/api/admin/dashboard/kpis` | GET | ❌ | KPI cards data |
| ❌ `/api/admin/dashboard/alerts` | GET | ❌ | Alert banner data |
| ❌ `/api/admin/dashboard/order-funnel` | GET | ❌ | Order funnel counts |
| ❌ `/api/admin/dashboard/action-queue` | GET | ❌ | Priority action items |
| ❌ `/api/admin/dashboard/live-feed` | GET | ❌ | Last 20 orders |
| ❌ `/api/admin/dashboard/inventory-flash` | GET | ❌ | Stock alert summary |
| ❌ `/api/admin/audit-logs` | GET | ❌ | Admin activity log |
| ❌ `/api/admin/users/summary` | GET | ❌ | User role breakdown |

🔴 **The entire admin dashboard is broken — all 8 data endpoints are missing. The dashboard renders placeholders or empty states for all KPIs.**

#### Users / Customers
| Route | Method | Status | Notes |
|---|---|---|---|
| ❌ `/api/admin/users` | GET | ❌ | The users page fetches from DB in server component |
| ❌ `/api/admin/users/[id]` | PATCH | ❌ | No role/status update endpoint |
| ❌ `/api/admin/customers/[id]` | GET | ❌ | Customer detail page and API missing |

#### Settings
| Route | Method | Status | Notes |
|---|---|---|---|
| ❌ `/api/admin/settings` | GET | ❌ | Settings page fetches from DB directly |
| ❌ `/api/admin/settings` | PATCH | ❌ | No way to update settings from UI |

🟡 System settings can only be changed via database directly. Store WhatsApp number, payment expiry, points rates — none are editable from the admin panel.

#### Field (Warehouse)
| Route | Method | Status | Notes |
|---|---|---|---|
| ❌ `/api/admin/field/packing-queue` | GET | ❌ | Orders ready to pack |
| ❌ `/api/admin/field/tracking-queue` | GET | ❌ | Orders needing tracking number |
| ❌ `/api/admin/field/pickup-queue` | GET | ❌ | Pickup orders |
| ❌ `/api/admin/field/inventory` | GET | ❌ | Current stock for field view |
| ❌ `/api/admin/field/inventory` | PATCH | ❌ | Manual stock update |
| ❌ `/api/admin/field/worker-activity` | GET | ❌ | Today's activity log |
| ❌ `/api/admin/field/today-summary` | GET | ❌ | Summary counts |

🔴 **The entire field/warehouse operations dashboard is broken. The `field/page.tsx` makes 8+ API calls to non-existent endpoints. Warehouse staff cannot use this page at all.**

---

### 1.5 AI Routes

| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/ai/caption` | POST | ✅ | Minimax AI caption generator |

---

### 1.6 Cron Routes

| Route | Method | Status | Notes |
|---|---|---|---|
| `/api/cron/cancel-expired-orders` | GET | ✅ | Cancels unpaid expired orders |
| `/api/cron/expire-points` | GET | ✅ | Expires old points |
| `/api/cron/points-expiry-warning` | GET | ✅ | Sends warning emails |

**Cron Route Issues:**
- ⚠️ 🟡 `verifyCronAuth()` utility is called but its implementation needs to be verified in `lib/utils/cron-auth.ts`. It should check a secret header that matches `CRON_SECRET` env var.
- ⚠️ 🟡 Vercel Cron schedules need to be configured in `vercel.json`. Check that all 3 crons are registered with appropriate schedules:
  - `cancel-expired-orders`: every 5 minutes
  - `expire-points`: daily (midnight WIB)
  - `points-expiry-warning`: daily (morning WIB)
- ⚠️ 🟢 No cron for "low stock alerts" — PRD mentions low stock alerts as P2 feature.

---

## 2. AUTHENTICATION & AUTHORIZATION GAPS

### 2.1 Role Enforcement on API Routes

**Current Pattern:**
```typescript
const session = await auth();
if (!session?.user) return unauthorized();
// Then sometimes: if (session.user.role !== 'superadmin') return forbidden();
```

**Issues Found:**

- 🔴 `/api/admin/orders/[id]/status` — only checks `auth()`, does NOT check role. Any logged-in customer who knows the order ID and status endpoint URL can change order status. **Security vulnerability.**

- 🟡 Admin routes generally check for session but many do not verify the user has an admin-level role. A `customer` role user could potentially POST to `/api/admin/blog` if they craft the right request.

- 🟡 The middleware correctly blocks `/admin/*` paths in the browser, but API routes under `/api/admin/*` rely on `auth()` session check only — middleware does not protect `/api/admin/*` routes.

**Fix Required:** Add role check middleware for all `/api/admin/*` routes:
```typescript
// lib/auth/require-admin.ts
export async function requireAdmin(roles: UserRole[] = ['owner', 'superadmin']) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!roles.includes(session.user.role)) throw new ForbiddenError();
  return session;
}
```

### 2.2 Warehouse Role Restrictions

The middleware only allows warehouse role to access `/admin/inventory` and `/admin/shipments` (browser-side). But:
- ❌ No API-level check prevents warehouse user from calling `/api/admin/orders/[id]/status` with arbitrary status changes.
- ❌ `/api/admin/field/*` endpoints (when built) must restrict warehouse users to only `packed→shipped` transitions.

### 2.3 Guest Order Tracking
**Status:** ✅ Page exists at `/orders/[orderNumber]`.

**Issue:** Verify the `/api/orders/[orderNumber]` GET route requires email verification for guest orders (email must match `recipient_email` in DB). If it returns full order data without email verification, any person who guesses an order number can see a stranger's personal data (name, address, phone). This is a **GDPR/privacy issue**.

### 2.4 Session Token Refresh
**Issue:** 🟢 If an admin's role is changed in the database (e.g., downgraded from `superadmin` to `owner`), their existing session still has the old role in the JWT until they log out and back in. The session callback does not re-read role from DB on each request.

**Fix:** In the session callback in `lib/auth/index.ts`, query the DB for the current user role on each session refresh:
```typescript
async session({ session, token }) {
  if (token.sub) {
    const user = await db.query.users.findFirst({ where: eq(users.id, token.sub) });
    session.user.role = user?.role ?? 'customer';
  }
  return session;
}
```

---

## 3. INPUT VALIDATION & SECURITY

### 3.1 Zod Validation Coverage

| Route | Zod Validation | Status |
|---|---|---|
| `/api/auth/register` | ✅ | `authSchema` from validations |
| `/api/checkout/initiate` | ✅ | `checkoutSchema` from validations |
| `/api/coupons/validate` | ✅ | Inline validation |
| `/api/webhooks/midtrans` | ✅ | Signature verification |
| `/api/admin/blog` POST | ⚠️ | Unknown — verify schema exists |
| `/api/admin/carousel` POST | ⚠️ | Unknown — verify schema exists |
| `/api/b2b/inquiry` POST | ⚠️ | Unknown — verify schema exists |

### 3.2 SQL Injection
✅ Using Drizzle ORM with parameterized queries — no raw SQL. Safe.

### 3.3 XSS
⚠️ 🟡 The blog content is stored as HTML/Tiptap JSON and rendered with `dangerouslySetInnerHTML` in the blog detail page. Ensure TipTap's output is sanitized with DOMPurify or a server-side HTML sanitizer before storage and render.

### 3.4 Rate Limiting
**Status:** ⚠️ Utility exists (`lib/utils/rate-limit.ts`) but application is unknown.

PRD requires rate limiting on:
- `/api/auth/*` — verify applied ⚠️
- `/api/coupons/validate` — verify applied ⚠️
- `/api/checkout/*` — verify applied ⚠️

If rate limiter is implemented but not wired to these routes, it does nothing. Check each route handler for `rateLimit()` call.

### 3.5 Midtrans Webhook Security
✅ SHA512 signature verification implemented correctly in `lib/midtrans/verify-webhook.ts`.

### 3.6 Cloudinary Upload Security
✅ Signed uploads via server-side token generation in `/api/admin/upload`. Unsigned uploads from client are disabled.

### 3.7 Environment Variable Exposure
✅ No `NEXT_PUBLIC_` prefix on sensitive keys (Midtrans server key, database URL, Resend API key).
⚠️ 🟢 `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` is correctly public (needed for Snap.js). Verify `MIDTRANS_SERVER_KEY` is never included in client bundles.

---

## 4. API RESPONSE FORMAT CONSISTENCY

**Current Pattern (most routes):**
```json
{ "success": true, "data": {...} }
{ "success": false, "error": "message" }
```

**Inconsistencies Found:**
- ⚠️ Some routes return `NextResponse.json({ error: "message" }, { status: 400 })` while others return `{ success: false, error: "..." }`. Pick one pattern and standardize.
- ⚠️ HTTP status codes: some validation errors return 200 with `{ success: false }` instead of proper 400/422. This confuses fetch error handling in the frontend.
- ✅ `lib/utils/api-response.ts` exists — verify all routes use it consistently.

---

## 5. MISSING API ROUTE MASTER LIST

This is the definitive list of API routes that need to be built, in priority order:

### 🔴 Priority 1 — Launch Blockers

```
POST   /api/admin/products                    Create product
PATCH  /api/admin/products/[id]               Update product
DELETE /api/admin/products/[id]               Soft delete product
POST   /api/admin/products/[id]/images        Upload product images
DELETE /api/admin/products/[id]/images/[img]  Remove image
POST   /api/admin/products/[id]/variants      Add variant
PATCH  /api/admin/products/[id]/variants/[v]  Update variant
PATCH  /api/admin/orders/[id]/status          Add paid→processing, processing→packed transitions
GET    /api/admin/dashboard/live-feed         Last 20 orders for dashboard
GET    /api/admin/dashboard/kpis              Revenue, orders, customers today
```

### 🟡 Priority 2 — Dashboard & Operations

```
GET    /api/admin/dashboard/alerts            Alert banner data
GET    /api/admin/dashboard/order-funnel      Funnel counts by status
GET    /api/admin/dashboard/action-queue      Priority action items
GET    /api/admin/dashboard/inventory-flash   Out-of-stock summary
GET    /api/admin/audit-logs                  Activity log
GET    /api/admin/users/summary               User role breakdown
PATCH  /api/admin/users/[id]                  Update user role/status
PATCH  /api/admin/settings                    Update system settings
PATCH  /api/admin/inventory/[variantId]       Manual stock update
```

### 🟡 Priority 3 — Warehouse Field Operations

```
GET    /api/admin/field/packing-queue         Orders to pack (paid status)
GET    /api/admin/field/tracking-queue        Packed orders needing tracking
GET    /api/admin/field/pickup-queue          Pickup orders to fulfill
GET    /api/admin/field/inventory             Stock view for warehouse
PATCH  /api/admin/field/inventory/[variantId] Restock/adjust via field app
GET    /api/admin/field/worker-activity       Today's activity log
GET    /api/admin/field/today-summary         Summary counts
```

### 🟢 Priority 4 — Account & B2B

```
PATCH  /api/account/profile                   Update name/phone/language
GET    /api/admin/customers/[id]              Customer detail
POST   /api/admin/points/adjust               Manual points adjustment
GET    /api/admin/b2b-profiles                List B2B applications
PATCH  /api/admin/b2b-profiles/[id]/approve  Approve B2B account
POST   /api/b2b/quote                         Customer quote request
GET    /api/b2b/quotes                        B2B customer quote history
```

---

## 6. VERCEL.JSON — CRON SCHEDULE VERIFICATION

The `vercel.json` must contain:
```json
{
  "crons": [
    {
      "path": "/api/cron/cancel-expired-orders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/expire-points",
      "schedule": "0 17 * * *"
    },
    {
      "path": "/api/cron/points-expiry-warning",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Read the current `vercel.json` and verify these are registered. If missing, cron jobs will never run.
