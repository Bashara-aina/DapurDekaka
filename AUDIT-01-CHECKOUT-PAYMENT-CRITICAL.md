# AUDIT 01 — Checkout, Cart & Payment: Critical Bugs

> **Priority: FIX FIRST.** These bugs mean orders cannot be created, carts disappear after login, and the Midtrans payment loop is broken end-to-end. Nothing in the store works correctly until these are resolved.

---

## BUG 01 — CRITICAL: All order creation is inside a dead `if` branch
**File:** `app/api/checkout/initiate/route.ts`  
**Approx line:** ~358

The entire order-creation block — `shippingCost`, `totalAmount`, the DB transaction, Midtrans SnapToken generation, and the `return success(...)` — is nested inside:

```ts
if (coupon && coupon.maxUsesPerUser && userId) {
  // ← ALL order creation code is here
}
```

This means: if there is **no coupon**, OR the coupon has no per-user limit, OR the user is a guest → **no order is ever created**. The function falls through with no return value. This is the primary reason checkout silently fails for the majority of users.

**Fix:** Extract the order-creation block out of the `if` statement. The only thing that should be inside the `if` block is the per-user coupon usage check:

```ts
// BEFORE the order creation block:
if (coupon && coupon.maxUsesPerUser && userId) {
  const userCouponUsages = await db.select(...)...;
  if (userCouponUsages.length >= coupon.maxUsesPerUser) {
    return badRequest('Coupon usage limit reached');
  }
}

// THEN the full order creation continues unconditionally:
const shippingCost = ...
const totalAmount = ...
// ... db.transaction, midtrans, return success
```

---

## BUG 02 — CRITICAL: `userId` used before it is declared
**File:** `app/api/checkout/initiate/route.ts`  
**Approx line:** ~199

A coupon per-user check runs at line ~199:
```ts
if (coupon.maxUsesPerUser && userId) { ... }
```

But `userId` is not declared until line ~300 (`const userId = session?.user?.id ?? null`). This is a `ReferenceError` at runtime — every checkout attempt with a limited coupon crashes here before reaching the order creation code.

**Fix:** Move the `userId` declaration to immediately after `const session = await auth()` (around line 30), before any coupon validation:

```ts
const session = await auth();
const userId = session?.user?.id ?? null;  // ← move here
```

---

## BUG 03 — CRITICAL: Free (buy_x_get_y) items break the Midtrans settlement webhook
**File:** `app/api/checkout/initiate/route.ts` (item details) + `app/api/webhooks/midtrans/route.ts` (amount check)

In the initiate route, free items are added to Midtrans item_details with `price: 1` (to satisfy Midtrans's zero-price restriction). But the order's `totalAmount` stored in the DB uses `0` for free items. This creates a mismatch of `freeItems.length` IDR between the Midtrans gross_amount and `order.totalAmount`.

The webhook then rejects the settlement:
```ts
// webhook/route.ts ~line 103
if (webhookAmount !== expectedAmount) {
  return NextResponse.json({ received: false }, { status: 400 });
}
```

**Result:** Every order with a `buy_x_get_y` coupon has its settlement webhook rejected. The order stays `pending_payment` forever.

**Fix Option A (recommended):** Don't add free items to Midtrans `item_details` as price 1. Instead, include them at price 0 and tell Midtrans via a discount item that brings gross_amount to match. Or simply exclude free items from `item_details` entirely and account for them in the order note.

**Fix Option B:** Add `freeItems.length` to `totalAmount` in the DB when buy_x_get_y is applied, so the amounts match.

---

## BUG 04 — CRITICAL: Cart is cleared BEFORE payment is confirmed
**File:** `app/(store)/checkout/page.tsx`  
**Approx line:** ~376

`clearCart()` is called immediately when the `/api/checkout/initiate` API responds successfully — before the Midtrans payment popup is shown, and before the user has actually paid:

```ts
const handlePlaceOrder = async () => {
  const res = await fetch('/api/checkout/initiate', ...);
  const data = await res.json();
  clearCart();   // ← cart wiped here, before payment
  setSnapToken(data.data.snapToken);
  openMidtrans(); // ← payment happens here
};
```

If the user closes the Midtrans popup without paying, they return to an empty cart with a dangling `pending_payment` order and no way to recover their items.

**Fix:** Move `clearCart()` to the `handleMidtransSuccess` callback only:

```ts
const handleMidtransSuccess = () => {
  clearCart(); // ← only clear after confirmed payment
  router.push(`/checkout/success?order=${orderNumber}`);
};
```

---

## BUG 05 — CRITICAL: Idempotency responses are missing `totalAmount`
**File:** `app/api/checkout/initiate/route.ts`  
**Approx lines:** ~317–343

Both early-return paths (for existing pending orders) return:
```ts
return success({
  orderId: recentOrder.id,
  orderNumber: recentOrder.orderNumber,
  snapToken: recentOrder.midtransSnapToken,
  // ← totalAmount is missing
});
```

The checkout page reads `data.data.totalAmount` to set `serverTotalAmount` for the "Bayar Sekarang — Rp X" button. Missing `totalAmount` means the button shows **Rp 0** when an existing order is returned.

**Fix:** Include `totalAmount: recentOrder.totalAmount` in both idempotency return payloads.

---

## BUG 06 — HIGH: `pointsBalanceAfter` in order creation references wrong column
**File:** `app/api/checkout/initiate/route.ts`  
**Approx line:** ~457

```ts
await tx.insert(pointsHistory).values({
  pointsBalanceAfter: sql`points_balance`,
  ...
});
```

`points_balance` is not a column in the `pointsHistory` table — it belongs to `users`. This will insert NULL or throw a column-not-found error, corrupting the points audit trail.

**Fix:** Compute the balance in JS and pass it directly:
```ts
const updatedUser = await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance - ${pointsToUse}` })
  .where(eq(users.id, userId))
  .returning({ pointsBalance: users.pointsBalance });

await tx.insert(pointsHistory).values({
  pointsBalanceAfter: updatedUser[0].pointsBalance,  // ← correct
  ...
});
```

---

## BUG 07 — HIGH: Stock never restored when Midtrans sends cancel/deny/expire webhook
**File:** `app/api/webhooks/midtrans/route.ts`  
**Approx lines:** ~277–327

The cancellation handler reverses points and coupon usage, but **never restores product stock**. Compare with the cron job `cancel-expired-orders` which correctly restores stock. Any order cancelled via Midtrans webhook (expired payment, denied, cancelled) permanently leaks stock.

**Fix:** Add stock restoration inside the cancel transaction, using the same pattern as `app/api/cron/cancel-expired-orders/route.ts`:

```ts
// Inside the cancel transaction:
for (const item of order.items) {
  await tx
    .update(productVariants)
    .set({ stock: sql`stock + ${item.quantity}` })
    .where(eq(productVariants.id, item.variantId));

  await tx.insert(inventoryLogs).values({
    variantId: item.variantId,
    changeType: 'reversal',
    quantityChange: item.quantity,
    note: `Payment cancelled: ${order.orderNumber}`,
  });
}
```

---

## BUG 08 — HIGH: Coupon `usedCount` is decremented on cancel but was never incremented
**File:** `app/api/webhooks/midtrans/route.ts`  
**Approx line:** ~320

On cancellation:
```ts
await tx.update(coupons).set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
```

But `usedCount` is only incremented on **settlement** (webhook line ~162). It is never incremented at order creation. So the cancellation always decrements an unincremented counter, making `usedCount` go to `-1` (or 0 via GREATEST), giving users a **free extra coupon use** for every cancelled order.

**Fix:** Remove the coupon decrement from the cancellation handler entirely — it has never been needed. The increment happens on settlement, and the decrement should mirror that event (i.e., only add a decrement if you also have an increment path that precedes it).

---

## BUG 09 — HIGH: Cart `validateStock` reads wrong response shape
**File:** `store/cart.store.ts`  
**Approx lines:** ~94–99

```ts
const stockMap = new Map(
  json.data.map((s: { variantId: string; stock: number }) => [s.variantId, s.stock])
);
```

The `/api/cart/validate` endpoint returns `{ success: true, data: { items: [...] } }` where each item has `availableStock`, not `stock`. This code reads `json.data` as the array (it's an object) and maps to `s.stock` (field doesn't exist). Result: the stock map is always empty, stock validation in the cart never works.

**Fix:**
```ts
const stockMap = new Map(
  (json.data.items as { variantId: string; availableStock: number }[])
    .map((s) => [s.variantId, s.availableStock])
);
```

---

## BUG 10 — HIGH: Cart appears empty after login (merge clears but never reloads)
**File:** `hooks/use-cart-merge.ts`  
**Approx lines:** ~29–31

After a successful cart merge to the database:
```ts
if (res.ok) {
  clearCart(); // ← local cart wiped
}
```

`loadFromDb()` in `cart.store.ts` is a **no-op stub** (it does nothing). So after login, the local cart is cleared, the merged cart sits in the DB, but the Zustand store is never rehydrated. The cart UI shows empty after every login.

**Fix (Step 1):** Implement `loadFromDb` in `store/cart.store.ts` to actually fetch and populate the store:
```ts
loadFromDb: async () => {
  const res = await fetch('/api/cart');
  if (!res.ok) return;
  const json = await res.json();
  set({ items: json.data.items ?? [] });
},
```

**Fix (Step 2):** Call `loadFromDb()` after `clearCart()` in `use-cart-merge.ts`:
```ts
if (res.ok) {
  clearCart();
  await useCartStore.getState().loadFromDb();
}
```

**Fix (Step 3):** Remove `items` from the `useEffect` dependency array in `use-cart-merge.ts` — having it there causes the merge to fire every time a cart item changes (after login), not just once on login:
```ts
}, [session, status]); // ← only re-run when session/auth changes
```

---

## BUG 11 — HIGH: No authentication on guest order retry — anyone can retry any guest order
**File:** `app/api/checkout/retry/route.ts`  
**Approx lines:** ~34–39

```ts
if (session?.user?.id && order.userId && session.user.id !== order.userId) {
  // check admin role
}
```

This check only runs when BOTH `session.user.id` and `order.userId` are truthy. For guest orders (`order.userId === null`) or unauthenticated requesters, the check is skipped entirely. Any anonymous user who knows a guest order number can generate a new Midtrans SnapToken for it.

**Fix:** Add an explicit guard:
```ts
// Guest orders: require the order's email to match a session token or a verified header
// At minimum, rate-limit by IP aggressively
if (!order.userId && !session?.user?.id) {
  // require email verification or a signed token; for now, rate-limit hard
}
```

---

## BUG 12 — MEDIUM: Midtrans expiry hardcoded at 15 min, ignores admin setting
**File:** `lib/midtrans/create-transaction.ts`  
**Approx lines:** ~38–40

```ts
expiry: { unit: 'minute', duration: 15 }
```

`payment_expiry_minutes` is stored in `system_settings` and read by both the initiate and retry routes when setting `paymentExpiresAt` on the order. But the actual Midtrans transaction always uses 15 minutes. If an admin changes the setting to 30 minutes, the DB shows a 30-minute window but Midtrans closes payment in 15.

**Fix:** Accept `expiryMinutes` as a parameter in `createMidtransTransaction()` and pass the setting value from the initiate/retry routes.

---

## BUG 13 — MEDIUM: Non-atomic order number sequence counter (race condition)
**File:** `app/api/checkout/initiate/route.ts`  
**Approx lines:** ~376–401

Order number generation uses two separate SQL statements — an upsert that does NOT increment `lastSequence` on conflict, followed by a separate UPDATE to increment it. Under concurrent load, two requests can read the same counter row and both generate the same sequence number, breaking order number uniqueness.

**Fix:** Use a single atomic statement with `RETURNING`:
```ts
const [counter] = await tx
  .insert(orderDailyCounters)
  .values({ date: today, lastSequence: 1 })
  .onConflictDoUpdate({
    target: orderDailyCounters.date,
    set: { lastSequence: sql`order_daily_counters.last_sequence + 1` },
  })
  .returning({ lastSequence: orderDailyCounters.lastSequence });
const sequence = counter.lastSequence;
```

---

## BUG 14 — MEDIUM: "Pay Now" button shows Rp 0 before order is placed
**File:** `app/(store)/checkout/page.tsx`  
**Approx lines:** ~89, ~739

`serverTotalAmount` initializes to `0`. The payment step button reads:
```tsx
`Bayar Sekarang — ${formatIDR(serverTotalAmount)}`
```
Before the user clicks the button and the API responds, this reads "Bayar Sekarang — Rp 0".

**Fix:** Display the client-computed total until the server responds:
```tsx
`Bayar Sekarang — ${formatIDR(serverTotalAmount || totalAmount)}`
```

---

## BUG 15 — MEDIUM: `checkout/failed/page.tsx` missing `<Suspense>` around `useSearchParams()`
**File:** `app/(store)/checkout/failed/page.tsx`  
**Approx line:** ~22

`useSearchParams()` is called in a top-level client component without a `<Suspense>` boundary. Next.js App Router requires all `useSearchParams()` calls to be wrapped in `<Suspense>` or the build will throw a prerender error.

**Fix:** Extract the page content into a child component and wrap at the page level (same pattern as `checkout/success/page.tsx`):
```tsx
export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutFailedContent />
    </Suspense>
  );
}
```
