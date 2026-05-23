# DapurDekaka Store Flows Audit

**Date:** May 22, 2026
**Scope:** Checkout, Cart, Order Tracking, Payment, Points, Coupon, Shipping flows

---

## 1. Checkout Flow

**Flow:** Identity → Delivery Method → Courier Selection → Payment → Midtrans → Success/Pending/Failed

### Step 1: Identity

**What works:**
- Form validation with Zod (name, email, phone regex, optional note)
- Pre-fills from session for logged-in users
- Pre-fills phone from profile API
- Back navigation

**What's broken:**
- All labels hardcoded (not i18n)
- No phone format normalization (accepts various formats including `+62`, `62`, `0`)
- `customerNote` stored but not prominently displayed in order review

### Step 2: Delivery Method

**What works:**
- Toggle between Delivery and Pickup
- Hardcoded pickup address (Jl. Sinom V no. 7, Turangga, Bandung)
- Store hours fetched from settings API
- Different flow paths for pickup (skips courier step)

**What's broken:**
- Courier names hardcoded in DeliveryMethodToggle: "SiCepat FROZEN / JNE YES / AnterAja Frozen" — should use `COLD_CHAIN_COURIERS` constant
- No validation that delivery address is complete before proceeding
- `handleAddressSubmit` resets `cityId`/`city`/`provinceId`/`province` before using them

### Step 3: Courier Selection

**What works:**
- Shipping options fetched from `/api/shipping/cost`
- RajaOngkir API called for each cold-chain courier
- Results filtered to FROZEN/YES service only
- Loading skeleton while fetching
- Empty state if no couriers available

**What's broken:**
- RajaOngkir Starter only supports origin city ID 501 (Jakarta) — **shipping FROM Bandung will be calculated from Jakarta**
- No free shipping coupon applied at this step (coupon applied in payment step)
- If courier selection changes, shipping cost updates but coupon free_shipping doesn't re-evaluate

### Step 4: Payment

**What works:**
- Order review collapsible
- Coupon input with validation against server
- Points redemption toggle with balance check
- Server-side 50% cap enforcement on points
- Client-side total calculation: `subtotal - couponDiscount - pointsDiscount + effectiveShippingCost`
- Free shipping coupon zeros `effectiveShippingCost`
- SessionStorage persistence of form state

**What's broken/missing:**
- `serverTotalAmount` set from API response but never compared against client `totalAmount` for reconciliation
- Coupon validation sends `subtotal` from `getSubtotal()` (Zustand), not re-fetched from DB — if prices changed between cart add and checkout, stale price used
- `PointsRedeemer.tsx` calculates `maxPointsValue = subtotal * 0.5` then converts to points by `/POINTS_VALUE_IDR` (10), but the display shows `maxPointsToRedeem * POINTS_VALUE_IDR` — potential double-conversion display bug
- No validation that coupon + points combined don't exceed subtotal
- The `onBack` link on payment step (line 782-786) goes to 'courier' step even for pickup orders (which skip courier step)

### Step 5: Order Initiation (API)

**What works:**
- Zod validation of all inputs
- DB-level stock + price re-validation
- Idempotency: 60-second dedup for guests, 30-second for logged-in users
- Points FIFO deduction in transaction
- B2B Net-30 bypass of Midtrans
- B2B price selection if user is B2B role
- All coupon rules enforced (min order, expiry, max uses, per-user limit, applicable products/categories)
- Buy X Get Y coupon adds free items to order
- Order number generation via atomic DB counter
- Payment expiry set from settings (default 15 minutes)

**What's broken:**
- Race condition on idempotency: the `findFirst` check is outside the transaction — two concurrent requests within 30 seconds could both pass and create duplicate orders (the second would fail on unique constraint with 500 error)
- Guest coupon per-user check relies on email in orders join — but guest checkout doesn't always have an order with that email yet at validate time

### Step 6: Midtrans Payment

**What works:**
- Snap token received and stored in component state
- Dynamic script loading (lazy import of Midtrans JS)
- Popup modal with callbacks
- `finish`, `unfinish`, `error`, `close` callbacks handled
- Order number passed via query param in redirect URL

**What's broken:**
- `MidtransPayment` receives `snapToken` prop but no `orderNumber` prop — uses `window.location.search` to extract order number in callbacks — fragile, depends on URL being set correctly before render
- `onSuccess` callback navigates to success page, but `onClose` also fires after success, potentially redirecting to failed page
- The callback cleanup (`window.snap.hide()`) may not work reliably

### Step 7: Success/Failed/Pending Pages

**Critical bugs (see store-frontend-audit.md B01-B05):**
- `orders/success/[orderNumber]/page.tsx` uses wrong field names and will crash
- `OrderTrackingClient.tsx` uses raw `<img>` tag

**What's broken:**
- Confetti fires on any status change, not just initial paid transition
- Two different success pages: client-side `checkout/success/page.tsx` and server-rendered `orders/success/[orderNumber]/page.tsx` — inconsistent behavior

---

## 2. Cart Flow

### Adding Items

**What works:**
- `addItem` in Zustand with stock-aware quantity limiting (max 99 or stock)
- `productImageUrl` stored at add-time (snapshot)
- Toast confirmation with action to view cart
- Plus button disabled when at max quantity

**What's broken:**
- No debouncing — rapid clicks could add multiple times before state updates
- `stock` field in CartItem is snapshot at add-time, may be stale

### Updating Quantities

**What works:**
- Quantity stepper with +/- buttons
- Minus at 1 goes to 0, triggers remove
- Max enforced to min(99, stock)
- Stock validation on quantity change triggers re-fetch of stock

**What's broken:**
- No optimistic UI — quantity updates immediately but stock validation is async

### Removing Items

**What works:**
- Remove button clears item
- Clear all with confirmation dialog

### Stock Validation

**What works:**
- On mount, `/api/cart/validate` called for all items
- Results stored in `stockValidations` state
- Warning banner shows count of unavailable items
- CartItem shows per-item stock warning

**What's broken:**
- Validation only on mount, not on quantity changes
- No periodic re-validation during checkout

### Sync to DB (Logged-in Users)

**What works:**
- `syncToDb` called when logged-in user reaches checkout
- Merges localStorage cart with DB cart
- Local quantity wins if DB stock differs

**What's broken:**
- Both `syncToDb` and `loadFromDb` silently fail — no error feedback to user
- If sync fails, user may lose cart items

---

## 3. Order Tracking Flow

### Guest User Flow

1. User lands on `/orders/[orderNumber]`
2. Email verification form shown
3. POST to `/api/orders/[orderNumber]` with email
4. If email matches, full order details revealed

**What works:**
- Email verification gate protects order data
- Timeline visualization
- Order items list
- Delivery info
- Payment summary

**What's broken:**
- No option to resend verification email if user doesn't receive it
- No rate limiting on verification attempts visible to user

### Logged-in User Flow

1. Auto-verify via `/api/orders/[orderNumber]` on mount
2. If user owns order, full details shown without email

**What works:**
- Seamless for logged-in users

**What's broken:**
- The API endpoint returns 401/403 for non-owners even when logged in

---

## 4. Payment Retry Flow

### Pending Page

1. User lands on `/checkout/pending?order=X`
2. Polling every 5 seconds checks order status
3. If status becomes `paid` → redirect to success
4. If countdown hits 0 → redirect to retry

**What works:**
- Auto-poll with cleanup
- Countdown timer
- VA number display
- Copy order number
- Snap JS loaded for retry

**What's broken:**
- Countdown hits 0 redirects to `/checkout/retry?orderId=X` — need to verify retry page exists and works
- No indication of how many retries remain (max 3)
- Snap JS loaded via Script component but retry uses `window.snap.pay()` directly — race condition if script not loaded

### Retry Button

1. POST to `/api/checkout/retry`
2. New Midtrans order_id = `DDK-YYYYMMDD-XXXX-retry-N`
3. New snap token returned
4. `window.snap.pay(newToken)` called

**What works:**
- Retry count tracked server-side (`paymentRetryCount`)
- New snap token generated with retry suffix

---

## 5. Points Earning Flow

### On Order Creation (Initiate)

- `pointsEarned = floor(subtotal / 1000) * POINTS_EARN_RATE`
- Stored on order record
- For B2B users: doubled (`* 2`)

**What works:**
- Points snapshot stored at order time
- B2B multiplier applied

### On Payment Settlement (Webhook)

- Points awarded to `users.pointsBalance`
- `pointsHistory` record created with 1-year expiry
- Email sent (async, non-blocking)

**What works:**
- Atomic transaction for balance update
- FIFO expiry tracking
- Non-blocking email

**What's broken:**
- No notification to user that points were credited (email is sent but no in-app notification)

### Display on Success Pages

- `checkout/success/page.tsx` shows `order.pointsEarned` if status is paid
- `OrderTrackingClient` shows points earned in payment summary
- Account points page shows balance + history

**What's broken:**
- On `checkout/success` (client-rendered), `order.pointsEarned` may not be set immediately if webhook hasn't fired yet — the page shows "Poin akan dikreditkan setelah pembayaran dikonfirmasi"

---

## 6. Points Redemption Flow

### At Checkout (Payment Step)

1. User toggles points on
2. `handlePointsToggle(true)` called
3. Client calculates max points: `floor(subtotal * 0.5 / POINTS_VALUE_IDR) * POINTS_VALUE_IDR`
4. Capped at `pointsBalance`
5. Rounded to nearest `POINTS_MIN_REDEEM` (100)
6. `pointsUsed` stored in form state
7. Discount displayed: `pointsUsed * POINTS_VALUE_IDR` (Rp value)

**What works:**
- 50% cap enforced on server side
- Minimum 100 points enforced
- Points value displayed in IDR equivalent

**What's broken:**
- `PointsRedeemer.tsx` line 27: `maxPointsValue = subtotal * 0.5` — this is in IDR, but then line 29 does `maxPointsValue / POINTS_VALUE_IDR` to get points. But the display on line 74-75 does `maxPointsToRedeem * POINTS_VALUE_IDR` — this seems correct.
- However, `handlePointsToggle` in `checkout/page.tsx` line 383: `maxPointsInIDR = floor((subtotal - couponDiscount) * 0.5)` — uses `subtotal - couponDiscount` but `PointsRedeemer` uses just `subtotal`. If coupon is applied, these may differ.

### On Order Cancellation (Webhook)

1. Redeem records found via `referencedEarnId`
2. `consumedAt` set to null (unconsume)
3. Balance restored: `points_balance + pointsUsed`
4. Coupon usage reversed

**What works:**
- FIFO reversal via `referencedEarnId`
- Balance restored atomically

---

## 7. Coupon Validation Flow

### At Payment Step (Client)

1. User enters code
2. Clicks "Terapkan"
3. POST to `/api/coupons/validate` with `code`, `subtotal`, `userId`, `productIds`
4. Response: `{ type, discountAmount, freeShipping, buyXgetY }`
5. State updated: `couponDiscount`, `couponType`, `isFreeShippingCoupon`, `couponBuyXgetY`

**What works:**
- All 9 coupon rules checked server-side
- Percentage, fixed, free_shipping, buy_x_get_y supported
- Discount amount returned for percentage/fixed
- Error messages shown

**What's broken:**
- `productIds` not sent from checkout page — the validate endpoint checks applicable_product_ids and applicable_category_ids but checkout never sends the product IDs

### At Order Initiation (Server)

1. All coupon rules re-validated server-side
2. Discount recalculated (never trust client discount)
3. For buy_x_get_y: free items added to order_items
4. Provisional `couponUsage` row inserted for per-user limit enforcement
5. On settlement: `couponUsages` confirmed, `usedCount` incremented
6. On cancellation: `usedCount` decremented, `couponUsage` deleted

**What works:**
- Server always recalculates — client discount never trusted
- Concurrency-safe with provisional rows
- All edge cases handled (expiry, starts_at, maxUses, per-user)

**What's broken:**
- The coupon service (`lib/services/coupon.service.ts`) is empty — all logic is in the API route, not service layer

---

## 8. Shipping Rate Flow

### Address Entry

1. Province dropdown (searchable)
2. On province select, cities fetched
3. City dropdown (searchable)
4. District + address line + postal (optional)

**What works:**
- Cascading dropdowns
- Search/filter
- Postal code auto-filled from RajaOngkir

**What's broken:**
- RajaOngkir Starter only has origin 501 (Jakarta) — **shipping FROM Bandung is wrong**

### Cost Calculation

1. `POST /api/shipping/cost` with `{ destination: cityId, weight }`
2. API calls RajaOngkir for each courier in `COLD_CHAIN_COURIERS`
3. Results filtered to specific service (SICEPAT FROZEN, JNE YES, ANTERAJA FROZEN)
4. Response: `[{ courier, service, displayName, cost, estimatedDays }]`

**What works:**
- Only cold-chain couriers shown
- All 3 supported couriers queried in parallel
- ETD displayed

**What's broken:**
- Origin hardcoded to "501" (Jakarta) in RajaOngkir Starter — comment in code acknowledges this limitation
- Weight minimum enforced at 1000g even for lighter orders
- If RajaOngkir returns error for a courier, entire result set may be empty (fail-fast instead of partial results)

### Courier Selection

1. User picks courier option
2. `courierCode`, `courierService`, `courierName`, `shippingCost` stored in form
3. Step advances to payment

**What works:**
- Selection persisted in form state
- SessionStorage restored on page reload

---

## Per-Flow Summary Table

| Flow | Status | Critical Issues |
|------|--------|----------------|
| Checkout - Identity | Works | Hardcoded labels |
| Checkout - Delivery Method | Works | Hardcoded courier names |
| Checkout - Courier Selection | BROKEN | Wrong origin city (Jakarta vs Bandung) |
| Checkout - Payment | BROKEN | serverTotalAmount not validated, coupon productIds not sent |
| Order Initiation | Works | Race condition in idempotency check |
| Midtrans Payment | BROKEN | snapToken handling fragile, onClose redirects to failed |
| Cart Add/Update | Works | No debouncing |
| Cart Stock Validation | Works | Only on mount |
| Cart DB Sync | BROKEN | Silent failures |
| Order Tracking | BROKEN | Raw img tag, field mismatches |
| Payment Retry | Works | Retry count tracked |
| Points Earning | Works | B2B multiplier, FIFO expiry |
| Points Redemption | BROKEN | client/server calculation mismatch with coupon |
| Coupon Validation | BROKEN | productIds not sent from checkout |
| Shipping Rate | BROKEN | Jakarta origin only |

---

## Recommendations

### Immediate Fixes Required

1. **Fix order success page field names** — `order.total` → `order.totalAmount`, `item.variant.*` → flat fields
2. **Replace `<img>` with `<Image>`** in OrderTrackingClient
3. **Upgrade RajaOngkir to Pro** or hardcode Bandung-origin rates as override
4. **Add productIds to coupon validation** request from checkout
5. **Reconcile serverTotalAmount** with client total before payment

### High Priority

6. **Populate or remove** `lib/services/coupon.service.ts`
7. **Add i18n** to AccountPointsPage
8. **Fix status filter label** in account/orders/page.tsx
9. **Add loading.tsx/error.tsx** to all missing routes
10. **Fix confetti trigger** in checkout/success

### Medium Priority

11. **Extract inline formatIDR** in account/orders/[orderNumber]/page.tsx
12. **Fix points calculation consistency** between PointsRedeemer and checkout handler
13. **Add cart sync error feedback** (toast on failure)
14. **Extract courier names** from constant in DeliveryMethodToggle
15. **Fix onClose callback** to not redirect to failed on successful payment
