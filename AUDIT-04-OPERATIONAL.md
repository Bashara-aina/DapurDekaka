# AUDIT 04 — Operational Flow
# DapurDekaka.com — Warehouse, Admin & Fulfillment Operations Audit
**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** Day-to-day operational flows, staff workflows, email, cron, inventory

---

## LEGEND
- ✅ Working
- ⚠️ Partial / has issues
- ❌ Not built
- 🔴 Blocks operations entirely
- 🟡 Major operational friction
- 🟢 Minor gap

---

## 1. ORDER FULFILLMENT PIPELINE

### 1.1 The Intended Daily Flow (from PRD)

```
Customer pays
    ↓ Midtrans webhook → order.status = "paid"
    ↓ Admin/Owner sees paid orders on dashboard
    ↓ Admin marks: paid → processing
    ↓ Warehouse staff packs order
    ↓ Warehouse staff marks: processing → packed
    ↓ Warehouse staff drops off at courier, inputs tracking number
    ↓ System auto-sets: packed → shipped (on tracking number entry)
    ↓ Admin marks: shipped → delivered (after courier confirms)
```

### 1.2 Current Actual Flow (what can actually happen today)

```
Customer pays
    ↓ Midtrans webhook → order.status = "paid" ✅
    ↓ Admin sees "paid" orders in /admin/orders list ✅ (read-only, no action buttons)
    ↓ ❌ BLOCKED — Cannot mark paid → processing (API doesn't support this transition)
    ↓ ❌ BLOCKED — Cannot mark processing → packed (API doesn't support this transition)
    ↓ ❌ BLOCKED — Warehouse field dashboard is broken (all API calls fail)
    ↓ Tracking number can be entered at /admin/shipments → marks packed → shipped ⚠️
      (but order never reached "packed" state so this would be wrong)
    ↓ Admin can mark shipped → delivered ✅
```

🔴 **The fulfillment pipeline is fundamentally broken between "paid" and "shipped". Orders will pile up at "paid" status with no way to progress them through the workflow without direct DB access.**

### 1.3 Required Fixes to Unblock Operations

**Fix 1: Extend Order Status API**
Add these transitions to `/api/admin/orders/[id]/status`:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  'pending_payment': [],  // only webhook can move this
  'paid': ['processing', 'cancelled'],
  'processing': ['packed', 'cancelled'],
  'packed': ['shipped', 'cancelled'],
  'shipped': ['delivered'],
  'delivered': ['refunded'],
};
```

**Fix 2: Add Status Update UI to Admin Orders Page**
The `/admin/orders` page needs an action dropdown or buttons per order row:
- "Proses" (paid → processing) — Owner/Superadmin only
- "Kemas" (processing → packed) — Owner/Superadmin/Warehouse
- "Batalkan" (any → cancelled) — Superadmin only

**Fix 3: Build `/admin/orders/[id]` Page**
Full order detail view with:
- All order items, prices, totals
- Customer info (name, email, phone, address)
- Current status with history timeline
- Status update buttons (role-appropriate)
- Tracking number input
- Order notes

---

## 2. WAREHOUSE STAFF WORKFLOW

### 2.1 Intended Warehouse Interface

Warehouse staff (role: `warehouse`) access two pages:
- `/admin/inventory` — view and update stock counts
- `/admin/shipments` — input tracking numbers, mark shipped
- `/admin/field` — comprehensive field operations dashboard (packing, tracking, pickup)

### 2.2 Current State of Each Page

#### `/admin/inventory`
**Status:** ⚠️ Read-only display.

Shows all variants sorted by stock (lowest first). Has out-of-stock and low-stock count cards.

**What's Missing:**
- ❌ 🔴 No inline stock editing input on this page. There's no button to update stock count.
- ❌ 🔴 No API endpoint to update stock (`PATCH /api/admin/inventory/[variantId]` missing).

Without stock editing, warehouse staff cannot perform the manual stock sync described in PRD §7.4. They can only read current levels.

#### `/admin/shipments`
**Status:** ⚠️ Partially functional.

Shows orders with status `processing`, `packed`, `shipped`. Has tracking number input.

**What Works:**
- Listing of orders ✅ (probably, fetches from DB in server component)
- Tracking number input field ✅ (probably, but needs verification)

**What's Missing:**
- ⚠️ 🔴 If the API (`PATCH /api/admin/orders/[id]/status`) only accepts `packed→shipped` and `shipped→delivered`, and most orders are still stuck at `paid` (because paid→processing isn't implemented), then `shipments` shows an empty list.
- ❌ 🟡 No "Confirm Packing" action on the shipments page — warehouse staff need to mark `paid→packed` directly (skipping processing in some workflows).

#### `/admin/field` (Field/Warehouse Dashboard)
**Status:** 🔴 COMPLETELY BROKEN.

This is a client-side React Query page that makes API calls to 8+ endpoints that don't exist:

| API Call | Endpoint | Status |
|---|---|---|
| Packing queue | `/api/admin/field/packing-queue` | ❌ 404 |
| Tracking queue | `/api/admin/field/tracking-queue` | ❌ 404 |
| Pickup queue | `/api/admin/field/pickup-queue` | ❌ 404 |
| Inventory list | `/api/admin/field/inventory` | ❌ 404 |
| Mark as packed | PATCH `/api/admin/field/packing-queue` | ❌ 404 |
| Add tracking | PATCH `/api/admin/field/tracking-queue` | ❌ 404 |
| Update stock | PATCH `/api/admin/field/inventory` | ❌ 404 |
| Worker activity | `/api/admin/field/worker-activity` | ❌ 404 |
| Today summary | `/api/admin/field/today-summary` | ❌ 404 |

When warehouse staff opens `/admin/field`, every section shows "Error loading data." or a loading skeleton that never resolves. The page is completely non-functional.

**Priority:** 🔴 Must build all field API endpoints before launch.

### 2.3 Warehouse Staff Daily Tasks (What Each Needs)

**Task: Pack orders**
1. Open `/admin/field` → Packing Queue tab
2. See orders with status `paid` (needs to be `paid`, not just `processing`, since that transition is missing)
3. Click "Kemas" on each order → status changes to `packed`
4. **Missing:** `/api/admin/field/packing-queue` GET + PATCH

**Task: Input tracking number**
1. Open `/admin/field` → Tracking Queue tab
2. See orders with status `packed`
3. Input tracking number → status changes to `shipped`
4. **Missing:** `/api/admin/field/tracking-queue` GET + PATCH

**Task: Process pickup**
1. Customer shows up with order number
2. Warehouse staff opens `/admin/field` → Pickup Queue tab
3. Scans/inputs order number → marks as `delivered`
4. **Missing:** `/api/admin/field/pickup-queue` GET + PATCH

**Task: Update stock after restocking**
1. Open `/admin/field` → Inventory tab (or `/admin/inventory`)
2. Input new stock count per variant
3. System logs the change with before/after values
4. **Missing:** `/api/admin/field/inventory` GET + PATCH OR `/api/admin/inventory/[variantId]` PATCH

---

## 3. ADMIN OWNER WORKFLOW

### 3.1 Daily Admin Tasks

**Task: View revenue KPIs**
- Open `/admin/dashboard`
- See today's revenue, orders, margins
- **Status:** 🔴 All KPI endpoints missing. Dashboard shows empty/loading state.

**Task: Manage orders**
- Open `/admin/orders`
- See list of all orders
- Click into an order to see detail and update status
- **Status:** 🔴 No order detail page. Status update buttons missing from list. Only reads.

**Task: Manage products**
- Open `/admin/products`
- Edit product prices, descriptions, images
- **Status:** 🔴 Read-only. No edit form exists.

**Task: Manage coupons**
- Open `/admin/coupons`
- Create new discount code
- **Status:** ✅ Coupon CRUD routes exist. Verify form works end-to-end.

**Task: Review B2B inquiries**
- Open `/admin/b2b-inquiries`
- See new inquiries, update status to "contacted"
- **Status:** ✅ Appears implemented.

**Task: Update system settings**
- Open `/admin/settings`
- Change WhatsApp number, payment expiry, etc.
- **Status:** ❌ Read-only. No editing possible.

### 3.2 Owner Role Restrictions (from PRD)

The Owner role should:
- ✅ View all orders ← can see order list
- ❌ View order detail ← no detail page
- ❌ Update order status ← API doesn't check role, but no UI
- ✅ View and edit products ← editing not possible yet
- ❌ View revenue dashboard ← dashboard broken

Everything the Owner needs is either not built or broken. The Owner (girlfriend) currently has no functional admin interface.

---

## 4. INVENTORY MANAGEMENT

### 4.1 Stock Deduction Flow

**When payment succeeds (Midtrans webhook):**
```typescript
// app/api/webhooks/midtrans/route.ts
await db.update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
  .where(eq(productVariants.id, item.variantId));
```

✅ This is correctly implemented.

**Issue:** `GREATEST(stock - qty, 0)` prevents negative stock but silently succeeds even if actual remaining stock was 0. This means:
- Customer A buys the last 3 units
- Customer B has 3 units in cart, also pays
- B's webhook deducts: GREATEST(0 - 3, 0) = 0 (no change)
- Both customers' orders are created, but there's only stock for one

🟡 **This is an overselling race condition.** Without stock reservation, the first-come-first-served approach means the second customer's order will be created and paid for, but you can't fulfill it. The `inventory_logs` would show this (before: 0, after: 0, delta: -3) but it's still a problem.

**Recommended Fix for V1:** In the checkout initiate route, use a database transaction with a SELECT FOR UPDATE lock on the variants being purchased, then validate stock before allowing order creation. Reject the order if stock is insufficient at that moment.

### 4.2 Inventory Log

**Status:** ⚠️ Schema exists but partially written.

`inventory_logs` should be written:
1. When payment webhook deducts stock (`sale` type) — ⚠️ Needs verification
2. When warehouse staff manually updates stock (`manual` or `restock` type) — ❌ API doesn't exist yet
3. When order is cancelled and stock is reversed (`reversal` type) — ⚠️ Needs verification

Without complete inventory logs, the stock history audit trail (who changed what, when) is incomplete.

### 4.3 Low Stock Alerts

**Status:** ❌ Not implemented.

PRD (P2 feature): Low stock alerts. The dashboard `inventory-flash` section in the UI shows out-of-stock and low-stock counts, but:
1. The API endpoint is missing
2. No proactive email/notification to admin when stock drops below threshold
3. No configurable threshold (hardcoded `stock < 5` in the UI)

---

## 5. EMAIL NOTIFICATIONS

### 5.1 Email Templates Inventory

| Template File | Event | Status |
|---|---|---|
| `OrderConfirmation.tsx` | Payment confirmed | ✅ Template exists |
| `OrderShipped.tsx` | Tracking number added | ✅ Template exists |
| `OrderDelivered.tsx` | Marked as delivered | ✅ Template exists |
| `PointsExpiring.tsx` | Points expiry warning | ✅ Template exists |
| — | Order cancelled | ❌ Missing |
| — | Pickup invitation | ❌ Missing |
| — | B2B inquiry received (to admin) | ❌ Missing |
| — | B2B inquiry auto-reply (to company) | ❌ Missing |
| — | Password reset | ✅ (in forgot-password route) |

### 5.2 Email Sending Triggers

| Trigger | Sends Email | Template Used | Status |
|---|---|---|---|
| Midtrans settlement webhook | ✅ Yes | `OrderConfirmation` | ✅ |
| Admin marks `packed→shipped` | ✅ Yes | `OrderShipped` | ✅ |
| Admin marks `shipped→delivered` | ✅ Yes | `OrderDelivered` | ✅ |
| Cron: points expiry warning | ✅ Yes | `PointsExpiring` | ✅ |
| Order cancelled (any source) | ❌ No | Missing | ❌ |
| Pickup payment confirmed | ❌ No | Missing | ❌ |
| B2B inquiry submitted | ❌ No | Missing | ❌ |

### 5.3 Email Configuration Issues

- ⚠️ 🟡 `FROM` email address — verify Resend is configured with a verified domain (`noreply@dapurdekaka.com` or similar). If using Resend's test address, emails may go to spam.
- ⚠️ 🟡 PDF attachment — PRD says "Send confirmation email via Resend (order summary + PDF attachment)." PDF generation is client-side only (browser). Server-side PDF generation via `@react-pdf/renderer` would be needed for email attachment. This is not implemented.
- ⚠️ 🟢 Email templates use hardcoded color values — verify they match the brand colors (`brand-red`, `brand-cream`) in `DESIGN_SYSTEM.md`.

---

## 6. CRON JOBS

### 6.1 Cancel Expired Orders Cron
**File:** `/api/cron/cancel-expired-orders`
**Status:** ✅ Implemented.

**Flow:**
1. Finds orders with `status=pending_payment` AND `paymentExpiresAt < now()`
2. For each, checks Midtrans for actual transaction status (avoids false cancellation)
3. If still pending: reverses points, reverses coupon usage, cancels order
4. Logs operation

**Issues:**
- ⚠️ 🟡 `coupon_usages` is never populated, so coupon "reversal" does nothing (just decrements `coupons.used_count` if it was incremented — but it's only incremented on settlement, not on initiation, so reversal is a no-op here).
- ⚠️ 🟡 If the cron hasn't run and orders pile up (e.g., if Vercel cron fails), old orders accumulate. No alerting mechanism for cron failures.
- ⚠️ 🟢 Schedule: should run every 5 minutes. Verify `vercel.json` has `*/5 * * * *`.

### 6.2 Expire Points Cron
**File:** `/api/cron/expire-points`
**Status:** ✅ Implemented.

**Flow:**
1. Finds `points_history` earn records where `expires_at <= now()` AND `is_expired = false`
2. Creates `expire` records in `points_history` with negative amounts
3. Updates `users.points_balance`
4. Marks earn records as `is_expired = true`

**Issues:**
- ⚠️ 🟡 Schedule: should run daily. Verify `vercel.json` has correct schedule (e.g., `0 17 * * *` for midnight WIB).

### 6.3 Points Expiry Warning Cron
**File:** `/api/cron/points-expiry-warning`
**Status:** ✅ Implemented (calls `/api/admin/points/expiry-reminders`).

**Flow:**
1. Finds points expiring within 30 days
2. Sends `PointsExpiring` email to affected customers

**Issues:**
- ⚠️ 🟡 No deduplication — if cron runs daily and customer has points expiring in 29 days, they get an email every day for 29 days. Should only send once (e.g., at exactly 30 days and again at 7 days).
- ⚠️ 🟢 Schedule: verify configured.

### 6.4 Vercel.json Cron Registration

**Status:** ✅ All 3 cron jobs are registered in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/cancel-expired-orders", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/expire-points", "schedule": "0 18 * * *" },
    { "path": "/api/cron/points-expiry-warning", "schedule": "0 2 * * *" }
  ]
}
```
- Cancel expired orders: every 5 minutes ✅
- Expire points: 1 AM WIB (UTC+7, stored as 18:00 UTC) ✅
- Points expiry warning: 9 AM WIB (UTC+7, stored as 02:00 UTC) ✅

**Still Required:** Set `CRON_SECRET` environment variable in Vercel. `verifyCronAuth()` correctly checks a `Bearer` token against this secret. Without `CRON_SECRET` in production env, crons will log an error and refuse to run.

---

## 7. AUDIT LOGGING

### 7.1 Admin Activity Log

**Schema:** `admin_activity_logs` table exists with: user_id, action, entity_type, entity_id, before_state, after_state, ip_address.

**Service:** `lib/services/audit.service.ts` exists.

**Status:** ⚠️ Unknown whether audit service is called from API routes.

Audit logging should be called after:
- Every order status change ✅ (verify in status update route)
- Every product create/update/delete (when implemented)
- Every coupon create/update/delete
- Every user role change
- Every system settings change

If `audit.service.ts` is not called in these places, the admin activity log will be empty.

---

## 8. B2B OPERATIONAL FLOW

### 8.1 B2B Inquiry → Approval → Account Flow

**Intended Flow:**
1. Company submits inquiry form at `/b2b`
2. Inquiry saved to `b2b_inquiries` table with status `new`
3. Admin gets notified (email) → reviews inquiry
4. Admin updates status to `contacted` → reaches out via WhatsApp
5. If interested: admin creates B2B account (role: `b2b`) + `b2b_profiles` record
6. Company receives login credentials
7. Company logs into B2B portal and can view B2B pricing, request quotes

**Current Reality:**
1. ✅ Company submits inquiry → saved to DB
2. ❌ Admin NOT notified (no email trigger)
3. ✅ Admin can see inquiry in `/admin/b2b-inquiries` and update status
4. ❌ No way for admin to create B2B account from inquiry — must do it manually in DB
5. ❌ No automated email to new B2B customer with credentials
6. ⚠️ B2B portal exists but is mostly stubs

**Missing Operational Steps:**
- Admin button: "Convert Inquiry to B2B Account" → creates user + b2b_profile atomically
- Email to new B2B customer with temporary password
- Admin approval flow for `b2b_profiles.is_approved`

### 8.2 B2B Quote → Order Flow

**Intended Flow (PRD P2):**
1. B2B customer browses catalog, adds to quote
2. Submits quote request
3. Admin builds custom quote with pricing/terms
4. Admin sends PDF quote to customer
5. Customer accepts → places order with net-30 or DP terms
6. Order fulfillment follows same pipeline

**Current Reality:**
1. ❌ No "add to quote" functionality in B2B catalog
2. ❌ Quote request form exists but has no backend
3. ⚠️ Admin quote builder UI exists in `/admin/b2b-quotes/new` (but unknown state)
4. ❌ No PDF quote generation
5. ❌ No B2B checkout flow for accepted quotes

---

## 9. SYSTEM SETTINGS OPERATIONS

### 9.1 Settings That Cannot Be Changed Without DB Access

Because `/admin/settings` is read-only, the following require direct DB access to change:

| Setting Key | Current Only Way to Change | Impact if Wrong |
|---|---|---|
| `store_whatsapp_number` | DB direct | WhatsApp button goes to wrong number |
| `store_opening_hours` | DB direct | Pickup invitation shows wrong hours |
| `points_earn_rate` | DB direct | Incorrect points awarded |
| `points_per_idr` | DB direct | Incorrect points calculation |
| `payment_expiry_minutes` | DB direct | Wrong payment window (hardcoded to 15 min in code anyway) |
| `maintenance_mode` | DB direct | Cannot enable maintenance mode remotely |

🟡 All operational settings must be editable from the admin panel. Add inline edit capability to `/admin/settings`.

---

## 10. DATA EXPORT & REPORTING

### 10.1 Missing Data Exports

PRD (P3 feature) mentions CSV export. Currently nothing is exportable:

| Data | Export | Status |
|---|---|---|
| Orders | CSV | ❌ |
| Customers | CSV | ❌ |
| Inventory | CSV | ❌ |
| Revenue report | CSV | ❌ |
| Coupon usage | CSV | ❌ |
| Audit logs | CSV | ❌ (button exists on dashboard but broken) |

For a business doing 500-1000 orders/month, some form of data export is operationally critical for accounting, tax reporting, and business analysis. Even a simple CSV download of orders with totals should be P1 for launch.

---

## 11. OPERATIONAL LAUNCH CHECKLIST

Before going live, these operational items must be verified:

### Payment
- [ ] Midtrans sandbox credentials replaced with production credentials
- [ ] Midtrans production webhook URL set to `https://dapurdekaka.com/api/webhooks/midtrans`
- [ ] Midtrans signature verification working in production
- [ ] Payment expiry set correctly (15 min as per PRD)

### Email
- [ ] Resend domain verified (`@dapurdekaka.com` or similar)
- [ ] All 4 email templates render correctly in Resend preview
- [ ] Test order confirmation email sends with all order details

### Shipping
- [ ] RajaOngkir production API key set in `.env`
- [ ] Origin city ID confirmed as `23` (Bandung)
- [ ] Cold-chain courier filter tested with real destination cities

### Database
- [ ] All seed data loaded (categories, admin user, system settings, sample coupons)
- [ ] All 19 product SKUs seeded with correct prices and weights
- [ ] Superadmin account created with secure password
- [ ] Database indexes created (check schema for CREATE INDEX statements)

### Cron Jobs
- [ ] All 3 cron jobs registered in `vercel.json`
- [ ] `CRON_SECRET` environment variable set in Vercel
- [ ] Cron jobs manually triggered once to verify they work

### Security
- [ ] All `.env` variables configured in Vercel production environment
- [ ] No sensitive keys with `NEXT_PUBLIC_` prefix
- [ ] Rate limiting enabled on auth and checkout routes
- [ ] `full_export.sql` in `.gitignore`

### Admin Access
- [ ] Superadmin can log in
- [ ] Warehouse staff account created with correct role
- [ ] Owner account created with correct role
- [ ] Role-based page access verified for each role
