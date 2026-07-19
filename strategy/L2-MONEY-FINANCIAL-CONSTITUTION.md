# L2 — MONEY: Financial Constitution

> Layer owner: MONEY. Evidence base: DEEP-AUDIT-01 (points-on-gross-subtotal, missing refund ledger, coupon race, B2B silent 2x) used as **policy signals**, not a bug list. PRD Sections 6 and 8.3 partially deprecated below.

## Executive summary

- The operator's real income is **product spread (Rp 15–18k) + shipping markup (Rp 3–16k)** per order. Killing the markup cuts operator income ~20–45% depending on tier — this is why the "PRD says no markup" tension matters financially, not just ethically.
- Three money rules are currently *implicit in code* and must be made explicit constitution or changed: points earn on gross subtotal (pre-discount), B2B earns silent 2x, and paid-order cancellations create **no refund obligation record**. The last one is the dangerous one.
- Biteship wallet is a **float business**: customers pay shipping Day 0, the wallet is debited at booking Day 0–3. The float is in our favor, but a dry wallet halts all dispatch — treat wallet balance as inventory.
- Net-30 B2B credit is **rejected for V1**. A solo operator cannot chase invoices; the downside is one Rp 5jt unpaid catering order erasing a month of margin.
- The 10-rule constitution below is written so every future feature question becomes "does it violate a rule?" instead of a fresh debate.

## Core question

What are the immutable financial rules before accepting real payments?

## Depth analysis table

| Depth | Current state | Risk | Recommendation |
|---|---|---|---|
| **D1 Surface** | Customer sees subtotal − coupon − points + ongkir(+markup) + insurance | Line items must never let markup be reverse-engineered | Bundled ongkir line per L1; points value always shown in IDR |
| **D2 Operational** | Coupon count increments at webhook; stock deducts at webhook; pickup has no deduct-at-handover concept | Operator has no daily money reconciliation ritual | Add "money minute" to L4 daily card: Midtrans settled vs orders paid vs wallet balance |
| **D3 Financial** | Points on gross subtotal; no refund ledger; wallet float untracked | 50%-off coupon + full points = paying customers ~3.5% of discounted revenue back in points on money never received | Rules 3, 6, 7 below |
| **D4 Strategic** | Website margin ≈ Rp 18–34k/order all-in; Shopee takes ~10–12% fees from brand | Our channel is structurally the highest-margin one for the operator — protect the ladder, don't discount into it | Coupons capped at levels that keep web price ≥ offline (Rule 9) |
| **D5 Existential** | A refund wave (cold-chain scandal) has no reserve behind it | 20 refunds × Rp 200k = Rp 4jt cash out in a week with no provisioning | Rule 8: refund reserve = 5% of weekly gross until data says otherwise |

## Stakeholder rotation

- **Ibu RT**: cares about total and whether points feel real. Points must never silently shrink (changing earn base later is R2 — do it *before* launch).
- **Warehouse**: touches money only via wallet-funded bookings; must never see a "wallet empty" error mid-dispatch. Wallet floor rule protects them.
- **Bashara**: the margin stack is his salary. Every discount and every refund comes out of Rp 18–34k/order.
- **Brand owner**: benefits from volume at any web margin, but bears refund reputation. ⚠️ **STAKEHOLDER CONFLICT** on aggressive couponing: operator loses margin, brand gains volume. Resolution: Rule 9 floor.

## Unit economics — 4 archetypes

Assumptions (state changes if data differs): product spread Rp 15–18k/order average; Midtrans fee ~2% e-wallet/QRIS (≈0.7% VA); markup = 20% of Biteship actual; packing materials Rp 3–5k (Kilat) to Rp 12–18k (intercity, more gel + insulation).

| | 1. Small cart, Bandung, express | 2. Medium cart, Jabodetabek, frozen_same_day | 3. Large cart, intercity, frozen_express | 4. Pickup + redemption |
|---|---|---|---|---|
| Subtotal | Rp 120k | Rp 240k | Rp 480k | Rp 150k − Rp 10k poin |
| Ongkir actual (Biteship) | Rp 15–25k | Rp 30–50k | Rp 40–80k | — |
| Markup (20%) | +Rp 3–5k | +Rp 6–10k | +Rp 8–16k | — |
| Customer pays | ~Rp 138–150k | ~Rp 276–300k | ~Rp 528–576k | Rp 140k |
| Midtrans fee (~2%) | −Rp 3k | −Rp 6k | −Rp 11k | −Rp 3k |
| Packing materials | −Rp 4k | −Rp 8k | −Rp 15k | −Rp 1k |
| Product spread | +Rp 15k | +Rp 18k | +Rp 25k (multi-item) | +Rp 15k |
| Points liability (Rule 3 base) | −Rp 1.2k | −Rp 2.4k | −Rp 4.8k | −Rp 1.4k |
| **Operator net / order** | **~Rp 10–12k** | **~Rp 8–12k** | **~Rp 2–10k** | **~Rp 10k − poin cost** |

Reading: intercity large orders are the *worst* net-margin-per-risk orders — highest packing cost, highest spoilage exposure, thinnest buffer if the 20% markup underestimates real handling. This feeds L3's decision to phase intercity, and refutes the instinct that "big orders are the best orders."

## Margin stack (per delivery order)

```text
Customer payment (Midtrans)
 ├─ Midtrans fee (~0.7–2%)            → Midtrans
 ├─ COGS (brand price / offline base) → Dapur Dekaka brand
 ├─ Shipping ACTUAL                   → Biteship wallet (debited at booking)
 ├─ Packing materials (gel/insulasi)  → operator cost
 ├─ Points liability (1/1000)         → deferred cost, redeemed later
 └─ RESIDUAL = product spread + shipping markup − refunds
                                      → Bashara (operator income)
```

## Major decisions & options

### Decision 1 — Markup: adopt, amend, or disclose
Options: (A) adopt 20% hidden as-is — failure: L1 disclosure risk; (B) **adopt 20% but reframe as bundled handling fee (recommended, pairs with L1 Option B)** — failure: none material; (C) zero markup (radical simplify) — failure: cuts operator net ~30% avg and removes the buffer that absorbs Biteship rate drift between quote and booking; (D) flat handling fee Rp 8k all tiers — failure: under-recovers intercity, over-charges Kilat. **Recommendation: B.** Irreversibility 3, Confidence **High**. PRD 8.3 "no markup" is deprecated.

### Decision 2 — Points earn base
Options: (A) gross subtotal (current code) — failure: coupon+points stacking pays loyalty on money never received; (B) **subtotal net of coupon and points redeemed, excluding shipping (recommended)** — failure: slightly smaller headline earn, invisible at launch since no customer has history; (C) total paid incl. shipping — failure: rewards expensive geography, weird incentives. **Recommendation: B, changed before first real order** (R0 now, R2 after customers accrue balances). Irreversibility 7 if deferred, Confidence **High**.

### Decision 3 — Net-30 B2B
Options: (A) offer at launch — failure: solo founder becomes a collections agency; one default > a month of margin; (B) **inquiry-only, 100% prepaid B2B (recommended, radical simplify)** — failure: may lose one hotel deal (acceptable; see L5); (C) 50% DP / 50% on delivery — failure: still requires chasing. **Recommendation: B for 90 days.** Irreversibility 2, Confidence **High**. B2B 2x points also deferred (see Rule 10).

### Decision 4 — Pickup stock timing
Options: (A) **deduct at payment (recommended)** — failure: no-show holds stock (mitigate: auto-release after 48h, refund minus nothing — goodwill); (B) deduct at handover — failure: overselling between payment and pickup, which is a *promise breach* (paid ≠ reserved); (C) defer decision — invalid, checkout is live-path. **Recommendation: A.** Irreversibility 4, Confidence **High**. This is inventory *policy*; the audit's pickup findings are implementation.

## THE FINANCIAL CONSTITUTION — 10 immutable rules

1. **All prices are integer IDR, set manually; website price sits strictly between offline and Shopee.** The ladder is the business model; no promo may invert it.
2. **Shipping is charged as one bundled "Ongkir & Penanganan Frozen" line = Biteship actual + 20%; we never claim courier-rate pass-through.** The markup is the operator's handling fee and the buffer against rate drift.
3. **Points earn on the amount the customer actually paid for products (subtotal − coupon − points redeemed, excluding shipping), 1 pt / Rp 1.000, floor-rounded.** No loyalty paid on money not received.
4. **Points and coupon reversals are always scoped to the specific order.** No cross-order reversal, ever. (Policy behind the audit's reversal finding.)
5. **Stock deducts at payment confirmation for every order type, including pickup; a paid order is a reserved order.** Unclaimed pickups auto-release + refund after 48h.
6. **A coupon's economic cost may never exceed the product spread: max coupon value per order = Rp 15k or 10%, whichever is lower, min order ≥ Rp 100k.** No free-shipping coupons until the mechanism exists and Rule 2 math is modeled.
7. **Every cancellation of a paid order creates a refund obligation record (amount, date, method, status) the moment it is cancelled; refunds processed within 7 days.** No untracked money owed to customers. (Policy behind the audit's refund-gap finding.)
8. **A refund reserve of 5% of weekly gross is held untouched for the first 90 days.** L1's refund-first playbook is only credible if funded.
9. **Biteship wallet balance never drops below 2× the last 7 days' dispatch cost; top-up is a Monday ritual.** Wallet-empty = business halted.
10. **B2B is 100% prepaid, standard points (no 2x multiplier), and no Net-30 for the first 90 days.** Any credit terms require a signed founder exception per deal.

## Pre-mortem (90 days)

October 2026: the site did 350 orders, yet Bashara netted almost nothing. Post-mortem shows: a launch coupon (20% off, no cap) ran for 3 weeks and inverted the ladder — regulars bought web below offline price; points accrued on gross subtotals of discounted orders; four paid cancellations were refunded late (one publicly complained) because nothing tracked them; and two intercity 8kg orders spoiled, costing Rp 900k in refunds with no reserve. Every failure maps to a rule above that existed as a code default instead of a constitution.

## Dependency graph

```text
UNLOCKS: L1 refund-first playbook (Rules 7–8 fund it); L4 Monday wallet ritual (Rule 9); L5 promo design bounds (Rule 6)
BLOCKS:  launch-week deep-discount campaigns; B2B credit deals; free-shipping vouchers
REQUIRES: founder ratification of points base change BEFORE first real order; confirmation of actual product spread per SKU (Rp 15–18k assumed)
```

## [FOUNDER DECISION] items

1. **Ratify Rule 2 (keep 20% markup, bundled)** — or choose 0%: this changes your personal income ~30%.
2. **Ratify Rule 3 points base change** — must decide before launch; it becomes R2 the day the first customer earns points.
3. **Refund reserve percentage** (suggested 5%) — a risk-appetite number.
4. **Pickup auto-release window** (suggested 48h) and whether the no-show refund is full or minus a restocking gesture.
5. **Confirm real per-SKU spread**: if actual spread is below Rp 15k on bestsellers, Rule 6 coupon caps must tighten further.

## Decision Record

DapurDekaka.com launches with a 10-rule Financial Constitution: manual integer-IDR pricing inside the offline<web<Shopee ladder; a bundled 20% shipping-handling markup replacing PRD 8.3's no-markup rule; points earned only on net product payment; order-scoped reversals; deduct-at-payment inventory for all order types including pickup; coupon cost capped below product spread with free-shipping coupons banned for 90 days; a mandatory refund-obligation ledger and 5% refund reserve; a 2×-weekly-dispatch Biteship wallet floor; and prepaid-only B2B with standard points and no Net-30. PRD Sections 6.4 (earn base), 6.2 (free_shipping availability), and 8.3 are deprecated in favor of this document.
