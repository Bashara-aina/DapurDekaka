# P4 — FULFILL → DISPATCH → TRACK

> Layer owner: PROCESS. Scope: `paid` → pack → book Biteship → AWB → WA/email → in-transit → delivered, plus pickup-ready flow.
> Ground truth: `app/api/admin/field/packing-queue/route.ts`, `app/api/admin/field/dispatch/route.ts`, `app/api/cron/retry-dispatch/route.ts`, `app/api/webhooks/biteship/route.ts`, `lib/shipping/providers/biteship/**`, `lib/shipping/wallet-floor.ts`, `app/api/admin/ops/route.ts`, `app/api/orders/track/[orderNumber]/route.ts`, `app/api/orders/[orderNumber]/route.ts`, `vercel.json`. Date: 2026-07-19.
> Depends on: P3 (paid = money+stock true), L3 (tiers/cutoffs/couriers), L4 (solo capacity). Feeds: P5.
> Non-goals: refunds/disputes resolution (P5).

## Executive summary

- **The dispatch auto-retry system does not work at all.** `cron/retry-dispatch` (a) is **not registered in `vercel.json`** (checklist itself admits it) and (b) calls `POST /api/admin/field/dispatch` with an empty `Cookie` (`retry-dispatch/route.ts:37-44`) against a route that requires a warehouse/superadmin session (`dispatch/route.ts:42-48`) — every retry would 403. Failed bookings retry only when Bashara manually re-taps. The `retrying` dispatch state is a dead letter.
- **Wallet-floor "observability" is noise, twice over:** `BITESHIP_WALLET_BALANCE_IDR` is a static env var that no cron can update on Vercel (`wallet-floor.ts:8-11` admits it needs an "external polling cron" that doesn't exist), so the check permanently returns `ok:false`; and the ops card feeds it **weekly gross revenue** instead of weekly dispatch cost (`admin/ops/route.ts:60-63,75`), inflating the floor ~10×. A permanently red light trains Bashara to ignore red lights. Also: **nothing actually blocks dispatch on low wallet** — Biteship just fails the booking, which lands in the (dead) retry path.
- **Order numbers are sequential and the status endpoint is open:** `DDK-YYYYMMDD-####` + `GET /api/orders/[orderNumber]` returns status, `totalAmount`, VA number, and payment type with **no verification** (`orders/[orderNumber]/route.ts:52-65`). Anyone can enumerate the day's orders and read revenue. The tracking route (`orders/track/...`) correctly gates on email; the minimal-info route undoes that care.
- Booking flips the order to `shipped` **at booking time** (`dispatch/route.ts:129-155`), before any courier scan; the Biteship webhook then maps `confirmed/allocated/picking_up` → shipped only from `packed` (`webhooks/biteship/route.ts:109`), so courier reality can never correct the optimistic status. If the driver never shows, the customer stares at "dikirim" indefinitely — the exact "silent failure after payment" class L4 fears. `refundsOverdue3d` on the ops card is also inverted (`gte` = created *within* 3 days, not older — `admin/ops/route.ts:52-58`).
- **Pickup is half-built:** `PICKUP_AUTO_RELEASE_HOURS = 48` exists (`financial-rules.ts:33`) but no cron or route consumes it; PickupReady email/WA fire at settlement ✅ (`webhooks/midtrans/route.ts:264-293`), but an unclaimed pickup order sits `paid` forever, holding deducted stock with no release, no reminder, no refund path.

## Core question

After money is taken, does every order reach a hand (courier's or customer's) on a truthful clock — and when it doesn't, does Bashara find out from the system before the customer does?

## Happy-path swimlane

| # | Actor | System | State change | Customer-visible effect | Ops action |
|---|-------|--------|--------------|------------------------|-----------|
| 1 | System (P3) | settlement | `paid`, dispatchStatus `pending` | confirmation email | order appears in packing queue (`status='paid'`, FIFO by createdAt) |
| 2 | Warehouse | `PATCH /api/admin/field/packing-queue` (note, coldChainCondition) | `paid → packed` | none | pack frozen + ice pack; L1/L4 photo-before-ship ritual (SOP only — no photo field in schema: **ASSUMPTION** flagged, add `packingPhotoUrl` or keep as WA-self-archive SOP) |
| 3 | Warehouse | `POST /api/admin/field/dispatch` → `createBiteshipOrder` | dispatchStatus `booking → booked`; `packed → shipped`; AWB + trackUrl stored | email "sudah dikirim!" + WA with AWB + track link | hand box to courier |
| 4 | Biteship | `POST /api/webhooks/biteship` (status updates) | driver info updates; `delivered` on POD | track page timeline; delivered email + WA | none |
| 5 | Customer | `/orders/track/[orderNumber]?email=` | none | internal timeline + live Biteship tracking merge | none |
| P | Customer (pickup) | settlement already sent PickupReady + pickupCode | — | shows code at store | verify code = orderNumber, hand over, mark delivered in admin |

## Depth analysis table

| Depth | Current state | Break mode | Customer impact | Solo-ops impact | Recommendation |
|-------|---------------|-----------|-----------------|-----------------|----------------|
| D1 Surface | Track page merges DB status + live Biteship pull (`orders/track/.../route.ts:46-52`) | Biteship fetch fails silently → stale view | thinks package stalled | WA "paket di mana?" | show "update terakhir {time}" stamp; if live fetch fails, say so honestly |
| D2 Operational | Manual dispatch only; retry loop dead; no SLA clocks beyond `paidNotPacked` count | failed booking at 15:50 Friday → sits all weekend | melted expectations | Bashara must remember to re-tap | Fix retry cron (auth + vercel.json); add `shipped >6h without courier scan` and `packed >2h unbooked` counters to ops card |
| D3 Financial / Inventory | Wallet floor fake; markup margin recorded per order (`shippingMarkupAmount`) ✅; insurance passed to Biteship as `insuranceValue = subtotal` when selected (`dispatch/route.ts:118-121`) | empty wallet discovered only via booking failure | next-day slip | top-up panic | Wallet: manual daily number in system_settings (Bashara types it in the morning ritual) beats a fake env var; feed ops card from `SUM(biteshipActualCost)` last 7d (query exists in `admin/health/wallet`) |
| D4 Strategic | `shipped` = booked fiction; enum has unused `processing`; dispatch books with stored `courierCode/Service` from checkout-time quote | courier discontinues service between quote and booking → booking fails | delay | manual re-quote | Keep enum; map booked-but-unscanned as customer-facing "sedang dijemput kurir" label instead of "dikirim" (copy fix, not schema fix) |
| D5 Existential brand risk | Enumerable order numbers leak daily revenue + statuses; a competitor or nosy neighbor can chart your sales | trust + competitive leak | privacy complaint | none until it's public | Gate minimal-info endpoint behind email or order-scoped token; keep VA info only for the session that created the order |

## State machine

Fulfillment slice (order.status × dispatchStatus):

```
paid/pending        → packed/pending        (packing-queue PATCH; warehouse roles only)
packed/pending      → packed/booking        (dispatch route, transient)
packed/booking      → shipped/booked        (Biteship booking success)
packed/booking      → packed/retrying       (booking fail, attempts < 3)
packed/booking      → packed/failed         (attempts ≥ 3; WA alert to store ✅ dispatch/route.ts:210-216)
packed/retrying     → packed/booking        (retry cron — CURRENTLY DEAD)
shipped/booked      → delivered/booked      (Biteship webhook POD)
shipped/booked      → shipped/failed        (Biteship cancelled/rejected webhook; order.status NOT reverted — customer still sees shipped ❗)
paid/not_required   → delivered (pickup)    (admin marks handed over)
```

Illegal (enforced ✅): dispatch on non-`packed`, dispatch on pickup, dispatch when dispatchStatus ∉ {pending, failed, retrying}.
Illegal but reachable today (must fix): customer-visible `shipped` with `dispatchStatus='failed'`; `paid` pickup older than 48h with no state.

## Failure matrix

| Failure | Detection | Auto-recovery | Human SOP | Customer message | Money effect | Max time-to-ack |
|---|---|---|---|---|---|---|
| Biteship booking fails (wallet, courier, address) | WA to store ✅ + dispatchStatus | retry cron (fix it) | re-book other courier from admin; if same-day promise broken → proactive WA using L1 language | "Pengiriman dijadwalkan ulang, kami kabari via WA" (send manually today; template it) | possible re-quote delta absorbed by margin | 15 min in booking hours |
| Courier booked, never picks up | **nothing today** | none | needed: ops-card row `shipped>6h no scan` → call courier / rebook | "Kurir dijadwalkan ulang" | none | 6 h |
| Biteship webhook cancelled/rejected mid-route | dispatchStatus failed + WA ✅ | none | rebook or refund per P5 | proactive WA required — status page still lies "dikirim" | maybe refund | 1 h |
| Biteship webhook signature never matches (secret mismatch / header absent) | none — deliveries stop updating | live-pull on track page masks it partially | pre-launch: fire one real webhook and verify 200 in logs | — | none directly, but delivered emails never send | pre-launch gate |
| Delivered but customer says no | dispute (P5) | n/a | P5 | P5 | P5 | — |
| Pickup no-show past 48h | **nothing today** | none (constant unused) | needed: day-2 WA reminder; day-7 auto-flag for refund-minus-nothing decision (FD#7) | "Pesanan siap diambil s/d {date}" | stock already deducted; food perishes | 48 h |
| Ops card lies (refundsOverdue inverted, wallet red-always, webhookErrors always 0) | — | — | fix the three queries | — | broken observability | pre-launch |

## Stakeholder rotation

- **Ibu RT:** her track page must never say "dikirim" while the box sits in the freezer because GoSend cancelled. The `shipped/failed` display gap is the single most customer-visible P4 defect.
- **Warehouse:** the 16:00 booking cutoff (`cutoffs.ts`) is his deadline, but the packing queue doesn't sort or badge by tier/cutoff — an express order paid at 13:00 looks identical to a frozen intercity one. Add tier + cutoff countdown to the queue rows.
- **Bashara:** every signal he's given must be true or absent. Today three of his five ops-card lights are decorative (webhook errors, wallet, refunds-overdue). Fewer, truer lights.
- **Brand owner:** photo-before-ship is the heritage brand's insurance policy — cheaper and more credible than the `InsuranceSelector`. **Conflict:** L4 time budget (~3 min/order packing) vs photo ritual (+30s). Verdict: keep photo; drop insurance UI (P2 Decision 2) to fund the time.

## Major decisions (max 3)

### Decision 1 — Fix retry as cron vs kill retry
A: Register cron in `vercel.json` + replace the HTTP-self-call with direct function invocation (or `CRON_SECRET`-authorized internal header the dispatch route accepts). B: delete the cron; manual-only retry with a loud ops-card row.
**Recommend A** — but with B's ops-card row anyway (cron can fail too). R0. Confidence: high. Would change my mind: if booking failures at launch are <1/week, B alone is honest solo-ops simplicity.

### Decision 2 — Customer-facing status truth
A: Keep DB `shipped` at booking but render label from `dispatchStatus`+tracking: booked-no-scan → "Sedang dijemput kurir"; failed → "Pengiriman dijadwalkan ulang". B: add real `courier_pickup` status to the enum (migration).
**Recommend A** (copy-layer fix, id+en strings, zero migration). R0. Confidence: high.

### Decision 3 — Order info exposure
A: Remove `totalAmount` + VA from the unverified branch of `GET /api/orders/[orderNumber]`; require email param (like the track route) or the creating session; pending-payment page passes the email it already collected. B: randomize order numbers.
**Recommend A** (B breaks the human-readable DDK ritual Bashara needs on box labels). R0. Confidence: high.

## Founder decisions required

- **[FOUNDER DECISION #6]** Photo-before-ship: mandatory per-order (stored `packingPhotoUrl`, +30s/order, dispute gold) or WA-self-archive SOP (zero code)? Recommend SOP now, column when disputes >1/month.
- **[FOUNDER DECISION #7]** Pickup no-show at 48h: hold longer (frozen stock decays), refund minus nothing (goodwill), or convert to store credit? L2 has no rule for this — needs one line added either way.

## Implementation backlog (ordered)

**P0**
1. `code+config` — retry-dispatch: add to `vercel.json` (`*/30 8-17 * * *` WIB-equivalent UTC) AND fix auth — extract dispatch logic into `lib/shipping/dispatch-order.ts` called by both the route (session-auth) and the cron (CRON_SECRET). Acceptance: kill Biteship key locally, dispatch fails → restore key → cron books it within 30 min, no session involved. Effort M. Risk if skipped: weekend-stranded paid orders.
2. `code` — ops-card truth repair (`admin/ops/route.ts`): refunds overdue = `status='pending' AND createdAt <= now()-3d` (flip `gte`→`lte`); wallet check fed by `SUM(biteshipActualCost)` 7d (reuse `admin/health/wallet` query) and balance from a `system_settings.biteship_wallet_balance` Bashara updates each morning; delete or wire `webhookErrorCount24h` (P3 backlog #6 wires it). Acceptance: each card number reproducible by hand from SQL. Effort M. Risk: alert fatigue → real reds ignored.
3. `code` — `GET /api/orders/[orderNumber]` unverified branch: return status + orderNumber only (drop totalAmount, VA, paymentType); pending page supplies email it already has. Acceptance: curl without email yields no monetary data. Effort S. Risk: daily revenue enumerable by anyone.
4. `code+copy` — status-label layer (Decision 2) + proactive-WA template for dispatch failure: id "Maaf, penjemputan kurir dijadwalkan ulang. Pesanan {no} tetap kami jaga beku & prioritas besok pagi." / en equivalent. Acceptance: order with `dispatchStatus='failed'` never renders "dikirim" on track page. Effort S–M.

**P1**
5. `code` — SLA clocks on ops card: `packed>2h unbooked (booking hours)`, `shipped>6h no Biteship scan`, `pickup paid>24h unclaimed`. Acceptance: seeded fixtures trigger each counter. Effort M.
6. `code` — packing queue rows show tier badge + cutoff countdown (`getCutoffStatus`), sort express-first. Effort M.
7. `code` — pickup reminder WA at 24h + auto-flag at `PICKUP_AUTO_RELEASE_HOURS` (48h) into `needs_attention` (P3 backlog #5 flag) pending FD#7. Effort M.
8. `ops SOP` — pre-launch webhook drill: one real Biteship order end-to-end; verify signature 200s, `shipped→delivered` transitions, delivered email/WA. Effort S (an afternoon + one real courier fee).

**P2**
9. `code` — `estimatedDays` populated at initiate from the selected quote (column exists, always null today; shipped email prints ''). Effort S.
10. `DEFER` — multi-warehouse, batch label printing, courier auto-failover. Trigger: >60 orders/week (L4 solo ceiling).

## Definition of Done for this phase

- [ ] A failed booking retries automatically within 30 min without a browser session
- [ ] Every ops-card number is true (verified against SQL by hand once)
- [ ] Track page never shows "dikirim" for a failed dispatch; shows last-update timestamp
- [ ] Unverified order lookup leaks no money data
- [ ] One real Biteship order has round-tripped: book → webhook shipped → webhook delivered → email+WA received
- [ ] Pickup orders older than 24h surface somewhere a human looks daily
- [ ] Packing queue readable at 375px (field mode is a phone in a cold room)

## Handoff to P5

P5 may assume: every order that leaves P4 is `delivered`, `picked up`, or loudly flagged (`needs_attention` / dispatch-failed / SLA breach) — no silent limbo states. P5 owns what happens when the flag is raised and the human enters the loop.

## Red team

1. **The enumerator:** loops `DDK-20260719-0001..0400` against the open endpoint at 23:00 and tweets your daily order count. Backlog #3 closes it; until then your revenue is public API.
2. **The vanished GoSend driver:** accepts, drives halfway, cancels. Biteship webhook fires `cancelled` → dispatchStatus failed, WA sent — but the box has been at ambient temperature for 40 minutes. SOP must include a cold-chain judgment call: re-ice + rebook (≤1h ambient) or pull stock + refund (>1h). Write the threshold into L3; the system can't measure temperature, the SOP must.
3. **The Friday 15:55 pile-up:** three bookings fail at once (wallet dipped below the real floor). Retry cron hammers three re-bookings that all fail again, burning attempts toward the `failed` cap while the actual fix is a top-up. Retry logic should back off when ≥2 consecutive failures share an error class (wallet/balance), and the WA alert should say "TOP UP WALLET" not "dispatch gagal ×3".
