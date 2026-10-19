# 03 — Points, Coupons & Loyalty

**Audit date:** 2026-10-19 · **Commit:** `d646f56`
**Scope:** points redemption in `checkout/initiate`, award in `lib/finance/settle-order.ts`, all cancellation paths, `cron/reconcile-points`, `cron/expire-points`, `admin/points/adjust`, `lib/finance/complete-refund.ts`, coupon validation.

## The ledger model (as implemented)

- `users.points_balance` = cached balance.
- `points_history` = ledger: `earn` (+, with `expires_at`, `consumed_at`), `redeem` (−, `referenced_earn_id`), `expire` (−), `adjust` (±).
- **Nightly `cron/reconcile-points` overwrites `points_balance` with `SUM(points_history.points_amount)`** (`reconcile-points/route.ts:24-41`).

That last rule makes the ledger the source of truth — so **every balance change must have a matching ledger row**. Several paths break that.

---

## CRITICAL

### P1 — Points refunded on cancellation are silently taken back the next night
These paths add `pointsUsed` back to `users.points_balance` and un-consume the earn rows, but **write no ledger row and leave the `redeem` rows in place**:

| Path | File |
|---|---|
| Midtrans `cancel/deny/expire` webhook | `app/api/webhooks/midtrans/route.ts:351-378` |
| Auto-cancel unpaid after expiry | `app/api/cron/cancel-expired-orders/route.ts:94-118` |
| Reconcile cron cancel | `app/api/cron/reconcile-payments/route.ts:164-185` |
| Retry limit (3) auto-cancel | `app/api/checkout/retry/route.ts:111-133` |

(Only the admin cancel in `admin/orders/[id]/status/route.ts:258-270` writes an `adjust` row — correctly.)

**Scenario:** customer has 500 pts, redeems 300 at checkout, abandons payment. 30 min later cron cancels → balance back to 500 ✅. At 03:00 reconcile-points computes `+500 −300 = 200` → **balance overwritten to 200**. The customer lost 300 points for not paying. Because un-consumed earn rows are now redeemable again *and* the redeem rows still exist, the ledger and FIFO state also disagree permanently.

This happens on the most common path of all (abandoned Snap popup). **Fix:** extract one `reverseRedeemedPointsTx(tx, order)` used by all five paths that (1) un-consumes earn rows, (2) inserts an `adjust` row `+pointsUsed` with `orderId`, (3) updates the balance. Add a test asserting `balance == SUM(ledger)` after each cancel path.

### P2 — FIFO marks whole earn rows consumed → leftover points become unredeemable
`initiate/route.ts:759-799` computes `amountUsed = min(record.pointsAmount, remaining)` but then sets `consumed_at` on **every** touched row, including the last one that was only partially used. Nothing tracks the remainder.

**Scenario:** user earns 150 pts (one row). Redeems 100 → row marked consumed; balance shows 50. Earns 80 more (new row). Tries to redeem 100 → FIFO only finds the 80-pt row → `remaining > 0` → **"Poin tidak mencukupi"** although the balance shows 130. The 50 leftover also never expires (expire cron skips consumed rows) — so the balance and what's usable diverge forever.

**Fix (simplest):** add `points_remaining` to earn rows (initialised = `points_amount`); FIFO decrements it and only sets `consumed_at` when it hits 0; expire cron expires `points_remaining`. Backfill: `points_remaining = points_amount` for unconsumed rows.

---

## HIGH

| # | Issue | Evidence | Fix |
|---|---|---|---|
| P3 | **B2B multiplier contradicts the financial rule.** Comment says "L2 Rule 10: B2B customers earn the same rate as retail (no 2x)", but `B2B_POINTS_MULTIPLIER = 2` (`lib/constants/points.ts:30`) and settings contain `b2b_points_multiplier`; `calculatePointsEarned` applies it. | `initiate/route.ts:688`, `points-calculator.ts:38-41` | Decide. If rule stands, set setting/constant to 1 and delete the multiplier branch |
| P4 | Earned points not reversed if already spent: admin cancel only claws back when `!earnRecord.consumedAt` | `status/route.ts:277` | Claw back from balance (allow going to 0) and log the shortfall |
| P5 | Double clawback: admin cancel reversal + refund completion clawback both run | `complete-refund.ts:43-55` | Check for existing reversal `adjust` row for the order |
| P6 | Points runtime settings exist (`points_min_redeem`, `points_max_redeem_pct`, `points_per_idr`) but initiate hard-codes `100`, `50%`, `×10` | `initiate/route.ts:385-401` | Read via `getPointsRuntimeRules()` — or delete the unused settings so admins aren't misled |
| P7 | Expire cron runs all users in one transaction and reads back balance per user; one bad row aborts the whole night | `expire-points/route.ts:23` | Per-user transactions |
| P8 | `pointsBalanceAfter` on bulk redeem rows is the same number for every row | `initiate/route.ts:879` | Cosmetic — compute running balance |

---

## Coupons

| # | Sev | Issue | Fix |
|---|---|---|---|
| K1 | CRIT | Client `discountAmount` trusted when no coupon (see file 02 C1) | Server-only discount |
| K2 | HIGH | `startsAt` not checked at initiate | Add check |
| K3 | HIGH | `maxUses` race (stale read; incremented only at settlement) | Atomic conditional increment |
| K4 | MED | Admin cancel of unpaid order decrements `used_count` and keeps the provisional `couponUsages` row | Only decrement if paid; always delete row |
| K5 | MED | `buy_x_get_y`: free variant stock checked as `> 0` without counting cart qty of the same variant; free item weight not added to the shipping quote | Check `stock >= cartQty + freeQty`; include in shipping items |
| K6 | MED | `buy_x_get_y` qualifies on **any** product with qty ≥ X and gives the cheapest variants of that product, ignoring which products the coupon is meant for | Add `applicable_product_ids` to coupons |
| K7 | LOW | Two validate endpoints (`/api/checkout/validate-coupon`, `/api/coupons/validate`) with separate logic | Keep one; share a `validateCoupon()` with initiate |
| K8 | LOW | `free_shipping` coupons are blocked at initiate ("aturan L2") but can still be created in admin | Hide the type in the coupon form while the rule stands |

---

## Customer-facing loyalty UX

- `/account/vouchers` is behind the `vouchersPage` flag (off) — fine, but the account nav/BottomNav should not link to it while off (verify).
- Show "poin akan hangus" dates on `/account/points` (data exists: `expires_at`).
- Explain at checkout *why* points are capped (50% after coupon) — currently only a 422 message.
- Success page: show points **pending** (awarded at settlement), not a number that may differ.

## Verification query (run after fixes, should return 0 rows)

```sql
select u.id, u.points_balance, coalesce(sum(h.points_amount),0) ledger
from users u left join points_history h on h.user_id = u.id
group by u.id having u.points_balance <> coalesce(sum(h.points_amount),0);
```
