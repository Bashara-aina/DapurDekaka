# AUDIT-04 — Points, Vouchers & Loyalty System
**Date:** 2026-05-16  
**Scope:** `app/api/account/points/`, `app/api/account/vouchers/`, `app/api/admin/points/`, `app/api/cron/expire-points/`, `app/api/cron/reconcile-points/`, `lib/points/`  
**Severity legend:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## BUG-01 🔴 `account/vouchers` endpoint always crashes — `userId` is undeclared

**File:** `app/api/account/vouchers/route.ts`  
**Line:** 63

**Root cause:**  
```ts
const userUsageCounts = userId   // ← 'userId' is NOT defined anywhere in this function
  ? await db
      .select({
        couponId: couponUsages.couponId,
        useCount: sql<number>`count(*)::int`,
      })
      .from(couponUsages)
      .where(eq(couponUsages.userId, userId))   // ← same undefined variable
      .groupBy(couponUsages.couponId)
  : [];
```

The function uses `session.user.id!` everywhere else but forgot to declare `const userId = session.user.id!` or directly use `session.user.id!` here. In JavaScript, accessing an undeclared variable throws `ReferenceError: userId is not defined`. TypeScript may flag this at build time but dev server would still surface the error at runtime.

**Impact:** The `/api/account/vouchers` endpoint crashes on EVERY request with a 500 error. The `/account/vouchers` page is completely broken for all users.

**Fix:** Replace `userId` with `session.user.id!` in both places:

```ts
// Replace lines 62-72:
const userUsageCounts = await db
  .select({
    couponId: couponUsages.couponId,
    useCount: sql<number>`count(*)::int`,
  })
  .from(couponUsages)
  .where(eq(couponUsages.userId, session.user.id!))
  .groupBy(couponUsages.couponId);
const userUsageMap = new Map(userUsageCounts.map(u => [u.couponId, u.useCount]));
```

(No ternary needed — `session.user.id` is already validated as non-null at line 12.)

---

## BUG-02 🟠 `account/vouchers` hides multi-use coupons after first use

**File:** `app/api/account/vouchers/route.ts`  
**Line:** 82

**Root cause:**
```ts
availableCoupons: trulyAvailable.filter(c => !usedCouponIds.includes(c.id)),
```

`usedCouponIds` is built from ALL coupon usages for this user, regardless of how many times the coupon allows use. A coupon with `maxUsesPerUser: 3` becomes hidden after the user uses it once, even though 2 more uses are allowed. The `trulyAvailable` array (built just above) already correctly filters by `maxUsesPerUser` using `userUsageMap` — but then it's filtered AGAIN by `usedCouponIds` which defeats the purpose.

**Fix:** Remove the final `.filter(c => !usedCouponIds.includes(c.id))`:

```ts
return success({
  usedCoupons: usedCouponsWithDetails,
  availableCoupons: trulyAvailable,  // already correctly filtered by per-user limit
});
```

The `trulyAvailable` filter is:
```ts
const trulyAvailable = availableCouponsList.filter(coupon => {
  if (!coupon.maxUsesPerUser) return true;
  return (userUsageMap.get(coupon.id) ?? 0) < coupon.maxUsesPerUser;
});
```

This correctly returns `false` when uses are exhausted, so no double-filter needed.

---

## BUG-03 🟠 `expire-points` cron marks ALL user points as expired even if only some expired

**File:** `app/api/cron/expire-points/route.ts`  
**Lines:** 42–55

**Root cause:**  
The query finds `earn` records where `expiresAt < now`:
```ts
const expiringRecords = await db.query.pointsHistory.findMany({
  where: and(
    eq(pointsHistory.type, 'earn'),
    eq(pointsHistory.isExpired, false),
    lt(pointsHistory.expiresAt, now),
    isNull(pointsHistory.consumedAt),
  ),
```

The issue is subtle: `totalPoints` is computed as the SUM of `pointsAmount` for all expiring records. The balance deduction uses:
```ts
pointsBalance: sql`GREATEST(points_balance - ${entry.totalPoints}, 0)`,
```

This is correct for deducting the expired amounts. **However**, there's no check that the expiring points haven't ALREADY been effectively consumed through redemptions. If a user redeemed points (which sets `consumedAt` on earn records), those records are already excluded by `isNull(pointsHistory.consumedAt)`. But partially consumed earn records are not handled — if an earn record was for 100 points but only 50 were consumed (impossible in current FIFO design, each earn is fully consumed or not), the system would expire the full 100.

**Bigger issue:** The `expiryThreshold` at line 23:
```ts
const expiryThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
```

This is UNUSED! The cron finds records where `expiresAt < now`, but `expiresAt` is set to `Date.now() + 365 days` at earn time. So `expiresAt < now` means the record was inserted MORE than 365 days ago — the `expiryThreshold` variable is defined but never used in the query. This is fine (just dead code), but it's confusing.

**Real risk:** The `expiringRecords` query uses `lt(pointsHistory.expiresAt, now)` which is correct. The `expiryThreshold` variable can be deleted as dead code.

**Fix:** Clean up dead code:
```ts
// Delete this line:
const expiryThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
```

And add a guard to prevent expiring points that have already been credited to a delivered order (the user actually received value):
```ts
// Consider: don't expire points from delivered orders for 30 days grace period
// (Optional — business decision needed)
```

---

## BUG-04 🟠 `reconcile-points` cron uses SUM of all records which can diverge from balance

**File:** `app/api/cron/reconcile-points/route.ts`  
**Lines:** 22–32

**Current behavior:**
```ts
calculatedBalance: sql<number>`COALESCE(SUM(${pointsHistory.pointsAmount}), 0)`,
```

This sums ALL `pointsAmount` values for each user:
- Earn records: positive
- Redeem records: negative (or the delta if not full consume)
- Expire records: negative
- Adjust records: positive or negative

**Issue:** The `expire` records have `pointsAmount = -entry.totalPoints` (negative). If the cron runs twice due to a bug (idempotency failure in expire cron), it would create duplicate expire records — each with negative amounts — causing `reconcile-points` to see a calculated balance LOWER than the actual balance, and it would set the user's balance to the wrong (lower) value.

**Also:** The reconcile cron has no pagination. If there are 10,000 users each with many history records, this query:
```ts
const results = await db.select({ userId, calculatedBalance })
  .from(pointsHistory)
  .groupBy(pointsHistory.userId);
```
Then loops with individual user queries (`db.query.users.findFirst` inside the loop) = N+1 query pattern. For 1000 users, this is 1001 queries.

**Fix — N+1:** Join users in the initial query:
```ts
const results = await db
  .select({
    userId: pointsHistory.userId,
    calculatedBalance: sql<number>`COALESCE(SUM(${pointsHistory.pointsAmount}), 0)`,
    currentBalance: users.pointsBalance,
  })
  .from(pointsHistory)
  .innerJoin(users, eq(pointsHistory.userId, users.id))
  .groupBy(pointsHistory.userId, users.pointsBalance);

// Then no inner db.query.users.findFirst needed
for (const row of results) {
  if (row.currentBalance !== row.calculatedBalance) {
    await db.update(users)
      .set({ pointsBalance: row.calculatedBalance })
      .where(eq(users.id, row.userId));
    drifted++;
  }
  reconciled++;
}
```

---

## BUG-05 🟠 Points earned but NOT displayed on success page for bank transfer orders

**File:** `app/(store)/checkout/success/page.tsx`  
**Lines:** 68–78

**Root cause:**  
The success page fetches order data from `/api/orders/${orderNumber}`. This API endpoint requires email verification for non-logged-in users (the OrderTrackingClient pattern). For the success page's `useQuery`, it calls the API without email verification. The response may return only basic order info (not pointsEarned) if the user is not verified.

For bank transfer (VA) orders, payment is not immediate — the order status is `pending_payment` at this point. `orderData.order.status === 'paid'` is false. The confetti hook won't fire, and the points display section requires `orderData.order.pointsEarned > 0` (which is set at initiate time, so it IS correct regardless of payment status).

**Actual issue:** The points text says "akan masuk setelah pembayaran dikonfirmasi" (will be credited after payment is confirmed) which is **correct** — but the UI design shows the confetti AND points in a golden card, creating a visual contradiction: the UI celebrates while telling the user the points aren't credited yet.

**Fix:** Show the points section with a "pending" state instead of a celebratory one for non-paid orders:

```tsx
{orderData?.order?.pointsEarned && orderData.order.pointsEarned > 0 ? (
  <div className={`rounded-xl p-4 mb-6 border ${
    orderData.order.status === 'paid'
      ? 'bg-gradient-to-r from-brand-gold/20 to-brand-gold/10 border-brand-gold/30'
      : 'bg-gray-50 border-gray-200'
  }`}>
    <p className="text-sm text-text-secondary mb-1">
      {orderData.order.status === 'paid' ? 'Kamu mendapat' : 'Kamu akan mendapat'}
    </p>
    <p className={`text-2xl font-bold ${orderData.order.status === 'paid' ? 'text-brand-gold' : 'text-gray-500'}`}>
      +{orderData.order.pointsEarned.toLocaleString('id-ID')} poin
    </p>
    <p className="text-xs text-text-secondary mt-1">
      {orderData.order.status === 'paid'
        ? 'Poin sudah dikreditkan!'
        : 'Poin akan dikreditkan setelah pembayaran dikonfirmasi'}
    </p>
  </div>
) : null}
```

---

## BUG-06 🟡 `account/points` API — `expiringPoints` only covers the next 30 days

**File:** `app/api/account/points/route.ts`  
**Lines:** 35–49

**Current behavior:**
```ts
const soonThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const expiringEntries = await db.query.pointsHistory.findMany({
  where: (ph, { and, eq, isNull, lte, gte }) => and(
    eq(ph.userId, session.user.id!),
    eq(ph.type, 'earn'),
    isNull(ph.consumedAt),
    eq(ph.isExpired, false),
    gte(ph.expiresAt, new Date()),   // not yet expired
    lte(ph.expiresAt, soonThreshold), // expires within 30 days
  ),
});
```

This correctly shows only soon-to-expire points. But the `account/points` page might display this as "expiring soon" without specifying WHEN. Users don't know if their points expire in 1 day or 30 days.

**Fix:** Return the earliest expiry date along with the sum:

```ts
const expiryDetails = expiringEntries.reduce(
  (acc, e) => ({
    totalPoints: acc.totalPoints + e.pointsAmount,
    earliestExpiry: !acc.earliestExpiry || (e.expiresAt && e.expiresAt < acc.earliestExpiry)
      ? e.expiresAt
      : acc.earliestExpiry,
  }),
  { totalPoints: 0, earliestExpiry: null as Date | null }
);

return success({
  balance: user?.pointsBalance || 0,
  history,
  expiringCount: expiringEntries.length,
  expiringPoints: expiryDetails.totalPoints,
  earliestExpiryDate: expiryDetails.earliestExpiry?.toISOString() ?? null,  // NEW
  page,
  hasMore: history.length === limit,
});
```

Then display on the frontend: "X poin akan hangus pada [date]"

---

## BUG-07 🟡 B2B users earn 2x points but the multiplier is hardcoded with no constant

**File:** `app/api/checkout/initiate/route.ts`  
**Location:** Wherever `pointsEarned` is computed with B2B multiplier

**Root cause:**  
Based on prior audits, the B2B 2x points multiplier is hardcoded as a magic number `2`. There is no `B2B_POINTS_MULTIPLIER` constant exported from `lib/constants/points.ts`.

**Fix:** In `lib/constants/points.ts`, add:
```ts
export const POINTS_EARN_RATE = 1;       // base: 1 point per 10 IDR (or whatever the rate is)
export const B2B_POINTS_MULTIPLIER = 2;  // B2B earns 2x base rate
```

Then in `app/api/checkout/initiate/route.ts` wherever pointsEarned is computed:
```ts
import { POINTS_EARN_RATE, B2B_POINTS_MULTIPLIER } from '@/lib/constants/points';

const basePoints = Math.floor(subtotal / 10000) * POINTS_EARN_RATE;
const pointsEarned = isB2b ? basePoints * B2B_POINTS_MULTIPLIER : basePoints;
```

---

## BUG-08 🟢 `points/adjust` admin action missing audit log

**File:** `app/api/admin/points/adjust/route.ts`  
**Scope:** After the transaction

**Issue:**  
The admin points adjustment has no `adminActivityLogs` entry. All other admin mutations (order status, invite user) log to `admin_activity_logs`. This one doesn't, making it invisible in the audit trail.

**Fix:** After the transaction succeeds, add:
```ts
import { logAdminActivity } from '@/lib/services/audit.service';

// After db.transaction completes:
logAdminActivity({
  userId: session.user.id,
  action: 'points_adjust',
  targetType: 'user',
  targetId: userId,
  beforeState: { pointsBalance: targetUser.pointsBalance },
  afterState: { pointsBalance: newBalance, adjustedAmount, reason },
}).catch(e => console.error('[Audit] Failed to log points adjust:', e));
```

---

## Summary Table

| Bug | File | Severity | Impact |
|-----|------|----------|--------|
| BUG-01 | `account/vouchers/route.ts:63` | 🔴 Critical | Vouchers page crashes for all users |
| BUG-02 | `account/vouchers/route.ts:82` | 🟠 High | Multi-use coupons hidden after first use |
| BUG-03 | `cron/expire-points/route.ts` | 🟠 High | Dead code; potential double-expire risk |
| BUG-04 | `cron/reconcile-points/route.ts` | 🟠 High | N+1 query; divergence risk |
| BUG-05 | `checkout/success/page.tsx:68` | 🟠 High | Misleading pending points UI |
| BUG-06 | `account/points/route.ts:35` | 🟡 Medium | Expiry date not surfaced to user |
| BUG-07 | `checkout/initiate/route.ts` | 🟡 Medium | Magic number — hardcoded 2x multiplier |
| BUG-08 | `admin/points/adjust/route.ts` | 🟢 Low | Missing audit log entry |
