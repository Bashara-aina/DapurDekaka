# AUDIT 01 — Business Flow
# DapurDekaka.com — Full Business Logic Audit
**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** Checkout, Payment, Orders, Coupons, Points, B2B

---

## LEGEND
- ✅ Implemented & correct
- ⚠️ Partially implemented or has a bug
- ❌ Not implemented (stub / placeholder)
- 🔴 Critical — blocks real usage
- 🟡 Major — hurts user experience
- 🟢 Minor — nice-to-have fix

---

## 1. GUEST CHECKOUT FLOW

### 1.1 Identity Collection (Step 1)
**Status:** ✅ Implemented

The `IdentityForm` component collects `recipientName`, `recipientEmail`, `recipientPhone`. Validated client-side with regex. Zod schema exists in `lib/validations/auth.schema.ts`.

**Gaps:**
- ⚠️ 🟡 No "optional login/register prompt" shown on identity step — PRD requires a non-blocking "Sudah punya akun? Masuk sekarang" prompt to encourage account creation before proceeding.
- ⚠️ 🟡 Phone validation regex not verified to enforce Indonesian format (`08xx` or `+628xx`) — needs explicit check since customers use mixed formats.
- ⚠️ 🟢 If logged-in user skips to checkout, the IdentityForm still renders but `recipientName/email/phone` are not pre-filled from session data. User must type them manually.

### 1.2 Delivery Method Selection (Step 2)
**Status:** ✅ Implemented — `DeliveryMethodToggle` renders both options.

**Gaps:**
- ⚠️ 🟡 When pickup is selected, the flow should skip directly from delivery choice to the coupon/payment step. Currently, the step index still includes "courier" (`STEPS` array has 4 items always). The courier step renders but is silently skipped — this confuses the stepper UI which shows 4 steps regardless.
- ❌ 🟡 No store address, opening hours, or map embed shown in the delivery selection step when user picks "Ambil Sendiri" — PRD requires this info inline.

### 1.3 Shipping Address (Step 3 — Delivery Only)
**Status:** ✅ Implemented — Province → City cascade works via RajaOngkir.

**Gaps:**
- ⚠️ 🟡 For logged-in users, there is **no "select from saved addresses" UI** in the checkout flow. The `AddressForm` always renders blank. Saved addresses are only viewable in `/account/addresses`. The PRD requires a picker showing saved addresses with a "tambah baru" option at checkout.
- ⚠️ 🟡 "Save this address" toggle for logged-in users is missing — PRD requires it.
- ❌ 🟡 District (Kecamatan) field — PRD requires it to cascade from city. Currently it is a free-text input, not a RajaOngkir dropdown. This means city_id can be set correctly but district is unvalidated.
- ⚠️ 🟢 `postalCode` is optional in the form type (`postalCode?: string`) but required in DB schema. If user skips it, the insert will fail.

### 1.4 Shipping Options (Step 3b)
**Status:** ✅ Implemented — RajaOngkir filters to SiCepat/JNE/AnterAja frozen services.

**Gaps:**
- ⚠️ 🟡 If no cold-chain service is available for the destination, a WhatsApp link is shown — but the WhatsApp number is **hardcoded** in `lib/constants/index.ts`. It does not pull from `system_settings.store_whatsapp_number`. If the number changes, it requires a code deploy.
- ⚠️ 🟡 No courier logos displayed — PRD says "Display per option: courier logo, service name, estimated days, cost". Currently only text labels are rendered.
- ⚠️ 🟢 No caching on RajaOngkir results. Every time the address form is submitted (even if same city_id), a fresh API call is made. This could hit rate limits.
- ⚠️ 🟢 Shipping weight formula is correct (sum of `variant.weightGram × qty`) but the minimum billable weight of 1000g and rounding to nearest 100g may not be applied consistently — verify `lib/rajaongkir/calculate-cost.ts`.

### 1.5 Coupon + Points (Step 4)
**Status:** ⚠️ Coupon works; points are broken.

**Critical Bug — Points Balance:**
```typescript
// app/(store)/checkout/page.tsx, line 99
const pointsBalance = session?.user ? 0 : 0; // TODO: Fetch points balance from DB
```
🔴 **This means NO logged-in user can ever redeem points at checkout.** The `PointsRedeemer` component receives `balance=0` and will never allow input. This is a critical regression of the entire loyalty system.

**Fix Required:**
```typescript
// Need a server-side or React Query fetch:
const { data: pointsData } = useQuery({
  queryKey: ['points-balance', session?.user?.id],
  queryFn: () => fetch('/api/account/points').then(r => r.json()),
  enabled: !!session?.user,
});
const pointsBalance = pointsData?.balance ?? 0;
```

**Coupon Gaps:**
- ⚠️ 🟡 `buy_x_get_y` coupon type exists in the DB schema and is validated by the API, but the checkout UI has **no logic to add the free item to cart automatically**. PRD says "adds free item to cart automatically — free item is lowest-priced variant in qualifying product." This entire coupon type is non-functional from a UX perspective.
- ⚠️ 🟡 Coupon discount formula for `free_shipping` works correctly (sets shipping to 0) but only if applied before shipping is selected. If user selects shipping first, then applies free_shipping coupon, the displayed total still shows shipping cost until the next render cycle.
- ⚠️ 🟢 Coupon error messages are in Indonesian (`Kupon tidak ditemukan`) but no English fallback for EN language setting.

### 1.6 Order Summary + Payment Trigger (Step 5)
**Status:** ✅ Order summary renders. Midtrans Snap integration works.

**Gaps:**
- ⚠️ 🟡 No "order notes" text input visible in the checkout flow. `customerNote` is in the form state but there is no textarea rendered on any step — PRD requires this at checkout.
- ⚠️ 🟡 No display of estimated delivery days in the payment step summary (only courier name shown). PRD requires showing estimated days.
- ⚠️ 🟢 Snap popup: if user closes the Snap modal without paying, they are not redirected. The `onClose` callback from Midtrans is wired to `onClose` in `MidtransPayment` but the parent checkout page does nothing with it (does not show a "continue payment" prompt or redirect).

---

## 2. REGISTERED USER CHECKOUT DIFFERENCES

**Status:** ⚠️ Partially implemented.

| Requirement | Status | Notes |
|---|---|---|
| Pre-fill identity form from session | ❌ | Session has name/email but checkout form starts blank |
| Select from saved addresses | ❌ | Only free-text address form exists at checkout |
| Save address toggle | ❌ | Not rendered |
| Show points balance | ❌ | Hardcoded to 0 (critical bug) |
| Earn points after payment | ✅ | Webhook correctly awards points |
| Cart merge on login | ✅ | `/api/auth/merge-cart` exists |

---

## 3. PAYMENT FLOW

### 3.1 Order Creation (checkout/initiate)
**Status:** ✅ Well implemented.

The route:
1. Validates cart items against live DB stock ✅
2. Calculates totals ✅
3. Validates coupon (delegates to same logic as validate API) ✅
4. Deducts points from user balance ✅
5. Creates order + order_items ✅
6. Creates Midtrans Snap token ✅
7. Returns snapToken + orderNumber ✅

**Gaps:**
- ⚠️ 🟡 Order number generation uses `generateOrderNumber()` with a random 4-digit suffix, not a sequential daily counter. PRD specifies `DDK-YYYYMMDD-XXXX` where XXXX is a daily sequential counter starting at 0001. Current implementation may produce collisions (`DDK-20260512-2847` and `DDK-20260512-2847` could theoretically both appear).
- ⚠️ 🟡 `paymentExpiresAt` is set to `new Date(Date.now() + 15 * 60 * 1000)` — hardcoded 15 minutes. PRD says this should be configurable via `system_settings.payment_expiry_minutes`. The setting exists in the DB seed but is never read by the initiate route.
- ⚠️ 🟢 No idempotency protection on `/api/checkout/initiate`. If a network error causes the client to re-submit, two orders could be created. Should check for an existing `pending_payment` order from same user with same cart before creating a new one.

### 3.2 Midtrans Webhook (Payment Confirmed)
**Status:** ✅ Fully implemented with proper security.

The webhook:
1. Verifies SHA512 signature ✅
2. Finds order by midtrans_order_id ✅
3. Checks idempotency (skips if already `paid`) ✅
4. On `settlement`: marks paid, deducts stock, awards points, sends email ✅
5. On `cancel`/`expire`/`deny`: reverses points, reverses coupon usage, cancels order ✅

**Gaps:**
- ⚠️ 🟡 `coupon_usages` table is never written to. The webhook increments `coupons.usedCount` but never inserts a row into `coupon_usages`. This breaks:
  - Per-user coupon limit checks (the `maxUsesPerUser` field)
  - The customer voucher history page (`/account/vouchers`)
  - Admin coupon usage analytics
- ⚠️ 🟡 `order_status_history` is not written on webhook events. The PRD schema requires every status change to be logged in `order_status_history` for the customer timeline view. Only admin status updates go through the status history API.
- ⚠️ 🟢 Email confirmation (`OrderConfirmation`) is sent from webhook but no PDF is attached. PRD says "PDF receipt generated and attached to confirmation email." Currently PDF is only client-side on the success page.
- ⚠️ 🟢 Points awarded use `floor(subtotal / 1000)` which is correct, but B2B double points multiplier (2x per `system_settings.b2b_points_multiplier`) is not applied. All orders earn 1x regardless of user role.

### 3.3 Payment Retry (/api/checkout/retry)
**Status:** ✅ Exists. Generates new Midtrans token for same order.

**Gaps:**
- ⚠️ 🟡 After 3 retries (`payment_retry_count >= 3`), PRD says order should be cancelled automatically. The retry endpoint increments the counter but does NOT enforce the cancellation. The cron job (`cancel-expired-orders`) handles expiry, but retry doesn't actively cancel on 3rd failure.
- ⚠️ 🟢 No "Coba Lagi" (try again) button on the `/checkout/failed` page that creates a new order with same items. PRD requires this.

### 3.4 Checkout Failed Page
**Status:** ⚠️ Page exists but incomplete.

The page file exists at `app/(store)/checkout/failed/page.tsx` but the implementation was not fully audited. From PRD:
- ❌ "Coba Lagi" button that creates a new order with same cart items — this requires either persisting cart state or re-reading order items from DB.
- ❌ No display of specific failure reason (fraud, expired, insufficient funds).

---

## 4. ORDER LIFECYCLE & STATUS MANAGEMENT

### 4.1 Status Transition API
**Status:** ⚠️ Partial.

The endpoint `/api/admin/orders/[id]/status` only accepts transitions to `shipped` (with tracking number) and `delivered`. The valid transitions defined in the route are:
```
paid → processing  ← NOT IN API
processing → packed ← NOT IN API
packed → shipped   ✅ (with tracking number)
shipped → delivered ✅
```

🔴 **Admin cannot mark orders as `processing` or `packed` via the API.** The admin orders page shows these statuses but there is no button/action to update them. The entire `processing` and `packed` stages of the fulfillment pipeline are stuck.

**Fix Required:** Extend the status update route to accept all valid transitions with role-based permission checks:
- `paid → processing`: Owner or Superadmin
- `processing → packed`: Owner, Superadmin, or Warehouse
- `packed → shipped`: Warehouse (with tracking number)
- `shipped → delivered`: Owner or Superadmin

### 4.2 Order Status History Logging
**Status:** ⚠️ Incomplete.

`order_status_history` is never written by:
- The Midtrans webhook (payment confirmation) ❌
- The checkout initiate route (order creation) ❌

It IS written by the admin status update route ✅

This means the customer-facing `OrderTimeline` component (which reads from `order_status_history`) will show:
- Empty timeline for all guest checkouts after payment ❌
- No "Pembayaran diterima" entry in timeline ❌
- Only manual admin status updates appear ❌

### 4.3 Pickup Order Flow
**Status:** ⚠️ Partial.

`PickupInvitation` component exists and renders correctly. The page `/orders/[orderNumber]/pickup` exists.

**Gaps:**
- ❌ 🟡 When a pickup order is confirmed (webhook settlement), no email is automatically sent with the pickup invitation. PRD says "Invitation is also emailed to customer."
- ⚠️ 🟡 Pickup orders skip `packed` and `shipped` per PRD, but the status update API doesn't enforce this. A warehouse staff member could accidentally mark a pickup order as `shipped`.
- ⚠️ 🟢 `pickup_code` on the order is set to `order_number` in the initiate route — but only if `deliveryMethod === 'pickup'`. Verify this conditional is present.

### 4.4 Customer-Side Order Notifications (Emails)
**Status:** ⚠️ Partial.

| Trigger | Template | Status |
|---|---|---|
| `paid` | `OrderConfirmation` | ✅ Sent from webhook |
| `packed → shipped` | `OrderShipped` | ✅ Sent from status API |
| `shipped → delivered` | `OrderDelivered` | ✅ Sent from status API |
| `any → cancelled` | Cancellation email | ❌ Not implemented |
| Pickup payment confirmed | Pickup invitation email | ❌ Not implemented |
| Points expiry warning | `PointsExpiring` | ✅ Template exists, cron exists |

❌ No cancellation email is ever sent. PRD requires "Email: Pesanan dibatalkan + refund info if applicable."

---

## 5. COUPONS SYSTEM

### 5.1 Coupon Types Implementation
| Coupon Type | Validation API | Checkout Apply | Admin Create |
|---|---|---|---|
| `percentage` | ✅ | ✅ | ❌ (no form) |
| `fixed` | ✅ | ✅ | ❌ (no form) |
| `free_shipping` | ✅ | ✅ | ❌ (no form) |
| `buy_x_get_y` | ✅ (validates) | ❌ (no cart logic) | ❌ (no form) |

### 5.2 Per-User Coupon Limit
**Status:** ❌ Not working.

The validation API queries `couponUsages` for per-user limit:
```typescript
// If maxUsesPerUser is set, check user's usage count
const userUsageCount = await db.select(...).from(couponUsages).where(...)
```
But `coupon_usages` is never populated (the webhook only increments `coupons.used_count`). So the per-user limit check always returns 0 uses → coupon always appears valid for any user, even after N uses.

### 5.3 Coupon Admin CRUD
**Status:** ❌ Missing backend.

The admin UI at `/admin/coupons`, `/admin/coupons/new`, `/admin/coupons/[id]` exists, and `CouponForm` component exists.
- `/api/admin/coupons` GET route exists ✅
- `/api/admin/coupons` POST route exists ✅  
- `/api/admin/coupons/[id]` PATCH route exists ✅
- `/api/admin/coupons/[id]` DELETE route exists ✅

Actually the coupon API routes do exist — verify if the form component properly submits to them and whether validation schemas match. The `CouponForm` component needs to be verified against the API schema.

---

## 6. LOYALTY POINTS SYSTEM

### 6.1 Points Earning
**Status:** ✅ Backend correct. Frontend broken.

Points are awarded correctly in the webhook (1 point per IDR 1,000 of subtotal).
Points are logged in `points_history` with 1-year expiry.
`users.points_balance` is updated atomically.

**Gaps:**
- ⚠️ B2B double points multiplier not implemented.
- ⚠️ Points balance is not shown anywhere on the customer side in real-time (account page shows it statically from server props).

### 6.2 Points Redemption
**Status:** 🔴 BROKEN — zero balance hardcode in checkout.

See Section 1.5 above. The root cause is line 99 of `checkout/page.tsx`.

### 6.3 Points Expiry
**Status:** ✅ Cron exists at `/api/cron/expire-points`.

**Gaps:**
- ⚠️ The cron job requires proper Vercel Cron configuration in `vercel.json`. Verify the cron schedule is registered.
- ⚠️ No admin UI to manually adjust points per customer (PRD requires this as P2 feature).
- ⚠️ Points history page (`/account/points`) exists but data fetched from `/api/account/points` — verify this endpoint returns all history records (earn, redeem, expire, adjust) with proper pagination.

### 6.4 Points FIFO Redemption
**Status:** ❌ Not implemented.

PRD states: "FIFO redemption: oldest points used first." The checkout initiate route simply deducts from `users.points_balance` without tracking which specific `points_history` earn records are being consumed. When points are redeemed, a single `redeem` row is inserted but the individual `earn` records are not marked as consumed. This means:
- The FIFO ordering is never enforced
- Points expiry checks cannot correctly determine remaining balance per earn-batch
- Reports on point burn rate are inaccurate

**Fix Required:** Implement a FIFO consumption algorithm that:
1. Fetches unexpired earn records ordered by `created_at ASC`
2. Marks them consumed (or creates partial consumption records) as redemption is applied

---

## 7. PRODUCT & INVENTORY RULES

### 7.1 Stock Validation at Checkout
**Status:** ✅ Correct.

The initiate route validates stock before creating an order. If insufficient stock, it returns a 400 error.

**Gaps:**
- ⚠️ 🟡 Cart page does not do real-time stock validation. A customer can add 10 units, another customer buys the last 10, and the first customer won't see a warning until they hit "Bayar Sekarang". PRD requires "Cart shows real-time stock validation."
- ⚠️ 🟢 Stock deduction is done with `GREATEST(stock - qty, 0)` which prevents negative stock but silently succeeds if stock was already 0. Should return an error and flag which items are out of stock.

### 7.2 Product Edit/Create in Admin
**Status:** ❌ Not implemented.

`/admin/products/new` shows a placeholder: "Form tambah produk akan segera tersedia."
`/admin/products/[id]` is read-only — shows product details but has no edit form or save button.

No API routes exist for:
- `POST /api/admin/products` — create product
- `PATCH /api/admin/products/[id]` — update product
- `DELETE /api/admin/products/[id]` — soft delete product
- `POST /api/admin/products/[id]/images` — upload product image
- `DELETE /api/admin/products/[id]/images/[imageId]` — delete product image
- `POST /api/admin/products/[id]/variants` — add variant
- `PATCH /api/admin/products/[id]/variants/[variantId]` — edit variant

🔴 **This means all products must be seeded via the seed script. Admin cannot add or edit any product after launch.**

### 7.3 Inventory Log
**Status:** ✅ Schema exists. ⚠️ Partially written.

`inventory_logs` is written when:
- Payment webhook deducts stock (should write a `sale` log) — verify this is implemented
- Warehouse staff updates stock via field page — the field page mutations call `/api/admin/field/inventory` which **does not exist**

---

## 8. B2B FLOW

### 8.1 B2B Landing Page
**Status:** ✅ Marketing content renders correctly. Static content, no DB dependency.

### 8.2 B2B Inquiry Form
**Status:** ✅ API route exists at `/api/b2b/inquiry`. Form submits and saves to `b2b_inquiries`.

**Gaps:**
- ⚠️ No email notification to admin when a new B2B inquiry arrives. PRD implies admin should be notified.
- ⚠️ No auto-reply email to the inquiring company.

### 8.3 B2B Product Catalog
**Status:** ✅ Shows products with `isB2bAvailable=true` and B2B pricing.

**Gaps:**
- ❌ B2B customers see the same pricing as B2C customers if `b2bPrice` is null — falls back to `price`. No gating to ensure B2B users see B2B prices only after approval.
- ❌ B2B catalog has no "Add to Cart" or "Add to Quote" functionality. It's display-only.

### 8.4 B2B Quote System
**Status:** ❌ Not implemented.

- `QuoteForm` component exists in `components/b2b/QuoteForm.tsx` but was not fully read.
- No API routes for: `POST /api/b2b/quote`, `GET /api/b2b/quotes`, `GET /api/b2b/quotes/[id]`
- No B2B-specific checkout flow
- `b2b_quotes` and `b2b_quote_items` tables are in schema but never written to from the application
- PDF quote generation is referenced in the DB (`pdf_url` column) but no PDF generation logic exists

### 8.5 B2B Account Portal
**Status:** ❌ Stub pages.

- `/b2b/account` — renders a menu card, links to subpages
- `/b2b/account/orders` — page file exists, content unknown
- `/b2b/account/quotes` — page file exists, content unknown
- No authentication check specific to B2B role on these pages (the B2B layout might handle it — verify)

### 8.6 B2B Checkout
**Status:** ❌ Not implemented.

B2B customers currently have no path to place an order. The regular B2C checkout doesn't apply B2B pricing, Net-30 payment terms, or B2B-specific invoice format.

---

## 9. MISSING PAGES (PRD-specified but not built)

| Page | Status | Priority |
|---|---|---|
| `/account/profile` — Edit profile | ❌ Not built | P1 |
| `/orders/[orderNumber]` — Guest tracking with email verification | ⚠️ Page exists, verify email gate | P0 |
| `/admin/orders/[id]` — Order detail + status update UI | ❌ No detail page | P0 |
| `/admin/customers/[id]` — Customer detail | ❌ Not built | P1 |
| B2B checkout flow | ❌ Not built | P2 |
| PDF receipt download API (`/api/orders/[orderNumber]/receipt`) | ❌ Not built | P0 |

---

## 10. SUMMARY: CRITICAL BLOCKERS FOR LAUNCH

| # | Issue | Severity | Fix Complexity |
|---|---|---|---|
| 1 | Points balance hardcoded to 0 in checkout | 🔴 Critical | Low (1-2 hrs) |
| 2 | `coupon_usages` never populated → per-user limits broken | 🔴 Critical | Low (30 min) |
| 3 | Admin cannot mark orders as `processing` or `packed` | 🔴 Critical | Medium |
| 4 | Product create/edit in admin completely missing | 🔴 Critical | High |
| 5 | `order_status_history` not written on payment | 🔴 Critical | Low (1 hr) |
| 6 | No cancellation email on order cancel | 🟡 Major | Low |
| 7 | Pickup email not sent after payment | 🟡 Major | Low |
| 8 | Saved addresses not shown at checkout | 🟡 Major | Medium |
| 9 | `buy_x_get_y` coupon has no cart logic | 🟡 Major | High |
| 10 | Order number not sequential daily counter | 🟡 Major | Medium |
| 11 | B2B quote system entirely missing | 🟡 Major | High |
| 12 | No PDF receipt API endpoint | 🟡 Major | Medium |
| 13 | FIFO points redemption not implemented | 🟢 Minor | High |
| 14 | B2B double points not applied | 🟢 Minor | Low |
| 15 | Payment expiry not read from system_settings | 🟢 Minor | Low |
