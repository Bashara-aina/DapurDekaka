# FINAL AUDIT 03 — Admin Dashboard & Operational Flows
**Date:** 2026-05-15  
**Focus:** Admin dashboard completeness, order management, warehouse operations, inventory, user management, role enforcement  
**Priority:** P0 = operation-blocking | P1 = significant gap | P2 = polish

---

## 1. ADMIN DASHBOARD (`/admin/dashboard`)

### 1.1 Revenue Chart is Missing [P1]
**PRD Requirement:** "Revenue chart (last 30 days)" — one of the explicit P1 features for admin.

**What exists:** KPI cards showing today's revenue, today's orders, new customers, estimated margin.

**What's missing:** Any time-series visualization of revenue over time. The admin cannot see:
- Weekly trends
- Month-over-month comparison
- Revenue by day chart
- Order volume over time

**Fix:** Add a LineChart (or BarChart) component under the KPI cards showing daily revenue for the last 30 days. Query `/api/admin/dashboard/kpis` (or a new endpoint) that returns daily revenue aggregate.

---

### 1.2 System Health - Cloudinary Check is Hardcoded [P2]
**File:** `app/(admin)/admin/dashboard/page.tsx:715-722`

```typescript
{ label: 'Cloudinary CDN', value: 'ok' },
```

Cloudinary status is always hardcoded as "ok" — no actual health check. If Cloudinary is down, the admin dashboard will still show "Operasional."

**Fix:** Either remove this entry or implement a lightweight Cloudinary ping.

---

### 1.3 Action Queue Has No "Mark Done" [P2]
The Action Queue shows items needing attention (e.g., "Order X has been paid, ready to process"). But there's no way to dismiss or mark an action as handled from the queue itself.

**Current behavior:** Items remain in queue until the underlying order status changes.

**PRD Expectation:** Implied that admin can take action directly from the queue.

**Fix:** Either add quick-action buttons directly in the queue items, or add a dismiss mechanism for items that have been addressed through other means.

---

### 1.4 "Estimated Margin (18%)" is Hardcoded [P2]
**File:** `app/(admin)/admin/dashboard/page.tsx:338`

```typescript
title="Est. Margin (18%)"
```

The 18% margin is hardcoded. The actual margin is configurable (business changes prices). This should come from `systemSettings` or be configurable.

---

### 1.5 Dashboard Has No Date Range Filter [P2]
All KPIs are "today" only. The admin has no way to see:
- Yesterday's revenue
- Last week's revenue
- This month's revenue

**Fix:** Add a date range selector to the KPI cards section.

---

## 2. ORDER MANAGEMENT (`/admin/orders`)

### 2.1 Admin Order Detail Page - Unclear If Exists [P1]
**PRD Requirement:** `/admin/orders/[id]` — Order detail + status update

Looking at the routes: `app/api/admin/orders/[id]/route.ts` and `app/api/admin/orders/[id]/status/route.ts` exist as API routes. But checking the admin pages:
- `app/(admin)/admin/orders/page.tsx` — list view with `OrdersClient`

There does NOT appear to be a `/admin/orders/[id]/page.tsx` page for the admin. The "Detail" link in the dashboard live feed goes to `/admin/orders?id=${order.id}` (query param), suggesting detail is shown inline in the list via a modal/drawer.

**Action:** Verify how the admin views order detail — if it's a modal in OrdersClient, check if it includes all needed information:
- Full order items with images
- Customer info
- Address
- Status history
- Status update controls
- Tracking number input (for warehouse)

---

### 2.2 Role-Based Access on Order Status Updates [P1]
**PRD Requirement:** 
- Warehouse staff can only update status to "shipped" (when entering tracking number)
- Owner can update all statuses
- Superadmin can update all + cancel

**File:** `app/api/admin/orders/[id]/status/route.ts`

Need to verify this API enforces role restrictions. The warehouse staff role should NOT be able to set status to `cancelled` or `refunded`.

---

### 2.3 Admin Orders Page Fetches Only 50 Orders [P1]
**File:** `app/(admin)/admin/orders/page.tsx:13`

```typescript
const allOrders = await db.query.orders.findMany({
  orderBy: [desc(orders.createdAt)],
  limit: 50,
});
```

If there are more than 50 orders, the admin can't see older ones. There's no pagination in the orders list.

**PRD Goal:** 500-1000 orders/month → 50 is not enough after month 1.

**Fix:** Add server-side pagination with page size 20-25 orders and navigation controls.

---

### 2.4 No Order Search or Filter Persistence [P2]
The admin orders list likely has client-side filtering (status filter tabs, search) in `OrdersClient`. But when the admin navigates to an order detail and comes back, the filter state resets.

**Fix:** Persist filter state in URL query params (e.g., `/admin/orders?status=paid&search=DDK-20260512`).

---

### 2.5 No Export UI Entry Point [P2]
The API route `/api/admin/export/orders` exists for CSV export. But need to verify there's a "Download CSV" button in the orders UI.

The admin dashboard has a CSV download in the audit log section but not in the orders page.

---

## 3. WAREHOUSE OPERATIONS (`/admin/field`, `/admin/inventory`, `/admin/shipments`)

### 3.1 Field Page Route Access for Warehouse Role [P1]
**PRD:** Warehouse staff can ONLY access `/admin/inventory` and `/admin/shipments`.

But the codebase has a `/admin/field` page (with sub-routes for `packing-queue`, `tracking-queue`, `pickup-queue`, etc.). The PRD didn't mention these routes — they appear to be an enhanced warehouse interface.

**Concern:** The middleware must restrict warehouse staff to the correct set of pages. Verify `app/middleware.ts` grants warehouse staff access to `/admin/field/*` (if intended) or restricts to `/admin/inventory` and `/admin/shipments` only.

---

### 3.2 Inventory Adjustment Audit Trail [P1]
**PRD:** "System logs the change: who changed, old value, new value, timestamp"

The `inventoryLogs` table has `changedByUserId`. But the `/api/admin/field/inventory/adjust/route.ts` must populate this with the session user ID.

**Verify:** Does the inventory adjust API set `changedByUserId` to the warehouse staff's user ID?

---

### 3.3 Tracking Number Entry Doesn't Trigger Shipped Email [P1]
When warehouse staff enters a tracking number, the order status changes to "shipped." But:

**PRD Notification Table:**
> `packed → shipped`: Email: "Pesanan dikirim" + tracking number + courier link

This email template does NOT exist. Looking at the Resend templates:
- `OrderConfirmation` ✅
- `OrderCancellation` ✅  
- `PickupInvitation` ✅
- **`OrderShipped` ❌ — Missing**

**Fix:** Create `OrderShippedEmail` template and call it in `/api/admin/orders/[id]/status/route.ts` when status changes to `shipped`.

---

### 3.4 "Delivered" Status Change Doesn't Trigger Email or Points Notification [P1]
**PRD Notification Table:**
> `shipped → delivered`: Email: "Pesanan tiba" + thank you + points earned info

This email template also doesn't exist.
- **`OrderDelivered` ❌ — Missing**

**Fix:** Create `OrderDeliveredEmail` template and trigger when status → `delivered`.

---

## 4. PRODUCT & INVENTORY MANAGEMENT

### 4.1 Product Form Missing "Pre-Order" Toggle [P2]
**File:** `lib/db/schema.ts:176`

```typescript
isPreOrder: boolean('is_pre_order').notNull().default(false),
```

The schema has `isPreOrder` but the PRD doesn't mention this. Need to check if the ProductForm exposes this field. If yes — "pre-order" behavior (shipping later) needs to be defined. If no — the field is dead.

---

### 4.2 Product Sort Order Not Manageable in Admin [P2]
Products have a `sortOrder` field in the schema, but the admin product list has no drag-and-drop or manual sort order editing. This means the "Featured Products" section on the homepage uses `desc(products.sortOrder)` but the admin has no way to control this ordering.

**Fix:** Add a sort order input in the ProductForm or a drag-and-drop product list.

---

### 4.3 Image Management [P1]
**PRD:** "Images (multiple, Cloudinary URLs, first image = thumbnail)"

**In ProductForm:** Image upload exists via Cloudinary. But need to verify:
- Can admin reorder images (drag to change thumbnail)?
- Can admin delete individual images?
- Is there a preview of how the thumbnail appears?

The schema has `sortOrder` on `productImages`. The admin UI must allow reordering.

---

### 4.4 Category Management Missing from Admin Nav [P2]
Categories are in the schema (`categories` table) and there's a `/api/admin/categories/route.ts`. But there's no `/admin/categories` page in the admin sidebar or navigation.

The admin cannot manage categories (add, rename, reorder, disable) through the UI.

---

## 5. COUPON MANAGEMENT

### 5.1 `buy_x_get_y` Coupon Has No Backend Enforcement [P0]
**File:** `app/(store)/checkout/page.tsx:567-575`

When a `buy_x_get_y` coupon is applied, the checkout shows a message but the free item is never added to the cart. The `discountAmount` from the API is 0 for this coupon type (correctly — the "discount" is a free item, not money off).

**Problem:** 
1. The free item is never added to the order
2. The customer sees a message saying they get a free item, but their order doesn't include it
3. The webhook records `discountAmount: 0` for this coupon, so there's no financial tracking

**PRD Says:** "free item is lowest-priced variant in qualifying product" — this logic doesn't exist anywhere.

**Fix:** In `/api/checkout/initiate`, when coupon type is `buy_x_get_y`:
1. Find the qualifying lowest-price variant
2. Add it as an order item with `unitPrice: 0`
3. Include it in the order total (it's free, so +0)

---

### 5.2 Coupon Start Date Not Validated [P1]
**Schema:** `startsAt: timestamp('starts_at', ...)`

The coupon validation API checks `expiresAt` but does it check `startsAt`? If `startsAt` is in the future, the coupon should not yet be valid.

**Fix:** Add `startsAt` check in `/api/coupons/validate/route.ts`.

---

### 5.3 Free Shipping Coupon - Checkout Doesn't Honor It [P1]
When a `free_shipping` coupon is applied:
- `couponDiscount` is set from the API response
- But how does the checkout know to waive shipping? 

Looking at the checkout logic: the `shippingCost` is stored in `formData` from the courier selection step (Step 3 — happens before Step 5 where coupon is applied). If a free shipping coupon is applied in Step 5, the `shippingCost` in `formData` still has the original value.

**The total calculation:**
```typescript
const totalAmount = subtotal - couponDiscount - pointsDiscount + formData.shippingCost;
```

If `couponDiscount = shippingCost` (free shipping coupon), the math works. But the `discountAmount` from the coupon API for a `free_shipping` coupon must return exactly `shippingCost` as the discount value. This requires knowing the shipping cost at validation time — which the checkout doesn't send to the validation API.

**Fix:** When applying a free_shipping coupon, set `couponDiscount = formData.shippingCost` and clearly display "Ongkir Gratis" in the order summary.

---

## 6. ADMIN USER MANAGEMENT (`/admin/users`)

### 6.1 No Way to Invite New Admin Users [P1]
**PRD:** Superadmin can create/edit/delete admin accounts.

Currently the users page shows a list and allows role changes. But there's no "Invite new admin" flow. A new warehouse staff user would need to:
1. Register as a regular customer
2. Have the superadmin manually change their role via the admin UI

This is clunky. **Fix:** Add an "Invite User" form that creates an account with a temporary password and sends a setup email.

---

### 6.2 Role Change Doesn't Invalidate Existing Sessions [P1]
If admin changes a user's role (e.g., demotes a warehouse user to customer), that user's existing session still has the old role. They retain warehouse access until their session expires (30 days).

**Fix:** Add session invalidation (delete all sessions for the user) when their role changes. Or use JWT with short expiry + refresh token.

---

### 6.3 No "Deactivate Account" UI [P2]
The schema has `isActive: boolean` on users and `deletedAt: timestamp`. But there's no clear UI button to deactivate or soft-delete a user account. The admin could change the role but not "suspend" an account.

---

## 7. B2B ADMIN TOOLS

### 7.1 B2B Quote PDF Generation Not Implemented [P1]
**Schema:** `b2bQuotes.pdfUrl` field exists.

The admin can create a B2B quote with line items. But "Export as PDF" functionality to generate and store the PDF doesn't exist.

**PRD (P2):** "B2B quote builder + PDF"

**Fix:** Implement PDF generation for B2B quotes (using `@react-pdf/renderer` or similar) and upload to Cloudinary. Store the URL in `b2bQuotes.pdfUrl`. Add "Send PDF to customer" button in admin.

---

### 7.2 B2B Profile Approval UI [P1]
**Schema:** `b2bProfiles.isApproved` and `isNet30Approved` fields exist.

A B2B customer submits an inquiry form. But there's no clear workflow in the admin to:
1. Review the inquiry and decide to onboard them
2. Create a B2B profile for them
3. Approve their account (set `isApproved: true`)
4. Optionally grant Net-30 (`isNet30Approved: true`)

The `/api/admin/b2b-profiles/[id]/approve/route.ts` API exists. But is there a UI button in the admin B2B inquiries page to trigger this approval?

---

### 7.3 Manual Points Adjustment Has No Admin UI [P1]
The API `/api/admin/points/adjust` exists for manual points adjustments. But there's no admin UI page for this.

**Use case:** Customer complains they didn't receive points → admin manually adds them.

**Fix:** Add a "Adjust Points" button/form in the customer detail page (`/admin/customers/[id]`).

---

## 8. ADMIN SETTINGS (`/admin/settings`)

### 8.1 Settings Page Uses `alert()` for Errors [P2]
**File:** `app/(admin)/admin/settings/page.tsx:38,61`

```typescript
} catch {
  alert('Gagal memuat pengaturan');
}
```

Native browser `alert()` is used for error handling. This breaks the admin's professional UI and doesn't match the design system.

**Fix:** Replace all `alert()` calls with toast notifications using the existing `sonner` toast library.

---

### 8.2 System Settings Not Pre-Seeded [P1]
**Current state:** The settings page shows an empty state ("Belum ada pengaturan sistem") if the DB has no settings rows.

**Expected settings that should exist by default:**
- Store opening hours
- WhatsApp number
- Points rate (points per IDR)
- Free shipping threshold
- Low stock threshold (below which to alert)
- Store address

**Fix:** Create a seed migration that inserts default system settings values.

---

### 8.3 Store Opening Hours Hardcoded [P1]
**File:** `app/(store)/checkout/page.tsx:507-509`

```typescript
<p className="text-xs text-green-600 mt-2">
  Senin–Sabtu: 08.00 – 17.00 WIB<br/>
  Minggu: 09.00 – 15.00 WIB
</p>
```

Store hours are hardcoded in multiple places (checkout pickup step, pickup invitation page). These should come from `systemSettings` so the admin can update them without a code deployment.

---

## 9. BLOG MANAGEMENT

### 9.1 Blog Admin Doesn't Handle Image Upload Properly [P2]
**File:** `components/admin/blog/TiptapEditor.tsx`

The TipTap editor is present. Need to verify: can admin upload images inline within the blog post content? Or only set a cover image?

**PRD:** Blog should support rich media. The editor should support image insertion via drag-and-drop or upload button.

---

### 9.2 Blog Has No Category Filter on Frontend [P2]
The schema has `blogCategories` table and `blogPosts` can be assigned a category. But the `/blog` listing page may not have a category filter. Verify the frontend blog listing supports filtering by category.

---

## SUMMARY TABLE

| # | Issue | File/Location | Priority |
|---|---|---|---|
| 1.1 | Revenue chart missing | `admin/dashboard/page.tsx` | P1 |
| 2.3 | Orders list paginates only 50 | `admin/orders/page.tsx:13` | P1 |
| 3.3 | Shipped email missing | Email templates | P1 |
| 3.4 | Delivered email missing | Email templates | P1 |
| 4.4 | Category management has no admin page | Missing page | P2 |
| 5.1 | buy_x_get_y not enforced | `api/checkout/initiate` | **P0** |
| 5.2 | Coupon startsAt not checked | `api/coupons/validate` | P1 |
| 5.3 | Free shipping coupon math unclear | `checkout/page.tsx` | P1 |
| 6.1 | No admin user invite flow | Missing feature | P1 |
| 7.1 | B2B quote PDF not generated | Missing feature | P1 |
| 8.2 | System settings not seeded | Missing seed data | P1 |
| 8.3 | Store hours hardcoded | `checkout/page.tsx:507` | P1 |
