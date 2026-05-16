# AUDIT V2-05 — APIs, Cron Jobs & Incomplete Features
**Date:** 2026-05-15  
**Scope:** `app/api/cron/`, `app/api/shipping/`, `app/api/admin/settings/`, `components/store/`, incomplete pages  
**Severity:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW

---

## BUG-01 🔴 CRITICAL — 3 cron jobs never execute (HTTP method mismatch with Vercel Cron)

**Files:**  
- `app/api/cron/cancel-expired-orders/route.ts` — line 15  
- `app/api/cron/expire-points/route.ts` — line 13  
- `app/api/cron/points-expiry-warning/route.ts` — line 11

### What's wrong
Vercel Cron always invokes routes via **GET** request. But three critical cron routes only export `POST`:

```typescript
// cancel-expired-orders/route.ts line 15:
export async function POST(req: NextRequest) {

// expire-points/route.ts line 13:
export async function POST(req: NextRequest) {

// points-expiry-warning/route.ts line 11:
export async function POST(req: NextRequest) {
```

When Vercel sends `GET /api/cron/cancel-expired-orders`, there is no `GET` handler → Next.js returns **405 Method Not Allowed**. The cron job appears to fire (Vercel logs show it triggered) but the route handler never runs.

**Result:**
- Expired/unpaid orders stay stuck as `pending_payment` forever — **inventory is never released back to available**
- User loyalty points never expire after 365 days
- Customers never receive the "your points will expire in 7 days" warning email

### Fix — Change `POST` to `GET` on all three routes:

```typescript
// In cancel-expired-orders/route.ts, expire-points/route.ts, points-expiry-warning/route.ts:
// Change:
export async function POST(req: NextRequest) {
// To:
export async function GET(req: NextRequest) {
```

The `verifyCronAuth` helper works with any method — no other changes needed.

---

## BUG-02 🔴 CRITICAL — cancel-expired-orders inflates stock (stock was never deducted for pending orders)

**File:** `app/api/cron/cancel-expired-orders/route.ts`  
**Lines:** 85–105

### What's wrong
Stock is only deducted in the Midtrans **settlement webhook** (when payment is confirmed). At checkout initiate, stock is **validated but not reserved**:

```typescript
// checkout/initiate/route.ts — only validates:
if (variant.stock < item.quantity) {
  return validationError(`Stok tidak mencukupi...`);
}
// No stock deduction here — stock is deducted later in the webhook
```

But `cancel-expired-orders` unconditionally adds stock back for every cancelled `pending_payment` order:

```typescript
// cancel-expired-orders/route.ts lines 88–105:
for (const item of order.items) {
  await tx.update(productVariants).set({
    stock: sql`stock + ${item.quantity}`,  // ← WRONG: stock was never taken
  }).where(eq(productVariants.id, item.variantId));
}
```

Every expired order causes a **false stock increase**. If 10 orders for a product with stock=5 expire, stock becomes 55.

**Result:** Product stock counts inflate over time. Items that are out of stock appear available. Customers can place orders for stock that doesn't exist.

### Fix — Remove the stock restoration from cancel-expired-orders entirely:

```typescript
// DELETE lines 85–105 (the entire stock restoration block):
// Stock is only deducted on payment confirmation (Midtrans webhook).
// pending_payment orders have no stock deduction to reverse.
// The inventory log insert should also be removed.
```

The only correct place to restore stock is in the Midtrans webhook cancel/expire handler — and only if the order was previously in `paid` or later status. Since `cancel-expired-orders` only touches `pending_payment` orders, no stock was ever taken.

---

## BUG-03 🔴 CRITICAL — reconcile-payments cancel branch doesn't reverse points or coupon

**File:** `app/api/cron/reconcile-payments/route.ts`  
**Lines:** 172–183

### What's wrong
When reconcile-payments detects a Midtrans-cancelled order, it only sets the DB status to `cancelled`:

```typescript
} else if (['cancel', 'deny', 'expire'].includes(midtransStatus)) {
  await db.transaction(async (tx) => {
    await tx.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(orders.id, order.id));
  });
  // ← No points reversal, no coupon reversal, no stock restore
  results.cancelled++;
}
```

Points ARE deducted at checkout initiate (before payment). If a user used 500 points and Midtrans cancels the payment via a status check in the reconcile cron, those 500 points are permanently lost. The coupon `usedCount` is also not decremented.

(Note: The Midtrans webhook cancel path at `webhooks/midtrans/route.ts:275` correctly reverses points and coupon. But the reconcile cron cancel path is missing this logic.)

### Fix — Add points and coupon reversal to the cancel branch:

```typescript
} else if (['cancel', 'deny', 'expire'].includes(midtransStatus)) {
  // Re-fetch full order to get pointsUsed, couponId, userId
  const fullOrder = await db.query.orders.findFirst({
    where: eq(orders.id, order.id),
  });
  if (!fullOrder || fullOrder.status !== 'pending_payment') continue;

  await db.transaction(async (tx) => {
    await tx.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(orders.id, order.id));

    // Reverse points if user used them
    if (fullOrder.userId && fullOrder.pointsUsed > 0) {
      await tx.update(users)
        .set({ pointsBalance: sql`points_balance + ${fullOrder.pointsUsed}` })
        .where(eq(users.id, fullOrder.userId));

      await tx.insert(pointsHistory).values({
        userId: fullOrder.userId,
        type: 'expire',
        pointsAmount: -fullOrder.pointsUsed,
        pointsBalanceAfter: fullOrder.pointsUsed, // see BUG-04 for correct pattern
        descriptionId: `Pembatalan pesanan ${fullOrder.orderNumber}`,
        descriptionEn: `Order ${fullOrder.orderNumber} cancelled`,
        expiresAt: null,
        isExpired: false,
        orderId: fullOrder.id,
      });
    }

    // Reverse coupon usage
    if (fullOrder.couponId) {
      await tx.update(coupons)
        .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
        .where(eq(coupons.id, fullOrder.couponId));
    }
  });
  results.cancelled++;
}
```

---

## BUG-04 🟠 HIGH — `pointsBalanceAfter: sql\`points_balance + X\`` fails in INSERT context

**Files:**  
- `app/api/cron/cancel-expired-orders/route.ts` — line 119  
- `app/api/admin/orders/[id]/status/route.ts` — line 181  
- `app/api/admin/points/adjust/route.ts` — line 67

### What's wrong
In a Drizzle `insert().values({...})` call, the values are placed in the `VALUES (...)` clause of the SQL INSERT statement. A bare column reference like `points_balance` has no table context in a VALUES clause — PostgreSQL throws `column "points_balance" does not exist`.

```typescript
// cancel-expired-orders/route.ts line 119:
await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`,
  // ← Generates: INSERT INTO points_history (...) VALUES (..., points_balance + 500)
  // PostgreSQL error: column "points_balance" does not exist
});

// admin/orders/[id]/status/route.ts line 181:
pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`,

// admin/points/adjust/route.ts line 67:
pointsBalanceAfter: sql`points_balance`,
```

When the INSERT fails, the entire transaction rolls back. In cancel-expired-orders, this means **the order never gets cancelled** despite the cron appearing to process it. In admin order cancellation, **admin cannot cancel orders where points were used**.

Note: `reconcile-payments/route.ts:113` uses a scalar subquery `sql\`(SELECT points_balance FROM users WHERE id = ...)\`` which IS valid PostgreSQL syntax and works correctly.

### Fix — Fetch the updated balance in JavaScript and pass an integer:

```typescript
// Pattern to use everywhere:
// 1. First perform the UPDATE to users.pointsBalance
await tx.update(users)
  .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
  .where(eq(users.id, order.userId));

// 2. Then fetch the new balance
const updatedUser = await tx.query.users.findFirst({
  where: eq(users.id, order.userId),
  columns: { pointsBalance: true },
});

// 3. Use the integer value in the INSERT
await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: updatedUser?.pointsBalance ?? 0,  // ← integer, not sql``
});
```

Apply this fix to all three affected files.

---

## BUG-05 🟠 HIGH — Settings API ignores the `type` column, infers type from value string

**File:** `app/api/admin/settings/route.ts`  
**Lines:** 38–47

### What's wrong
The `system_settings` table has a `type` column (`varchar(50)`) that stores the intended data type of each setting. But `GET /api/admin/settings` completely ignores it and infers the type by inspecting the value string:

```typescript
const settingsWithType = settings.map((s) => {
  let type: 'string' | 'number' | 'boolean' = 'string';
  const lowerValue = s.value.toLowerCase();
  if (lowerValue === 'true' || lowerValue === 'false') {
    type = 'boolean';
  } else if (!isNaN(Number(s.value)) && s.value !== '') {
    type = 'number';
  }
  // s.type (from DB) is completely ignored
  return { ...s, type };
});
```

Problems:
- A setting stored as `"0"` or `"1"` is typed as `number`, not `boolean` — the settings UI renders a text input instead of a toggle
- After `payment_expiry_minutes` is set to `"15"`, its type is correctly inferred as `number`. But if it's ever reset to `"0"`, `isNaN(Number("0"))` is false so it's still number — OK. But `"true"` stored in a numeric setting (typo) would switch it to `boolean` type in the UI
- The `s.type` column exists but is dead code — it was presumably populated in the seed but serves no runtime purpose

### Fix — Use the DB type column:

```typescript
const settingsWithType = settings.map((s) => ({
  ...s,
  type: (s.type as 'string' | 'number' | 'boolean') || 'string',
}));
```

This requires the `type` column to be correctly populated for all settings (verify in the seed script).

---

## BUG-06 🟠 HIGH — couponUsages rows not deleted on order cancellation (per-user limit count is wrong)

**Files:**  
- `app/api/webhooks/midtrans/route.ts` — lines 318–326  
- `app/api/cron/cancel-expired-orders/route.ts` — lines 127–133

### What's wrong
Both cancellation paths decrement `coupons.usedCount` when cancelling an order with a coupon:

```typescript
await tx.update(coupons)
  .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
  .where(eq(coupons.id, order.couponId));
```

But neither path **deletes the row from `couponUsages`**.

The per-user coupon limit check (in `checkout/initiate/route.ts`) counts rows in `couponUsages`:
```typescript
const userUsageCount = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(couponUsages)
  .where(and(
    eq(couponUsages.couponId, coupon.id),
    eq(couponUsages.userId, userId)
  ));
if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
  return conflict('Anda sudah menggunakan kupon ini sebelumnya');
}
```

Even if an order is cancelled and `usedCount` is decremented, the `couponUsages` row remains. The next time the same user tries to use the same coupon, the count is still 1 → blocked from using a coupon they have a right to use.

**Result:** A user whose order was cancelled can never reuse the coupon.

### Fix — Delete the couponUsages row on cancellation:

```typescript
// Add after the usedCount decrement in both cancellation paths:
if (order.couponId && order.userId) {
  await tx
    .delete(couponUsages)
    .where(and(
      eq(couponUsages.couponId, order.couponId),
      eq(couponUsages.orderId, order.id)
    ));
}
```

---

## BUG-07 🟡 MEDIUM — OrderTimeline component imported but never rendered in order detail page

**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`  
**Lines:** 8, 145–171

### What's wrong
The file imports `OrderTimeline` but the "Status Pesanan" section only renders a status badge and a text count:

```typescript
// Line 8 — imported:
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';

// Lines 145–171 — "Status Pesanan" section renders NO OrderTimeline:
<div className="bg-white rounded-card shadow-card p-6">
  <h2>Status Pesanan</h2>
  <div className="flex items-center gap-3">
    <span className={`px-3 py-1.5 ...`}>
      {/* status label */}
    </span>
    <p className="text-sm text-text-secondary">
      {order.statusHistory.length} update status  {/* ← just a count */}
    </p>
  </div>
</div>
```

The `order.statusHistory` is fetched (with timestamps) but the data is only used to display a count. The `OrderTimeline` component (`components/store/orders/OrderTimeline.tsx`) is fully implemented and ready to use — it just needs to be wired up.

### Fix — Map statusHistory to timeline steps and render OrderTimeline:

```typescript
const STATUS_STEPS = [
  { key: 'pending_payment', label: 'Menunggu Pembayaran' },
  { key: 'paid', label: 'Pembayaran Diterima' },
  { key: 'processing', label: 'Sedang Diproses' },
  { key: 'packed', label: 'Dikemas' },
  { key: 'shipped', label: 'Dalam Perjalanan' },
  { key: 'delivered', label: 'Selesai' },
];

const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);

// In JSX, replace the "Status Pesanan" section content:
<OrderTimeline
  steps={STATUS_STEPS.map((s, i) => ({
    label: s.label,
    description: order.statusHistory[i]
      ? new Date(order.statusHistory[i].createdAt).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        }) + ' WIB'
      : undefined,
  }))}
  currentStepIndex={currentStepIndex}
/>
```

Also fetch `toStatus` in the statusHistory query to match steps to timestamps more accurately.

---

## BUG-08 🟡 MEDIUM — B2B account order detail page missing (clicking an order → 404)

**Missing file:** `app/(b2b)/b2b/account/orders/[orderNumber]/page.tsx`

### What's wrong
`app/(b2b)/b2b/account/orders/page.tsx` lists B2B orders. Each order row presumably links to a detail page. But `app/(b2b)/b2b/account/orders/[orderNumber]/` does not exist — clicking an order returns 404.

The B2B order detail page should show:
- Order header (order number, status, date)
- Items with **B2B prices** (not retail prices)
- Payment status and Midtrans payment link if still `pending_payment`
- Pickup code if it's a pickup order
- Shipping info if delivery

### Fix — Create `app/(b2b)/b2b/account/orders/[orderNumber]/page.tsx`

The implementation is essentially the same as `app/(store)/account/orders/[orderNumber]/page.tsx` with two differences:
1. Authorization check must verify `session.user.role === 'b2b'` (not just `order.userId === session.user.id`)
2. Item prices should show `item.unitPrice` as originally stored (which for B2B orders will be the b2b price)

---

## BUG-09 🟡 MEDIUM — LanguageSwitcher is a non-functional UI element (confirmed by code comment)

**File:** `components/store/layout/LanguageSwitcher.tsx`  
**Line:** 10

### What's wrong
The component explicitly documents its own non-functionality:

```typescript
const switchLocale = (newLocale: 'id' | 'en') => {
  setLocale(newLocale);
  // The app doesn't have full i18n yet — just toggle the state for future use
  // When i18n is fully implemented, this would update cookies/locale
};
```

It appears in the Navbar. Users who click "EN" see the button highlight but the page language is unchanged. This is actively misleading to users.

### Fix — Hide the component until i18n is implemented:

In `components/store/layout/Navbar.tsx`, comment out or conditionally hide `<LanguageSwitcher />`:

```typescript
{/* LanguageSwitcher disabled until i18n is implemented */}
{/* <LanguageSwitcher className="hidden md:flex" /> */}
```

Do not delete the component — it can be re-enabled when next-intl or next-i18next is integrated.

---

## BUG-10 🔵 LOW — InstagramFeed renders hardcoded Cloudinary paths, not actual Instagram content

**File:** `components/store/home/InstagramFeed.tsx`  
**Lines:** 8–15

### What's wrong
```typescript
const instagramPosts = [
  { id: 1, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  { id: 2, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-02', alt: 'Bakso frozen' },
  // ...
];
```

These are hardcoded static Cloudinary paths. The section is titled "Ikuti Kami di Instagram" which implies real Instagram content. Two problems:
1. If these Cloudinary assets haven't been uploaded, 6 broken image placeholders appear on the homepage
2. The content is static — it never updates with real Instagram posts

### Fix options (choose one):
- **Option A (quick)**: Upload 6 gallery images to the exact Cloudinary paths listed. Rename section to "Galeri Kami" to avoid implying it's a live feed.
- **Option B (proper)**: Store gallery image public IDs in the DB (in `systemSettings` or a new `galleryImages` table) and fetch them server-side in `app/(store)/page.tsx`. Admin can update gallery images without a code deploy.
- **Option C (real Instagram)**: Integrate Instagram Basic Display API. Complex — requires OAuth token rotation. Not recommended for the current stage.

---

## INCOMPLETE-01 — `vercel.json` cron schedule runs `cleanup-audit-logs` with wrong schedule

**File:** `vercel.json` line (cleanup-audit-logs cron)

### What to check
```json
{ "path": "/api/cron/cleanup-audit-logs", "schedule": "0 3 * * 0" }
```
`* * 0` runs Sunday at 3am UTC. The route itself has `export async function GET` — correct. But confirm the route accepts GET (it does, confirmed). This one is fine.

**However:** Confirm `cleanup-counters` at `0 2 * * *` (daily at 2am UTC = 9am WIB) cleans only counters older than 7 days. Confirm it doesn't accidentally delete today's counter before any orders are placed (orders on the current date need the counter).

---

## INCOMPLETE-02 — No customer-facing page to reopen Midtrans payment for pending_payment orders

**What's missing**
If a user places an order but doesn't complete payment immediately (closes the snap popup), they have no way to return and pay. The `checkout/pending/page.tsx` exists but verify it shows the snap token and allows re-payment.

**What to check in `app/(store)/checkout/pending/page.tsx`:**
1. Does it fetch the order by `orderNumber` from query params?
2. Does it check if `midtransSnapToken` is still valid?
3. Does it render `<MidtransPayment snapToken={...} />` so the user can complete payment?

If it only shows a static "please wait" message, users with `pending_payment` orders must contact support — there's no self-service recovery path.

---

## Summary Table

| # | Severity | File | Issue |
|---|----------|------|-------|
| 01 | 🔴 CRITICAL | `cron/cancel-expired-orders/route.ts:15` | POST handler never fires — Vercel Cron sends GET |
| 01 | 🔴 CRITICAL | `cron/expire-points/route.ts:13` | Same: POST never fires on Vercel |
| 01 | 🔴 CRITICAL | `cron/points-expiry-warning/route.ts:11` | Same: POST never fires on Vercel |
| 02 | 🔴 CRITICAL | `cron/cancel-expired-orders/route.ts:88` | False stock restore for orders that never deducted stock |
| 03 | 🔴 CRITICAL | `cron/reconcile-payments/route.ts:172` | Cancel branch misses points + coupon reversal |
| 04 | 🟠 HIGH | `cron/cancel-expired-orders/route.ts:119` | `sql\`points_balance + X\`` in VALUES clause → DB error |
| 04 | 🟠 HIGH | `admin/orders/[id]/status/route.ts:181` | Same SQL error in admin order cancellation |
| 04 | 🟠 HIGH | `admin/points/adjust/route.ts:67` | Same SQL error in points adjustment |
| 05 | 🟠 HIGH | `api/admin/settings/route.ts:38` | Ignores `type` column, infers type from value string |
| 06 | 🟠 HIGH | `cron/cancel-expired-orders/route.ts:127` | couponUsages not deleted → phantom per-user limit records |
| 06 | 🟠 HIGH | `webhooks/midtrans/route.ts:318` | Same: couponUsages not deleted on webhook cancel |
| 07 | 🟡 MEDIUM | `account/orders/[orderNumber]/page.tsx:8` | OrderTimeline imported but never rendered |
| 08 | 🟡 MEDIUM | `b2b/account/orders/[orderNumber]/page.tsx` | Page doesn't exist → 404 on click |
| 09 | 🟡 MEDIUM | `components/store/layout/LanguageSwitcher.tsx` | Non-functional (confirmed by code comment) |
| 10 | 🔵 LOW | `components/store/home/InstagramFeed.tsx:8` | Hardcoded gallery paths, not real Instagram |
