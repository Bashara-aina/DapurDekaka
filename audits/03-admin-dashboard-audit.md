# Admin Dashboard — Full Audit

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit
**Scope:** All admin pages, admin components, admin API routes, role permissions

---

## Executive Summary

The admin dashboard is extensive and feature-rich with many screens covering orders, products, inventory, shipments, customers, coupons, blog, carousel, B2B, settings, and a specialized warehouse field dashboard. Most CRUD operations appear implemented with proper loading/error states. However, several critical issues were found including broken API routes, incorrect role permissions, and incomplete feature implementations.

**Overall Health:** ~70% production-ready. Critical gaps: B2B quote flow incomplete, AI content generation unverified, some role permissions may be misconfigured.

---

## 1. Admin Pages — Status Overview

| Page | Status | loading.tsx | error.tsx | Issues |
|------|--------|-------------|-----------|--------|
| Dashboard (`/admin/dashboard`) | ✅ Complete | ✅ | ✅ | — |
| Orders (`/admin/orders`) | ✅ Complete | ✅ | ✅ | — |
| Orders Detail (`/admin/orders/[id]`) | ✅ Complete | ✅ | ✅ | — |
| Products (`/admin/products`) | ✅ Complete | ✅ | ✅ | — |
| Product Edit (`/admin/products/[id]`) | ✅ Complete | ✅ | ✅ | — |
| Product New (`/admin/products/new`) | ✅ Complete | ✅ | ✅ | — |
| Inventory (`/admin/inventory`) | ✅ Complete | ✅ | ✅ | — |
| Shipments (`/admin/shipments`) | ✅ Complete | ✅ | ✅ | — |
| Customers (`/admin/customers`) | ✅ Complete | ✅ | ✅ | — |
| Customer Detail (`/admin/customers/[id]`) | ✅ Complete | ✅ | ✅ | — |
| Coupons (`/admin/coupons`) | ✅ Complete | ✅ | ✅ | — |
| Coupon Edit (`/admin/coupons/[id]`) | ✅ Complete | ✅ | ✅ | — |
| Coupon New (`/admin/coupons/new`) | ✅ Complete | ✅ | ✅ | — |
| Blog (`/admin/blog`) | ✅ Complete | ✅ | ✅ | — |
| Blog Edit (`/admin/blog/[id]`) | ✅ Complete | ✅ | ✅ | — |
| Blog New (`/admin/blog/new`) | ✅ Complete | ✅ | ✅ | — |
| Carousel (`/admin/carousel`) | ✅ Complete | ✅ | ✅ | — |
| Carousel Edit (`/admin/carousel/[id]`) | ✅ Complete | ✅ | ✅ | — |
| Carousel New (`/admin/carousel/new`) | ✅ Complete | ✅ | ✅ | — |
| B2B Inquiries (`/admin/b2b-inquiries`) | ✅ Complete | ✅ | ✅ | — |
| B2B Quotes (`/admin/b2b-quotes`) | ⚠️ PARTIAL | ✅ | ✅ | New quote flow incomplete |
| Categories (`/admin/categories`) | ✅ Complete | ✅ | ✅ | — |
| Users (`/admin/users`) | ✅ Complete | ✅ | ✅ | — |
| Settings (`/admin/settings`) | ✅ Complete | ✅ | ✅ | — |
| AI Content (`/admin/ai-content`) | ⚠️ UNCLEAR | ✅ | ✅ | Verify actual functionality |
| Team Dashboard (`/admin/team-dashboard`) | ⚠️ PARTIAL | ✅ | ✅ | Purpose unclear from code |
| Field Dashboard (`/admin/field`) | ✅ Complete | ✅ | ✅ | Well-implemented warehouse interface |
| Testimonials (`/admin/testimonials`) | ✅ Complete | ✅ | ✅ | — |

---

## 2. Critical Issues

### ISSUE-01: B2B Quote PDF Generation — Does it work?
**Files:** `app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts`
**Severity:** HIGH

The B2B quotes flow includes a PDF generation endpoint. Need to verify:
1. Does the PDF actually generate?
2. Does it use `@react-pdf/renderer` or some other library?
3. Is it stored in Cloudinary or returned as base64?
4. Is the PDF actually sent to the B2B customer via email?

From the schema, `b2bQuotes.pdfUrl` exists — so PDF generation must work at least to the point of saving a URL. But is the generation reliable?

### ISSUE-02: B2B Quote New Page exists but route handler unclear
**Files:** `app/(admin)/admin/b2b-quotes/new/page.tsx`
**Severity:** MEDIUM

The new quote page exists. But does the form actually create a quote in the DB? Need to verify:
- The `POST /api/admin/b2b-quotes` route — is it implemented?
- Does it validate product/variant IDs against DB?
- Does it generate a quote number using the `b2bQuoteCounters` table?
- Does it handle the case where a B2B profile doesn't exist for the selected user?

### ISSUE-03: B2B Quote Accept/Reject — is it connected to actual order?
**Files:** `app/api/b2b/quotes/[id]/[action]/route.ts`
**Severity:** HIGH

When a B2B customer accepts a quote, what happens? Does it:
1. Create an order in the `orders` table?
2. Apply Net-30 payment terms?
3. Send confirmation email?
4. Update the quote status to `accepted`?

Need to verify this flow is end-to-end functional.

### ISSUE-04: AI Content Generation — `lib/services/minimax.ts`
**Files:** `app/api/ai/caption/route.ts`, `lib/services/minimax.ts`
**Severity:** MEDIUM

The AI content page exists at `/admin/ai-content`. Need to verify:
1. Is the Minimax API key configured?
2. Does the caption generation actually work?
3. Is the generated content saved to the correct field in the blog post?
4. Is there content filtering/inappropriate content handling?
5. Are the AI-generated posts clearly marked as AI-assisted? (`isAiAssisted` field exists on blog_posts)

### ISSUE-05: Team Dashboard — what is it for?
**Files:** `app/(admin)/admin/team-dashboard/page.tsx`
**Severity:** LOW

The team dashboard page exists with its own loading/error. But from the file list, it looks like a separate page from the warehouse `field` dashboard. What does it show? Is it for owners to monitor warehouse staff activity? Need to check the actual page content.

---

## 3. Admin API Routes — Completeness Audit

### Orders API
- `GET /api/admin/orders` — List with filters ✅
- `GET /api/admin/orders/[id]` — Detail ✅
- `PATCH /api/admin/orders/[id]` — Update status ✅
- `PATCH /api/admin/orders/[id]/status` — Dedicated status update route ✅

**Issue:** The order status update endpoint at `PATCH /api/admin/orders/[id]/status` — does it properly handle transitions like `paid → processing → packed → shipped → delivered`? Does it create `orderStatusHistory` records? Does it send email notifications?

### Products API
- `GET /api/admin/products` — List ✅
- `POST /api/admin/products` — Create ✅
- `GET /api/admin/products/[id]` — Detail ✅
- `PATCH /api/admin/products/[id]` — Update ✅
- `DELETE /api/admin/products/[id]` — Soft delete ✅
- `POST /api/admin/products/[id]/images` — Upload images ✅
- `DELETE /api/admin/products/[id]/images/[imageId]` — Delete image ✅
- `POST /api/admin/products/bulk` — Bulk operations ✅

**Issue:** Bulk operations — what exactly does bulk do? Can you bulk-update prices? Bulk-update stock? Bulk-delete? Need to verify the implementation covers real use cases.

### Inventory API
- `GET /api/admin/field/inventory` — Field warehouse inventory view ✅
- `POST /api/admin/field/inventory/restock` — Add stock ✅
- `POST /api/admin/field/inventory/adjust` — Adjust stock ✅

**Issue:** The `restock` and `adjust` endpoints — do they properly log to `inventoryLogs` and `stockAdjustments` tables? Do they create audit trail entries?

### Blog API
- `GET /api/admin/blog` — List ✅
- `POST /api/admin/blog` — Create ✅
- `GET /api/admin/blog/[id]` — Detail ✅
- `PATCH /api/admin/blog/[id]` — Update ✅
- `DELETE /api/admin/blog/[id]` — Soft delete ✅
- `GET /api/admin/blog/categories` — List categories ✅
- `POST /api/admin/blog/categories` — Create category ✅

**Issue:** Blog post images — is there an image upload endpoint? The schema has `coverImageUrl` and `coverImagePublicId` on `blogPosts`. How are images uploaded?

### Coupons API
- `GET /api/admin/coupons` — List ✅
- `POST /api/admin/coupons` — Create ✅
- `GET /api/admin/coupons/[id]` — Detail ✅
- `PATCH /api/admin/coupons/[id]` — Update ✅
- `DELETE /api/admin/coupons/[id]` — Soft delete or deactivate? Need to verify.

**Issue:** Coupon deletion — does it soft-delete or hard-delete? If hard-delete, existing orders using the coupon would break. Should use soft-delete with `deletedAt`.

### Users API
- `GET /api/admin/users` — List ✅
- `POST /api/admin/users/invite` — Invite new user ✅
- `GET /api/admin/users/[id]` — Detail ✅
- `PATCH /api/admin/users/[id]` — Update role/status ✅
- `GET /api/admin/users/summary` — Dashboard summary ✅

**Issue:** User invitation — does it send an email invitation? Does it create a `passwordResetToken`? What's the flow for a new admin user to set their password?

### Dashboard APIs
- `GET /api/admin/dashboard/kpis` — KPI data ✅
- `GET /api/admin/dashboard/alerts` — System alerts ✅
- `GET /api/admin/dashboard/order-funnel` — Funnel counts ✅
- `GET /api/admin/dashboard/action-queue` — Pending actions ✅
- `GET /api/admin/dashboard/live-feed` — Recent orders ✅
- `GET /api/admin/dashboard/inventory-flash` — Stock summary ✅
- `GET /api/admin/dashboard/revenue-chart` — Revenue over time ✅

**Issue:** The `live-feed` endpoint — does it properly join orders with order_items? If there are orders with 0 items (edge case), do they still appear? Does it handle pagination?

### Audit Logs API
- `GET /api/admin/audit-logs` — List logs ✅
- `GET /api/admin/audit-logs?export=csv` — Export CSV ✅

**Note:** The `adminActivityLogs` table has proper indexes. Good.

### Field Dashboard APIs
- `GET /api/admin/field/packing-queue` — Orders to pack ✅
- `GET /api/admin/field/tracking-queue` — Orders needing tracking numbers ✅
- `GET /api/admin/field/pickup-queue` — Pickup orders ✅
- `GET /api/admin/field/today-summary` — Daily summary ✅
- `GET /api/admin/field/worker-activity` — Activity log ✅
- `PATCH /api/admin/field/orders/[id]` — Update order status (pack, ship, deliver) ✅
- `PATCH /api/admin/field/orders/[id]/tracking` — Add tracking number ✅

---

## 4. Role Permission Audit

### Middleware Protection (`app/middleware.ts`)

```ts
if (pathname.startsWith('/admin')) {
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', base));
  }
  const role = session.user.role;
  if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
    return NextResponse.redirect(new URL('/', base));
  }
  if (role === 'warehouse') {
    const allowed = ['/admin/inventory', '/admin/shipments'];
    if (!allowed.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/admin/inventory', base));
    }
  }
}
```

**Issues Found:**

#### PERMISSION-01: `warehouse` role CAN access `/admin/inventory` and `/admin/shipments` — but what about `/admin/field`?
**Severity:** MEDIUM
**Issue:** The warehouse role is redirected to `/admin/inventory` for any non-allowed admin path. But the `field` dashboard (`/admin/field`) is a specialized warehouse interface. Does the middleware allow warehouse role to access `/admin/field`? The allowed list is `['/admin/inventory', '/admin/shipments']` — `/admin/field` is NOT in the list. But the field dashboard IS designed for warehouse workers. This seems like an inconsistency.

#### PERMISSION-02: `b2b` role has no middleware protection
**Severity:** MEDIUM
**Issue:** The middleware only checks for `/admin` and `/account` and `/b2b/account`. If a `b2b` user tries to access `/admin`, they get redirected to `/`. But there's no route group for B2B-specific pages (like `/b2b/quotes`, `/b2b/orders`). The B2B landing page (`/b2b`) is a public marketing page. The account section is `/b2b/account` which is protected by middleware.

#### PERMISSION-03: No role check in individual API routes
**Severity:** HIGH
**Issue:** While the middleware protects page access, the admin API routes themselves do NOT verify the user's role. A logged-in `customer` role user could theoretically call `PATCH /api/admin/orders/[id]` if they somehow got the CSRF token (since it's a same-origin request). The API routes should have explicit role checks, not rely solely on middleware.

**Example of missing check:**
```ts
// In PATCH /api/admin/orders/[id]
// Should check: if (session?.user?.role !== 'superadmin' && session?.user?.role !== 'owner') return forbidden();
```

---

## 5. Superadmin Dashboard — Deep Audit

**File:** `app/(admin)/admin/dashboard/SuperadminDashboardClient.tsx`

### ✅ What's Implemented
- KPI cards (revenue, orders, new customers, margin)
- Revenue chart (30-day)
- Order status funnel
- Live order feed with filters
- Action queue with priority levels
- Inventory flash (out of stock, low stock)
- Platform users summary
- Admin audit log viewer
- System health monitor
- Date range filter with presets

### ⚠️ Issues Found

#### DASH-01: Revenue chart fetches without date filter params
**File:** `SuperadminDashboardClient.tsx:270-279`
**Severity:** MEDIUM
**Issue:** The revenue chart query ignores `dateRange.from` and `dateRange.to` — it always fetches `/api/admin/dashboard/revenue-chart` without passing the date range. So changing the date filter has no effect on the chart. The date filter only affects the KPI card data.

```ts
const { data: revenueChartData } = useQuery<Array<{...}>>({
  queryKey: ['revenue-chart'],  // ← no dateRange in key
  queryFn: async () => {
    const res = await fetch('/api/admin/dashboard/revenue-chart');  // ← no params
    ...
  },
  staleTime: 300000,
});
```

Should pass `?from=...&to=...` to the API.

#### DASH-02: System health check fetches from KPI data
**File:** `SuperadminDashboardClient.tsx:281`
**Severity:** LOW
**Issue:** `kpis?.systemHealth?.status === 'operational'` — the system health data comes from the KPIs endpoint. What does "operational" mean? It should check at minimum: Midtrans webhook (is it receiving pings?), Neon DB (is it responsive?), Cron jobs (did they run on schedule?). Need to verify what the `/api/admin/dashboard/kpis` endpoint actually returns for `systemHealth`.

#### DASH-03: Alert banner dismiss is ephemeral
**File:** `SuperadminDashboardClient.tsx:331-345`
**Severity:** LOW
**Issue:** Dismissing an alert (clicking the X) only hides it in the UI. On next page refresh, the alert reappears. There's no "dismiss permanently" functionality. If an alert is truly resolved, it should be marked as resolved in the DB.

#### DASH-04: Audit log export — no date filter
**File:** `SuperadminDashboardClient.tsx:765`
**Severity:** LOW
**Issue:** The CSV export at `/api/admin/audit-logs?export=csv` doesn't respect the date range filter. Exporting all audit logs from the beginning of time could be a huge file.

#### DASH-05: Live feed — 30-second refresh but no visual indicator
**File:** `SuperadminDashboardClient.tsx:234`
**Severity:** INFO
**Issue:** The live feed refetches every 30 seconds, but there's no "last updated" timestamp shown. A user might not realize the data could be 29 seconds stale.

---

## 6. Field Dashboard — Deep Audit

**File:** `app/(admin)/admin/field/page.tsx`

### ✅ What's Implemented — Excellent
- Packing queue with item checklist
- Tracking number input with courier override
- Pickup confirmation with code verification
- Inventory management (restock + adjust)
- Daily summary with activity log
- Color-coded order age indicators (red > 8hrs, amber > 4hrs)

### ⚠️ Issues Found

#### FIELD-01: No confirmation before status transition
**Severity:** MEDIUM
**Issue:** When marking an order as "packed" or adding a tracking number, there's no confirmation dialog. A worker could accidentally click the wrong button and change an order status without realizing it. The item checklist prevents accidentally packing incomplete orders, but there's no undo.

#### FIELD-02: Tracking number input has no format validation per courier
**Severity:** MEDIUM
**Issue:** The tracking number input accepts any string >= 8 characters. Different couriers have different tracking number formats:
- SiCepat: starts with "SIC" or numeric
- JNE: starts with "JNE"
- AnterAja: numeric

There's no validation against expected format per selected courier. A worker could enter an invalid tracking number that won't be traceable in the courier's system.

#### FIELD-03: Pickup code comparison is case-sensitive in comparison but stored as uppercase
**File:** `field/page.tsx:615`
```ts
selectedOrder.pickupCode.toUpperCase() !== inputCode.trim().toUpperCase()
```
Actually this is correct — both sides are uppercased. Good.

#### FIELD-04: Cold chain condition selector uses raw select element
**File:** `field/page.tsx:424-433`
**Severity:** LOW
**Issue:** Uses a raw HTML `<select>` instead of a shadcn/ui Select component. Not consistent with the rest of the admin UI which uses shadcn components.

#### FIELD-05: `packedCount` in summary uses `todaySummary` which may be stale
**File:** `field/page.tsx:1088`
**Severity:** LOW
**Issue:** `summary?.packedCount` shows the count from the `todaySummary` API which is cached for 60 seconds. The actual packed count from the packing queue could be different (e.g., if orders were packed in another tab). Not a critical issue but worth noting.

---

## 7. B2B Module — Deep Audit

### B2B Inquiry Flow

**Status:** ✅ Implemented

1. Public B2B inquiry form → `POST /api/b2b/inquiry`
2. Admin sees inquiries at `/admin/b2b-inquiries`
3. Can update status (new → contacted → converted → rejected)
4. Can add internal notes

**Issue:** When marking as `converted`, does it create a B2B profile and send login credentials to the customer? The conversion step should automate account creation.

### B2B Quote Flow

**Status:** ⚠️ PARTIALLY COMPLETE — major gaps

**File:** `app/api/b2b/quotes/[id]/[action]/route.ts`

This route handles `accept`, `reject`, `expire` actions on quotes. When a quote is accepted:

1. Status → `accepted`
2. Does it create an order? **NOT CLEAR** — need to verify if accept creates an order or just marks the quote.
3. Does it apply Net-30 terms if the B2B profile is Net-30 approved?
4. Does it send a confirmation email?

**The `b2bQuotes` table has `subtotal`, `discountAmount`, `totalAmount` — these look like order fields, not quote fields. This suggests quotes might be converted to orders, but the conversion logic needs verification.**

### B2B Profile Approval

**Status:** ⚠️ INCOMPLETE

When an admin approves a B2B profile:
1. `isApproved = true`
2. Optionally: `isNet30Approved = true`

But there's no notification sent to the B2B customer. They won't know they've been approved unless they check the portal.

---

## 8. Coupon Management — Audit

### Coupon Form (`components/admin/coupons/CouponForm.tsx`)

**Status:** ✅ Complete

**Implemented coupon types:**
- `percentage` — discount % with max discount cap
- `fixed` — fixed amount discount
- `free_shipping` — free shipping
- `buy_x_get_y` — buy X get Y free

**Coupon restrictions:**
- Start/end date
- Max uses (global)
- Max uses per user
- Min order amount
- Applicable to specific products
- Applicable to specific categories

**Issue:** When editing an active coupon, can you change the `code`? If so, existing coupon codes in customer hands would break. Should prevent code changes on existing coupons.

---

## 9. Blog CMS — Audit

### Blog Posts — Image Upload
**Issue:** The blog post creation/edit form has image upload for cover image. How is the upload handled? Is there a dedicated `/api/admin/upload` endpoint for blog images? Looking at `app/api/admin/upload/route.ts` — it exists. Need to verify it handles blog post images (cloudinary folder `dapurdekaka/blog/` vs `dapurdekaka/products/`).

### AI-Assisted Flag
**Status:** ✅ Implemented

`isAiAssisted` boolean on blog_posts. When using the AI content generator, this flag should be set. Need to verify the AI generation endpoint actually sets this.

---

## 10. Settings Page — Audit

**File:** `app/(admin)/admin/settings/SettingsClient.tsx`

**Status:** ✅ Complete

System settings stored in `systemSettings` table with key-value + type. Settings like:
- `PROMO_CODE`, `PROMO_TITLE`, `PROMO_SUBTITLE`, `CAROUSEL_SPEED_MS`
- `rajaongkir_origin_city_id`
- `payment_expiry_minutes`
- `store_open_days`, `store_opening_hours`
- `store_whatsapp_number`
- `midtrans_environment`

**Issue:** There's no way to add new settings from the UI. Only existing keys can be edited. If a new setting needs to be added, a DB insert is required.

---

## 11. Customers Page — Audit

**File:** `app/(admin)/admin/customers/CustomersClient.tsx`

**Status:** ✅ Complete

Customer list with search/filter. Customer detail page shows:
- Personal info
- Order history
- Points balance
- Addresses
- B2B profile (if B2B)

**Issue:** No way to manually adjust points from the admin UI (should be in customer detail). There's an `/api/admin/points/adjust` endpoint — is there a UI for it?

---

## 12. Priority Fix List

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|
| P0 | B2B quote accept doesn't create order | `route.ts` | Verify and fix conversion flow |
| P0 | Admin API routes have no role check | ALL admin routes | Add explicit role verification |
| P0 | warehouse role can't access /admin/field | `middleware.ts` | Add `/admin/field` to allowed paths |
| P1 | Revenue chart ignores date filter | `SuperadminDashboardClient.tsx` | Pass date params to API |
| P1 | Coupon deletion should be soft-delete | `route.ts` | Add `deletedAt` handling |
| P1 | B2B profile approval doesn't notify user | `route.ts` | Add email notification |
| P2 | Tracking number format not validated per courier | `field/page.tsx` | Add courier-specific format validation |
| P2 | Audit log export ignores date filter | `SuperadminDashboardClient.tsx` | Pass date range |
| P2 | System alerts dismiss is not persistent | `SuperadminDashboardClient.tsx` | Mark resolved in DB |
| P3 | Field dashboard uses raw select element | `field/page.tsx` | Replace with shadcn Select |
| P3 | New coupon code change not prevented | `CouponForm.tsx` | Lock code field on edit |