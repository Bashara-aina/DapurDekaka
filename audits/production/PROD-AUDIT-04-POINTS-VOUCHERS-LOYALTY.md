# PROD-AUDIT-04: Points, Vouchers & Loyalty Engine
**Status: NOT PRODUCTION READY — 4 critical, 6 high severity**
**Focus: Points engine, coupon/voucher system, expiry, reconciliation, customer-facing display**

---

## Architecture overview (intended behavior)

- **Earn:** Points awarded at Midtrans `settlement`. B2B users earn 2× (constant, not configurable).
- **Redeem:** At checkout, customer can use accumulated points for a discount. Redeemed via FIFO against earn records.
- **Expire:** Points with `expiresAt < NOW()` are expired by cron. Warning email sent 7 days before.
- **Reconcile:** Cron periodically audits `pointsHistory` SUM vs `users.pointsBalance` and corrects drift.
- **Vouchers:** Coupons fetched from DB and displayed in customer's account page.

---

## BUG-01 [CRITICAL] Reconcile-points cron inflates points balance — reverses every expiry

**File:** `app/api/cron/reconcile-points/route.ts` ~line 22–28

**Problem:** The reconcile cron computes the "correct" balance as:
```typescript
SUM(pointsAmount) WHERE isExpired = false
```
But when the expire-points cron runs, it:
1. Reduces `users.pointsBalance` by the expired amount (correct)
2. Inserts a `pointsHistory` record with `type: 'expire'` and `isExpired: true` (this is the expiry marker)

The expire record has `isExpired: true`, so the reconcile query EXCLUDES it from the SUM. The SUM therefore represents the balance BEFORE expiry (without accounting for the expired deduction). The reconcile cron then sets `users.pointsBalance` to this higher number — effectively restoring the expired points on every reconcile run.

**Example:**
- User earns 1000 points (`isExpired: false`, `pointsAmount: +1000`)
- Expire cron: `pointsBalance` set to 0; expire record inserted (`isExpired: true`, `pointsAmount: -1000`)
- Reconcile runs: SUM of `isExpired=false` rows = 1000. Sets `pointsBalance = 1000`. ← WRONG.

**Fix (Option A — include all records in SUM):**
```typescript
// Remove the isExpired filter entirely — expire records have negative amounts
// and should be included in the running total:
const result = await db
  .select({ total: sum(pointsHistory.pointsAmount) })
  .from(pointsHistory)
  .where(eq(pointsHistory.userId, userId));
  // ← no isExpired filter

const correctBalance = Math.max(0, result[0]?.total ?? 0);
```

**Fix (Option B — change expire cron to mark records isExpired: false):**
Change the expire cron to write the expire record with `isExpired: false` (it's a transaction record, not an earn record marker). Then the SUM filter is not needed and can be removed.

The cleanest fix is Option A: remove the `isExpired` filter from the reconcile SUM query. The `isExpired` field on individual earn records is an optimization for "which earn records have been expired" — it does not affect the running total calculation.

---

## BUG-02 [CRITICAL] Expire-points cron uses absolute balance set — non-atomic, subject to race conditions

**File:** `app/api/cron/expire-points/route.ts` ~line 78–87

**Problem:**
```typescript
// Cron reads user balance, computes new value, then sets absolutely:
const currentBalance = user.pointsBalance;  // read
const newBalance = currentBalance - entry.totalPoints;  // compute
await tx.update(users).set({ pointsBalance: Math.max(0, newBalance) });  // absolute set
```
If a checkout, another cron run, or an admin adjustment modifies the user's balance between the `read` and the `set`, the cron will overwrite it with a stale value. All concurrent changes are silently discarded.

**Fix:** Use a relative SQL decrement:
```typescript
await tx.update(users)
  .set({
    pointsBalance: sql`GREATEST(points_balance - ${entry.totalPoints}, 0)`,
  })
  .where(eq(users.id, userId));
```

---

## BUG-03 [CRITICAL] Admin points adjust has TOCTOU race — `pointsBalanceAfter` logs stale value

**File:** `app/api/admin/points/adjust/route.ts` ~line 54–73

**Problem:**
```typescript
const currentBalance = targetUser.pointsBalance;  // read outside transaction
const newBalance = currentBalance + adjustedAmount;  // compute

await db.transaction(async (tx) => {
  await tx.update(users).set({ pointsBalance: sql`points_balance + ${adjustedAmount}` });
  await tx.insert(pointsHistory).values({
    pointsBalanceAfter: newBalance,  // ← stale: based on pre-transaction read
  });
});
```
If another operation changes the balance between the initial read and the transaction, `newBalance` will be wrong. The actual DB balance will be correct (relative increment), but the history record will have an incorrect `pointsBalanceAfter`.

**Fix:** Read the updated balance inside the transaction using `RETURNING`:
```typescript
await db.transaction(async (tx) => {
  const [updatedUser] = await tx
    .update(users)
    .set({ pointsBalance: sql`points_balance + ${adjustedAmount}` })
    .where(eq(users.id, targetUserId))
    .returning({ pointsBalance: users.pointsBalance });

  await tx.insert(pointsHistory).values({
    userId: targetUserId,
    type: 'adjust',
    pointsAmount: adjustedAmount,
    pointsBalanceAfter: updatedUser.pointsBalance,  // ← correct: from RETURNING
    note: reason,
    adminId: session.user.id,
  });
});
```

---

## BUG-04 [CRITICAL] Admin points deduction can make balance negative — no guard

**File:** `app/api/admin/points/adjust/route.ts` ~line 46, 59

**Problem:** When `adjustedAmount` is negative, `sql\`points_balance + ${adjustedAmount}\`` can set the balance below zero. There is no `GREATEST(..., 0)` guard and no server-side validation that `|adjustedAmount| <= currentBalance`.

**Fix:**
```typescript
// Add validation before the transaction:
if (adjustedAmount < 0 && Math.abs(adjustedAmount) > targetUser.pointsBalance) {
  return NextResponse.json(
    { error: `Tidak bisa mengurangi ${Math.abs(adjustedAmount)} poin. Saldo saat ini: ${targetUser.pointsBalance}` },
    { status: 400 }
  );
}

// And in the SQL as a safety net:
await tx.update(users).set({
  pointsBalance: sql`GREATEST(points_balance + ${adjustedAmount}, 0)`,
});
```

---

## BUG-05 [HIGH] Account vouchers page includes expired/exhausted coupons in "available" list

**File:** `app/api/account/vouchers/route.ts` ~line 24–37

**Problem:** The available coupons query filters by `isActive`, not-expired, and global `maxUses` not reached — but does NOT check `maxUsesPerUser` against this specific user's usage count. A coupon that allows each user to use it once, and this user has already used it, will still appear in their "available" coupons list.

**Fix:**
```typescript
// Fetch the user's usage counts per coupon in a single query:
const userUsages = await db
  .select({
    couponId: couponUsages.couponId,
    useCount: count(),
  })
  .from(couponUsages)
  .where(eq(couponUsages.userId, userId))
  .groupBy(couponUsages.couponId);

const userUsageMap = new Map(userUsages.map(u => [u.couponId, u.useCount]));

// Filter out coupons where user has hit their per-user limit:
const trulyAvailable = activeCoupons.filter(coupon => {
  if (!coupon.maxUsesPerUser) return true;
  return (userUsageMap.get(coupon.id) ?? 0) < coupon.maxUsesPerUser;
});
```

---

## BUG-06 [HIGH] Vouchers page has N+1 queries for used coupons

**File:** `app/api/account/vouchers/route.ts` ~line 39–58

**Problem:**
```typescript
// For each usage, fetches the coupon individually (N+1):
const usedCouponsWithDetails = await Promise.all(
  usedCouponsList.map(async (usage) => {
    const coupon = await db.query.coupons.findFirst({  // ← 1 query per coupon
      where: eq(coupons.id, usage.couponId),
    });
    return { ...usage, coupon };
  })
);
```
A user with 50 used coupons fires 50 sequential DB queries.

**Fix:**
```typescript
const couponIds = usedCouponsList.map(u => u.couponId);
const couponsData = await db.query.coupons.findMany({
  where: inArray(coupons.id, couponIds),  // ← 1 query
});
const couponsMap = new Map(couponsData.map(c => [c.id, c]));

const usedCouponsWithDetails = usedCouponsList.map(usage => ({
  ...usage,
  coupon: couponsMap.get(usage.couponId) ?? null,
}));
```

---

## BUG-07 [HIGH] `expiringPoints` calculated from paginated data — misses points expiring on page 2+

**File:** `app/api/account/points/route.ts` ~line 35–39

**Problem:**
```typescript
// history is already paginated (page 1, limit 20):
const expiringPoints = history
  .filter(h => h.type === 'earn' && h.expiresAt && isExpiringSoon(h.expiresAt))
  .reduce(...);
```
If the user's soon-to-expire earn record is not in the first 20 rows of their history, `expiringPoints` will be 0 even though points are about to expire. The "expiring soon" banner in the customer dashboard will never show.

**Fix:** Run a separate, unpaginated query for expiring points:
```typescript
const soonThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

const expiringEntries = await db.query.pointsHistory.findMany({
  where: and(
    eq(pointsHistory.userId, userId),
    eq(pointsHistory.type, 'earn'),
    isNull(pointsHistory.consumedAt),
    eq(pointsHistory.isExpired, false),
    lte(pointsHistory.expiresAt, soonThreshold),
    gte(pointsHistory.expiresAt, new Date()),
  ),
});

const expiringPoints = expiringEntries.reduce((sum, e) => sum + e.pointsAmount, 0);
const earliestExpiry = expiringEntries.reduce(
  (min, e) => (!min || e.expiresAt < min) ? e.expiresAt : min,
  null as Date | null
);
```

---

## BUG-08 [HIGH] FIFO earn record deduction `.limit(pointsUsed)` limits by row count, not by points total

**File:** `app/api/checkout/initiate/route.ts` ~line 443

**Problem:**
```typescript
const earnRecords = await tx.query.pointsHistory.findMany({
  where: ...,
  orderBy: [asc(pointsHistory.createdAt)],
  limit: pointsUsed,  // ← limits to N ROWS, not N points worth of earn records
});
```
`.limit(pointsUsed)` means "fetch at most 500 rows" not "fetch records covering 500 points". If a user has 500 separate earn records of 1 point each and tries to redeem 500 points, this works. But if the user has 3 earn records of 200, 200, and 300 points and tries to redeem 500, the limit of 500 would try to fetch 500 rows — way more than needed. Conversely if there are fewer matching rows, it correctly gets all of them.

**The real bug:** If a user has 2 earn records (1000 pts, 1000 pts) and wants to redeem 500 points, `limit: 500` fetches only 1 of the 500-item records (which has 1000 pts — more than enough). The loop should deduct 500 from this record. This works but is wasteful. The genuine failure case: `limit: 500` would fetch 500 ROWS — if there are only 2 rows, it fetches both (which is correct). So in practice this doesn't cause incorrect accounting, but it's dangerous and should be fixed.

**Fix:** Remove the `.limit()` and use a proper accumulating loop:
```typescript
const earnRecords = await tx.query.pointsHistory.findMany({
  where: and(
    eq(pointsHistory.userId, userId),
    eq(pointsHistory.type, 'earn'),
    isNull(pointsHistory.consumedAt),
    eq(pointsHistory.isExpired, false),
    gt(pointsHistory.pointsAmount, 0),
  ),
  orderBy: [asc(pointsHistory.expiresAt), asc(pointsHistory.createdAt)], // expire-first FIFO
  // No limit — we need to walk until total >= pointsToRedeem
});

let remaining = pointsToRedeem;
const toConsume: { id: string; amountUsed: number }[] = [];

for (const record of earnRecords) {
  if (remaining <= 0) break;
  const amountUsed = Math.min(remaining, record.pointsAmount);
  toConsume.push({ id: record.id, amountUsed });
  remaining -= amountUsed;
}

if (remaining > 0) {
  throw new Error('Insufficient points balance');
}
```

---

## BUG-09 [HIGH] B2B users earn 4× points — double-multiplied in webhook

**File:** `app/api/webhooks/midtrans/route.ts` ~(points award section)
**File:** `app/api/checkout/initiate/route.ts` ~(points calculation section)

**Problem:** `order.pointsEarned` is computed at initiate time with the B2B 2× multiplier applied. Then at settlement in the webhook, `pointsEarned` is multiplied by 2 again when awarding to the user — resulting in 4× for B2B users.

**Fix:** Points should only be multiplied once. Choose one approach:
- **Option A:** Compute final `pointsEarned` at initiate (2× for B2B, 1× for B2C), store in `orders.pointsEarned`. At settlement, award exactly `order.pointsEarned` with no additional multiplier.
- **Option B:** Store raw base points in `orders.pointsEarned` (without multiplier). At settlement, apply the multiplier based on user role.

Option A is cleaner. Verify in the webhook that it does NOT apply `B2B_POINTS_MULTIPLIER` again:
```typescript
// Webhook settlement — award exactly what was computed at initiate:
const pointsToAward = order.pointsEarned; // ← already includes B2B multiplier from initiate
// Do NOT multiply by B2B_POINTS_MULTIPLIER here
```

---

## BUG-10 [HIGH] Coupon `free_shipping` type has no server-side handler — client value is trusted

**File:** `app/api/checkout/initiate/route.ts` ~line 200–279
*(Cross-reference with PROD-AUDIT-01 BUG-10)*

**Problem:** `coupon.type === 'free_shipping'` is not handled in the initiate route's coupon type chain. The `discountAmount` defaults to the client-provided value, which is exploitable.

**Fix:** Add the handler (see PROD-AUDIT-01 BUG-10 for full code).

---

## Points expiry flow — full verification checklist

- [ ] `lib/points/expiry-check.ts` has NO `process.exit()` at module level (see PROD-AUDIT-02 BUG-01)
- [ ] `lib/points/expiry-check.ts` has NO hardcoded email exceptions
- [ ] `lib/points/expiry-check.ts` `totalValue` multiplied by `POINTS_VALUE_IDR` (see PROD-AUDIT-02 BUG-09)
- [ ] `/api/cron/expire-points` uses relative SQL decrement (not absolute set)
- [ ] `/api/cron/expire-points` does NOT re-expire already-consumed earn records (checks `isNull(consumedAt)`)
- [ ] `/api/cron/reconcile-points` SUM includes all records (no `isExpired` filter issue)
- [ ] `/api/cron/points-expiry-warning` calls `checkExpiringPoints()` and returns success
- [ ] Customer `/account/points` page shows expiring points from dedicated query (not paginated slice)
- [ ] Points history timeline is ordered correctly (newest first in display)
- [ ] Points balance shown on checkout page is real-time from DB, not stale

---

## Coupon/voucher system — full verification checklist

- [ ] Available coupons exclude those user has hit per-user limit on
- [ ] Used coupons loaded in single batched query (no N+1)
- [ ] `free_shipping` coupon type handled server-side
- [ ] `buy_x_get_y` coupon items set `price: 0` in Midtrans itemDetails (see PROD-AUDIT-01 BUG-01)
- [ ] Provisional `couponUsages` row inserted at checkout initiate to prevent concurrent bypass
- [ ] Coupon `usedCount` incremented at settlement
- [ ] Coupon `usedCount` decremented on cancellation (order cancel, expiry cancel, 3-retry cancel)
- [ ] `couponUsages` row deleted on cancellation
- [ ] Coupon validation at `/api/coupons/validate` and at `/api/checkout/initiate` use same logic
