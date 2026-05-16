# DEEP AUDIT 01 — Business Logic & Financial Integrity
> Generated: 2026-05-14 | Read every file line by line. Priority: CRITICAL bugs first.

---

## SEVERITY LEGEND
- 🔴 **CRITICAL** — Money/data loss, order corruption, broken user flows
- 🟠 **HIGH** — User-facing bugs, financial inaccuracies, exploitable edge cases
- 🟡 **MEDIUM** — Logic gaps, UX problems, missing features that are expected to work
- 🟢 **LOW** — Polish, improvements, non-blocking

---

## 🔴 CRITICAL — Order Sequence Counter Off-by-One

**File:** `app/api/checkout/initiate/route.ts:334-345`

```ts
// Step 1: insert/conflict row, returns id
const [counterRow] = await tx
  .insert(orderDailyCounters)
  .values({ date: today, lastSequence: 0 })
  .onConflictDoUpdate({ target: orderDailyCounters.date, set: { updatedAt: new Date() } })
  .returning({ id: orderDailyCounters.id });

// Step 2: increment
const updatedCounters = await tx
  .update(orderDailyCounters)
  .set({ lastSequence: sql`last_sequence + 1`, updatedAt: new Date() })
  .where(eq(orderDailyCounters.id, counterRow!.id))
  .returning({ newSequence: orderDailyCounters.lastSequence });

const seq = (updatedCounters[0]?.newSequence ?? 1) + 1; // BUG: +1 here
```

**The bug:** On the very first order of the day, the counter starts at 0 → increments to 1 → `newSequence = 1` → `seq = 1 + 1 = 2`. So the first order of the day is always numbered `DDK-YYYYMMDD-0002`. Sequence `0001` is permanently skipped every day.

**The comment** says `// +1 because increment hasn't committed yet in same tx` — this reasoning is wrong. In Drizzle's neon-http transaction batch, the UPDATE statement runs before the RETURNING is read. `newSequence` correctly reflects the post-increment value.

**Fix:**
```ts
const seq = updatedCounters[0]?.newSequence ?? 1; // remove the +1
```

---

## 🔴 CRITICAL — Payment Reconciliation Cron Does Nothing When Payment is Found

**File:** `app/api/cron/reconcile-payments/route.ts:52-57`

```ts
if (midtransStatus === 'settlement') {
  logger.warn('[Reconcile] Order paid but status is pending', {
    orderNumber: order.orderNumber,
    midtransStatus,
  });
  results.reconciled++; // ← just logs and counts, no DB update!
}
```

**The bug:** When the cron detects that Midtrans says `settlement` but our DB still says `pending_payment`, it only logs a warning and increments a counter. It does NOT call the webhook handler or update the order. The order stays in `pending_payment` forever. The customer's stock is never deducted, points are never awarded, and no confirmation email is sent.

**Fix:** When `settlement` is detected, call the same transaction block as the webhook (or POST to the webhook endpoint internally), updating order to `paid`, deducting stock, awarding points, writing status history, and sending email.

---

## 🔴 CRITICAL — B2B Orders Page API Route Missing

**File:** `app/(b2b)/b2b/account/orders/page.tsx:16`

```ts
const res = await fetch('/api/b2b/orders');
```

This route **does not exist**. The file list contains `app/api/b2b/inquiry/route.ts` and `app/api/b2b/quotes/route.ts` but no `app/api/b2b/orders/route.ts`. Every B2B user who visits their order history page gets a `404` response, and the empty state renders ("Belum Ada Pesanan") even for users who have orders.

**Fix:** Create `app/api/b2b/orders/route.ts` that queries `orders` where `userId = session.user.id` and `isB2b = true`.

---

## 🔴 CRITICAL — Retry Payment Endpoint Has No Auth Check

**File:** `app/api/checkout/retry/route.ts:10-107`

The entire `POST` handler has no `auth()` call. Any person who knows an order number (which is predictable: `DDK-YYYYMMDD-NNNN`) can:
1. Trigger a new Midtrans Snap token for someone else's order.
2. Force the `paymentRetryCount` to increment.
3. After 3 calls, auto-cancel the order: `status: 'cancelled'`.

This is a **denial-of-service and data manipulation vulnerability** — a bad actor can cancel any pending order just by calling this endpoint 3 times.

**Fix:** Add `auth()` check and verify `order.userId === session.user.id` (or allow guest checkout retry by storing a session token on the order).

---

## 🔴 CRITICAL — Field Dashboard Inventory Adjust: API Parameter Mismatch

**File (API):** `app/api/admin/field/inventory/adjust/route.ts:9-13`
```ts
const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int(),      // ← API expects "delta"
  reason: z.string().min(1),
  note: z.string().optional(),
});
```

**File (Frontend):** `app/(admin)/admin/field/page.tsx:176-180`
```ts
async function adjustInventory(data: { variantId: string; newQuantity: number; reason: string }) {
  const res = await fetch('/api/admin/field/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(data), // ← sends "newQuantity", not "delta"
  });
```

The frontend sends `{ variantId, newQuantity, reason }` but the API schema expects `{ variantId, delta, reason }`. Zod will reject every adjustment with a validation error. **Warehouse staff who try to do inventory correction through the field dashboard will silently fail** (Sonner toast never triggers either — the error is returned but the frontend just throws it).

**Fix Option A:** Change the API schema to accept `newQuantity` and compute `delta = newQuantity - currentStock` inside the API.  
**Fix Option B:** Change the frontend to send `delta = newQuantity - selectedItem.stock`.

---

## 🔴 CRITICAL — Points Reversal on Webhook Cancel: Wrong Query Limit

**File:** `app/api/webhooks/midtrans/route.ts:287-306`

```ts
const redeemRecords = await tx
  .select()
  .from(pointsHistory)
  .where(
    and(
      eq(pointsHistory.userId, order.userId),
      eq(pointsHistory.type, 'redeem'),
      sql`${pointsHistory.referencedEarnId} IS NOT NULL`
    )
  )
  .orderBy(pointsHistory.createdAt)
  .limit(order.pointsUsed);  // ← BUG: limits by point VALUE, not record count
```

`order.pointsUsed` is the **number of points** (e.g., 5000), not the number of redeem records. There could be 1–N redeem records covering those 5000 points depending on how many earn records were consumed via FIFO. This `.limit(5000)` accidentally works most of the time (it over-fetches) but is semantically wrong and will fail to restore the correct earn records if the user has fewer redeem records than `pointsUsed`.

There's also a deeper bug: the query doesn't filter by `orderId`. If a user has MULTIPLE cancelled orders that used points, this query would return redeem records from ALL of them, and all referenced earn records would be unconsumed, effectively doubling/tripling the user's point balance.

**Fix:** Add `eq(pointsHistory.orderId, order.id)` to the where clause, and remove the `.limit()`.

---

## 🟠 HIGH — Coupon Max-Uses Race Condition

**File:** `app/api/checkout/initiate/route.ts:181-185`

```ts
if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
  return conflict('Kupon sudah mencapai batas penggunaan');
}
```

The `usedCount` check reads the current value from DB. But the increment only happens in the webhook (`used_count + 1` on settlement). In the window between two simultaneous checkout initiations:
- User A reads `usedCount = 9`, `maxUses = 10` → passes
- User B reads `usedCount = 9`, `maxUses = 10` → passes
- Both orders proceed. Both pay. Webhook for A increments to 10. Webhook for B increments to 11.

**Fix:** Either use a SELECT FOR UPDATE / atomic compare-and-increment at initiate time, or add a `coupon_reservations` table for in-progress checkouts.

---

## 🟠 HIGH — Guest Checkout Has No Idempotency Protection

**File:** `app/api/checkout/initiate/route.ts:276-293`

The idempotency check (returns existing pending order if same user has a recent one) only works when `userId` is present:

```ts
if (userId) {
  const existingPending = await db.query.orders.findFirst({ ... });
  if (existingPending?.midtransSnapToken) { return existing; }
}
```

Guest users (no session) get no idempotency protection. Double-clicking "Bayar Sekarang" creates two separate orders, two Midtrans transactions, and two stock reservation attempts. One payment will succeed and one will leave a phantom `pending_payment` order that gets auto-cancelled hours later by the cleanup cron.

**Fix:** For guest users, store a session token (cookie or localStorage key) on the order and include it in the idempotency check.

---

## 🟠 HIGH — Admin Cancel: Points Recorded as 'expire' Type

**File:** `app/api/admin/orders/[id]/status/route.ts:172-179`

```ts
await tx.insert(pointsHistory).values({
  userId: order.userId,
  type: 'expire',          // ← semantically wrong
  pointsAmount: -order.pointsUsed,
  pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`,
  descriptionId: `Pembatalan pesanan ${order.orderNumber} — poin dikembalikan`,
```

Using `type: 'expire'` for a points refund due to cancellation is semantically incorrect. The `expire` type should only be used by the points expiry cron job. Using it here corrupts the loyalty history display — the customer would see "Poin Kadaluarsa" instead of "Pengembalian Poin" in their history.

Additionally, `pointsBalanceAfter: sql\`points_balance + ${order.pointsUsed}\`` — the SQL expression uses the user's balance BEFORE the UPDATE. In the same transaction, the `UPDATE users SET points_balance + pointsUsed` was already applied, so this should actually be CORRECT (the UPDATE runs first, then the INSERT reads the new balance). But this is fragile and should be an explicit calculation.

**Fix:** Use `type: 'adjust'` for admin cancellation refunds, and compute `pointsBalanceAfter` explicitly.

---

## 🟠 HIGH — Checkout Page: Saved Addresses Never Populate

**File:** `app/(store)/checkout/page.tsx:139-143`

```ts
// BUG: useState() being called with a function — this is NOT a side effect
useState(() => {
  if (addressesData) {
    setSavedAddresses(addressesData as SavedAddress[]);
  }
});
```

`useState(initializer)` only runs the initializer function **once** during the initial render, and the return value (which is `undefined` here since `setSavedAddresses` returns void) is used as the initial state for a new state variable that's never captured. This is essentially a no-op — `savedAddresses` is always `[]`.

The correct pattern is `useEffect(() => { if (addressesData) setSavedAddresses(addressesData); }, [addressesData])`.

**Impact:** Logged-in users never see their saved addresses during checkout. The saved address picker never shows. Users must re-enter their address every order.

**Fix:**
```ts
useEffect(() => {
  if (addressesData) {
    setSavedAddresses(addressesData as SavedAddress[]);
  }
}, [addressesData]);
```

---

## 🟠 HIGH — Checkout Failed Page: Response Parsing Bug

**File:** `app/(store)/checkout/failed/page.tsx:36-44`

```ts
const res = await fetch(`/api/orders/${orderNumber}`);
if (res.ok) {
  const data = await res.json();
  if (data.success?.data?.items) {  // ← BUG: wrong response path
    setOrderItems(data.success.data.items);
  }
}
```

The standard API response format (from `lib/utils/api-response.ts`) is `{ success: true, data: { ... } }`. So the correct path is `data.data?.items`, not `data.success?.data?.items`. This means `setOrderItems` is never called, `orderItems` stays null, the "cart restored" message never shows, and the "Coba Lagi" button doesn't restore cart items.

**Fix:** Change to `data.data?.items` or more robustly:
```ts
if (data.success && data.data?.items) {
  setOrderItems(data.data.items);
}
```

---

## 🟡 MEDIUM — Stock Not Reserved at Checkout; Oversell Window Exists

**Files:** `app/api/checkout/initiate/route.ts` (stock check only, no decrement), `app/api/webhooks/midtrans/route.ts:110-130` (actual decrement)

Stock is validated at initiation time but not decremented until the Midtrans webhook fires. The window between initiation and payment confirmation (up to 15 minutes default, or up to payment expiry) creates an oversell opportunity:

1. User A adds last 1 unit to cart, passes stock check, creates order
2. User B also checks out the same item, passes the same stock check (still shows stock = 1)
3. User A pays first → webhook decrements stock to 0
4. User B pays second → webhook finds `stock < quantity`, logs oversell error

The webhook only logs the oversell but doesn't reverse the payment or notify anyone. The admin dashboard should surface this as an alert.

**Recommended fix:** Reserve stock at initiation (soft reserve), release on payment failure. At minimum, add an `oversell_alerts` notification or email to admin.

---

## 🟡 MEDIUM — Buy-X-Get-Y Free Items Added to Midtrans With Price 0

**File:** `app/api/checkout/initiate/route.ts:479-484`

```ts
itemDetails.push({
  id: freeItem.variantId,
  price: 0,
  quantity: freeItem.quantity,
  name: `FREE: ${freeItem.productNameId.substring(0, 40)}...`,
});
```

Midtrans requires `price >= 1` for item details. Sending `price: 0` will cause the Midtrans API to reject the transaction with a validation error. The `gross_amount` total will also be inconsistent if free items have 0 price but are listed in `item_details`.

**Fix:** Either exclude free items from `item_details` and instead add a single "Gratis" line item with the negative total value, or set `price: 1` and add a discount line item to compensate.

---

## 🟡 MEDIUM — Points Earned Calculation Skips Discount

**File:** `app/api/checkout/initiate/route.ts:309`

```ts
const pointsEarned = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;
```

Points are calculated on `subtotal` (before discounts, before shipping). A customer who gets a 50% discount coupon still earns full points as if they paid full price. This is a business decision, but it's probably unintentional. Best practice is to earn points on `totalAmount` (after discounts, shipping optional).

**Fix:** Decide on policy and document it. If it should be on actual payment:
```ts
const pointsEarned = Math.floor(totalAmount / 1000) * POINTS_EARN_RATE;
```

---

## 🟡 MEDIUM — Checkout Step Index Uses Wrong Steps Array

**File:** `app/(store)/checkout/page.tsx:332`

```ts
const currentStepIndex = STEPS.findIndex((s) => s.id === step);
```

`STEPS` always has 4 steps (identity, delivery, courier, payment). But for pickup orders, `STEPS_PICKUP` has only 3 steps (no courier). When a user picks `pickup`, `step` can be `'payment'` which has index 3 in `STEPS` but index 2 in `STEPS_PICKUP`. Any component that uses `currentStepIndex` for display or logic will show the wrong index for pickup flows.

**Fix:**
```ts
const currentStepIndex = activeSteps.findIndex((s) => s.id === step);
```

---

## 🟡 MEDIUM — No Pickup Code Generated or Stored

**File:** `lib/db/schema.ts:270` — `pickupCode: varchar('pickup_code', { length: 20 })` column exists.

**File:** `app/api/checkout/initiate/route.ts:400-433` — The order insert never sets `pickupCode`.

The pickup code column exists in the schema but is never populated. The field dashboard pickup tab at `app/(admin)/admin/field/page.tsx:615` tries to use `order.pickupCode` for verification:

```ts
if (selectedOrder.pickupCode && inputCode.trim().toUpperCase() !== selectedOrder.pickupCode.toUpperCase()) {
  setCodeError('Kode tidak cocok.');
}
```

Since `pickupCode` is always null, the if-condition is false and staff can confirm ANY pickup without verification. The pickup security model is completely broken.

**Fix:** Generate and store a `pickupCode` (e.g., last 6 chars of `orderNumber`) when creating pickup orders, and display it in the pickup invitation email.

---

## 🟡 MEDIUM — B2B Points Double-Multiplier Has No Cap or Validation

**File:** `app/api/webhooks/midtrans/route.ts:152-159`

```ts
const userRecord = await tx.query.users.findFirst({ ... columns: { role: true } });
const isB2B = userRecord?.role === 'b2b';
const earnedPoints = isB2B ? order.pointsEarned * 2 : order.pointsEarned;
```

The business rule of B2B users earning 2x points is applied correctly, but:
1. The `order.pointsEarned` value was calculated at initiation time without the 2x multiplier (line 309 of initiate route). So the `pointsEarned` stored on the order is the B2C amount — the 2x happens silently in the webhook.
2. The `pointsEarned` field in the order still shows the B2C value even though the user received 2x. This causes a mismatch in order history display vs actual points awarded.
3. There's no business logic document or constant defining the B2B multiplier (2x is hard-coded).

**Fix:** Store the actual earned points in `orders.pointsEarned` after applying the multiplier, and define `B2B_POINTS_MULTIPLIER = 2` in `lib/constants/points.ts`.

---

## 🟡 MEDIUM — Admin Status Route: Cancellation Doesn't Check if Order Was Paid

**File:** `app/api/admin/orders/[id]/status/route.ts:138-188`

When admin cancels an order with status `paid`, `processing`, or `packed`, the code restores stock (correct) and reverses points (correct) and reverses coupon (correct). However:

1. It does NOT create a pending refund record or notify finance team.
2. `VALID_TRANSITIONS.paid` includes `['processing', 'cancelled']` — cancelling a PAID order means the customer has already been charged but the system shows no refund obligation. The `refundAmount` is not tracked anywhere.
3. The cancellation email uses a hardcoded `refundInfo: 'Pengembalian dana akan diproses 1-7 hari kerja'` in the webhook, but for admin-initiated cancellations (in the status route), the cancellation email at line 244-271 does NOT include `refundAmount` or `refundInfo`.

**Fix:** Add `refundAmount` and `refundInfo` to the admin cancellation email if `order.status` was `paid` or later.

---

## 🟢 LOW — `isLoading` Not Reset on Midtrans Init Failure

**File:** `app/(store)/checkout/page.tsx:275-316`

```ts
const handlePlaceOrder = async () => {
  setIsLoading(true);
  try {
    const res = await fetch('/api/checkout/initiate', ...);
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Gagal membuat pesanan');
      setIsLoading(false);  // ← reset on API error only
      return;
    }
    setSnapToken(data.data.snapToken);
    setOrderNumber(data.data.orderNumber);
    // ← no setIsLoading(false) here
  } catch {
    alert('Gagal membuat pesanan');
    setIsLoading(false);  // ← reset on exception only
  }
};
```

On success, `isLoading` stays `true` and the Midtrans modal takes over. But if the Midtrans snap.js fails to load or throws, the button stays permanently disabled with no way for the user to retry without a page reload.

**Fix:** Always reset `isLoading(false)` after setting `snapToken`, and let the MidtransPayment component handle its own loading state.

---

## 🟢 LOW — `free_shipping` Coupon Type Not Implemented

**File:** `lib/db/schema.ts:325` — `freeShipping: boolean('free_shipping').notNull().default(false)` column exists.

**File:** `app/api/checkout/initiate/route.ts:186-267` — Coupon handling covers `percentage`, `fixed`, `buy_x_get_y` but NOT `free_shipping`.

**File:** `app/api/coupons/validate/route.ts:92-103` — Returns `freeShipping: coupon.freeShipping` in the response but the checkout page never reads it.

The `freeShipping` flag is stored and returned but never applied to `shippingCost`. A free shipping coupon currently has no effect.

---

## 🟢 LOW — `customerNote` Not Shown in Admin Order Detail

The checkout form collects `customerNote` (`app/(store)/checkout/page.tsx:177`) and it's stored in the `orders` table. The field dashboard shows it correctly with a yellow banner. However, the admin order detail page at `app/(admin)/admin/orders/[id]/page.tsx` should be verified to display it — important for customer special requests (e.g., "no spice", "gift wrapping").
