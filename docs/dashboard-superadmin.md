# Superadmin Dashboard — DapurDekaka
**Role:** `superadmin` (Bashara only)  
**Route:** `/admin/dashboard` → default landing after login  
**Access Level:** Unrestricted — all entities, all data, all controls  
**Stack context:** Next.js 14 App Router · Drizzle ORM · PostgreSQL (Neon) · shadcn/ui · Recharts · Tailwind CSS

---

## 1. Purpose & Philosophy

This is the **command centre**. Everything visible in the team dashboard and field worker dashboard also exists here, but Bashara additionally sees system-level controls, raw audit trails, user role management, financial reconciliation, coupon/promotion engineering, and platform health. The design principle is **"alert first, context second, action third"** — the dashboard should surface the most urgent thing the moment the page loads, with full context one click away and an action reachable immediately.

---

## 2. Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADMIN SIDEBAR (collapsed on mobile)                                        │
│  AdminHeader → breadcrumb · global search · notification bell · avatar      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Alert Banner — dismissible]                                                │
│  e.g. "3 orders stuck in 'paid' for >2 hrs — review now →"                 │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Revenue  │ │  Orders  │ │ New Cust │ │  Margin  │ │ Sys Hlth │         │
│  │  Today   │ │  Today   │ │  Today   │ │  Today   │ │   ✓/✗    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                              │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Revenue & Orders Chart     │  │  Order Status Funnel                 │  │
│  │  (30-day dual-axis)         │  │  (real-time counts per status stage) │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Live Order Feed            │  │  Action Queue                        │  │
│  │  (latest 20, streaming)     │  │  (items needing superadmin action)   │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Financial    │ │ Inventory    │ │ B2B Pipeline │ │ Platform Health  │  │
│  │ Deep Dive    │ │ Flash        │  │ Flash        │ │ Flash            │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Admin Audit Log (last 50 actions, filterable)                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Alert Banner

A dismissible banner at the very top of the content area. It queries multiple signals on page load and surfaces the **single most critical issue**. Priority order:

| Priority | Condition | Banner Text Example |
|----------|-----------|---------------------|
| P0 | Payment webhook not received in >30 min | "⚠️ Midtrans webhook may be down — last received 47 min ago" |
| P1 | Order stuck in `paid` status >2 hours | "🔴 4 orders stuck in 'paid' — possible processing failure" |
| P1 | Stock of a top-5 product reaches 0 | "🔴 Siomay Udang XL is out of stock — orders may be failing" |
| P2 | Pending payment orders expiring in <30 min | "🟡 12 orders expire in under 30 min — customers may need follow-up" |
| P2 | B2B quote pending response for >3 days | "🟡 Quote #Q-2024-0041 has been open for 4 days without response" |
| P3 | Coupon usage >80% of maxUses | "ℹ️ Coupon RAMADAN30 is 85% used (170/200 redemptions)" |

**Data source:** Aggregated query across `orders`, `productVariants`, `b2bQuotes`, `coupons`  
**Interaction:** Click banner → navigates to relevant sub-page. "×" dismiss → hidden for current session.

---

## 4. KPI Cards (Top Row)

Five cards. Each shows: **primary metric · delta vs. yesterday · sparkline (7d) · quick action link**.

### 4.1 Revenue Today
- **Primary:** Total `subtotal + shippingCost - discount` of orders with `status IN ('paid','processing','packed','shipped','delivered')` where `paidAt >= today 00:00`
- **Format:** `Rp 4.250.000`
- **Delta:** vs. same day last week (not yesterday, because weekly patterns matter more for food delivery)
- **Sparkline:** 7-day daily revenue bars
- **Sub-line:** Gross margin estimate: `revenue × 0.18` (hardcoded 18% margin rate until COGS tracking is built)
- **Click:** Opens Financial Deep Dive panel

### 4.2 Orders Today
- **Primary:** Count of orders created today, regardless of status
- **Sub-metrics shown inline:**
  - 🟢 Paid: X
  - 🔵 Processing: X
  - 🟡 Pending Payment: X
  - 🔴 Cancelled: X
- **Delta:** vs. same day last week
- **Click:** Opens `/admin/orders` pre-filtered to today

### 4.3 New Customers Today
- **Primary:** Count of `users` with `role = 'customer'` and `createdAt >= today`
- **Sub-line:** "X registered, Y guest checkouts" (guest = orders with `userId IS NULL`)
- **Delta:** vs. yesterday
- **Sparkline:** 7-day new customer trend
- **Click:** Opens `/admin/customers` pre-filtered to today

### 4.4 Estimated Margin Today
- **Primary:** `SUM(orderItems.priceAtOrder × qty) × 0.18` for paid+ orders today
- **Sub-line:** Avg margin per order: `total / order_count`
- **Note:** Renders a tooltip "⚠️ Margin estimated — COGS not tracked yet" until real COGS data exists
- **Click:** Opens financial breakdown modal

### 4.5 System Health
- **Primary:** A single status pill — `✓ All Systems Operational` or `✗ Issues Detected`
- **Checks performed:**
  - Last Midtrans webhook timestamp < 4 hours ago
  - Neon DB query latency (ping query) < 500ms
  - Last Cron job ran within its expected window
  - Cloudinary upload test (cached result, not live)
- **Sub-line:** Shows which service has an issue if any
- **Click:** Expands Platform Health panel

---

## 5. Revenue & Orders Chart (30-day Dual-Axis)

**Component:** Recharts `ComposedChart`  
**Data:** Daily aggregation from `orders` table, past 30 days  
**Left Y-axis:** Revenue in IDR (millions)  
**Right Y-axis:** Order count  

```
Series:
  - Bar: Daily revenue (paid+ statuses)
  - Line: Daily order count (all non-cancelled)
  - Line (dashed): 7-day rolling average revenue
```

**Controls above chart:**
- Date range picker: `7d | 14d | 30d | 90d | custom`
- Toggle: `Revenue | Orders | Both`
- Toggle: `B2C only | B2B only | All`

**Hover tooltip shows:**
- Date
- Revenue: Rp X.XXX.XXX
- Orders: N
- Avg order value: Rp X.XXX
- Top product sold that day (if easily joinable)

**Click on a bar** → opens modal with that day's orders list

---

## 6. Order Status Funnel

**Component:** Horizontal bar chart (Recharts `BarChart` horizontal)  
**Purpose:** Shows the real-time distribution of ALL active orders across the status pipeline

```
pending_payment  ████████████  47
paid             ███           12
processing       ██████        23
packed           ████          15
shipped          ██████████    38
delivered        ─ (archive)
cancelled        ─ (shown separately)
```

**Refresh:** Every 60 seconds (or on-demand via "↻ Refresh" button)  
**Colour coding:**
- `pending_payment` → amber (time-sensitive)
- `paid` → blue (needs action)
- `processing` → indigo
- `packed` → purple
- `shipped` → green
- Any stage with count > expected threshold → flashes red

**Expected thresholds** (configurable in System Settings):
- `paid` orders should not exceed 10 for more than 2 hours (means processing is bottlenecked)
- `packed` orders should not exceed 20 (means shipping pickup not happening)

**Click on any bar** → opens filtered order list for that status

---

## 7. Live Order Feed

**Component:** Auto-refreshing table (polling every 30s via React Query `refetchInterval`)  
**Shows last 20 orders created, sorted by `createdAt DESC`**

| Column | Content |
|--------|---------|
| Order # | `DDK-20240514-0012` — clickable → order detail |
| Time | Relative: "3 min ago" |
| Customer | Name (or "Guest" + masked phone) |
| Items | "3 items · Siomay Udang ×2, Hakau ×1" |
| Amount | `Rp 285.000` |
| Status | Badge with colour |
| Courier | Courier code + service if assigned |
| Actions | Inline: `[Process] [View] [Cancel]` based on current status |

**Filter chips above table:**
`All · Needs Action · Paid · Processing · Packed · Shipped · Today Only`

**"Needs Action" filter** — shows only orders where superadmin/owner intervention is typically needed:
- `paid` orders older than 30 min (should have moved to processing)
- `processing` orders older than 4 hours (should have been packed)
- `packed` orders with no trackingNumber after 6 hours

---

## 8. Action Queue

A priority-sorted list of items that specifically need superadmin attention. Not just operational — includes business decisions.

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔴  ORDER #DDK-0041 stuck in 'paid' for 3h 12min          [Process] │
│  🔴  Stock: Hakau Udang S reaching 0 (3 units left)         [Restock] │
│  🟡  B2B Inquiry from PT Sinar Mas — submitted 2 days ago    [Review] │
│  🟡  Quote #Q-0039 accepted by customer — awaiting payment   [View]   │
│  🟡  Coupon LEBARAN25 expires in 6 hours (38 uses remaining) [View]   │
│  🔵  3 customers have points expiring in 7 days              [Email]  │
│  🔵  Blog post "Cara Simpan Dimsum" in draft since 5 days    [Publish] │
└──────────────────────────────────────────────────────────────────────┘
```

**Sources feeding the queue:**
- `orders` table: stuck orders (via status + updatedAt delta)
- `productVariants`: stock < 5
- `b2bInquiries`: unread, > 1 day old
- `b2bQuotes`: status = `accepted`, no corresponding order yet
- `coupons`: expiresAt < now + 12h AND remainingUses > 0
- `pointsHistory`: expiryDate < now + 7d
- `blogPosts`: status = `draft`, updatedAt > 3 days ago

**Interaction:** Each item has an inline action button. Clicking marks it "acknowledged" (stored in localStorage, cleared on page reload).

---

## 9. Financial Deep Dive Panel

A collapsible section below the main charts. Expanded by clicking the Revenue KPI card or the section header.

### 9.1 Period Selector
`Today | This Week | This Month | Last Month | Custom Range`

### 9.2 Revenue Breakdown Table

| Metric | Value | Notes |
|--------|-------|-------|
| Gross Revenue | Rp X.XXX.XXX | Sum of `subtotal + shippingCost` |
| Discount Given | - Rp X.XXX | Sum of `discountAmount` across all orders |
| Net Revenue | Rp X.XXX.XXX | Gross - Discount |
| Shipping Collected | Rp X.XXX | Sum of `shippingCost` |
| Est. Product Revenue | Rp X.XXX.XXX | Net - Shipping |
| Est. COGS (82%) | - Rp X.XXX.XXX | Placeholder until COGS tracked |
| Est. Gross Profit | Rp X.XXX | Product revenue × 18% |
| Midtrans MDR (est.) | - Rp X.XXX | ~0.7% of net revenue |
| Est. Net Profit | **Rp X.XXX** | After MDR |

### 9.3 Revenue by Channel
Pie chart:
- B2C (website orders, `users.role = 'customer'`)
- B2B (orders from B2B accounts or via quotes)
- Guest checkout

### 9.4 Revenue by Payment Method
From `orders.paymentMethod` (once captured by Midtrans webhook):
- VA Bank Transfer
- QRIS
- Credit Card
- GoPay / OVO / etc.

### 9.5 Top Products by Revenue
Table: Product name · Units sold · Revenue contribution · % of total

### 9.6 Coupon Impact
- Total discount given
- Breakdown by coupon code
- Revenue that might not have happened without coupon (attribution note)

### 9.7 Refund Tracker
- Total refunds this period
- Orders refunded + amounts
- Link to each refunded order

---

## 10. Inventory Flash Panel

A compact at-a-glance inventory snapshot. Full inventory management is at `/admin/inventory`.

```
Stock Health Summary
──────────────────────────────────────
🔴 Out of Stock (0 units):     3 SKUs  →  [View All]
🟡 Low Stock (< 10 units):     7 SKUs  →  [View All]
🟢 Healthy (≥ 10 units):      42 SKUs

Top 5 Low Stock Items:
  • Hakau Udang S (2 units remaining)
  • Siomay Ikan XL (4 units remaining)
  • Baso Urat M (5 units remaining)
  • Dimsum Mix Pack (6 units remaining)
  • Charsiu Bun L (8 units remaining)

Last inventory update: 14 May 2024, 09:32
```

**Includes:** Quick restock note field per item (notes stored in `inventoryLogs` with `type = 'manual'`).

---

## 11. B2B Pipeline Flash Panel

```
B2B Pipeline Summary
──────────────────────────────────────
New Inquiries (unread):         2
Inquiries in progress:          5
Quotes sent (awaiting reply):   3
Quotes accepted:                1
Quotes expired this month:      1
B2B Orders this month:          8
B2B Revenue this month:    Rp 12.500.000

Next follow-up due: PT Arya Catering (overdue by 1 day)  [Open Inquiry]
```

---

## 12. Platform Health Panel

| Service | Status | Last Event | Notes |
|---------|--------|-----------|-------|
| Midtrans Webhook | ✅ Operational | 8 min ago | Last txn: `#MID-8821` |
| RajaOngkir API | ✅ Operational | Called 4 min ago | Response 312ms |
| Cloudinary CDN | ✅ Operational | Last upload 2h ago | |
| Resend Email | ✅ Operational | Last sent 1h ago | |
| Neon DB | ✅ Operational | Query time: 45ms | |
| Cron: expire-points | ✅ Last ran 02:00 | On schedule | |
| Cron: cancel-orders | ✅ Last ran 07:00 | On schedule | |
| Vercel Deployment | ✅ Production live | Deployed 2d ago | SHA: `a3f9b1c` |

**Implementation note:** These checks are lightweight — DB ping, `adminActivityLogs` lookup for last webhook event, and system setting values for last cron timestamps. Not real uptime monitoring (no external probe), but good enough for operational awareness.

---

## 13. Admin Audit Log

Full table of `adminActivityLogs`, last 50 entries by default.

| Column | Content |
|--------|---------|
| Time | "2 min ago" (expandable to full timestamp) |
| Actor | Admin name + role badge |
| Action | `ORDER_STATUS_UPDATED`, `PRODUCT_CREATED`, `COUPON_DELETED`, etc. |
| Entity | `Order #DDK-0041`, `Product: Siomay Udang XL` |
| Before → After | Collapsed diff (click to expand JSON) |
| IP | Last 4 octets masked (privacy) |

**Filter controls:**
- Actor filter: All admins / Bashara / Owner (girlfriend's account) / Warehouse staff
- Action type: All · Orders · Products · Inventory · Users · Coupons · Settings
- Date range picker
- Search: free text on entityType + entityId

**Export:** "Download CSV" button → triggers server action returning full log for selected filters

---

## 14. User & Role Management Panel

Accessible from the sidebar but summarised on the dashboard. Shows:

```
Platform Users
──────────────────────────────────────
Superadmin:    1  (Bashara)
Owner:         1  (girlfriend)
Warehouse:     2  (Adi, Siti)
B2B Clients:  14
Customers:   347
Inactive:      8

Recent signups (last 7 days): 23 customers, 1 B2B
```

**Quick actions:**
- `[+ Add Warehouse Staff]` → opens `/admin/users/new` pre-set to `role = warehouse`
- `[Manage Roles]` → opens `/admin/users`

**Superadmin-only capabilities on `/admin/users`:**
- Change any user's role
- Force-deactivate an account (`isActive = false`)
- Manually reset a user's points balance (with required audit note)
- Impersonate a customer account (view-only, opens customer dashboard in read-only mode)
- Export all user emails (for manual email campaign use)

---

## 15. System Settings Quick Access

Renders a subset of `systemSettings` key-value pairs as editable fields directly on the dashboard. Full settings page is at `/admin/settings`.

| Setting Key | Current Value | Edit Inline |
|-------------|---------------|-------------|
| `site_maintenance_mode` | `false` | Toggle |
| `free_shipping_threshold` | `Rp 300.000` | Number input |
| `loyalty_points_rate` | `1 point per Rp 10.000` | Text input |
| `points_expiry_days` | `365` | Number input |
| `default_shipping_origin` | `Jakarta Utara` | Text input |
| `min_order_amount` | `Rp 50.000` | Number input |
| `max_guest_order_age_hours` | `24` | Number input |

**Save pattern:** Each row has a `[Save]` button that calls `PATCH /api/admin/settings/:key`. Changes are logged to `adminActivityLogs`.

---

## 16. Quick Action Toolbar

A fixed row of action buttons at the top-right of the dashboard (visible on desktop, collapsed under "⚡ Actions" on mobile):

| Button | Action |
|--------|--------|
| `+ New Product` | → `/admin/products/new` |
| `+ New Coupon` | → `/admin/coupons/new` |
| `↻ Points Expiry Email` | → POST `/api/admin/points/expiry-reminders` |
| `⚙ Cancel Expired Orders` | → POST `/api/cron/cancel-expired-orders` (manual trigger) |
| `📦 Bulk Ship` | → Opens modal to assign tracking to multiple packed orders at once |
| `📊 Export Orders CSV` | → Opens date-range picker, downloads orders as CSV |

---

## 17. Notification Bell (Header)

Real-time notification centre. Queries `adminActivityLogs + orders + b2bInquiries` on mount and polls every 2 minutes.

**Notification types:**
- 🔔 New order placed (any status)
- ✅ Payment confirmed (status → paid)
- 📦 Order delivered (status → delivered)
- 💬 New B2B inquiry submitted
- 🔴 Stock alert (variant drops below threshold)
- ⚠️ Webhook error detected
- 🏷 Coupon used for first time
- 👤 New customer registered (B2B role)

**Behaviour:**
- Badge count on bell icon shows unread count
- Click → opens dropdown with last 10 notifications
- Each notification is clickable → navigates to relevant entity
- "Mark all as read" button
- "View all" → opens full notification history page

---

## 18. Global Search (Header)

A `⌘K` / `Ctrl+K` command palette that searches across:
- Orders by order number, customer name, email, phone
- Products by name (Indonesian or English), SKU
- Customers by name, email
- Coupons by code
- Blog posts by title
- B2B inquiries by company name

**Implementation:** Client-side search across cached data with debounce 300ms. Falls back to server search for orders/customers with `limit = 20`.

---

## 19. Data Fetching Strategy

| Section | Method | Freshness |
|---------|--------|-----------|
| KPI Cards | Server Component + React Query `staleTime: 60s` | ~1 min |
| Alert Banner | Server Component (blocking, SSR) | Page load |
| Revenue Chart | React Query `staleTime: 300s` | ~5 min |
| Order Funnel | React Query `refetchInterval: 60s` | ~1 min |
| Live Order Feed | React Query `refetchInterval: 30s` | ~30 sec |
| Action Queue | React Query `refetchInterval: 120s` | ~2 min |
| Financial Panel | React Query on expand (lazy) | On demand |
| Audit Log | React Query paginated | On demand |
| System Health | Client-side ping on load | Page load |

---

## 20. API Endpoints Required

All under `/api/admin/` and protected by `role === 'superadmin'`:

```
GET  /api/admin/dashboard/kpis         → { revenueToday, ordersToday, newCustomers, estimatedMargin, systemHealth }
GET  /api/admin/dashboard/alerts       → [{ priority, message, link }]
GET  /api/admin/dashboard/revenue-chart?range=30d&channel=all → [{ date, revenue, orders }]
GET  /api/admin/dashboard/order-funnel → { pending_payment: N, paid: N, ... }
GET  /api/admin/dashboard/action-queue → [{ priority, type, message, entityId, actionLabel }]
GET  /api/admin/dashboard/inventory-flash → { outOfStock: N, lowStock: N, items: [...] }
GET  /api/admin/dashboard/b2b-pipeline → { ... }
GET  /api/admin/dashboard/platform-health → { services: [...] }
GET  /api/admin/audit-logs?page=1&actor=&action=&dateFrom=&dateTo= → paginated logs
PATCH /api/admin/settings/:key         → update system setting
POST /api/admin/dashboard/acknowledge-alert → { alertId }
GET  /api/admin/users/summary          → { roleCounts, recentSignups }
```

---

## 21. Permissions Matrix

| Feature | superadmin | owner | warehouse |
|---------|-----------|-------|-----------|
| Full dashboard | ✅ | ❌ (team dashboard) | ❌ (field dashboard) |
| Financial deep dive | ✅ | ✅ | ❌ |
| Audit log | ✅ | ❌ | ❌ |
| User role management | ✅ | ❌ | ❌ |
| System settings | ✅ | View only | ❌ |
| Coupon create/delete | ✅ | ❌ | ❌ |
| Order status change | ✅ | ✅ | Shipment only |
| Inventory update | ✅ | ✅ | ✅ |
| Blog management | ✅ | ✅ | ❌ |
| B2B quote PDF | ✅ | ✅ | ❌ |
| Force cancel order | ✅ | With reason | ❌ |
| Export data CSV | ✅ | ❌ | ❌ |
| Manual cron trigger | ✅ | ❌ | ❌ |

---

## 22. Mobile Behaviour

On screens < 768px, the layout changes to:
1. Alert banner (full width, sticky)
2. KPI cards scroll horizontally (swipe carousel)
3. Charts stacked vertically, chart controls collapse into a "⚙ Options" button
4. Live order feed becomes a card list (not table)
5. Action queue shown as a badge count on the header bell
6. Financial/inventory/B2B panels collapsed by default with expand accordions
7. Quick action toolbar becomes a floating action button `⚡` → bottom-right

---

## 23. Implementation Priority

Phase 1 (MVP — build immediately):
- KPI cards with correct data queries
- Alert banner (P0 + P1 conditions only)
- Live order feed with "needs action" filter
- Order status funnel
- Action queue (orders + stock only)

Phase 2:
- Revenue chart with date range controls
- Financial deep dive panel
- Audit log table
- System health panel

Phase 3:
- Platform health live checks
- Notification bell
- Global search (⌘K)
- Bulk ship modal
- CSV export
- User management summary

---

*Last updated: 14 May 2026 · DapurDekaka Superadmin Spec v1.0*
