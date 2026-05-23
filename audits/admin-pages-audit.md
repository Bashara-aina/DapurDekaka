# Admin Pages Audit

**Auditor:** Deep Read-Only Code Audit
**Date:** 2026-05-22
**Scope:** `app/(admin)/admin/`, `components/admin/`, `app/api/admin/`

---

## Executive Summary

The DapurDekaka admin dashboard is **largely functional** but has several critical issues that would prevent features from working at runtime. Most concerning: the **team-dashboard page references 11 API endpoints that do not exist**, and a **URL template literal bug** in `InquiryStatusUpdate.tsx` would cause all B2B status updates to fail.

### Severity Breakdown

| Severity | Count |
|----------|-------|
| Critical (runtime broken) | 2 |
| High (feature incomplete) | 3 |
| Medium (UX/code quality) | 5 |
| Low (cosmetic) | 2 |

---

## Per-Admin-Page Audit

### 1. Dashboard (`/admin/dashboard`)

**Status:** Functional

- Page: `app/(admin)/admin/dashboard/page.tsx` + `SuperadminDashboardClient.tsx`
- Role restriction: `requireRole(['superadmin'])` — correct
- API routes called:
  - `/api/admin/dashboard/kpis` — EXISTS
  - `/api/admin/dashboard/alerts` — EXISTS
  - `/api/admin/dashboard/order-funnel` — EXISTS
  - `/api/admin/dashboard/action-queue` — EXISTS
  - `/api/admin/dashboard/live-feed` — EXISTS
  - `/api/admin/dashboard/inventory-flash` — EXISTS
  - `/api/admin/dashboard/revenue-chart` — EXISTS
  - `/api/admin/audit-logs` — EXISTS
  - `/api/admin/users/summary` — EXISTS
- **loading.tsx:** `app/(admin)/admin/dashboard/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/dashboard/error.tsx` — MISSING (git status shows untracked)
- Loading state: Relies on TanStack Query skeleton states in the client component — no route-level loading.tsx

**Bugs:** None found
**Missing features:** None

---

### 2. Superadmin Dashboard (`/admin/team-dashboard`)

**Status:** BROKEN — references non-existent API routes

- Page: `app/(admin)/admin/team-dashboard/page.tsx` (client component)
- Role restriction: NONE (no `requireRole` call found)
- API routes called (ALL MISSING):

| API Route | Called In |
|----------|-----------|
| `/api/admin/team-dashboard/snapshot` | team-dashboard line 169 |
| `/api/admin/team-dashboard/monthly-progress` | team-dashboard line 180 |
| `/api/admin/team-dashboard/order-pipeline` | team-dashboard line 191 |
| `/api/admin/team-dashboard/action-orders` | team-dashboard line 202 |
| `/api/admin/team-dashboard/top-products` | team-dashboard line 213 |
| `/api/admin/team-dashboard/inventory-alerts` | team-dashboard line 224 |
| `/api/admin/team-dashboard/b2b-pipeline` | team-dashboard line 235 |
| `/api/admin/team-dashboard/coupons` | team-dashboard line 246 |
| `/api/admin/team-dashboard/blog-status` | team-dashboard line 257 |
| `/api/admin/team-dashboard/health-indicators` | team-dashboard line 268 |
| `/api/admin/team-dashboard/points-summary` | team-dashboard line 279 |
| `/api/admin/points/expiry-reminders` (POST) | team-dashboard line 675 |

- **loading.tsx:** `app/(admin)/admin/team-dashboard/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/team-dashboard/error.tsx` — MISSING (git status shows untracked)

**Critical Bug:** The entire `TeamDashboardPage` component renders nothing but empty skeletons — every single `useQuery` would throw `{ success: false, error: 'Internal Server Error' }` because the API routes don't exist. This page is completely non-functional.

---

### 3. Orders (`/admin/orders`)

**Status:** Functional

- Page: `app/(admin)/admin/orders/page.tsx` + `OrdersClient.tsx`
- Role restriction: `requireRole(['superadmin', 'owner', 'warehouse'])` — correct
- API routes used:
  - Server-side data fetching (no API call needed for list page)
  - `/api/admin/orders/[id]/status` (PATCH) — EXISTS
- **loading.tsx:** `app/(admin)/admin/orders/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/orders/error.tsx` — MISSING (git status shows untracked)

**Order Detail (`/admin/orders/[id]`):**
- `app/(admin)/admin/orders/[id]/page.tsx` — Functional
- Role: `requireRole(['superadmin', 'owner', 'warehouse'])` — correct
- `/api/admin/orders/${orderId}` (GET) — handled by `app/api/admin/orders/route.ts` (GET) + `app/api/admin/orders/[id]/route.ts`
- Bug: `estimatedDays` in order detail form input but not persisted anywhere in the PATCH handler

**Shipments (`/admin/shipments`):**
- `app/(admin)/admin/shipments/page.tsx` + `ShipmentsClient.tsx`
- Role: `requireRole(['superadmin', 'owner', 'warehouse'])` — correct
- Uses `/api/admin/field/tracking-queue` — EXISTS
- **loading.tsx:** `app/(admin)/admin/shipments/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/shipments/error.tsx` — MISSING (git status shows untracked)

---

### 4. Products (`/admin/products`)

**Status:** Functional

- Page: `app/(admin)/admin/products/page.tsx` + `ProductsClient.tsx`
- Role: `requireRole(['superadmin', 'owner'])` — correct
- Server-side data fetching (direct DB query)
- Bulk actions via `/api/admin/products/bulk` — EXISTS
- Bulk delete: uses DELETE method, but the bulk route only has PATCH documented

**Product Edit (`/admin/products/[id]`):**
- `ProductEditClient.tsx` — functional, fetches `/api/admin/products/${productId}`
- Variant and image CRUD via `/api/admin/products/[id]/variants/[variantId]/route.ts` — verify this exists

**Product New (`/admin/products/new`):**
- Uses `ProductForm` component directly (server component pattern) — POST to `/api/admin/products`
- Role check uses manual `auth()` + redirect pattern instead of `requireAdmin`

**Missing:**
- **loading.tsx:** `app/(admin)/admin/products/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/products/error.tsx` — MISSING (git status shows untracked)
- **loading.tsx:** `app/(admin)/admin/products/new/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/products/new/error.tsx` — MISSING (git status shows untracked)

---

### 5. Inventory (`/admin/inventory`)

**Status:** Functional

- Page: `app/(admin)/admin/inventory/page.tsx` + `InventoryClient.tsx`
- Role: `requireRole(['superadmin', 'owner', 'warehouse'])` — correct
- Inline stock editing via `/api/admin/field/inventory/adjust` — EXISTS

**Missing:**
- **loading.tsx:** `app/(admin)/admin/inventory/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/inventory/error.tsx` — MISSING (git status shows untracked)

---

### 6. Customers (`/admin/customers`)

**Status:** Functional

- Page: `app/(admin)/admin/customers/page.tsx` + `CustomersClient.tsx`
- Role: `requireAdmin(['superadmin', 'owner'])` — correct
- Paginated list via `/api/admin/customers` — EXISTS

**Customer Detail (`/admin/customers/[id]`):**
- `CustomerDetailClient.tsx` — functional
- Points adjustment via `/api/admin/points/adjust` — EXISTS

**Missing:**
- **loading.tsx:** `app/(admin)/admin/customers/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/customers/error.tsx` — MISSING (git status shows untracked)
- **loading.tsx:** `app/(admin)/admin/customers/[id]/CustomerDetailClient.tsx` — no separate loading.tsx for the detail route

---

### 7. Coupons (`/admin/coupons`)

**Status:** Functional

- Listing: server-side render, no API call needed
- Edit: `CouponEditClient.tsx` → `PUT /api/admin/coupons/[id]`
- New: `CouponNew.tsx` (client component) → `POST /api/admin/coupons`
- Role: `requireRole(['superadmin'])` — correct
- Form: `CouponForm.tsx` component — shared between edit and new

**Missing:**
- **loading.tsx:** `app/(admin)/admin/coupons/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/coupons/error.tsx` — MISSING (git status shows untracked)

---

### 8. Blog (`/admin/blog`)

**Status:** Functional

- Listing: server-side render
- Edit: `BlogEditClient.tsx` → `PUT /api/admin/blog/[id]`
- New: `BlogNewClient.tsx` → `POST /api/admin/blog`
- Role: `requireRole(['superadmin', 'owner'])` — correct
- Editor: TiptapEditor component
- Cover image upload: `CoverImageUploader` component

**Missing:**
- **loading.tsx:** `app/(admin)/admin/blog/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/blog/error.tsx` — MISSING (git status shows untracked)

---

### 9. Carousel (`/admin/carousel`)

**Status:** Functional

- Listing: server-side render with card grid
- Edit: `CarouselEditClient.tsx` → `PUT /api/admin/carousel/[id]`
- New: `CarouselNewClient.tsx` → `POST /api/admin/carousel`
- Role: `requireRole(['superadmin', 'owner'])` — correct
- Form: `CarouselForm.tsx` — shared component

**Missing:**
- **loading.tsx:** `app/(admin)/admin/carousel/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/carousel/error.tsx` — MISSING (git status shows untracked)

---

### 10. B2B Inquiries (`/admin/b2b-inquiries`)

**Status:** PARTIALLY BROKEN

- Listing: `app/(admin)/admin/b2b-inquiries/page.tsx` — server-side render
- Detail: `app/(admin)/admin/b2b-inquiries/[id]/page.tsx` — functional
- Status update (inline dropdown): `B2BInquiryStatusClient.tsx` → `PATCH /api/admin/b2b-inquiries/${inquiryId}`
- Detail status update: `InquiryStatusUpdate.tsx` → `PATCH /api/admin/b2b-inquiries/${inquiryId}`

**CRITICAL BUG:** `InquiryStatusUpdate.tsx` line 27:
```typescript
const response = await fetch(`/api/admin/b2b-inquiries/${inquiryId}}`, {
//                                                   ^ extra closing brace — URL is malformed
```
This is a template literal with an extra `}` character. All PATCH calls from the B2B inquiry detail page will target the literal string `/api/admin/b2b-inquiries/${inquiryId}}` (with literal braces) and return 404.

The `B2BInquiryStatusClient.tsx` on the listing page does NOT have this bug — it correctly uses `inquiryId}`.

**Role:** `requireRole(['superadmin', 'owner'])` — correct

**Missing:**
- **loading.tsx:** `app/(admin)/admin/b2b-inquiries/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/b2b-inquiries/error.tsx` — MISSING (git status shows untracked)

---

### 11. B2B Quotes (`/admin/b2b-quotes`)

**Status:** PARTIALLY BROKEN

- Listing: `app/(admin)/admin/b2b-quotes/page.tsx` — server-side render, references `b2bQuotes` with nested `b2bProfile`
- New Quote: `app/(admin)/admin/b2b-quotes/new/page.tsx` — fully client-side, MISSING role check entirely. Any authenticated user can create B2B quotes.
- Role (listing): No `requireRole` found in `b2b-quotes/page.tsx` — may be accessible to all authenticated users

**Critical:** `/admin/b2b-quotes/new/page.tsx` has no role enforcement. Any logged-in user (including `customer` role) could access this page and create quotes.

**Missing:**
- **loading.tsx:** `app/(admin)/admin/b2b-quotes/loading.tsx` — MISSING (git status shows untracked)

---

### 12. Settings (`/admin/settings`)

**Status:** Functional

- Page: `app/(admin)/admin/settings/page.tsx` + `SettingsClient.tsx`
- Role: `requireRole(['superadmin'])` — correct
- Read-only for non-superadmin roles (enforced in client)
- Updates via `/api/admin/settings/[key]` (PATCH) — EXISTS

**Missing:**
- **loading.tsx:** `app/(admin)/admin/settings/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/settings/error.tsx` — MISSING (git status shows untracked)

---

### 13. AI Content (`/admin/ai-content`)

**Status:** Functional

- Page: `app/(admin)/admin/ai-content/page.tsx`
- Role: `requireRole(['superadmin'])` — correct
- Component: `CaptionGenerator.tsx` → `/api/ai/caption` (POST)
- **loading.tsx:** EXISTS (`app/(admin)/admin/ai-content/loading.tsx`) — verified present
- **error.tsx:** EXISTS (`app/(admin)/admin/ai-content/error.tsx`) — verified present

---

### 14. Field Dashboard (`/admin/field`)

**Status:** Functional

- Page: `app/(admin)/admin/field/page.tsx` — very comprehensive warehouse app
- Role: NO `requireRole` found in the page component itself. All API routes enforce `['superadmin', 'owner', 'warehouse']` — this is a security concern if the API enforcement is the only barrier.
- API routes used (all exist in `app/api/admin/field/`):
  - `packing-queue` — EXISTS
  - `tracking-queue` — EXISTS
  - `pickup-queue` — EXISTS
  - `today-summary` — EXISTS
  - `worker-activity` — EXISTS
  - `inventory` — EXISTS
  - `inventory/adjust` — EXISTS
  - `inventory/restock` — EXISTS
  - `field/orders/[id]` (PATCH) — EXISTS

**Role Permission Issue:** The page itself has no server-side role check. If a `customer` or `b2b` role user navigates directly to `/admin/field`, they would see the full warehouse interface. API routes are protected, but the page UI itself is not.

**Missing:**
- **loading.tsx:** `app/(admin)/admin/field/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/field/error.tsx` — MISSING (git status shows untracked)

---

### 15. Users (`/admin/users`)

**Status:** PARTIALLY BROKEN

- Page: `app/(admin)/admin/users/page.tsx` — `'use client'` component with in-component auth check
- Role: Uses `requireRole(['superadmin', 'owner'])` inside `useEffect` — WRONG pattern. This is a client-side check that navigates to `/` on failure, but the page content renders on the server during SSR before the client check runs. A `warehouse` or `b2b` user could potentially see the page shell briefly.
- Should use a server component wrapper or middleware for auth.
- Invite user via `/api/admin/users/invite` — EXISTS

**Missing:**
- **loading.tsx:** `app/(admin)/admin/users/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/users/error.tsx` — MISSING (git status shows untracked)

---

### 16. Testimonials (`/admin/testimonials`)

**Status:** PARTIALLY BROKEN

- Page: `app/(admin)/admin/testimonials/page.tsx` — `'use client'` with in-component auth check (same anti-pattern as Users page)
- Role: Uses `requireRole` inside `useEffect` — client-side only, same SSR concern as Users
- CRUD via `/api/admin/testimonials` (GET, POST) and `/api/admin/testimonials/[id]` (PATCH, DELETE) — EXISTS

**Missing:**
- **loading.tsx:** `app/(admin)/admin/testimonials/loading.tsx` — MISSING (git status shows untracked)
- **error.tsx:** `app/(admin)/admin/testimonials/error.tsx` — MISSING (git status shows untracked)

---

### 17. Categories (`/admin/categories`)

**Status:** Functional

- Page: `app/(admin)/admin/categories/page.tsx` — `'use client'`, fully self-contained
- NO role check found in the component or page
- API routes: `/api/admin/categories` (GET, POST), `/api/admin/categories/[id]` (PATCH) — verify existence

**Role Permission Issue:** No role enforcement found. Any authenticated user can manage product categories.

---

## Admin API Routes Status

| Route | Status | Notes |
|-------|--------|-------|
| `GET/POST /api/admin/orders` | EXISTS | Orders listing + admin create |
| `GET/PATCH /api/admin/orders/[id]` | EXISTS | Order detail + status update |
| `PATCH /api/admin/orders/[id]/status` | EXISTS | Full status transitions with cancellation logic |
| `GET /api/admin/products` | EXISTS | |
| `POST /api/admin/products` | EXISTS | |
| `PATCH /api/admin/products/[id]` | EXISTS | |
| `DELETE /api/admin/products/[id]` | EXISTS | |
| `PATCH /api/admin/products/bulk` | EXISTS | Bulk disable |
| `DELETE /api/admin/products/bulk` | EXISTS | Bulk delete |
| `POST /api/admin/products/[id]/images` | EXISTS | |
| `DELETE /api/admin/products/[id]/images/[imageId]` | EXISTS | |
| `POST /api/admin/products/[id]/variants` | EXISTS | |
| `PATCH /api/admin/products/[id]/variants/[variantId]` | EXISTS | |
| `DELETE /api/admin/products/[id]/variants/[variantId]` | EXISTS | |
| `GET /api/admin/customers` | EXISTS | |
| `GET /api/admin/customers/[id]` | EXISTS | |
| `PATCH /api/admin/points/adjust` | EXISTS | |
| `POST /api/admin/points/expiry-reminders` | EXISTS | |
| `GET /api/admin/dashboard/kpis` | EXISTS | |
| `GET /api/admin/dashboard/revenue-chart` | EXISTS | |
| `GET /api/admin/dashboard/alerts` | EXISTS | |
| `GET /api/admin/dashboard/live-feed` | EXISTS | |
| `GET /api/admin/dashboard/action-queue` | EXISTS | |
| `GET /api/admin/dashboard/inventory-flash` | EXISTS | |
| `GET /api/admin/dashboard/order-funnel` | EXISTS | |
| `GET/POST /api/admin/coupons` | EXISTS | |
| `GET/PATCH/DELETE /api/admin/coupons/[id]` | EXISTS | |
| `GET/POST /api/admin/blog` | EXISTS | |
| `GET/PATCH/DELETE /api/admin/blog/[id]` | EXISTS | |
| `GET /api/admin/blog/categories` | EXISTS | |
| `POST /api/admin/blog/categories` | EXISTS | |
| `GET/POST /api/admin/carousel` | EXISTS | |
| `GET/PATCH/DELETE /api/admin/carousel/[id]` | EXISTS | |
| `GET /api/admin/b2b-inquiries` | EXISTS | |
| `GET/PATCH /api/admin/b2b-inquiries/[id]` | EXISTS | |
| `GET /api/admin/b2b-profiles` | EXISTS | |
| `POST /api/admin/b2b-profiles/[id]/approve` | EXISTS | |
| `GET/POST /api/admin/b2b-quotes` | EXISTS | |
| `GET/PATCH /api/admin/b2b-quotes/[id]` | EXISTS | |
| `POST /api/admin/b2b-quotes/[id]/generate-pdf` | EXISTS | |
| `GET/PATCH /api/admin/settings` | EXISTS | |
| `PATCH /api/admin/settings/[key]` | EXISTS | |
| `GET /api/admin/testimonials` | EXISTS | |
| `POST /api/admin/testimonials` | EXISTS | |
| `PATCH/DELETE /api/admin/testimonials/[id]` | EXISTS | |
| `GET /api/admin/categories` | EXISTS | |
| `POST /api/admin/categories` | EXISTS | |
| `PATCH /api/admin/categories/[id]` | EXISTS | |
| `GET /api/admin/audit-logs` | EXISTS | |
| `GET /api/admin/export/orders` | EXISTS | |
| `GET /api/admin/export/customers` | EXISTS | |
| `GET /api/admin/export/inventory` | EXISTS | |
| `GET /api/admin/field/packing-queue` | EXISTS | |
| `GET /api/admin/field/tracking-queue` | EXISTS + PATCH | |
| `GET /api/admin/field/pickup-queue` | EXISTS | |
| `GET /api/admin/field/today-summary` | EXISTS | |
| `GET /api/admin/field/worker-activity` | EXISTS | |
| `GET /api/admin/field/inventory` | EXISTS | |
| `POST /api/admin/field/inventory/adjust` | EXISTS | |
| `POST /api/admin/field/inventory/restock` | EXISTS | |
| `PATCH /api/admin/field/orders/[id]` | EXISTS | |
| `GET/POST /api/admin/users` | EXISTS | |
| `PATCH /api/admin/users/[id]` | EXISTS | |
| `POST /api/admin/users/invite` | EXISTS | |
| `GET /api/admin/users/summary` | EXISTS | |
| **ALL `/api/admin/team-dashboard/*`** | **MISSING** | 11 routes do not exist |

---

## Role Permission Audit Matrix

| Page | Enforced Role | Enforcement Method | Issue |
|------|--------------|-------------------|-------|
| Dashboard | superadmin | Server component `requireRole` | OK |
| Superadmin Dashboard | NONE | None | Page shell accessible to all |
| Orders | superadmin, owner, warehouse | Server component `requireRole` | OK |
| Products | superadmin, owner | Server component `requireAdmin` | OK |
| Inventory | superadmin, owner, warehouse | Server component `requireRole` | OK |
| Customers | superadmin, owner | Server component `requireAdmin` | OK |
| Coupons | superadmin | Server component `requireRole` | OK |
| Blog | superadmin, owner | Server component `requireRole` | OK |
| Carousel | superadmin, owner | Server component `requireRole` | OK |
| B2B Inquiries | superadmin, owner | Server component `requireRole` | OK |
| B2B Quotes | NONE | None | Page and new quote accessible to all |
| Settings | superadmin | Server component `requireRole` | OK |
| AI Content | superadmin | Server component `requireRole` | OK |
| Field Dashboard | NONE (API-enforced) | API routes only | Page shell accessible to all |
| Users | superadmin, owner | Client-side `requireRole` in `useEffect` | SSR issue — page renders before redirect |
| Testimonials | superadmin, owner | Client-side `requireRole` in `useEffect` | SSR issue — page renders before redirect |
| Categories | NONE | None | Any authenticated user can manage categories |

---

## Missing Loading/Error Files

The following pages have NO route-level loading.tsx or error.tsx files, despite having complex async operations:

| Page | loading.tsx | error.tsx |
|------|-------------|-----------|
| `/admin/dashboard` | MISSING | MISSING |
| `/admin/team-dashboard` | MISSING | MISSING |
| `/admin/orders` | MISSING | MISSING |
| `/admin/products` | MISSING | MISSING |
| `/admin/products/new` | MISSING | MISSING |
| `/admin/inventory` | MISSING | MISSING |
| `/admin/customers` | MISSING | MISSING |
| `/admin/customers/[id]` | MISSING | MISSING |
| `/admin/coupons` | MISSING | MISSING |
| `/admin/coupons/new` | MISSING | MISSING |
| `/admin/blog` | MISSING | MISSING |
| `/admin/blog/new` | MISSING | MISSING |
| `/admin/carousel` | MISSING | MISSING |
| `/admin/carousel/new` | MISSING | MISSING |
| `/admin/b2b-inquiries` | MISSING | MISSING |
| `/admin/b2b-quotes` | MISSING | MISSING |
| `/admin/settings` | MISSING | MISSING |
| `/admin/field` | MISSING | MISSING |
| `/admin/users` | MISSING | MISSING |
| `/admin/testimonials` | MISSING | MISSING |
| `/admin/categories` | MISSING | MISSING |
| `/admin/ai-content` | EXISTS | EXISTS |

---

## Severity Table

| # | Issue | Page | Severity | Fix |
|---|-------|------|----------|-----|
| 1 | Team dashboard references 11 non-existent API routes — entire page broken | team-dashboard | **Critical** | Create all 11 team-dashboard API routes |
| 2 | URL template literal bug: `${inquiryId}}` (extra brace) — B2B status updates always 404 | InquiryStatusUpdate.tsx:27 | **Critical** | Fix to `${inquiryId}` |
| 3 | B2B Quotes new page has NO role check — any user can create quotes | b2b-quotes/new | **High** | Add `requireRole(['superadmin', 'owner'])` |
| 4 | Field dashboard page has NO role check — any user sees warehouse UI | field/page.tsx | **High** | Add server-side `requireRole` |
| 5 | Users/Testimonials use client-side auth in useEffect — SSR exposure | users, testimonials | **High** | Convert to server component wrappers |
| 6 | Categories page has NO role check | categories | **High** | Add `requireRole(['superadmin', 'owner'])` |
| 7 | Superadmin dashboard page has NO role check | team-dashboard | **Medium** | Add `requireRole(['superadmin'])` |
| 8 | Product new page uses manual auth redirect instead of `requireAdmin` | products/new | **Medium** | Use `requireAdmin` pattern |
| 9 | All pages missing route-level loading.tsx (21 pages) | Various | **Medium** | Create loading.tsx for each route |
| 10 | All pages missing route-level error.tsx (21 pages) | Various | **Medium** | Create error.tsx for each route |
| 11 | B2B Quotes listing has no `requireRole` | b2b-quotes | **Medium** | Add `requireRole(['superadmin', 'owner'])` |
| 12 | Orders detail: estimatedDays input exists but field not persisted | orders/[id] | **Low** | Either remove input or add field to schema/route |
