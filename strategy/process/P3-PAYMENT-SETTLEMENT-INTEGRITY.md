# P3 — PAYMENT → SETTLEMENT INTEGRITY

> Layer owner: PROCESS. Scope: `POST /api/checkout/initiate` (commit half) → Midtrans Snap → `POST /api/webhooks/midtrans` → stock/coupon/points/email → success|pending|failed pages.
> Ground truth: `app/api/checkout/initiate/route.ts`, `app/api/checkout/retry/route.ts`, `app/api/webhooks/midtrans/route.ts`, `app/api/cron/cancel-expired-orders/route.ts`, `app/api/cron/reconcile-payments/route.ts`, `lib/midtrans/create-transaction.ts`, `lib/finance/points-calculator.ts`. Date: 2026-07-19.
> Depends on: P2 (validated order), L2 (10 money rules). Feeds: P4.
> Non-goals: courier booking, tracking (P4); refund execution (P5).

## Executive summary

- **The codebase disagrees with itself about when stock is deducted.** The constitutional rule (deduct ONLY at settlement) is implemented in the webhook (`webhooks/midtrans/route.ts:154-176`), but three cancellation paths **restore stock that was never deducted** (webhook cancel branch `:366-385`, `cron/cancel-expired-orders/route.ts:94-112`, `checkout/retry/route.ts:71-91`), and the reconcile cron **skips deduction on recovered settlements** claiming "stock was already deducted at initiate" (`cron/reconcile-payments/route.ts:89-107` — false). Net effect: every abandoned checkout inflates inventory; every reconcile-recovered payment ships phantom stock. This is the single biggest money-integrity defect in the system.
- **The Midtrans signature scheme is probably wrong for production.** The webhook demands an `x-midtrans-signature` header equal to `sha512(serverKey + rawBody)` (`webhooks/midtrans/route.ts:37-53`). Midtrans HTTP notifications carry `signature_key = sha512(order_id + status_code + gross_amount + serverKey)` **in the body** and send no such header. If unverified, **every real webhook 401s** and the entire money path silently degrades to the reconcile cron — which has the stock bug above. Must be proven in sandbox before any other P3 work matters.
- **Settlement is not concurrency-safe:** the `paid` update has no `WHERE status='pending_payment'` guard (`webhooks/midtrans/route.ts:136-152`); two near-simultaneous settlement webhooks that both pass the pre-transaction idempotency reads can double-deduct stock and double-award points. Reconcile already has the conditional-update fix (BUG-11, `reconcile-payments/route.ts:76-87`); the webhook does not.
- **Internal 15-minute expiry vs Midtrans reality guarantees expire-then-pay incidents:** VA transfers legitimately settle "hours/days later" (acknowledged at `webhooks/midtrans/route.ts:65-67`), but `cancel-expired-orders` cancels at 15 min (cron every 15 min). A customer who pays a VA at minute 40 hits the "settlement for cancelled order" branch — which only logs a warning and returns 200 (`:96-105`). Money arrives, nobody is alerted, no refund row is created.
- **Oversell-at-settlement strands a paying customer with no alarm:** two buyers pass initiate's stock check, both pay; the second settlement throws (`Settlement failed: insufficient stock`, `:164-166`) → 500 → Midtrans retries forever → order stuck `pending_payment` while cancel-expired skips it (Midtrans says settlement). The only signal is `pendingOrdersOver1h` on the ops card — and `webhookErrorCount24h` is decorative because **nothing ever writes to `webhook_events`** (only `app/api/admin/ops/route.ts` reads it).

## Core question

From the moment money can move, does every peso — stock unit, coupon count, and loyalty point — end in exactly one consistent ledger state, with Bashara alerted within minutes when it doesn't?

## Happy-path swimlane

```mermaid
sequenceDiagram
  participant C as Customer
  participant I as /api/checkout/initiate
  participant M as Midtrans Snap
  participant W as /api/webhooks/midtrans
  participant DB as Neon (orders/stock/points)
  C->>I: pay tap (validated payload)
  I->>DB: TX: counter → order(pending_payment) + items snapshot + points FIFO deduct + provisional couponUsage
  I->>M: create Snap (order_id = DDK-...-retry-N scheme, gross = totalAmount)
  M-->>I: snapToken
  I-->>C: snapToken (Snap popup opens; 15-min internal expiry)
  C->>M: pays (QRIS/VA/card)
  M->>W: settlement notification
  W->>W: verify signature + gross_amount == totalAmount
  W->>DB: TX: status=paid, stock GREATEST deduct + inventory_logs, coupon used_count (guarded), points earn (recomputed net-of-discount)
  W-->>M: 200
  W-->>C: async email (OrderConfirmation / PickupReady) + WA (pickup)
  C->>C: lands on /checkout/success
```

## Depth analysis table

| Depth | Current state | Break mode | Customer impact | Solo-ops impact | Recommendation |
|-------|---------------|-----------|-----------------|-----------------|----------------|
| D1 Surface | success/pending/failed pages exist; pending shows VA via `/api/orders/[orderNumber]` minimal payload | webhook dead (signature) → success page but order forever "pending" | paid, no confirmation email, no packing | WA storm | Fix signature verification first; success page should poll order status, show "pembayaran diterima" only on `paid` |
| D2 Operational | Idempotency: txn-id check, paid+settlement check, cancelled+cancel check | concurrent settlements race (no conditional update) | double stock deduct, double points | ledger repair by hand | Conditional `WHERE status='pending_payment'` + treat 0-rows as already-processed |
| D3 Financial / Inventory | Stock: deduct at settlement ✅; restore on cancel ❌ (never deducted); reconcile: no deduct ❌; coupon `used_count` incremented at settlement, decremented on *any* cancel → drifts below truth (GREATEST floors at 0) | phantom stock; coupon maxUses overshoot | oversell → P5 disputes | inventory recounts | Single architecture decision (Major Decision 1) + delete all pre-settlement restores |
| D4 Strategic | Net-30 B2B path bypasses Midtrans, deducts stock at initiate correctly (`initiate/route.ts:751-779`) — the one place initiate-time deduction is right | mixing both models confuses future edits | n/a | every future dev (or AI) re-breaks it | Encode the invariant as one shared `settleOrder(tx, order)` function used by webhook AND reconcile; comment the Net-30 exception loudly |
| D5 Existential brand risk | Paid-but-stranded customer (oversell at settlement, expire-then-pay) discovers the brand took money and went silent | "Dapur Dekaka nipu" post | worst-case brand event | hours of apology + refund | `needs_attention` order flag + Fonnte WA to Bashara on every abnormal settlement path (money received outside happy path) |

## State machine

Order status (payment phase), from `orderStatusEnum` (`lib/db/schema.ts:25-28`):

```
(created by initiate)            pending_payment
pending_payment → paid           settlement/capture webhook, reconcile cron, Net-30 at initiate
pending_payment → cancelled      expire/cancel/deny webhook, cancel-expired cron, retry cap (3), reconcile
paid → (P4: processing/packed)   admin action
paid → cancelled                 webhook cancel of paid order (creates refund row, L2 Rule 7 ✅ `webhooks/midtrans:346-364`)
```

Illegal transitions that must stay/become impossible:
- `cancelled → paid` (today: settlement-for-cancelled is parked with a log line; must become: refund row + alert, status stays cancelled)
- `pending_payment → pending_payment` with second stock deduction (concurrency guard)
- any transition that touches stock before `paid` (except Net-30)

## Failure matrix

| Failure | Detection | Auto-recovery | Human SOP | Customer message | Money effect | Max time-to-ack |
|---|---|---|---|---|---|---|
| Webhook signature rejects all notifications | today: none (`webhook_events` never written) | reconcile cron recovers settlements ≤ every 10 min (with stock bug) | sandbox test pre-launch | none needed if fixed | entire revenue path | pre-launch gate |
| Double settlement webhook | txn-id check catches most | idempotent 200 | none | none | double-deduct risk in race window | fix with conditional update |
| Expire-then-pay (VA after 15 min) | log line only | none | needed: refund or honor SOP | needed: "Pembayaran diterima setelah batas waktu — kami hubungi Anda via WA" | unrefunded cash | 30 min via WA alert (build it) |
| Settlement insufficient stock | webhook 500s, Midtrans retries | none — stuck forever | needed: `needs_attention` queue | needed: apology + choice (wait/refund) per L1 | paid, undelivered | 15 min via WA alert (build it) |
| Midtrans down at initiate | catch → order rolled back (`initiate/route.ts:933-943`) ✅ | customer retries | none | "Gagal membuka pembayaran, coba lagi" | none | instant |
| Snap abandoned (no pay) | `paymentExpiresAt` | cancel-expired cron (≤30 min lag: 15-min expiry + */15 cron) | none | failed page + retry (≤3, then auto-cancel `checkout/retry:53-146`) | none (no stock held) | n/a |
| gross_amount mismatch | 400 returned | Midtrans retries same payload forever | needed: alert after N retries | none | held at gateway | 1 h |
| Email/WA send fails | `.catch` logged | none | resend from admin orders | none | none | 24 h ok |
| Reconcile recovers settlement | logger.warn | partial (stock skipped ❌, points from stale column ❌ — `pointsEarned` is 0 for non-Net-30 initiate `initiate/route.ts:545-553`) | none today | confirmation email sent ✅ | stock never deducted; customer earns 0 points | fix at source |

## Stakeholder rotation

- **Ibu RT:** pays by QRIS at 13:58 for same-day. Settlement at 14:02 — payment cutoff (14:00, `cutoffs.ts`) already passed. Nothing re-checks cutoff at settlement; P4 inherits a promise P3 already broke. Needs: at initiate, if `now + expiry` crosses the tier's payment cutoff, message "bayar dalam X menit atau pengiriman bergeser ke besok".
- **Warehouse:** trusts the packing queue = `status='paid'`. Every reconcile-recovered order arrives there with stock unledgered — he packs boxes the inventory count says still exist.
- **Bashara:** his "money reconciliation minute" (L4) is currently impossible: `webhook_events` is empty, wallet floor is noise (see P4), and Midtrans-vs-DB diff requires opening two dashboards. Ops card must show: settlements today (Midtrans) vs `paid` today (DB), one number each.
- **Brand owner:** L2 Rule 7 (refund obligation on paid-cancel) is implemented in the webhook ✅ — the only L2 rule fully wired end-to-end. Protect it in the refactor.

## Major decisions (max 3)

### Decision 1 — One stock architecture (THE decision of this file)
| Option | Description |
|---|---|
| A | **Settlement-deduct (constitutional):** keep webhook deduction; DELETE stock-restore from the three unpaid-cancel paths; FIX reconcile to deduct with the same GREATEST+gte guard; keep restore ONLY when cancelling an order that was `paid` |
| B | Initiate-deduct with reservation TTL (what reconcile's comments assume): deduct at initiate, restore on expiry — real reservations, no oversell-at-settlement |

**Recommend A.** It matches L2, the webhook, and the no-COD/15-min model; B re-opens the "abandoned cart holds stock" griefing vector under solo ops. Irreversibility R2 (ledger semantics). Confidence: high. Would change my mind: sustained oversell disputes (>2/month) from settlement races — then move to B with a 20-minute reservation.
**CONFLICT flag:** none with L2 — L2 already mandates A; the *code* (3 restore sites + reconcile comment) is what violates it.

### Decision 2 — Expiry truth: internal 15 min vs Midtrans channel expiry
A: Pass `custom_expiry` (15 min) into Snap creation (`lib/midtrans/create-transaction.ts`) so Midtrans and DB expire together; expire-then-pay becomes near-impossible. B: extend internal expiry for VA to 60 min. C: status quo.
**Recommend A** (+ keep the settlement-for-cancelled handler as backstop that now creates a refund row + WA alert instead of a log line). R1. Confidence: high. Would change my mind: data showing meaningful VA usage that needs >15 min — then B for VA only, per L2 review.

### Decision 3 — Where abnormal money lands
A: Add `needs_attention` (boolean + reason) on orders; set it on: settlement-for-cancelled, settlement-insufficient-stock, gross-mismatch, reconcile-recovery; ops card counts it; Fonnte WA to store number on each set. B: keep logger-only.
**Recommend A.** R0. Confidence: high. This is the observability backbone L4's "know within minutes" requires.

## Founder decisions required

- **[FOUNDER DECISION #4]** Expire-then-pay policy: auto-honor the order if stock still available (revive to `paid`) or always refund? Recommend: refund by default (deterministic, solo-ops-safe), revive only manually. L1 wording: "Pembayaran diterima setelah pesanan kedaluwarsa — dana dikembalikan penuh dalam 7 hari, atau balas WA ini jika masih ingin pesanannya."
- **[FOUNDER DECISION #5]** Ratify Decision 1 Option A as the permanent line in L2's Decision Record (it is R2 — changing later rewrites ledger history semantics).

## Implementation backlog (ordered)

**P0**
1. `code` — verify + fix Midtrans webhook verification: accept body `signature_key = sha512(order_id + status_code + gross_amount + serverKey)`; drop the header requirement (`webhooks/midtrans/route.ts:36-53`). Acceptance: a sandbox Snap payment flips the order to `paid` via the webhook (not reconcile) — check `order_status_history.note`. Effort S. Risk if skipped: **all revenue rides on a cron with a stock bug.**
2. `code` — delete stock-restore + coupon `used_count` decrement from unpaid cancels: `webhooks/midtrans/route.ts:366-385,421-429` (guard with `wasPaidBefore`), `cron/cancel-expired-orders/route.ts:92-149` (order was never paid — keep points reversal + couponUsage delete only), `checkout/retry/route.ts:70-100`. Acceptance: expiring an unpaid order leaves `product_variants.stock` and `coupons.used_count` unchanged; cancelling a *paid* order still restores both. Effort M. Risk: inventory inflates daily.
3. `code` — reconcile settlement recovery = same routine as webhook: stock deduct (GREATEST+gte), points **recomputed** via `calculatePointsEarned` (not the stale `pointsEarned` column), `POINTS_EXPIRY_DAYS` not hardcoded 365, `couponUsages` insert with `onConflictDoNothing` (`cron/reconcile-payments/route.ts:89-144`). Best: extract shared `settleOrderTx()` used by both. Acceptance: kill the webhook URL in sandbox, pay; after reconcile, stock is deducted and points match webhook math. Effort M.
4. `code` — settlement concurrency guard: `UPDATE orders SET status='paid' ... WHERE id=? AND status='pending_payment' RETURNING`; 0 rows → return `already_processed` (`webhooks/midtrans/route.ts:136-152`). Acceptance: firing the same settlement twice concurrently deducts stock once. Effort S.
5. `code` — `needs_attention` flag + Fonnte WA alert on: settlement-for-cancelled (also insert refund row per L2 Rule 7), settlement-insufficient-stock (catch instead of naked throw; mark order, return 200 so Midtrans stops retrying), reconcile-recovery. Acceptance: each path produces one WA to `NEXT_PUBLIC_WHATSAPP_NUMBER` within the request. Effort M.

**P1**
6. `code` — write `webhook_events` rows (source, eventType, externalId, payload, errorMessage) in both webhooks so `webhookErrorCount24h` on the ops card means something. Effort S.
7. `code` — Snap `custom_expiry` = `payment_expiry_minutes` (Decision 2). Acceptance: unpaid VA shows expired in Midtrans dashboard at minute 16. Effort S.
8. `code` — success page polls `/api/orders/[orderNumber]` until `paid` (max 60s) before declaring victory; otherwise renders the pending state. Effort S.
9. `ops SOP` — reconciliation minute: ops card gains "Midtrans settlements today vs DB paid today"; L4 daily card row: mismatch >0 → open Midtrans dashboard. Effort M (needs one Midtrans status pull or manual count field).

**P2**
10. `code` — alert (WA) when the same midtrans order_id 400s (gross mismatch) 5+ times. Effort S.
11. `DEFER` — automatic Midtrans refund API integration; manual refunds via dashboard are fine ≤5/week. Trigger: >5 refunds/week.

## Definition of Done for this phase

- [ ] Sandbox payment settles via webhook (proven in `order_status_history`)
- [ ] Unpaid-order expiry changes zero stock and zero coupon counts
- [ ] Paid-order cancel restores stock and creates a refund row (unchanged, regression-tested)
- [ ] Duplicate settlement cannot double-deduct (concurrent test)
- [ ] Reconcile-recovered order: stock deducted, points recomputed, coupon idempotent
- [ ] Every abnormal money event → `needs_attention` + WA within the request
- [ ] Ops card reconciliation numbers live; `webhook_events` populated

## Handoff to P4

P4 may assume: `status='paid'` means money verified, stock decremented and ledgered, coupon/points final, and address complete (P2). Any order P4 sees in the packing queue is safe to pack without checking Midtrans.

## Red team

1. **The forged-webhook attacker:** POSTs a settlement payload for his own `pending_payment` order with inflated fake `gross_amount`. Body-signature verification (backlog #1) kills forgeries; the `gross_amount === totalAmount` check (`webhooks/midtrans:122-131`) kills tampering even if a key leaks partially. Keep both.
2. **The stock-race twins:** two customers, last 3 packs of siomay, both pay within the same minute. Today: one settles, one strands (500-loop). After backlog #5: second order flags `needs_attention`, Bashara WAs an apology + refund within 15 minutes per L1 dispute playbook. Test this exact scenario before launch — it *will* happen on promo day.
3. **The Midtrans brownout:** notifications delayed 45 minutes on a busy Friday. Internal expiry cancels orders at 15; settlements then arrive for cancelled orders in bulk. With Decision 2 (synchronized `custom_expiry`) Midtrans won't accept those payments at all; without it, you eat a stack of manual refunds — this is why Decision 2 is not optional polish.
