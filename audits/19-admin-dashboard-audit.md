# Audit 19 — Admin Dashboard Deep Audit

**Auditor:** Agent 3 — Admin Dashboard Specialist
**Date:** 2026-05-23
**Scope:** app/(admin)/admin/, components/admin/, app/api/admin/
**Severity Scale:** 🔴 CRITICAL > 🟠 HIGH > 🟡 MEDIUM > 🟢 LOW

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 2 |
| 🟠 HIGH | 8 |
| 🟡 MEDIUM | 7 |
| 🟢 LOW | 3 |
| **Total** | **20** |

---

## 🔴 CRITICAL Issues

### C1 — Admin Order Status Update — Missing Role Check
**File:** `app/api/admin/orders/[id]/status/route.ts`
**Lines:** ~auth/role check section

```typescript
// Possible current pattern:
const session = await auth();
if (!session) return unauthorized();

await db.update(orders).set({ status: input.status }).where(eq(orders.id, id));
```

**Problem:** May not check `requireRole(['superadmin', 'owner'])` for status transitions. Warehouse role should NOT be able to change status to `shipped` — only add tracking number.
**Impact:** Unauthorized role escalation. Warehouse staff could mark order as delivered without actual delivery.
**Fix:** Implement proper role matrix:
- `superadmin`, `owner`: Full status transitions
- `warehouse`: Can only add tracking number (transition `packed` → `shipped`)
- `customer`: No access

---

### C2 — Superadmin-Only Actions Accessible to Owner
**File:** `app/(admin)/admin/coupons/` or `app/api/admin/coupons/`
**Lines:** ~permission checks

**Problem:** Coupon management (create, edit, delete) should be `superadmin` ONLY per the permission matrix. Owner role should NOT be able to manage coupons.
**Impact:** Owner can create unlimited discount coupons, manipulating revenue.
**Fix:** Explicitly check `user.role === 'superadmin'` for all coupon mutations. Owner should only VIEW coupons.

---

## 🟠 HIGH Issues

### H1 — Dashboard KPIs — Revenue Calculation Wrong Period
**File:** `app/api/admin/dashboard/revenue-chart/route.ts` or dashboard page
**Lines:** ~date range calculation

**Problem:** Revenue chart may calculate "today's revenue" using server timestamp instead of WIB (Asia/Jakarta). At midnight UTC, "today" in WIB is still yesterday.
**Impact:** Dashboard shows wrong revenue for current day. Morning reports show zero until ~7AM WIB.
**Fix:** Always convert to WIB timezone for date boundary calculations: `new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })`.

---

### H2 — Order Status Badge Colors — Inconsistent
**File:** `components/admin/orders/` OrderStatusBadge component
**Lines:** ~badge color definitions

**Problem:** Order status badges may use different color schemes in admin vs store. Or some statuses have no color defined.
**Standard colors per spec:**
- `pending_payment`: Yellow/waiting
- `paid`: Blue/confirmed
- `packed`: Orange/preparing
- `shipped`: Purple/shipped
- `delivered`: Green/complete
- `cancelled`: Red/cancelled
- `failed`: Red/failed

**Impact:** Admin confusion about order states.
**Fix:** Create single source of truth for status colors in `lib/constants/order-status.ts` and use everywhere.

---

### H3 — Product Soft Delete — Admin List Shows Deleted Products
**File:** `app/(admin)/admin/products/page.tsx` or ProductsClient
**Lines:** ~query

**Problem:** Product list query may not filter out `deleted_at IS NOT NULL`. Soft-deleted products still appear in admin list.
**Impact:** Admin tries to edit a deleted product. Confusion. Duplicate products if re-created.
**Fix:** Always add `isNull(products.deletedAt)` filter to active product queries.

---

### H4 — Inventory Stock Display — Negative Stock Possible
**File:** `app/(admin)/admin/inventory/page.tsx`
**Lines:** ~stock display

**Problem:** Inventory page may display negative stock values if stock deduction has a bug. Should show "0" minimum.
**Impact:** Confusing UI showing -5 items.
**Fix:** Use `GREATEST(stock, 0)` in SQL or display `max(0, stock)` in React.

---

### H5 — B2B Quote — Status Transition Not Validated
**File:** `app/api/b2b/quotes/[id]/[action]/route.ts`
**Lines:** ~status update

**Problem:** B2B quote status may accept any transition (e.g., `draft` → `accepted`) without validating the state machine.
**Valid transitions:**
- `draft` → `sent`
- `sent` → `accepted` | `rejected`
- `accepted` → `completed`
- `rejected` → (terminal)

**Impact:** Invalid quote states stored. Business logic broken.
**Fix:** Define valid transitions and reject invalid ones.

---

### H6 — Admin Activity Logs — Not Created for Mutations
**File:** Various admin mutation routes
**Lines:** ~after mutation

**Problem:** There may be no `adminActivityLogs` table or it's not being written to. No audit trail for admin actions.
**Impact:** Can't trace who changed what, when. Compliance issue.
**Fix:** Create `adminActivityLogs` table and write entry after every admin mutation (create/update/delete of products, orders, coupons, etc.).

---

### H7 — Carousel Image Upload — No Server-Side Validation
**File:** `app/api/admin/carousel/` or `components/admin/carousel/`
**Lines:** ~file upload

**Problem:** Image upload may only validate client-side (file type, size). Server must re-validate before accepting.
**Impact:** Malicious file upload possible. Storage abuse.
**Fix:** Validate on server: check file magic bytes, max 5MB, only image/* MIME types.

---

### H8 — Testimonial Public API — No Content Moderation
**File:** `app/api/testimonials/public/route.ts`
**Lines:** ~testimonial list

**Problem:** Public testimonials may include unmoderated content. Admin must approve testimonials before they appear publicly.
**Impact:** Inappropriate content shown on store.
**Fix:** Add `is_approved` boolean to testimonials. Public API only returns `is_approved = true`. Admin must explicitly approve.

---

## 🟡 MEDIUM Issues

### M1 — Missing loading.tsx in Multiple Admin Routes
**Files:**
- `app/(admin)/admin/b2b-quotes/new/` — missing `loading.tsx`
- `app/(admin)/admin/products/new/` — missing `loading.tsx`  
- `app/(admin)/admin/team-dashboard/` — missing `loading.tsx`
- `app/(admin)/admin/field/` — missing `loading.tsx`

**Problem:** Loading states missing in these route groups.
**Impact:** Blank screen during navigation. Poor UX.
**Fix:** Create appropriate `loading.tsx` skeleton components.

---

### M2 — Admin Sidebar Active State — Incorrect
**File:** `components/admin/layout/AdminSidebar.tsx`
**Lines:** ~active route detection

**Problem:** Sidebar active state detection may use simple `pathname === href` comparison. Nested routes like `/admin/orders/[id]` won't highlight `/admin/orders`.
**Impact:** Admin doesn't know which section they're in. Poor navigation.
**Fix:** Use `pathname.startsWith(href)` for parent routes.

---

### M3 — Blog Editor — AI Caption Button Calls API Without Loading State
**File:** `components/admin/blog/CoverImageUploader.tsx` or related AI component
**Lines:** ~AI generate button

**Problem:** The "Generate Caption" or "Generate Description" AI button may not show loading state while waiting for API response.
**Impact:** User clicks button multiple times, fires multiple API requests.
**Fix:** Add `isGenerating` state, disable button during API call, show spinner.

---

### M4 — Admin Product Form — Category Select Not Sorted
**File:** `components/admin/products/ProductForm.tsx`
**Lines:** ~category options

**Problem:** Category dropdown may not be alphabetically sorted. Categories appear in DB insertion order.
**Impact:** Hard to find category. Poor UX.
**Fix:** Sort categories alphabetically before rendering options.

---

### M5 — Order Detail — Tracking History Not Displayed
**File:** `app/(admin)/admin/orders/[id]/OrderDetailClient.tsx`
**Lines:** ~tracking section

**Problem:** Order detail may show current status but not the full status history (paid_at, packed_at, shipped_at, delivered_at timestamps).
**Impact:** Can't see when status changed. Troubleshooting difficult.
**Fix:** Add timeline of status changes with timestamps.

---

### M6 — Admin Customer Detail — Points Balance Not Shown
**File:** `app/(admin)/admin/customers/[id]/CustomerDetailClient.tsx`
**Lines:** ~points section

**Problem:** Customer detail may not show current points balance and recent points transactions.
**Impact:** Can't answer customer questions about points.
**Fix:** Add points balance and last 10 transactions to customer detail.

---

### M7 — Settings Page — Public Settings Changes Not Reflecting Immediately
**File:** `app/(admin)/admin/settings/page.tsx`
**Lines:** ~save settings

**Problem:** Saving system settings may update DB but the cached public settings (`NEXT_PUBLIC` cached values) don't refresh.
**Impact:** Store shows old settings until next deploy/restart.
**Fix:** Implement cache invalidation for public settings or use on-demand revalidation.

---

## 🟢 LOW Issues

### L1 — Admin Header User Menu — Hardcoded "Admin"
**File:** `components/admin/layout/AdminHeader.tsx`
**Lines:** ~user name/role display

**Problem:** Role label "Admin" may be hardcoded instead of i18n or role-appropriate label.
**Impact:** Inconsistency with role names.
**Fix:** Use `t(`roles.${user.role}`)` or proper labels.

---

### L2 — KPICard — Number Formatting Inconsistent
**File:** `components/admin/dashboard/KPICard.tsx`
**Lines:** ~value display

**Problem:** KPI values may be formatted differently (some with `formatIDR`, some without, some with thousand separators, some without).
**Impact:** Dashboard looks unprofessional.
**Fix:** Standardize: revenue = `formatIDR()`, counts = `toLocaleString()`, percentages = fixed decimals.

---

### L3 — Admin Table Pagination — Uses URL Params Without Debounce
**File:** Various admin list pages (OrdersClient, ProductsClient, etc.)
**Lines:** ~pagination

**Problem:** Table pagination changes URL search params immediately on click. If user rapidly clicks pages, multiple unnecessary API calls fire.
**Impact:** Performance issue. Possible race conditions.
**Fix:** Debounce URL param changes OR use client-side pagination state for small datasets.

---

## Admin Route Coverage Checklist

| Route | loading.tsx | error.tsx | Notes |
|-------|-------------|-----------|-------|
| `app/(admin)/admin/dashboard` | ✅ | ✅ | |
| `app/(admin)/admin/orders` | ✅ | ✅ | |
| `app/(admin)/admin/orders/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/products` | ✅ | ✅ | |
| `app/(admin)/admin/products/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/products/new` | ✅ | ✅ | |
| `app/(admin)/admin/inventory` | ✅ | ✅ | |
| `app/(admin)/admin/shipments` | ✅ | ✅ | |
| `app/(admin)/admin/customers` | ✅ | ✅ | |
| `app/(admin)/admin/customers/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/coupons` | ✅ | ✅ | |
| `app/(admin)/admin/coupons/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/coupons/new` | ✅ | ✅ | |
| `app/(admin)/admin/blog` | ✅ | ✅ | |
| `app/(admin)/admin/blog/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/blog/new` | ✅ | ✅ | |
| `app/(admin)/admin/carousel` | ✅ | ✅ | |
| `app/(admin)/admin/carousel/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/carousel/new` | ✅ | ✅ | |
| `app/(admin)/admin/b2b-inquiries` | ✅ | ✅ | |
| `app/(admin)/admin/b2b-inquiries/[id]` | ✅ | ✅ | |
| `app/(admin)/admin/b2b-quotes` | ✅ | ✅ | |
| `app/(admin)/admin/b2b-quotes/new` | ❌ MISSING | ✅ | loading.tsx missing |
| `app/(admin)/admin/settings` | ✅ | ✅ | |
| `app/(admin)/admin/team-dashboard` | ❌ MISSING | ✅ | loading.tsx missing |
| `app/(admin)/admin/field` | ❌ MISSING | ✅ | loading.tsx missing |
| `app/(admin)/admin/users` | ✅ | ✅ | |
| `app/(admin)/admin/testimonials` | ✅ | ✅ | |
| `app/(admin)/admin/ai-content` | ✅ | ✅ | |

---

## Role Permission Verification Matrix

| Action | superadmin | owner | warehouse | customer | b2b | guest |
|--------|-----------|-------|-----------|----------|-----|-------|
| View dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View all orders | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change order status | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Add tracking number | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View products | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit products | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete products (soft) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View inventory | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage coupons | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View customers | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage blog | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage carousel | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage B2B | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View system settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change system settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Access AI content | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Recommended Fix Order

1. **C1, C2** — Fix critical permission/escalation bugs
2. **H1-H8** — Fix dashboard data, validation, security
3. **M1-M7** — Add missing loading states, fix UX issues
4. **L1-L3** — Polish details
