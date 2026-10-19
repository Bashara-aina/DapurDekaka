# 02 — Checkout, Payment & Order Money Flow

**Audit date:** 2026-10-19 · **Commit:** `d646f56`
**Scope:** `app/api/checkout/initiate`, `checkout/retry`, `webhooks/midtrans`, `lib/finance/settle-order.ts`, `cron/cancel-expired-orders`, `cron/reconcile-payments`, `admin/orders/[id]/status`, `lib/finance/complete-refund.ts`, `lib/shipping/dispatch.ts`, checkout UI hook `app/(store)/checkout/use-checkout.ts`.

## How the flow works today (verified)

```
Customer cart ─► POST /api/checkout/initiate
   validates stock (no reservation), prices from DB, coupon, points (deducted now, FOR UPDATE),
   shipping quote re-validated against Biteship, phase/geo gates
   ─► order row status=pending_payment + order_items + redeem rows (1 tx)
   ─► Midtrans Snap token (expiry ≤15 min)  [on failure: full rollback ✅]
Customer pays ─► Midtrans webhook (signature ✅, amount check ✅, idempotency ✅)
   settleOrderTx: guarded update pending→paid, deduct stock, coupon used_count, award points, history
Backstops: reconcile-payments (*/30) re-settles missed webhooks; cancel-expired (*/30) cancels unpaid
Admin: paid→processing→packed→(Biteship dispatch)→shipped→delivered (Biteship webhook)
```

What's genuinely good: server-side price recompute, signature + gross-amount verification, `status='pending_payment'` guarded settlement shared between webhook and cron, rollback when Midtrans fails, points FIFO under row lock, late-settlement → refund obligation.

---

## CRITICAL

### C1 — Client can set any discount: `discountAmount` is trusted when no coupon is used
`app/api/checkout/initiate/route.ts:223`
```ts
let discountAmount = parsed.data.discountAmount ?? 0;   // from request body
```
It is only overwritten inside `if (couponCode)` for `percentage`/`fixed` types, and `enforceCouponCap` (line 373) only runs when a coupon exists. So:

- **Scenario:** `POST /api/checkout/initiate` with no `couponCode` and `"discountAmount": 199000` on a Rp 200.000 cart → `totalAmount = 1000 + shipping`. Midtrans accepts it (the line items include `{id:'discount', price:-199000}` so they sum correctly), the webhook's amount check passes because it compares against the *stored* `totalAmount`, the order settles, stock ships.
- Same hole with a `buy_x_get_y` coupon (discount branch never assigns `discountAmount`).

**Fix:** `let discountAmount = 0;` and compute it only from the DB coupon. Add a server invariant before the transaction: `if (totalAmount < 1 || discountAmount > subtotal) return conflict(...)`. Optionally reject when the client value differs from the server value (helps catch UI drift). Add a test in `tests/api/checkout/`.

### C2 — COD toggle double-charges the customer
`components/store/checkout/CheckoutShippingStep.tsx:124` shows `CodToggle` whenever the Biteship quote says `cashOnDeliveryAvailable`. `initiate` stores `cashOnDelivery: true` **but still requires the full Midtrans payment**, then `lib/shipping/dispatch.ts:94` books Biteship with `cashOnDeliveryValue: order.totalAmount` → the courier collects the full amount **again** at the door.

**Fix (launch):** remove the toggle and force `cashOnDelivery=false` server-side. If COD is wanted later it needs its own flow: no Midtrans, order status `awaiting_cod`, stock reserved, settlement on Biteship `delivered` + COD remittance.

### C3 — Paying an *old* VA after a retry is lost money
`app/api/checkout/retry/route.ts:181-195` replaces `midtransOrderId` with `DDK-…-retry-N` but never cancels the previous Midtrans transaction. The webhook looks up by `midtransOrderId` only (`webhooks/midtrans/route.ts:246`).

**Scenario:** customer opens Snap, gets BCA VA, closes popup, clicks "Bayar lagi" (new VA), then pays the **first** VA from m-banking → webhook for `DDK-20261019-0007` → `Order not found` → 404 → money received, order later auto-cancelled, customer emailed "dibatalkan".

**Fix:** in the webhook, resolve the order by `order_id.replace(/-retry-\d+$/, '')` against `orders.orderNumber` (and accept any of that order's Midtrans ids). Also call Midtrans `cancel` on the previous id when retrying (best-effort).

### C4 — Admin cannot cancel a paid order paid by VA / QRIS
`admin/orders/[id]/status/route.ts:226-231` calls `refundTransaction()` (Midtrans refund API) and **aborts the cancel if it fails**. Midtrans' refund API only supports cards / GoPay / ShopeePay (and limited QRIS); **bank-transfer VA cannot be refunded via API**. Most Indonesian customers pay by VA/QRIS → "Refund gagal… Pesanan tidak dibatalkan" → order stuck, stock stuck, customer angry.

Also: this external HTTP refund happens **inside** the DB transaction — if the refund succeeds and a later statement fails, money is refunded but the order is not cancelled.

**Fix:** cancellation must not depend on an API refund. On cancel of a paid order: cancel + reverse stock/points in the tx, insert a `refunds` row (`status='pending'`, `method = midtrans|bank_transfer`), and let the Refunds page drive either the API refund (supported methods) or a manual transfer with proof upload. Call Midtrans refund **after** commit, never inside.

---

## HIGH

### H1 — Inactive / hidden products can be bought
`initiate/route.ts:182-191` checks only that the variant exists and has stock — not `variant.isActive`, `product.isActive`, or `product.deletedAt`. A stale cart or crafted request buys discontinued items. (`retry` does check `isActive` — inconsistent.) **Fix:** join products and reject inactive/deleted.

### H2 — Client controls weight, name, SKU, image stored on the order
`initiateSchema` accepts `weightGram`, `productNameId`, `sku`, `imageUrl` per item and `orderItemsData` stores them verbatim (`initiate/route.ts:205-219`). `weightGram` feeds the shipping re-quote (`shippingItems`, line 573) → a crafted `weightGram: 1` gets a cheaper courier rate and the Biteship booking will later be re-priced (`order.price` webhook) — you eat the difference. Names/SKU on invoices and packing lists can be spoofed. **Fix:** take all of these from `dbVariants` / products; accept only `variantId` + `quantity` from the client.

### H3 — No stock reservation → paid orders stuck when stock runs out
Stock is checked at initiate but only deducted at settlement. Two customers can both pay for the last pack. The second settlement throws `InsufficientStockError`; the webhook rolls back and returns 200 (`webhooks/midtrans/route.ts:187-204`). The order **stays `pending_payment` even though money arrived**:
- `cancel-expired` skips it (Midtrans says settled) — good, but
- `reconcile-payments` retries every 30 min forever, sending an ops WhatsApp each time (if Fonnte is configured at all), and no refund row is created.

**Fix (pick one):** (a) reserve stock at initiate (`stock - reserved` with a `reserved_until`), released by cancel-expired; or (b) on oversell, still flip to `paid` with `needsAttention=true` and create a refund obligation so it surfaces in the Refunds queue. For a small frozen-food catalog, (a) is cleaner.

### H4 — Webhook cancellation of a processing/packed order skips refunds and stock restore
`webhooks/midtrans/route.ts:296` `wasPaidBefore = order.status === 'paid'`. If Midtrans sends `cancel`/`deny` (e.g. card chargeback / manual cancel in Midtrans dashboard) while the order is `processing`/`packed`/`shipped`, status becomes `cancelled` but **no refund row, no stock restore**. Also no `orderStatusHistory` row is written in `handleCancellation`. **Fix:** use `order.paidAt != null`, write status history, and refuse to auto-cancel once `shipped` (flag `needsAttention` instead).

### H5 — `capture` with `fraud_status = challenge` is treated as paid
`webhooks/midtrans/route.ts:139` settles on any `capture`. Midtrans docs: card `capture` + `fraud_status=challenge` must be held for review. **Fix:** settle `capture` only if `fraud_status === 'accept'`; on `challenge` flag `needsAttention`. (Only matters if cards are enabled.)

### H6 — `refund` / `partial_refund` / `chargeback` notifications are ignored
After settlement `midtransTransactionId` is stored; any later notification with the same `transaction_id` returns early at line 99 ("already_processed"). Refunds done from the Midtrans dashboard never update the order. **Fix:** dedup on `(transaction_id, transaction_status)` instead of `transaction_id` alone, and handle `refund`/`partial_refund` by marking the refund row complete.

### H7 — Midtrans redirect lands on the success page without an order
`create-transaction.ts:54` `finish: ${appUrl}/checkout/success` — Midtrans appends `?order_id=…&transaction_status=…`, but `checkout/success/page.tsx:18` reads `searchParams.get('order')`. Redirect-based payments (mobile GoPay/ShopeePay, some banks) show an empty success page. (And `appUrl` is localhost today — see file 01.) **Fix:** read `order_id` as fallback and strip `-retry-N`.

### H8 — Emails/WhatsApp are fire-and-forget on Vercel
Every notification (`sendEmail(...).catch()` / `void sendWhatsApp`) is started and the handler returns immediately; nothing uses `waitUntil`. On Vercel the function can be frozen after the response, so order-confirmation, shipped, cancellation and ops alerts are **intermittently dropped**. **Fix:** `import { waitUntil } from '@vercel/functions'` and wrap each notification, or `await` them (they're fast).

---

## MEDIUM

| # | Issue | Location | Fix |
|---|---|---|---|
| M1 | Coupon `startsAt` not checked at initiate (validate route checks it) → future coupons usable via API | `initiate/route.ts:241-275` | Add `if (coupon.startsAt && coupon.startsAt > now)` |
| M2 | `maxUses` check is a stale read; concurrent checkouts exceed it | `initiate/route.ts:273` | Conditional `UPDATE coupons SET used_count=used_count+1 WHERE used_count < max_uses` at settlement, or reserve at initiate |
| M3 | Admin-cancel of an **unpaid** order decrements `coupons.used_count` (never incremented) and does not delete the provisional `couponUsages` row → used_count drifts low, and that user is then blocked by per-user limit | `admin/orders/[id]/status/route.ts:301-306` | Decrement only if `paidAt`; always delete provisional usage |
| M4 | Admin-cancel of a pending order doesn't cancel the Midtrans transaction → customer can still pay the VA → late settlement | same | Call Midtrans `cancel` for pending orders |
| M5 | Biteship cancel failure on a shipped order is swallowed; order is cancelled while the courier still has the box | `status/route.ts:132-146` | Block or flag `needsAttention` |
| M6 | Double points clawback: admin cancel reverses earned points, then completing the refund claws back again (sums `earn` rows regardless) | `lib/finance/complete-refund.ts:43-55` | Skip if an `adjust` reversal for this order exists |
| M7 | `totalAmount` can be 0 (pickup + 50% points + coupon on small cart is blocked by caps today, but no explicit guard) → Midtrans rejects `gross_amount 0` → 500 | `initiate/route.ts:686` | Guard `totalAmount >= 1` |
| M8 | Retry `item_details` omits insurance → sum ≠ gross when insurance is enabled | `retry/route.ts:144-167` | Add insurance line (or build items in one shared helper used by initiate+retry) |
| M9 | Reconcile cron hardcodes `https://api.midtrans.com` | `reconcile-payments/route.ts:217` | Use `lib/midtrans/status.ts` (respects sandbox) |
| M10 | Guest dedupe returns an existing order for **any** cart with the same email + subtotal in 60 s (different items/address) | `initiate/route.ts:440-459` | Require the client `idempotencyKey`; hash items+address |
| M11 | Status history for a new order is written in a second transaction | `initiate/route.ts:1008` | Move into the first tx |
| M12 | `pickup` settlement emails "siap diambil!" the moment payment lands, before anyone packs it | `webhooks/midtrans/route.ts:438-461` | Send "Pembayaran diterima" now; "Siap diambil" when warehouse marks packed |
| M13 | Order number date uses server TZ (UTC) — orders 00:00–07:00 WIB get yesterday's date | `generate-order-number.ts:9` | Format with `Asia/Jakarta` (both counter key and number) |
| M14 | `cancel-expired` proceeds to cancel when Midtrans status check errors — could cancel a just-paid order (recoverable via late-settlement refund, but bad UX) | `cancel-expired-orders/route.ts:57-63` | Skip on error; retry next run |
| M15 | No customer email on auto-cancel by cron | `cancel-expired-orders` | Send cancellation email (with "pesan lagi" link) |

---

## Tests to add (none of these are covered today)

1. initiate ignores client `discountAmount` / `weightGram` / names.
2. initiate rejects inactive variant/product.
3. webhook resolves `-retry-N` order ids and an old Midtrans id.
4. settlement oversell → order surfaces in refunds/attention queue.
5. admin cancel of VA-paid order succeeds and creates a pending refund.
6. cancel paths leave `users.points_balance == SUM(points_history)` (see file 03).
