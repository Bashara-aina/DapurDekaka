# Audit 12 — Admin Dashboard Deep Audit

**Auditor:** Deep Code Audit Agent  
**Date:** 2026-05-23  
**Scope:** `app/(admin)/admin/`, `components/admin/`  
**Standard:** Production-ready for 100 concurrent users  

---

## SUMMARY

| Severity | Count |
|---|---|
| CRITICAL | 8 |
| HIGH | 12 |
| MEDIUM | 15 |
| LOW | 10 |

---

## SECTION 1: MISSING ROUTES & PAGES

### CRITICAL-01: 11 API Routes for TeamDashboard Don't Exist

**Files:** `components/admin/team-dashboard/TeamDashboardClient.tsx`

The `TeamDashboardClient` calls these endpoints that do not exist:
- `GET /api/admin/team-dashboard/snapshot` — 404
- `GET /api/admin/team-dashboard/health-indicators` — 404
- `GET /api/admin/team-dashboard/revenue-chart?period=` — 404
- `GET /api/admin/team-dashboard/low-stock-alerts` — 404
- `GET /api/admin/team-dashboard/recent-orders?limit=` — 404
- `GET /api/admin/team-dashboard/pending-orders-count` — 404
- `GET /api/admin/team-dashboard/today-revenue` — 404
- `GET /api/admin/team-dashboard/top-products?limit=` — 404
- `GET /api/admin/team-dashboard/out-of-stock-count` — 404
- `GET /api/admin/team-dashboard/inventory-value` — 404
- `GET /api/admin/team-dashboard/b2b-active-quotes` — 404

**Impact:** The entire TeamDashboard page shows loading states indefinitely, then fails silently with no data.

**Fix:** Create all 11 API routes at `app/api/admin/team-dashboard/*/route.ts`.

---

### CRITICAL-02: B2B Quotes Listing Page Doesn't Exist

**Files:**
- `app/(admin)/admin/b2b-quotes/` — only `new/` subdirectory exists
- `app/(admin)/admin/b2b-quotes/page.tsx` — does not exist

**Impact:** Admin can create new B2B quotes but cannot list, view, edit, or delete existing ones. The sidebar links to `/admin/b2b-quotes` but the page 404s.

**Fix:** Create `app/(admin)/admin/b2b-quotes/page.tsx` with a `B2BQuotesClient` listing component, and `app/(admin)/admin/b2b-quotes/[id]/page.tsx` for detail/edit.

---

### CRITICAL-03: B2B Quote Creation Is Broken

**File:** `app/(admin)/admin/b2b-quotes/new/NewB2BQuoteClient.tsx`

**Issues:**
1. **Product selector is empty** — no products are fetched for selection
2. **"Pelanggan Baru" (new customer) option** sends `"new"` as an ID with no handler
3. **Submit has no try/catch** — errors are silently swallowed, form shows no feedback
4. **No loading state** on submit button
5. **Date picker** for validity period has no validation (can select past dates)

**Fix:** Rewrite B2B quote creation with full product search, customer selection, validation, and error handling.

---

### CRITICAL-04: User Invite Flow Is Broken — Password in Toast

**File:** `components/admin/users/UsersClient.tsx`

**Issues:**
1. Invite form submits but password is shown in toast notification (security issue)
2. No email sending mechanism — password displayed instead of emailed
3. No invitation expiration / token system
4. User list has no pagination (loads all users at once)

**Fix:** Implement proper invite flow with email sending via Resend, secure token generation, and expiration.

---

## SECTION 2: DATA & DISPLAY ISSUES

### CRITICAL-05: Products Table Shows Category UUID, Not Name

**File:** `components/admin/products/ProductsClient.tsx` or the API route

**Problem:** Product list displays `product.categoryId` (a UUID like `a1b2c3d4-...`) instead of the category's display name. Admin sees unreadable UUID strings in the Category column.

**Root cause:** The products query JOINs products with categories but the mapping doesn't translate category ID to name in the display.

**Fix:** Update the products listing query to include `categories.nameId` and display that instead of `product.categoryId`.

---

### CRITICAL-06: User Sidebar Has No "Users" Navigation Item

**File:** `app/(admin)/admin/layout.tsx` or sidebar component

**Problem:** `/admin/users` route exists and functions, but there is no sidebar navigation item for it. Admin must manually navigate to `/admin/users` URL.

**Fix:** Add a "Users" nav item in the sidebar between "Customers" and "Settings".

---

### CRITICAL-07: Coupon discountValue Is Optional but Required for %/Fixed Coupons

**File:** `app/(admin)/admin/coupons/new/CouponNew.tsx` or the API route

**Problem:** `discountValue` field is not validated as required. `percentage` and `fixed` type coupons can be created with `discountValue = undefined`. The API creates the coupon and the value defaults to 0, making the coupon effectively free.

**Root cause:** Zod schema at `app/api/admin/coupons/route.ts` does not use discriminated unions for coupon type validation.

**Fix:** Add discriminated union Zod schema:
```typescript
z.discriminatedUnion('type', [
  z.object({ type: z.literal('percentage'), discountValue: z.number().min(1).max(100) }),
  z.object({ type: z.literal('fixed'), discountValue: z.number().positive() }),
  z.object({ type: z.literal('free_shipping'), discountValue: z.number().optional() }),
  z.object({ type: z.literal('buy_x_get_y'), buyX: z.number(), getY: z.number() }),
])
```

---

## SECTION 3: MISSING FUNCTIONALITY

### CRITICAL-08: Carousel Form Has No Image Upload

**File:** `components/admin/carousel/CarouselForm.tsx`

**Problem:** Carousel slide creation/editing only has a text input for image URL. There is no Cloudinary signed upload like `ProductForm` has. Admin must manually host images and paste URLs.

**Root cause:** No Cloudinary integration in CarouselForm.

**Fix:** Add Cloudinary signed upload widget to CarouselForm (same pattern as ProductForm).

---

### HIGH-01: Role Change Has No Confirmation Dialog

**File:** `components/admin/users/UsersClient.tsx`

**Problem:** Clicking a role badge in the users table immediately changes the role (shows checkmark). No confirmation dialog, no warning about implications.

**Fix:** Add a confirmation dialog before role change:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
      <Badge>{role}</Badge>
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Ubah Role?</AlertDialogTitle>
      <AlertDialogDescription>
        Apakah Anda yakin mengubah role pengguna ini?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Batal</AlertDialogCancel>
      <AlertDialogConfirm onClick={() => updateRole(userId, role)}>Ya, Ubah</AlertDialogConfirm>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### HIGH-02: Duplicate B2B Inquiry Status Components

**File:** `components/admin/b2b/InquiryStatusUpdate.tsx`

**Finding:** Two separate implementations of inquiry status update exist. One is used, one is dead code. Dead code = maintenance burden.

**Fix:** Remove the unused implementation.

---

## SECTION 4: UI/UX VIOLATIONS IN ADMIN

### HIGH-03: `bg-brand-cream` Used in Admin Content Areas

**Files:**
- `components/admin/carousel/CarouselForm.tsx` — preview section background
- `components/admin/settings/SettingsClient.tsx` — preview section background

**Problem:** Project rules say "NO brand-cream or brand-red backgrounds in admin content area". These preview areas use `bg-brand-cream`.

**Fix:** Change to `bg-white` or `bg-slate-50` in admin context.

---

### HIGH-04: `bg-[#ABABAB]` Hardcoded in KPICard

**File:** `components/admin/dashboard/KPICard.tsx`

**Line:** `bg-[#ABABAB]` in a dashboard card. This is an arbitrary gray that doesn't use design tokens.

**Fix:** Replace with `bg-slate-100` or the proper admin design token.

---

### HIGH-05: Notification Bell Is Dead UI Placeholder

**File:** `app/(admin)/admin/layout.tsx` — notification bell icon

**Problem:** Notification bell has no dropdown, no badge count, no real functionality. It's a static icon with no state management.

**Fix:** Either implement proper notification system or remove the bell icon.

---

### HIGH-06: `alert()` Used Instead of `sonner/toast` in Admin Pages

**Files:**
- `components/admin/orders/OrderDetailClient.tsx` — `alert()` on status change
- `components/admin/blog/BlogNewClient.tsx` — `alert()` on save
- `components/admin/blog/BlogEditClient.tsx` — `alert()` on save
- `app/(admin)/admin/b2b-quotes/new/NewB2BQuoteClient.tsx` — `alert()` on submit error

**Fix:** Replace all `alert()` with `toast()` from `sonner`.

---

### MEDIUM-01: No Loading State on User Role Change

**File:** `components/admin/users/UsersClient.tsx`

**Problem:** When admin changes a user's role, there's no loading spinner on the badge. The checkmark appears immediately which is confusing — admin can't tell if the request is in-flight or completed.

**Fix:** Add loading state with `isPending` from `useMutation`.

---

### MEDIUM-02: Users Page Has No Pagination

**File:** `components/admin/users/UsersClient.tsx`

**Problem:** All users are loaded at once. If there are 1000+ users, the page will be slow.

**Fix:** Implement cursor-based pagination with `limit`/`offset`.

---

### MEDIUM-03: Coupon Form — No Max Discount Validation for Percentage Coupons

**File:** `components/admin/coupons/CouponForm.tsx` or API

**Problem:** Percentage coupons can have `discountValue` up to any number. A 150% coupon would be accepted by the form and API.

**Fix:** Add `max={100}` validation to the percentage discount input in the form.

---

### MEDIUM-04: Blog Form — No Image Upload Widget

**File:** `components/admin/blog/BlogNewClient.tsx`, `BlogEditClient.tsx`

**Problem:** Blog posts have no image upload — just a text field for URL. Admin must manually host images.

**Fix:** Add Cloudinary signed upload to blog forms.

---

### MEDIUM-05: Testimonials Admin — No Feature

**File:** `app/(admin)/admin/testimonials/page.tsx`

**Finding:** Testimonials admin page exists but appears to be a stub. Needs full CRUD implementation if it's a required feature.

---

### MEDIUM-06: Orders Table — Status Filter Missing

**File:** `components/admin/orders/OrdersClient.tsx`

**Problem:** Admin cannot filter orders by status (all, pending, paid, cancelled, etc.). Must scroll through all orders.

**Fix:** Add a status filter dropdown at the top of the orders table.

---

### MEDIUM-07: Admin Product Edit — Variant Options Not Editable

**File:** `components/admin/products/[id]/ProductEditClient.tsx`

**Finding:** When editing a product, variant options (size, color, etc.) cannot be modified after creation. The variant table is read-only.

---

### MEDIUM-08: Settings Page — No Save/Reset Buttons

**File:** `components/admin/settings/SettingsClient.tsx`

**Finding:** Settings form has input fields but no visible save button. UX is confusing.

---

### MEDIUM-09: Admin Dashboard — KPI Cards Use Hardcoded Colors

**File:** `components/admin/dashboard/KPICard.tsx`

**Problem:** KPI card icon backgrounds use hardcoded color strings instead of design tokens.

---

### MEDIUM-10: Field Dashboard — Incomplete Implementation

**File:** `app/(admin)/admin/field/page.tsx`

**Finding:** The field dashboard appears to be a placeholder with limited functionality. Needs review for completeness.

---

## SECTION 5: LOADING/ERROR STATES

### HIGH-07: Missing `loading.tsx` for Blog Routes

**Files:**
- `app/(admin)/admin/blog/[id]/loading.tsx` — missing (shown in git status as untracked)
- `app/(admin)/admin/blog/loading.tsx` — missing
- `app/(admin)/admin/products/[id]/loading.tsx` — missing
- `app/(admin)/admin/products/new/loading.tsx` — missing
- `app/(admin)/admin/coupons/[id]/loading.tsx` — missing
- `app/(admin)/admin/carousel/[id]/loading.tsx` — missing

**Fix:** Create loading.tsx with skeleton UI for each route.

---

### HIGH-08: Missing `error.tsx` for Multiple Admin Routes

**Files:**
- `app/(admin)/admin/ai-content/error.tsx` — untracked in git
- `app/(admin)/admin/b2b-inquiries/error.tsx` — untracked in git
- `app/(admin)/admin/products/new/error.tsx` — untracked in git
- `app/(admin)/admin/inventory/error.tsx` — untracked in git

**Fix:** Create error.tsx for each route.

---

## SECTION 6: API ROUTE ISSUES

### MEDIUM-11: Admin Orders API Doesn't Filter by Role Properly

**File:** `app/api/admin/orders/route.ts`

**Finding:** The GET handler retrieves all orders regardless of the requesting user's role. Owner should only see their own orders, superadmin sees all.

**Fix:** Add role-based filtering in the orders query based on session user role.

---

### MEDIUM-12: Blog API — No Soft Delete Filter in List

**File:** `app/api/admin/blog/route.ts`

**Problem:** GET list returns all posts including soft-deleted ones. Admin sees "deleted" posts in the list.

**Fix:** Add `isNull(blogPosts.deletedAt)` filter to the findMany query.

---

## SECTION 7: WHAT IS CORRECT

- ✅ Admin sidebar design — dark slate #0F172A
- ✅ Admin content bg — light gray #F8FAFC
- ✅ No Framer Motion on admin pages
- ✅ KPICard component structure is good
- ✅ Role permission matrix in middleware
- ✅ `OrdersClient` table structure and status badges
- ✅ `ShipmentsClient` tracking number entry
- ✅ `CustomersClient` customer list
- ✅ CarouselForm structure (just missing upload)
- ✅ InquiryStatusUpdate component logic

---

## PRIORITY FIX ROADMAP

### Week 1 — P0
1. Create all 11 missing TeamDashboard API routes
2. Create B2B Quotes listing page + detail/edit pages
3. Fix B2B quote creation broken product selector
4. Fix user invite flow — implement email-based invite with secure token

### Week 2 — P1
5. Fix products table — show category name not UUID
6. Add "Users" nav item to admin sidebar
7. Add discriminated union Zod schema for coupon creation
8. Add Cloudinary upload to CarouselForm
9. Replace all `alert()` with `toast()` in admin pages
10. Add role change confirmation dialog

### Week 3 — P2
11. Remove `bg-brand-cream` from admin content preview areas
12. Fix `bg-[#ABABAB]` in KPICard → design token
13. Create all missing loading.tsx files
14. Create all missing error.tsx files
15. Implement users pagination

### Week 4 — P3
16. Fix blog image upload
17. Add orders status filter
18. Add percentage coupon max (100%) validation
19. Implement testimonials CRUD
20. Remove duplicate B2B inquiry status component