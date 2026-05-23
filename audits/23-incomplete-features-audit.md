# Audit 23 — Incomplete & Placeholder Features Audit

**Purpose:** Find features that LOOK complete but are actually broken, placeholder, or immature
**Date:** 2026-05-23

---

## What Makes a Feature "Incomplete"

A feature is incomplete if:
1. It has a UI but the backend doesn't work (button clicks do nothing)
2. It has a form but submissions aren't validated
3. It shows data but the data is fake/hardcoded
4. It has an API route but returns 500 errors
5. It has a loading state but no data source
6. It has error handling but the error messages are in English
7. It has a "success" flow but no actual state change
8. It looks finished but has TODO/FIXME comments
9. It works on desktop but breaks on mobile
10. It works for happy path but crashes on edge cases

---

## 🔴 CRITICAL — Appears Functional But Is Broken

### IC1 — AI Caption Generation (Superadmin)
**Files:** `app/(admin)/admin/ai-content/page.tsx`, `app/api/ai/caption/route.ts`

**What it looks like:** Admin can generate AI captions for products/blog
**Reality:**
- API route exists but may not validate input
- No loading state on generate button (multiple clicks = multiple API calls)
- Generated captions not saved automatically (need manual copy-paste)
- No error handling if Minimax API fails
- Not checked if `MINIMAX_API_KEY` is set → silent failure

**Fix needed:**
- Add `isGenerating` state with spinner
- Auto-save to product/blog on confirm
- Error toast if API fails
- Graceful degradation if API key not configured

---

### IC2 — B2B Quote Status Update
**Files:** `app/api/b2b/quotes/[id]/[action]/route.ts`

**What it looks like:** Admin can accept/reject quotes
**Reality:**
- Status transitions NOT validated (can go from `draft` → `accepted` skipping `sent`)
- Email notification to B2B customer may not fire
- Quote PDF generation may not work
- `accepted` quote doesn't create any order record

**Fix needed:**
- Implement state machine for quote statuses
- Add email notification on status change
- `accepted` quote should prompt creating actual order

---

### IC3 — Blog Cover Image Upload
**Files:** `components/admin/blog/CoverImageUploader.tsx`, Cloudinary upload API

**What it looks like:** Admin can upload cover images to Cloudinary
**Reality:**
- Client-side validation only (type/size)
- No server-side re-validation
- Upload progress may not show
- If upload fails, error state may not display
- Existing image deletion from Cloudinary may not happen

**Fix needed:**
- Server-side file validation (magic bytes, not just MIME)
- Progress indicator during upload
- Proper error toast on failure
- Delete old Cloudinary asset on replacement

---

### IC4 — Testimonial Public API
**File:** `app/api/testimonials/public/route.ts`

**What it looks like:** Anyone can see testimonials on store
**Reality:**
- No `is_approved` filter → ALL testimonials shown including unmoderated
- No pagination → returns all testimonials forever
- No content sanitization → XSS possible

**Fix needed:**
- Add `isApproved = true` filter
- Add pagination
- Sanitize HTML content

---

### IC5 — Team Dashboard Snapshot
**Files:** `app/api/admin/team-dashboard/snapshot/route.ts`, various metric routes

**What it looks like:** Warehouse team has a dashboard with KPIs
**Reality:**
- API routes exist but may return 500 errors
- Data may be hardcoded or stale
- No real-time updates (need manual refresh)
- Missing loading states on the page

**Fix needed:**
- Verify each metric route works end-to-end
- Add polling or SWR for auto-refresh
- Add skeleton loading states

---

### IC6 — Points Expiry Cron
**Files:** `app/api/cron/expire-points/route.ts`

**What it looks like:** Points automatically expire after 365 days
**Reality:**
- Cron endpoint has NO authentication (anyone can trigger)
- No logging of what was expired
- No email sent before expiry (spec says: email 30 days before)
- No idempotency (running twice = double expiry)

**Fix needed:**
- Add `Authorization: Bearer CRON_SECRET`
- Add proper logging
- Send expiry warning email 30 days before
- Add idempotency key check

---

### IC7 — Cancel Expired Orders Cron
**Files:** `app/api/cron/cancel-expired-orders/route.ts`

**What it looks like:** Unpaid orders auto-cancel after 15 minutes
**Reality:**
- Cron endpoint has NO authentication
- May not handle concurrent execution (race condition)
- May not properly release reserved stock
- May not restore coupon usage

**Fix needed:**
- Add `Authorization: Bearer CRON_SECRET`
- Use `SELECT FOR UPDATE` for atomic cancellation
- Restore reserved stock atomically
- Restore coupon usage

---

### IC8 — Cart Merge on Login
**Files:** `app/api/auth/merge-cart/route.ts`

**What it looks like:** Guest cart merges when logging in
**Reality:**
- May not verify guest cart belongs to same session
- If merge conflict (same product, different qty), unclear which wins
- If guest cart is empty, unnecessary API call
- If merge fails, no error shown to user

**Fix needed:**
- Verify session token matches
- Implement conflict resolution (sum quantities)
- Early return if guest cart empty
- Show error toast if merge fails

---

## 🟠 HIGH — UI Complete But Backend Fragile

### IH1 — Coupon Create/Edit Form
**Files:** `components/admin/coupons/CouponForm.tsx`, `app/api/admin/coupons/route.ts`

**What it looks like:** Admin can create coupons with all options
**Reality:**
- `applicable_product_ids` and `applicable_category_ids` may not save correctly
- `max_uses_per_user` may not be validated at creation time
- Start date may not be enforced (coupon usable before start)
- No preview of coupon code generation

**Fix needed:**
- Verify all 9 validation rules are configurable in form
- Add date picker for start_at
- Preview generated code before save

---

### IH2 — Product Variant Management
**Files:** `components/admin/products/ProductForm.tsx`, variant handling

**What it looks like:** Admin can create product with multiple variants (size/weight)
**Reality:**
- Variant list may allow duplicate names
- Deleting a variant may not update existing cart items
- Price per variant may not be validated (negative? zero?)
- Stock initialized but may not match expected

**Fix needed:**
- Add unique constraint on variant name per product
- Add migration to clean orphaned cart items
- Validate price > 0

---

### IH3 — Order Status Timeline
**Files:** `app/(admin)/admin/orders/[id]/OrderDetailClient.tsx`

**What it looks like:** Order detail shows status progression
**Reality:**
- Only shows CURRENT status, not HISTORY
- No timestamps for when status changed
- No admin/user who made the change
- If order skipped a status (e.g., direct ship without pack), not shown

**Fix needed:**
- Add `order_status_history` table
- Record every status change with timestamp and actor
- Display full timeline in order detail

---

### IH4 — RajaOngkir Shipping Integration
**Files:** `lib/services/rajaongkir.ts`, `app/api/shipping/cost/route.ts`

**What it looks like:** Store shows shipping cost from RajaOngkir
**Reality:**
- City list fetched fresh on every request (rate limit risk)
- Origin city hardcoded (may be wrong)
- No retry logic if RajaOngkir API fails
- No fallback if API is down

**Fix needed:**
- Cache city list in DB, refresh weekly
- Store origin in system_settings
- Add retry with exponential backoff
- Show fallback message if API unavailable

---

### IH5 — Midtrans Payment Retry
**Files:** `app/api/checkout/retry/route.ts`

**What it looks like:** Customer can retry failed payment
**Reality:**
- May create new Midtrans order_id without invalidating old one
- Old snap_token may still be valid and usable
- Payment retry count may not be tracked
- After 3 retries, no indication that customer is blocked

**Fix needed:**
- Ensure old order_id marked as `retry_replaced`
- Generate new `order_id` with retry suffix
- Track retry count on order
- Show "max retries reached" after 3 attempts

---

### IH6 — Blog AI Description Generation
**Files:** `app/api/ai/caption/route.ts` (may handle blog too)

**What it looks like:** Admin can generate blog descriptions with AI
**Reality:**
- May not have distinct endpoint for blog vs product captions
- Generated content length may not be appropriate for blog
- SEO meta fields (title, description) may not auto-fill from content
- No image alt text generation

**Fix needed:**
- Separate blog description prompt from product caption
- Respect blog SEO field lengths
- Auto-generate image alt text

---

## 🟡 MEDIUM — Partially Implemented

### IM1 — Wishlist / Favorites
**Status:** NOT STARTED (inferred from schema check)

**Evidence:** No `wishlists` or `favorites` table in schema. No wishlist UI components.
**Spec says:** Customers can save products to wishlist
**Reality:** Feature not built
**Fix needed:** Build from scratch or confirm if deferred

---

### IM2 — Email Notifications
**Files:** `lib/services/resend.ts`, various API routes

**What it looks like:** Emails sent on order confirmation, etc.
**Reality:**
- Resend API integration exists but may not have full templates
- Order confirmation email may not include order items
- Password reset email may have generic template
- B2B inquiry notification may not send

**Fix needed:**
- Audit all email templates in `components/email/`
- Verify each template renders correctly
- Add missing templates (B2B inquiry, points expiry warning)

---

### IM3 — Cloudinary Image Service
**Files:** `lib/services/cloudinary.ts`

**What it looks like:** Images uploaded to Cloudinary
**Reality:**
- Signed upload URL generation may not work
- Image transformations (resize, optimize) may not be applied
- Upload to wrong folder path possible
- No image deletion when product deleted

**Fix needed:**
- Verify signed upload flow end-to-end
- Apply auto-optimization transformations
- Add cleanup on product deletion

---

### IM4 — Inventory Low Stock Alerts
**Files:** `app/api/admin/team-dashboard/low-stock-alerts/route.ts`

**What it looks like:** Dashboard shows low stock products
**Reality:**
- Alert threshold hardcoded (should be configurable per product)
- No notification sent to warehouse team
- No "don't show again" for acknowledged alerts

**Fix needed:**
- Store threshold in `products.low_stock_threshold` column
- Add email/WhatsApp notification option
- Add "dismiss" functionality

---

### IM5 — Order Tracking Page
**Files:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

**What it looks like:** Customer can track order status
**Reality:**
- May not show actual shipping tracking number
- May not link to courier's tracking page
- No estimated delivery date
- No map visualization for "near you"

**Fix needed:**
- Display tracking number with courier link
- Add estimated delivery based on courier estimates
- Consider map integration for delivery progress

---

## 🟢 LOW — Edge Cases Missing

### IL1 — Empty Cart Checkout Attempt
**Files:** `app/(store)/checkout/page.tsx`

**What should happen:** Checkout button disabled or redirect to cart
**Reality:** User with empty cart may still reach checkout URL directly
**Fix needed:** Check cart on mount, redirect if empty

---

### IL2 — Concurrent Cart Updates
**Files:** `store/cart.store.ts` (Zustand)

**What should happen:** Cart state synced between tabs
**Reality:** If user adds item on desktop and switches to mobile, cart is stale
**Fix needed:** Consider `BroadcastChannel` API or SWR for cart

---

### IL3 — Order Number Collision
**Files:** `lib/utils/generate-order-number.ts`

**What should happen:** Unique order numbers always
**Reality:** If two orders generated in same millisecond, collision possible
**Fix needed:** Add sufficient randomness or use UUID suffix

---

### IL4 — Coupon Applied Then Product Deleted
**Files:** `app/api/webhooks/midtrans/route.ts`

**What should happen:** If coupon was applied but qualifying product deleted before payment, order should still be valid (coupon already used)
**Reality:** Need to verify this edge case is handled
**Fix needed:** Snapshot product IDs in coupon usage at apply time

---

## Placeholder & TODO Hunt

Search for all placeholder patterns:

```typescript
// TODO patterns to find:
rg "TODO:\|FIXME:\|XXX:\|HACK:\|BUG:\|XXX"
rg "placeholder\|TEMP\|MOCK\|fake\|dummy"
rg "// not implemented\|// wip\|// coming soon"
rg "return null;.*// TODO\|// .* not done"

// Hardcoded test data:
rg "test\|Test\|TEST" in production code
rg "console\\.log"
rg "alert("

// Empty implementations:
rg "async function.*\\{\\s*\\}"
rg "const .* = async.*=>\\s*\\{\\s*\\}"
```

---

## Feature Completeness Score

| Feature | Status | Score |
|---------|--------|-------|
| Browse Products | Mostly complete | 85% |
| Product Detail | Complete | 90% |
| Cart | Mostly complete | 80% |
| Checkout | Partially complete | 65% |
| Payment (Midtrans) | Basic, missing security | 55% |
| Order Management | UI complete, history missing | 70% |
| Customer Account | Mostly complete | 80% |
| Admin Dashboard | KPIs present, data issues | 60% |
| Admin Orders | CRUD complete, history missing | 75% |
| Admin Products | CRUD complete | 85% |
| Admin Customers | List complete, detail missing | 70% |
| Admin Coupons | CRUD complete | 80% |
| Admin Blog | Mostly complete | 75% |
| Admin Carousel | Mostly complete | 75% |
| B2B Portal | Basic structure | 50% |
| Blog (Store) | List/detail complete | 90% |
| Auth | Register/login OK, password reset partial | 75% |
| Points System | Earn OK, redeem OK, expiry missing | 70% |
| Coupons | Partial validation | 60% |
| Shipping | Basic, caching missing | 55% |
| Email | Templates missing | 50% |
| AI Content | Basic, unstable | 40% |
| i18n | Indonesian complete, English incomplete | 60% |
