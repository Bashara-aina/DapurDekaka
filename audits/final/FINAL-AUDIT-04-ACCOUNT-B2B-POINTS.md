# FINAL AUDIT 04 — CUSTOMER ACCOUNT, B2B PORTAL & POINTS SYSTEM
**Date:** 2026-05-16  
**Severity scale:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## BUG 01 🔴 — Points page: wrong IDR conversion shows 100x too much redeemable value

**File:** `app/(store)/account/points/page.tsx` line 69

```tsx
// WRONG: shows IDR 100,000 for 100 points
~{formatIDR((data?.balance || 0) * 1000)} bisa ditukarkan
```

**PRD rule (§6.4):** "100 points = IDR 1,000" → **1 point = IDR 10**

If a user has 500 points, the page shows `~Rp500.000 bisa ditukarkan` but the real value is `Rp5.000`. This causes major customer confusion — users may feel "cheated" when they only get a small discount at checkout.

**Fix:**
```tsx
// CORRECT:
~{formatIDR((data?.balance || 0) * 10)} bisa ditukarkan
```

Also verify the same formula in `app/(store)/account/page.tsx` line 205:
```tsx
{formatIDR(user.pointsBalance * POINTS_VALUE_IDR)}
```
If `POINTS_VALUE_IDR = 10`, this is correct. If it's 1000, fix it to `* 10`.

---

## BUG 02 🟠 — Account order detail: `OrderTimeline` component is imported but NOT rendered

**File:** `app/(store)/account/orders/[orderNumber]/page.tsx` lines 8, 146–173

The file imports `OrderTimeline` from `@/components/store/orders/OrderTimeline`:
```tsx
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
```

But in the render, the "Status Pesanan" section does NOT use `OrderTimeline`. Instead it shows a simple status badge and count:
```tsx
<div className="flex items-center gap-3">
  <span className={...}>{order.status === ... }</span>
  <p className="text-sm text-text-secondary">
    {order.statusHistory.length} update status
  </p>
</div>
```

The `statusHistory` data is fetched (`with: { statusHistory: { orderBy: asc } }`) and typed correctly, but never rendered into a visual timeline. Customers cannot see WHEN their order changed status.

**Fix:** Replace the simple badge with the actual timeline component:
```tsx
{/* Status Pesanan */}
<div className="bg-white rounded-card shadow-card p-6">
  <h2 className="font-display text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
    <Clock className="w-5 h-5" />
    Status Pesanan
  </h2>
  <OrderTimeline
    currentStatus={order.status}
    statusHistory={order.statusHistory}
  />
</div>
```

Verify `OrderTimeline` component at `app/components/store/orders/OrderTimeline.tsx` accepts these props. If the component has different props, align them.

---

## BUG 03 🟠 — Account order detail: any logged-in user can view any order by guessing the order number

**File:** `app/(store)/account/orders/[orderNumber]/page.tsx` lines 27–78

The DB query fetches the order by `orderNumber` **without filtering by `userId`**:
```ts
const order = await db.query.orders.findFirst({
  where: (orders, { eq, and }) => and(
    eq(orders.orderNumber, orderNumber),
    // NO userId filter here!
  ),
  ...
});
```

Then access control checks:
```ts
const canView =
  order.userId === session.user.id ||
  session.user.role === 'superadmin' ||
  session.user.role === 'owner';

if (!canView) {
  redirect('/account/orders');
}
```

The problem: **the data is fetched before the auth check**. Any user who guesses or obtains another user's order number can access it (the redirect only happens after the full order data including items and status history is loaded). This is a data exposure vulnerability.

**Fix:** Add the userId filter to the query itself:
```ts
const order = await db.query.orders.findFirst({
  where: (orders, { eq, and, or }) => and(
    eq(orders.orderNumber, orderNumber),
    or(
      eq(orders.userId, session.user.id!),
      // Allow superadmin/owner to see any order — handle via role check below
    )
  ),
  ...
});
```

Or more simply, for regular customers always enforce userId in the query:
```ts
const isAdmin = ['superadmin', 'owner'].includes(session.user.role ?? '');

const order = await db.query.orders.findFirst({
  where: (orders, { eq, and }) => isAdmin
    ? eq(orders.orderNumber, orderNumber)
    : and(eq(orders.orderNumber, orderNumber), eq(orders.userId, session.user.id!)),
  ...
});

if (!order) {
  notFound(); // Returns 404 without leaking that the order exists
}
```

---

## BUG 04 🟡 — B2B landing page: category counts show `{cat.count} Varian` but counts products

**File:** `app/(b2b)/b2b/page.tsx` lines 36–54, 183

```tsx
<p className="text-text-muted text-xs mt-1">{cat.count} Varian</p>
```

The SQL query counts products (`count(${products.id})`), not variants:
```ts
count: sql<number>`count(${products.id})::int`,
```

If a category has 3 products (each with multiple variants), the display says "3 Varian" but the correct label is "3 Produk".

**Fix:**
```tsx
<p className="text-text-muted text-xs mt-1">{cat.count} Produk</p>
```

---

## BUG 05 🟡 — Points expiry cron doesn't check `consumedAt` — can expire already-redeemed points

**File:** `app/api/cron/expire-points/route.ts` lines 26–33

```ts
const expiringRecords = await db.query.pointsHistory.findMany({
  where: and(
    eq(pointsHistory.type, 'earn'),
    eq(pointsHistory.isExpired, false),
    lt(pointsHistory.expiresAt, now)
    // Missing: consumedAt IS NULL check!
  ),
});
```

The FIFO redemption system marks earn records with `consumedAt` when they're redeemed. The expiry cron does NOT filter these out. If a user redeemed (consumed) points that later hit their expiry date, the cron will try to expire them again:

1. User earns 100 points (earn record A, expiresAt = 1 year later)
2. User redeems 100 points → earn record A gets `consumedAt = now`
3. User's balance is deducted 100 points during redemption
4. 1 year later, expire cron runs, finds earn record A (isExpired=false, expiresAt<now)
5. Cron deducts another 100 points from balance → **balance goes negative or to 0 unfairly**
6. Also, since `Math.max(0, currentBalance - totalPoints)` is used, balance clamps at 0 but the user is still double-penalized

**Fix:**
```ts
const expiringRecords = await db.query.pointsHistory.findMany({
  where: and(
    eq(pointsHistory.type, 'earn'),
    eq(pointsHistory.isExpired, false),
    lt(pointsHistory.expiresAt, now),
    isNull(pointsHistory.consumedAt),  // ADD THIS — only expire unconsumed points
  ),
});
```

---

## BUG 06 🟡 — B2B landing page: shows estimated B2B price without being clearly marked as estimate

**File:** `app/(b2b)/b2b/page.tsx` line 209

```tsx
const b2bPrice = product.variants[0]?.b2bPrice ?? Math.round(retailPrice * 0.85);
```

If `b2bPrice` is not set in the database, the page shows `Math.round(retailPrice * 0.85)` as if it's the actual B2B price. The disclaimer at line 223 says "Harga di atas hanya perkiraan" but the table column header says "Harga B2B" without asterisk.

While there is a disclaimer, the table visually presents a made-up number in a "Harga B2B" column. This could lead to B2B customers expecting the 15% discount, creating pricing disputes.

**Fix:** Either:
1. Don't show the price table at all if no real B2B prices are set (`product.variants[0]?.b2bPrice` should not be null for displayed products), or
2. Skip rows where `b2bPrice` is null:
```tsx
{priceTeaserProducts.filter(p => p.variants[0]?.b2bPrice != null).slice(0, 5).map(...)}
```
3. Or show "Hubungi Kami" instead of a computed price:
```tsx
const b2bPrice = product.variants[0]?.b2bPrice;
// ...
<td>{b2bPrice ? formatIDR(b2bPrice) : <span className="text-brand-red text-xs">Hubungi Kami</span>}</td>
```

---

## BUG 07 🟡 — Account vouchers page: shows ALL public active coupons, not user-specific ones

**File:** `app/(store)/account/vouchers/page.tsx`  
**API:** `app/api/account/vouchers/route.ts`

The "Voucher Tersedia" section presumably fetches all active, non-expired coupons that have remaining uses. This shows coupons that:
- The user has already used (if maxUsesPerUser = 1)
- Have minimum order amounts the user has never met
- Are expired for this user specifically

**Action:** Verify `app/api/account/vouchers/route.ts`. If it returns all public active coupons, add filtering:
1. Exclude coupons where user has already reached `maxUsesPerUser`
2. Show the coupon code so users can actually apply it (currently showing the code is the main value)
3. Show minimum order requirement if applicable

**Expected API logic:**
```ts
// In /api/account/vouchers
const usedCouponIds = (await db.query.couponUsages.findMany({
  where: eq(couponUsages.userId, userId),
  columns: { couponId: true }
})).map(u => u.couponId);

const availableCoupons = await db.query.coupons.findMany({
  where: and(
    eq(coupons.isActive, true),
    or(isNull(coupons.expiresAt), gt(coupons.expiresAt, new Date())),
    or(isNull(coupons.maxUses), lt(coupons.usedCount, coupons.maxUses)),
  ),
});
```

---

## BUG 08 🔵 — Account page: status badge for `packed` order shows no text (empty label)

**File:** `app/(store)/account/page.tsx` line 183

The recentOrders status rendering is missing the `packed` status:
```tsx
{order.status === 'pending_payment' && 'Menunggu'}
{order.status === 'paid' && 'Dibayar'}
{order.status === 'processing' && 'Diproses'}
// 'packed' is missing!
{order.status === 'shipped' && 'Dikirim'}
{order.status === 'delivered' && 'Selesai'}
{order.status === 'cancelled' && 'Dibatalkan'}
```
And the status color classes also miss `packed`:
```tsx
${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
// This line is missing from account/page.tsx (it exists in orders/page.tsx)
```

**Fix:** Add the missing `packed` case:
```tsx
{order.status === 'packed' && 'Dikemas'}
// And in the className:
${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
```

---

## BUG 09 🔵 — Account order detail: `TrackingInfo` component receives `courierName` but may need `courierCode` for deep links

**File:** `app/(store)/account/orders/[orderNumber]/page.tsx` lines 180–186

```tsx
<TrackingInfo
  trackingNumber={order.trackingNumber}
  courierName={order.courierName}
/>
```

The `TrackingInfo` component generates deep-link URLs to courier tracking pages. The URL patterns are keyed by courier CODE (e.g., `SICEPAT`, `JNE`, `ANTERAJA`), not courier NAME. If `TrackingInfo` uses `courierName` to look up URLs, it may not match.

**Action:** Check `app/components/store/orders/TrackingInfo.tsx`. If it uses `courierCode` for URL generation, pass it:
```tsx
// In the type cast at line 37, add courierCode:
courierCode: string | null;

// Then pass to component:
<TrackingInfo
  trackingNumber={order.trackingNumber}
  courierName={order.courierName}
  courierCode={order.courierCode}  // Add this
/>
```

---

## MISSING FEATURE 01 🟠 — B2B account portal pages: orders and quotes may be incomplete stubs

**Files:**  
- `app/(b2b)/b2b/account/orders/page.tsx`
- `app/(b2b)/b2b/account/quotes/page.tsx`
- `app/(b2b)/b2b/account/page.tsx`

The B2B account portal is protected by middleware. These pages need to:
1. Show B2B orders with B2B pricing
2. Show quote request history and status
3. Show assigned WhatsApp contact
4. Show points earned (at 2x rate for B2B)

**Action:** Verify these pages have real data fetching, not `return <div>Coming Soon</div>`.

---

## MISSING FEATURE 02 🟡 — Profile edit page: PRD requires edit name/phone but page may be missing key fields

**File:** `app/(store)/account/profile/page.tsx`

The profile page should allow editing name, phone number, and potentially profile image. Verify:
1. Name is editable
2. Phone number is editable (used for checkout pre-fill)
3. Email change requires password confirmation
4. Google OAuth accounts can add a password

**Action:** Open `/account/profile` and verify all PRD-required fields are present and save correctly to `/api/account/profile`.

---

## MISSING FEATURE 03 🟡 — Public order tracking page: guest email verification may be missing or leaking data

**File:** `app/(store)/orders/[orderNumber]/page.tsx` and `OrderTrackingClient.tsx`

The PRD (§9.5) requires: "Guest can track order at `/orders/[orderNumber]`. Must enter email used at checkout to verify ownership."

**Action:** Verify `OrderTrackingClient.tsx`:
1. Shows an email input if the user is not logged in
2. Submits email to API for verification
3. API verifies `order.recipientEmail === submittedEmail` before returning full order details
4. If email doesn't match: shows generic "Order not found" (not "Email incorrect" which leaks existence)

If the page currently shows order details without email verification for guests, this is a privacy violation.

---

## MISSING FEATURE 04 🔵 — Account orders list doesn't filter/search by status

**File:** `app/(store)/account/orders/page.tsx`

The order list shows all orders paginated. There's no filter by status (e.g., "Show only pending", "Show only completed"). For customers with many orders, this is a UX improvement.

Per PRD (§3.1): `/account/orders` should show order history. No filter is explicitly required but it's a standard e-commerce pattern.

**Optional enhancement:** Add a status filter tab bar:
```tsx
const STATUS_FILTERS = ['Semua', 'Menunggu', 'Dikirim', 'Selesai', 'Dibatalkan'];
```

---

## MISSING FEATURE 05 🔵 — B2B inquiry form: no confirmation email to inquirer after submission

**File:** `app/api/b2b/inquiry/route.ts`

When a B2B inquiry is submitted, verify:
1. Admin receives notification email (to notify@dapurdekaka.com or similar)
2. Inquirer receives an acknowledgment email ("Terima kasih, kami akan menghubungi Anda dalam 24 jam")

Without #2, B2B leads get no confirmation that their inquiry was received.

**Action:** In the inquiry route, after saving to DB, send acknowledgment email via Resend:
```ts
await sendEmail({
  to: body.email,
  subject: 'Terima kasih atas minat Anda — Dapur Dekaka',
  react: B2BInquiryAckEmail({ name: body.name, companyName: body.companyName }),
});
```
