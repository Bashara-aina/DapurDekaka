# FINAL AUDIT 01 — Store UX & Checkout Flow
**Date:** 2026-05-15  
**Focus:** Customer-facing store, cart, checkout multi-step, order result pages, order tracking  
**Priority:** P0 = breaks the app / revenue loss | P1 = bad UX / PRD deviation | P2 = polish

---

## 1. CART PAGE (`/cart`)

### 1.1 Stock Validation Only Runs for Logged-In Users [P1]
**File:** `app/(store)/cart/page.tsx:53-60`

```typescript
useEffect(() => {
  if (items.length > 0 && session?.user?.id) {
    validateCartStock();
  } else if (items.length > 0 && !session?.user?.id) {
    setHasValidated(true);   // ← guests skip validation entirely
  }
}, [items.length, session?.user?.id]);
```

**Problem:** Guests can add items to cart but their stock is never validated against the DB. If stock runs out between add-to-cart and checkout, a guest may attempt to pay for out-of-stock items.

**PRD Says:** "Cart shows real-time stock validation — if stock drops below cart quantity, show warning"

**Fix:** Remove the `session?.user?.id` guard. Call `validateCartStock()` for all users. The `/api/cart/validate` endpoint is already public (no auth required).

---

### 1.2 Cart Stock Validation Uses Wrong HTTP Method [P1]
**File:** `app/(store)/cart/page.tsx:34-39`

The cart page calls `GET /api/cart/validate?variantIds=...&quantities=...` using query params.
The cart store (`store/cart.store.ts:85`) calls `POST /api/cart/validate` with JSON body.

These are two different call patterns to the same conceptual endpoint. If the API route only supports one method, one of them silently fails.

**Fix:** Standardize on POST with JSON body everywhere.

---

### 1.3 No "Save to Account" or Cart Sync for Logged-In Users [P1]
**File:** `store/cart.store.ts`

The cart is purely `localStorage` (zustand persist). There is a `/api/auth/merge-cart` route, but:
- It is never called automatically when the user logs in during a session
- Cart is NOT synced to the database while logged in

**PRD Says:** "Cart syncs to database for logged-in users"

**Current state:** If a user logs in on mobile, adds items, and switches to desktop — cart is empty on desktop.

**Fix:** On successful login (`signIn` callback or after `useSession` status changes to `authenticated`), call `/api/auth/merge-cart` to merge localStorage cart into DB and then load the DB cart state.

---

### 1.4 Missing Bulk Actions (Cosmetic) [P2]
Cart has no "Clear cart" button visible on the page. The `clearCart()` function exists in the store but there's no UI affordance for it.

---

## 2. CHECKOUT PAGE (`/checkout`)

### 2.1 PRD Step 6 "Order Review" Is Missing [P0]
**File:** `app/(store)/checkout/page.tsx:553-605`

**PRD Step 6 says:** Show full order summary: items, shipping address, courier, subtotal, discount, shipping cost, points redeemed, final total — BEFORE the "Bayar Sekarang" button.

**What exists:** The `OrderSummaryCard` in the sidebar (desktop) shows items + totals but does NOT show:
- Recipient name / phone
- Full delivery address
- Selected courier + estimated days
- Confirmation of applied coupon code + discount

On **mobile**, the sidebar is hidden below the form — customers paying on mobile have NO order review at all before pressing "Bayar Sekarang."

**Fix:** In the `payment` step, add a collapsible/accordion "Review Pesanan" section above the coupon+points that shows: recipient info, delivery address, selected courier, and full price breakdown. This is especially critical on mobile.

---

### 2.2 Points Calculation Is Client-Side Only [P1]
**File:** `app/(store)/checkout/page.tsx:163-166`

```typescript
const pointsDiscount = usePoints && formData.pointsUsed > 0
  ? Math.floor(formData.pointsUsed / POINTS_VALUE_IDR) * POINTS_VALUE_IDR
  : 0;
```

The `formData.pointsUsed` is not being updated when the `usePoints` toggle is turned on. The `PointsRedeemer` component calculates how many points to use, but there's no mechanism to write that value back into `formData.pointsUsed`.

Looking at the `PointsRedeemer` render:
```typescript
usedPoints={usePoints ? Math.min(pointsBalance, Math.floor((subtotal - couponDiscount) * 0.5 / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) : 0}
```

This calculates a local `usedPoints` value but never calls `updateForm({ pointsUsed: calculatedAmount })`. When `handlePlaceOrder` sends to the API, `formData.pointsUsed` is still 0.

**Result:** Points discount shows in UI but is NOT sent to the checkout API → order is created without points deduction → customer pays full price but sees a discount that wasn't applied.

**Fix:** When `usePoints` is toggled on, immediately call `updateForm({ pointsUsed: calculatedValue })`.

---

### 2.3 Identity Step Shows for Logged-In Users Too [P1]
**File:** `app/(store)/checkout/page.tsx:365-386`

Even when a user is logged in (session exists), they still see the Identity step. The PRD says Step 1 "Identity (Guest only)" — logged-in users should skip directly to Step 2 (Delivery).

**Fix:** In `useEffect`, if `session?.user` is truthy, pre-fill the identity form data from the session and auto-advance to the `delivery` step.

---

### 2.4 No Cart-to-Checkout Stock Re-validation [P1]
When the user clicks "Bayar Sekarang," there's no final stock check before calling `/api/checkout/initiate`. If inventory dropped between cart load and payment, the API will either fail or allow overselling.

The `/api/checkout/initiate` should validate stock before creating the order. Need to verify this in the API route (`app/api/checkout/initiate/route.ts`).

---

### 2.5 Pickup Step Flow Has No Saved Address Handling [P2]
When switching from "delivery" to "pickup" in the delivery step, the code correctly sets `deliveryMethod: 'pickup'` and skips to payment. But the `handleAddressSubmit` function has this check:

```typescript
if (formData.deliveryMethod === 'pickup') {
  setStep('payment');
  return;
}
```

This runs ONLY if an address was submitted. The pickup button "Lanjut ke Pembayaran" in the UI correctly calls `setStep('payment')` directly, so this is redundant but not broken.

---

### 2.6 Coupon Validation Doesn't Check userId [P1]
**File:** `app/api/coupons/validate/route.ts` (calling context from checkout)

When validating a coupon, the API should check `maxUsesPerUser` against the current user. The validation request only sends `{ code, subtotal }` — no `userId`. If the coupon has `maxUsesPerUser: 1`, a logged-in user could use it multiple times.

**Fix:** Send `userId` (or session token) in the coupon validation request, and check `couponUsages` table for per-user limit.

---

### 2.7 Missing: Order Notes UI In Payment Step [P1]
**PRD:** "Order notes at checkout"

The `IdentityForm` component collects `customerNote` in Step 1 (Identity). However, it's placed in the FIRST step where the user's mind is on providing their name/email — they likely won't notice or use it there.

**Fix:** Move order notes to the Payment step, after coupon/points, before "Bayar Sekarang." This is where customers naturally think about special instructions.

---

### 2.8 Shipping Step Shows No Loader While Fetching [P2]
When the user submits their address, `loadingShipping` is set to true and `setStep('courier')` happens only after the API returns. During the fetch (potentially 2-3 seconds for RajaOngkir), the user sees the delivery step with nothing happening — no spinner, no loading state.

**Fix:** Show a spinner overlay or transition animation while `loadingShipping` is true.

---

## 3. CHECKOUT SUCCESS PAGE (`/checkout/success`)

### 3.1 No Points Earned Confirmation [P1]
**File:** `app/(store)/checkout/success/page.tsx`

**PRD Says:** After payment success, show points earned.

Currently the success page shows only:
- Confetti animation
- "Pesanan Berhasil!" heading
- Order number
- "Lihat Detail Pesanan" and "Lanjut Belanja" buttons

Missing:
- How many points were earned
- Email confirmation message ("Cek email kamu untuk detail pesanan")
- Estimated delivery timeframe
- PDF receipt download button

**Fix:** Fetch order details from `/api/orders/[orderNumber]` on mount and display:
1. Points earned (if logged in)
2. Email sent confirmation
3. Estimated delivery date/range

---

### 3.2 Success Page Has No PDF Download [P1]
**PRD Says:** "PDF receipt generated and emailed after payment" and customer can download.

The success page has no PDF download button. The `/api/orders/[orderNumber]/receipt` endpoint doesn't exist (not found in API routes listing).

**Fix:** Create `/api/orders/[orderNumber]/receipt` route that generates a PDF receipt. Add a "Download Struk" button on the success page.

---

### 3.3 Cart Not Cleared on Midtrans Error Path [P1]
**File:** `app/(store)/checkout/page.tsx:322-324`

```typescript
const handleMidtransSuccess = () => {
  clearCart();
};
```

`clearCart()` is only called in the Midtrans `onSuccess` callback. But the Midtrans Snap popup has multiple outcomes. If the user pays successfully but closes the popup before the callback fires (race condition), or if the success callback doesn't trigger, the cart remains.

Also, if Midtrans calls `onPending`, the cart should be cleared too (since an order was already created).

**Fix:** Clear cart immediately when the order is created successfully (after `setSnapToken()`), not only after Midtrans callback.

---

## 4. CHECKOUT PENDING PAGE (`/checkout/pending`)

### 4.1 Midtrans Snap.js Not Loaded [P0]
**File:** `app/(store)/checkout/pending/page.tsx:30-33`

```typescript
if (typeof window !== 'undefined' && (window as Window & { snap?: { pay: ... }}).snap) {
  (window as ...).snap!.pay(data.data.snapToken);
}
```

The pending page directly calls `window.snap.pay()`. But Midtrans Snap.js is only loaded by the `MidtransPayment` component, which is only used in `checkout/page.tsx`.

If the user navigates directly to `/checkout/pending` (bookmarked or via email link), `window.snap` is `undefined` → retry button silently fails with no feedback.

**Fix:** Load Midtrans Snap.js script on the pending page itself. Add a `<Script src="https://app.midtrans.com/snap/snap.js" ...>` or import the `MidtransPayment` component.

---

### 4.2 No Countdown Timer [P1]
**PRD Says:** "Payment expires after 15 minutes"

The pending page shows a static text "Harap selesaikan pembayaran sebelum 15 menit dari sekarang." — but this is wrong because:
1. The 15-minute clock started when the order was created, not when the user is reading this page
2. There's no countdown timer showing time remaining

**Fix:** Fetch the order's `paymentExpiresAt` timestamp and display a real countdown timer (MM:SS).

---

### 4.3 VA Number and Payment Instructions Not Shown [P1]
**PRD Says:** "Show payment instructions (VA number, amount, expiry time)"

The pending page shows the order number but NOT:
- The Virtual Account (VA) number to transfer to
- The exact amount to pay
- Bank/provider name

This information is in the `midtransVaNumber` field of the order. Users who close Midtrans Snap and land on pending page have no idea what number to transfer to.

**Fix:** Fetch order details and display `midtransVaNumber`, `totalAmount`, and `midtransPaymentType` with appropriate instructions.

---

### 4.4 "Bayar Lagi" Doesn't Handle Already-Paid Orders [P1]
If the user paid via VA and clicks "Bayar Lagi" before the webhook arrives, a new Snap token is generated for an already-paid order. The backend retry logic should check order status first.

Check `app/api/checkout/retry/route.ts` — it should reject retries for orders already in `paid` status.

---

## 5. CHECKOUT FAILED PAGE (`/checkout/failed`)

### 5.1 API Response Shape Mismatch [P0]
**File:** `app/(store)/checkout/failed/page.tsx:37-43`

```typescript
const res = await fetch(`/api/orders/${orderNumber}`);
if (res.ok) {
  const data = await res.json();
  if (data.success?.data?.items) {    // ← THIS IS WRONG
    setOrderItems(data.success.data.items);
  }
}
```

The API response is `{ success: true, data: { items: [...] } }` but the code accesses `data.success?.data?.items` (treating `success` as an object, not a boolean). This will always be `undefined`.

**Result:** The "Coba Lagi" button will never have items to restore → cart restoration silently fails → user must manually add items again.

**Fix:** Change to `data.data?.items`.

---

### 5.2 Restored Cart Items Missing Critical Fields [P1]
**File:** `app/(store)/checkout/failed/page.tsx:55-68`

```typescript
addItem({
  ...item,
  productNameEn: '',    // ← empty
  variantNameEn: '',    // ← empty
  sku: '',              // ← empty
  imageUrl: item.imageUrl ?? '',
  stock: 0,             // ← stock 0, can't add more
});
```

When cart is restored after failed payment:
- `productNameEn` and `variantNameEn` are empty (breaks EN language display)
- `sku` is empty (breaks any SKU-based logic)
- `stock: 0` means the cart item will show as out-of-stock immediately

**Fix:** The order items API should return all needed fields, and the restore logic should use them.

---

## 6. PUBLIC ORDER TRACKING (`/orders/[orderNumber]`)

### 6.1 CRITICAL: No Email Verification for Guest Order Tracking [P0]
**File:** `app/(store)/orders/[orderNumber]/page.tsx:47-78`

The order tracking page shows the FULL order to anyone who knows the order number:
- Recipient name
- Recipient phone
- Full delivery address  
- All items ordered
- Payment amounts
- Courier tracking number

**PRD Says:** "Guest can track order at `/orders/[orderNumber]` — Must enter email used at checkout to verify ownership. If email matches order: show full order detail. If no match: show generic 'Order not found' message."

**Fix:** Add a two-step flow:
1. First, show only an email input asking "Masukkan email yang digunakan saat checkout"
2. Check if `email === order.recipientEmail` (case-insensitive)
3. Only if matched: show full order details
4. For logged-in users with `userId === order.userId`: skip email gate

This is a **customer privacy / GDPR-equivalent concern** for Indonesian personal data protection law (UU PDP).

---

### 6.2 Order Tracking Has No Refresh Button [P2]
Customer lands on the tracking page but order status doesn't auto-refresh. They must manually reload. The page is a Server Component (no real-time updates). Consider adding a manual refresh button or client-side polling for orders in `pending_payment`, `paid`, or `processing` states.

---

## 7. ACCOUNT ORDER DETAIL (`/account/orders/[orderNumber]`)

### 7.1 Order Timeline Shows No Actual History [P1]
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx:150-171`

```typescript
<div className="flex items-center gap-3">
  <span className="...">
    {order.status === 'processing' && 'Sedang Diproses'}
    ...
  </span>
  <p className="text-sm text-text-secondary">
    {order.statusHistory.length} update status
  </p>
</div>
```

The status section only shows the CURRENT status badge + a count of updates. The `OrderTimeline` component is imported but never used here.

**PRD says:** Customers should see the full timeline of status changes with dates.

**Fix:** Replace the simple badge with the `OrderTimeline` component, passing all status history entries with their timestamps.

---

### 7.2 "Ongkos Kirir" Typo [P2]
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx:234`

```typescript
<span className="text-text-secondary">Ongkos Kirir</span>
```

"Kirir" should be "Kirim."

---

### 7.3 No PDF Receipt Download Button [P1]
The order detail page in the account doesn't have a "Download Struk PDF" button. This was a P0 requirement in the PRD.

---

## 8. ACCOUNT DASHBOARD (`/account`)

### 8.1 "Total Pesanan" Shows Max 5 [P1]
**File:** `app/(store)/account/page.tsx:18-27`

```typescript
const recentOrders = await db.query.orders.findMany({
  ...
  limit: 5,    // ← only fetches 5
});
```

Then the KPI card shows:
```typescript
<p className="text-2xl font-bold">{recentOrders.length || 0}</p>
<p className="text-xs">Total Pesanan</p>
```

A customer with 50 orders sees "5" as their total. This is misleading.

**Fix:** Run a separate `COUNT(*)` query for the total, and use `limit: 5` only for the recent orders display.

---

### 8.2 Points Display Calculation Incorrect [P1]
**File:** `app/(store)/account/page.tsx:198-203`

```typescript
<p className="text-xs opacity-70 mt-1">
  {formatIDR(user.pointsBalance)} bisa ditukarkan
</p>
```

`formatIDR(1500)` shows "Rp 1.500" — but 1500 points = Rp 15,000 discount (100 points = Rp 1,000).

**Fix:** Display as `formatIDR(user.pointsBalance * 10)` or clarify the conversion (100 poin = Rp 1.000 discount).

---

## 9. NAVBAR & NAVIGATION

### 9.1 Language Switcher is Broken [P0]
**File:** `components/store/layout/LanguageSwitcher.tsx`

The component uses `next-intl` (`useLocale`, `useTranslations`) and routes to `/{locale}/path`. But:
- The app directory does NOT have a `[locale]` directory structure
- There's no `i18n.ts` or `middleware.ts` locale detection
- `useTranslations('nav')` and `useTranslations('common')` will throw at runtime

**PRD says:** "Language toggle (ID/EN)" is a P1 feature.

The Navbar also imports `useTranslations('nav')` for nav link labels:
```typescript
const t = useTranslations('nav');
const navLinks = [
  { href: '/', label: t('home') },
  ...
```

This will cause the entire Navbar to crash at runtime on any page.

**Fix (minimal viable):** Replace `useLocale`/`useTranslations` with a simple React state or cookie-based toggle. The app content is all hardcoded in Indonesian anyway — the language preference saved in the profile doesn't actually change any UI text currently.

---

### 9.2 Search Icon Goes to /products Instead of Search [P2]
**File:** `components/store/layout/Navbar.tsx:54-57`

The search icon in the navbar links to `/products` instead of opening a search input or `/products?search=`. The `ProductSearch` component exists and works on the products page, but there's no global search capability.

---

### 9.3 Mobile Bottom Nav Missing Account Link for Logged-In Users [P2]
**File:** `components/store/layout/BottomNav.tsx`

The bottom nav should differentiate between logged-in and guest users — showing the user's name/avatar or an "Account" tab that reflects session state.

---

## 10. PRODUCT PAGES

### 10.1 "Tersisa X pcs" Warning Not Shown [P1]
**PRD Says:** "When stock < 5: show 'Tersisa X pcs' warning on product page"

The `StockBadge` component exists (`components/store/common/StockBadge.tsx`) but need to verify if it's being used on product cards and detail pages to show low-stock warnings. The product detail page (`ProductDetailClient`) should show this for stocks < 5.

### 10.2 Product Detail Has No Related Products Section [P2]
After viewing a product, there are no "You might also like" or "From the same category" suggestions. This is not in the PRD explicitly but is a major e-commerce UX gap.

---

## SUMMARY TABLE

| # | Issue | File/Location | Priority | Impact |
|---|---|---|---|---|
| 1.1 | Guest stock validation skipped | `cart/page.tsx:53` | P1 | Guests can checkout out-of-stock items |
| 2.2 | Points not sent to checkout API | `checkout/page.tsx:163` | **P0** | Revenue math wrong, discount not applied |
| 2.1 | No order review before payment (mobile) | `checkout/page.tsx` | P1 | Bad UX, no confirmation before paying |
| 3.1 | No points earned on success page | `checkout/success/page.tsx` | P1 | Feature invisible to user |
| 3.2 | No PDF receipt download | Missing API route | P1 | PRD requirement |
| 4.1 | Snap.js not loaded on pending page | `checkout/pending/page.tsx:30` | **P0** | Retry button silently fails |
| 4.2 | No countdown timer on pending page | `checkout/pending/page.tsx` | P1 | UX broken |
| 4.3 | No VA number shown | `checkout/pending/page.tsx` | P1 | User can't pay via VA |
| 5.1 | API response shape mismatch on failed | `checkout/failed/page.tsx:37` | **P0** | Cart restore never works |
| 6.1 | No email gate on order tracking | `orders/[orderNumber]/page.tsx` | **P0** | Customer privacy breach |
| 7.1 | No timeline in order detail | `account/orders/[orderNumber]/page.tsx` | P1 | PRD requirement |
| 7.2 | "Kirir" typo | `account/orders/[orderNumber]/page.tsx:234` | P2 | Embarrassing |
| 8.1 | Total orders shows max 5 | `account/page.tsx:25` | P1 | Confusing stats |
| 8.2 | Points conversion display wrong | `account/page.tsx:200` | P1 | Trust issue |
| 9.1 | Language switcher crashes app | `LanguageSwitcher.tsx` | **P0** | Runtime crash |
| 1.3 | Cart not synced to DB for logged-in users | `cart.store.ts` | P1 | Multi-device cart lost |
