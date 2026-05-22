# FRESH AUDIT 03 — Points, Loyalty, Vouchers & Cron Jobs
> Deep code-level audit — May 2026. Use this file directly in Cursor.
> Every bug references the exact file + the specific code that is wrong.

---

## BUG-01 — B2B users earn 4× points on settlement (webhook doubles already-doubled amount)
**File:** `app/api/webhooks/midtrans/route.ts`  
**Severity:** CRITICAL — B2B users accrue 4× points on every paid order indefinitely

**What's wrong:**  
`checkout/initiate/route.ts` computes `pointsEarned` with the B2B multiplier already applied:
```ts
const multiplier = isB2b ? 2 : 1;
const pointsEarned = Math.floor((subtotal / 1000) * multiplier);
// → stored in orders.pointsEarned
```

Then in the Midtrans webhook `settlement` handler, the code reads `order.pointsEarned` (which is already 2×) and multiplies AGAIN:
```ts
const multiplier = order.isB2b ? 2 : 1;
const earned = order.pointsEarned * multiplier;  // ← BUG: double multiplication
```

B2B result: `(subtotal/1000 * 2) * 2 = 4× points`

**Fix:**  
In `app/api/webhooks/midtrans/route.ts`, in the settlement branch, remove the multiplier:
```ts
// CORRECT: pointsEarned already has the multiplier from initiate
const earned = order.pointsEarned ?? 0;
await tx.update(users).set({ pointsBalance: sql`points_balance + ${earned}` })...
```

Grep for `isB2b` in `webhooks/midtrans/route.ts` to find the exact line.

---

## BUG-02 — reconcile-points cron: SUM of ALL pointsHistory records overestimates balance
**File:** `app/api/cron/reconcile-points/route.ts`  
**Severity:** HIGH — daily balance reconciliation inflates points balances

**What's wrong:**  
The reconcile cron calculates `calculatedBalance` as:
```ts
calculatedBalance: sql<number>`COALESCE(SUM(${pointsHistory.pointsAmount}), 0)`
```

This sums ALL history rows for a user — including expired entries that were already deducted. The `expire-points` cron correctly writes a negative `expire` record to reduce balance. But if there are any orphaned, duplicate, or incorrectly-signed rows, the SUM can drift.

More importantly: the SUM approach can produce a different number than `users.pointsBalance` legitimately (e.g., if a partial batch failed mid-transaction). Blindly overwriting `pointsBalance` with the SUM result on every run could permanently damage balances.

**What's actually happening:**  
The cron computes sum and compares to current balance. If they differ, it updates. This is intended. BUT the SUM includes `type = 'redeem'` rows that might have `orderId = null` (see Audit-01 BUG-02). These redemptions that were never reversed create a permanent negative phantom.

**Fix:**  
1. First fix Audit-01 BUG-02 (redeem records get orderId at insert time).
2. Add a sanity check: never let `calculatedBalance` go below 0:
```ts
const safeBalance = Math.max(0, row.calculatedBalance);
if (row.currentBalance !== safeBalance) {
  await db.update(users).set({ pointsBalance: safeBalance }).where(eq(users.id, row.userId));
}
```
3. Log all corrections with `logger.warn` so you can audit them.

---

## BUG-03 — expire-points cron: writes `pointsAmount: -entry.totalPoints` but `totalPoints` already sums positive `earn` amounts
**File:** `app/api/cron/expire-points/route.ts`  
**Severity:** MEDIUM — the expiry history record is correct but verify sign convention

**What's happening:**  
When expiring points, the cron:
1. Finds all `earn` records past `expiresAt`  
2. Sums them into `entry.totalPoints` (positive sum of positive `pointsAmount` values)  
3. Deducts from balance: `GREATEST(points_balance - ${entry.totalPoints}, 0)` ✓
4. Inserts history: `pointsAmount: -entry.totalPoints` ✓

This is CORRECT — the negative sign on the expire history record is intentional.

**However**, the `reconcile-points` cron sums ALL history including the `expire` records. So the SUM already accounts for expirations. No double-deduct happens. The logic is sound.

**Action:** No fix needed here. Document this so future developers don't "fix" it incorrectly.

---

## BUG-04 — Points expiry warning cron: uses POST method but is registered as a Vercel cron GET
**File:** `app/api/cron/points-expiry-warning/route.ts`  
**Severity:** HIGH — cron job silently never runs

**What's wrong:**  
The file exports `async function POST(req: NextRequest)` but Vercel Cron Jobs call routes via **GET** by default. Check `vercel.json` — if the cron path for `points-expiry-warning` uses GET, this handler will return 405 Method Not Allowed on every scheduled run.

**Fix:**  
Change the export to GET (consistent with all other cron routes):
```ts
// CHANGE:
export async function POST(req: NextRequest) {

// TO:
export async function GET(req: NextRequest) {
```

Verify `vercel.json` cron configuration:
```json
{
  "path": "/api/cron/points-expiry-warning",
  "schedule": "0 2 * * *"
}
```
Vercel calls GET by default. If you want POST, you need `"method": "POST"` in vercel.json. Simpler to just change the handler to GET.

---

## BUG-05 — Account points page: `expiringCount` shows count of individual RECORDS, not total points expiring
**File:** `app/(store)/account/points/page.tsx`  
**File:** `app/api/account/points/route.ts`  
**Severity:** MEDIUM — UX misleads user about how many points are expiring

**What's wrong:**  
The API returns:
```ts
expiringCount: expiringEntries.length,  // count of earn RECORDS
expiringPoints: expiryDetails.totalPoints,  // sum of points amounts
```

The page displays:
```tsx
{data.expiringCount} poin kamu akan kedaluwarsa dalam 30 hari ke depan.
```
This says "3 poin akan kedaluwarsa" when it means "3 records (possibly hundreds of points total) will expire." A user with 3 separate earn records expiring might have 300 points expiring, but sees "3 poin".

**Fix:**  
The API already returns `expiringPoints` (the correct total). Use it in the UI:
```tsx
// In account/points/page.tsx, change:
{data.expiringCount} poin kamu akan kedaluwarsa

// To:
{data.expiringPoints?.toLocaleString('id-ID')} poin kamu akan kedaluwarsa
```

---

## BUG-06 — Vouchers page: `isPublic` coupons shown but private/targeted coupons never surfaced to user
**File:** `app/api/account/vouchers/route.ts`  
**Severity:** MEDIUM — incomplete feature; B2B-targeted or user-targeted coupons invisible

**What's wrong:**  
The vouchers API only fetches coupons where `isPublic = true`. Any coupon created specifically for a user (private coupon distributed via email) is never shown on the vouchers page.

There is currently no mechanism to associate a coupon with a specific user at creation time. The `coupons` table has no `targetUserId` column.

**Fix options:**  
Option A (quick): No fix — this is intentional for now, all coupons are public.  
Option B (complete): Add a `targetUserId` (nullable) column to the `coupons` table and include those in the vouchers query:
```ts
where: (c, { and, eq, or, isNull, gte, sql }) => and(
  eq(c.isActive, true),
  or(
    and(eq(c.isPublic, true), isNull(c.targetUserId)),
    eq(c.targetUserId, session.user.id)
  ),
  or(isNull(c.expiresAt), gte(c.expiresAt, now))
)
```

---

## BUG-07 — Points history page: `isLoading` never resets to `false` after page change
**File:** `app/(store)/account/points/page.tsx`  
**Severity:** LOW — "Load More" button stays in loading state after new items arrive

**What's wrong:**  
`fetchPoints` sets `setIsLoading(false)` in the `finally` block. But the initial `isLoading = true` is set at component mount. When user clicks "Tampilkan Lebih Banyak" and increments `page`, the `useEffect` runs `fetchPoints(page)` but `isLoading` is already `false` from the previous call. The `finally` block sets it to false again (no-op).

The `disabled={isLoading}` on the "Load More" button works because `isLoading` is briefly `true` during the fetch. But the `isLoading` state is also used as a page-level loading gate: `if (isLoading) return <skeleton>`. On `page > 1`, this causes the full skeleton to flash before new items append.

**Fix:**  
Split into two states:
```ts
const [isInitialLoading, setIsInitialLoading] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
```
Use `isInitialLoading` for the full-page skeleton and `isLoadingMore` for the button disabled state.

---

## BUG-08 — Admin points adjust: response returns `newBalance` from the RETURNING clause but before reconcile-points may have drifted
**File:** `app/api/admin/points/adjust/route.ts`  
**Severity:** INFO — no active bug, but worth noting

**What's happening:**  
The adjust endpoint uses `GREATEST(points_balance + ${adjustedAmount}, 0)` and reads back the new balance via `.returning()`. This is correct and atomic.

**No fix needed** — this is properly implemented.

---

## BUG-09 — Coupons admin list: `buy_x_get_y` coupon with no `discountValue` shows empty discount column
**File:** `app/(admin)/admin/coupons/page.tsx`  
**Severity:** LOW — cosmetic, admin sees blank discount cell for BXGY coupons

**What's wrong:**  
```tsx
{coupon.type === 'buy_x_get_y' ? `Beli ${coupon.buyQuantity} Get ${coupon.getQuantity}` : ''}
```
This renders correctly for BXGY type. But the logic is evaluated with a trailing ternary `? '' : ''` — actually reading the code more carefully:

```tsx
{coupon.type === 'percentage' && coupon.discountValue ? `${coupon.discountValue}%` : ''}
{coupon.type === 'fixed' && coupon.discountValue ? formatIDR(coupon.discountValue) : ''}
{coupon.type === 'free_shipping' ? 'Free Ship' : ''}
{coupon.type === 'buy_x_get_y' ? `Beli ${coupon.buyQuantity} Get ${coupon.getQuantity}` : ''}
```

These are four separate expressions that each render independently. For BXGY: the first three render `''` and the fourth renders the BXGY string. This is fine but renders whitespace for the other three. Use a helper function or switch instead.

**Fix:**  
Replace with a switch function for clarity:
```tsx
{(() => {
  switch (coupon.type) {
    case 'percentage': return coupon.discountValue ? `${coupon.discountValue}%` : '-';
    case 'fixed': return coupon.discountValue ? formatIDR(coupon.discountValue) : '-';
    case 'free_shipping': return 'Free Ongkir';
    case 'buy_x_get_y': return `Beli ${coupon.buyQuantity ?? '?'} Get ${coupon.getQuantity ?? '?'}`;
    default: return '-';
  }
})()}
```

---

## BUG-10 — Coupon `startsAt` field: coupons with future start date ARE shown as "Aktif" if `isActive = true`
**File:** `app/(admin)/admin/coupons/page.tsx`  
**Severity:** MEDIUM — admin sees scheduled coupons as "Aktif" instead of "Scheduled"

**What's wrong:**  
```tsx
const isNotStarted = coupon.startsAt && new Date(coupon.startsAt) > new Date();
...
{!coupon.isActive ? 'Nonaktif' : isExpired ? 'Expired' : isNotStarted ? 'Scheduled' : isMaxed ? 'Maxed' : 'Aktif'}
```

This is correct logic for the badge. But the coupon validate API in `app/api/coupons/validate/route.ts` correctly rejects coupons that haven't started yet via:
```ts
or(isNull(coupons.startsAt), lte(coupons.startsAt, new Date())),
```

So the status badge is correct. No fix needed.

**However** — the vouchers API (`/api/account/vouchers/route.ts`) does NOT check `startsAt` when listing available coupons for users. A scheduled coupon that hasn't started yet will appear as available to users, and if they try to use it at checkout, it will be rejected.

**Fix in vouchers API:**
```ts
// Add to the where clause in availableCouponsList query:
or(
  isNull(c.startsAt),
  lte(c.startsAt, now)
)
```
