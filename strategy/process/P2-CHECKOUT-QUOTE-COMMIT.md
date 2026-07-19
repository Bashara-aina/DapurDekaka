# P2 — CHECKOUT → QUOTE COMMIT

> Layer owner: PROCESS. Scope: identity → address/maps → shipping tiers → insurance/ack → coupon → points → summary → "Bayar" tap (before Midtrans opens).
> Ground truth: `app/(store)/checkout/page.tsx`, `components/store/checkout/**`, `app/api/shipping/rates/route.ts`, `lib/shipping/**`, `app/api/checkout/validate-coupon/route.ts`, `app/api/checkout/initiate/route.ts` (validation half). Date: 2026-07-19.
> Depends on: P1 (cart truth), L1 (promise language), L2 (coupon/points caps), L3 (tiers, cutoffs, phase gates). Feeds: P3.
> Non-goals: Snap token lifecycle, settlement, stock deduction (P3).

## Executive summary

- Server re-validation at initiate is **genuinely strong**: prices re-fetched (`initiate/route.ts:117-179`), quote re-fetched and re-priced via `validateSelectedQuote` (`lib/shipping/validate-checkout.ts:86-121`), markup verified (`lib/shipping/markup.ts`), insurance fee verified (`lib/shipping/insurance.ts`), points capped at 50% of subtotal (`initiate/route.ts:339-340`), coupon caps per L2 (`lib/constants/financial-rules.ts`). The commit contract is trustworthy.
- The **phase gate fires in the wrong place**: `enforceShippingPhaseGates` runs only inside initiate (`initiate/route.ts:530-540`), while `app/api/shipping/rates/route.ts` has **no phase filtering** — frozen tiers are quoted, rendered in `ShippingTierTabs`, selected, acknowledged… then 503 "belum tersedia" at the very last tap. A guaranteed dead-end funnel for every frozen-tier customer until phase1.
- **Cutoff messaging exists only as a library**: `lib/shipping/cutoffs.ts` (`express_payment: 14:00 WIB`, booking 16:00, same_day/intercity 12:00) is consumed by `lib/shipping/policy.ts` but no checkout component renders "bayar sebelum jam X" — the single most important honesty string for frozen food is not shown where the decision happens.
- **Address is under-constrained for delivery**: `initiateSchema` marks `addressLine`, `district`, `postalCode` all optional (`initiate/route.ts:65-71`); only `selectedQuoteId + lat/lng` are enforced (`:458-460`). P4's dispatch route then books Biteship with `destinationAddress: order.addressLine ?? ''` — an empty street address on a real courier booking.
- Express cooler-bag acknowledgment is enforced twice server-side (`initiate/route.ts:464-466`, `validate-checkout.ts:119-121`) — good. Insurance UI (`InsuranceSelector`, 0.2%/0.5% of subtotal) exists but L1 Decision 3 questioned launch-time insurance; the claim SOP behind it does not exist yet (see P5) — selling insurance you can't adjudicate is a promise you can't keep.

## Core question

When the customer taps "Bayar", is every number and promise on the summary card (price, ongkir, ETA, cutoff, insurance, discount) one the system can actually honor?

## Happy-path swimlane

| # | Actor | System | State change | Customer-visible effect | Ops action |
|---|-------|--------|--------------|------------------------|-----------|
| 1 | Customer | `IdentityForm` (guest or session) | none | name/email/phone captured | none |
| 2 | Customer | `DeliveryMethodToggle` → pickup ends at 6 | none | pickup panel or address step | none |
| 3 | Customer | `AddressMapPicker` + `/api/shipping/maps/autocomplete` (Biteship maps) | none | pin + `biteship_area_id` + lat/lng | none |
| 4 | System | `POST /api/shipping/rates` → `getShippingRates` → eligibility (`eligibility.ts`: Borzo excluded, express ≤15kg, Paxel ≤5kg) → ranking → markup (`applyMarkup`, +20% ceil) | none | `ShippingTierTabs`: Express / Same-Day / Frozen Express with customer prices | none |
| 5 | Customer | selects quote; if tier=express → `InstantDeliveryAck` checkbox; `InsuranceSelector`; `CouponInput` → `POST /api/checkout/validate-coupon`; `PointsRedeemer` | none | order summary updates | none |
| 6 | Customer | taps Bayar → `POST /api/checkout/initiate` (P3 boundary) | order row created `pending_payment` | Snap opens | none |

## Depth analysis table

| Depth | Current state | Break mode | Customer impact | Solo-ops impact | Recommendation |
|-------|---------------|-----------|-----------------|-----------------|----------------|
| D1 Surface | Tier tabs show whatever Biteship returns; no cutoff copy; ETA from courier marketing | Post-14:00 buyer picks "same day", gets tomorrow | Broken promise on first order | WA "kok belum sampai?" | Render `getCutoffStatus(tier)` per tab: "Pesan sebelum 12.00 WIB untuk kirim hari ini" |
| D2 Operational | Phase gate only at initiate; rates show frozen tiers in phase0 | 503 `PHASE_NOT_READY` after full form completion | Dead-end at last tap; feels broken | Zero signal — customer just leaves | Filter tiers in `/api/shipping/rates` by `resolveEffectivePhase()`; show locked tabs with honest copy instead |
| D3 Financial / Inventory | Coupon caps (Rp 15k / 10% / min Rp 100k), points ≤50% subtotal, markup + insurance verified server-side | Client tampering | none — server wins | none | Keep; add one integration test per cap |
| D4 Strategic | Guest checkout allowed, no points for guests (enforced: points path requires `userId`, `initiate/route.ts:387-389`) | Guests double-dip per-user coupons via emails | margin leak bounded by maxUsesPerUser email check (`:419-432`) | manual coupon audits | Accept; per-L2 caps make the leak ≤ Rp 15k/email |
| D5 Existential brand risk | ETA/insurance/ack language is the promise surface; "bundled handling" framing for markup per L2 | UI says "asuransi ganti 100%" with no claim SOP | Melted-package claim denied → public rage | dispute hours | Either ship the claim SOP (P5) or hide `InsuranceSelector` at launch |

## State machine

Checkout session states (client, enforced by step components):

```
IDENTITY → METHOD → ADDRESS(delivery only) → QUOTE_SELECTED → EXTRAS(ack/insurance/coupon/points) → SUMMARY_TRUE → INITIATED
```

Allowed regressions: any step back edits invalidate `selectedQuoteId` → must re-run rates (QUOTE_SELECTED reset).
Illegal transitions (must stay impossible):
- `SUMMARY_TRUE → INITIATED` with `tier=express` and `courierInstantAck=false` (blocked server-side ✅)
- `SUMMARY_TRUE → INITIATED` with stale quote (blocked: re-quote at initiate compares `actualCost`; mismatch → 409 "Tarif ongkir tidak valid" ✅)
- `ADDRESS → QUOTE_SELECTED` without lat/lng (blocked ✅) — but **legal today with empty `addressLine`** (must become illegal)
- Any frozen-tier selection in phase0 (today legal until initiate — must become illegal at rates)

## Failure matrix

| Failure | Detection | Auto-recovery | Human SOP | Customer message | Money effect | Max time-to-ack |
|---|---|---|---|---|---|---|
| Rates API/Biteship down | rates 5xx | retry button | if >30 min: enable pickup-only banner | "Ongkir tidak dapat dimuat, coba lagi / pilih ambil di toko" | lost orders | 30 min (Bashara notices WA silence + tests checkout) |
| Quote price changed between render and pay | initiate 409 (`validate-checkout.ts:108-113`) | UI must re-fetch rates | none | "Tarif pengiriman berubah, silakan pilih ulang kurir" | none | instant |
| Phase gate 503 at initiate | HTTP 503 `PHASE_NOT_READY` | none | none | today: generic error. Needed: "Layanan Same-Day belum tersedia di area Anda" + fallback tiers | lost order | fix at rates (P0) |
| Pin dropped in wrong spot / area_id mismatch | none | none | Bashara notices weird ongkir when packing | needed: reverse-geocode confirmation line under pin | wrong ongkir, failed pickup | pre-launch fix |
| Coupon valid at validate, dead at initiate (maxUses raced) | initiate 409 | none | none | "Kupon sudah mencapai batas penggunaan" | none | instant |
| Empty `addressLine` passes | **none until courier calls** | none | Bashara edits order + re-books | courier WA "alamatnya mana?" | re-dispatch cost | pre-launch fix |
| Insurance selected, claim later denied | P5 dispute | n/a | P5 SOP | must match `/trust` page wording | refund reserve | n/a here |

## Stakeholder rotation

- **Ibu RT:** reads "GoSend Instant — 2 jam" as a contract. If cooler-bag ack text is legalese, she taps without reading; keep `InstantDeliveryAck` to one sentence of consequence, not terms.
- **Warehouse:** every under-specified address is his failed pickup at 15:45 before the 16:00 booking cutoff.
- **Bashara:** phase-gate dead-ends generate zero telemetry today — he cannot see the customers he loses at the last tap. Rates-level filtering turns an invisible loss into a visible locked tab.
- **Brand owner:** "bundled handling" markup framing (L2 Decision 1) must never appear as a line item named "markup". Current Midtrans item naming uses `Ongkir {courier}` (`initiate/route.ts:900`) — compliant. **Conflict:** growth wants frozen tiers teased in phase0; trust wants them hidden. Recommend visible-but-locked with criteria-free copy ("Segera hadir untuk area Anda").

## Major decisions (max 3)

### Decision 1 — Phase gating location
A: Filter/lock frozen tiers at `/api/shipping/rates` using `resolveEffectivePhase()` (initiate keeps its gate as backstop). B: status quo (gate only at initiate).
**Recommend A.** R0, confidence high. Would change my mind: nothing; a last-tap 503 is indefensible UX.

### Decision 2 — Insurance UI at launch
A: Hide `InsuranceSelector` until the P5 claim SOP exists; fold basic protection into the L1 "ganti atau refund" promise. B: keep selector (0.2%/0.5% revenue).
**Recommend A** — kill this sacred cow. Insurance revenue on 50 orders ≈ Rp 50–150k; one denied claim costs the brand. R1 (schema + order rows already support it; re-enable is a flag flip). Confidence: medium-high. Would change my mind: Biteship insurance claims turn out to be genuinely operable by one person (test one claim in sandbox/real life first).

### Decision 3 — Address completeness contract
A: For `deliveryMethod=delivery`, require `addressLine` (min 10 chars) + `postalCode` + `biteshipAreaId` in `initiateSchema`; show reverse-geocoded text under the pin for confirmation. B: keep lat/lng-only truth.
**Recommend A.** R0, confidence high. Lat/lng is enough for instant couriers, not for Paxel/SiCepat waybills.

## Founder decisions required

- **[FOUNDER DECISION #2]** Phase0 frozen tabs: fully hidden, or visible-but-locked with "Segera hadir" copy? (Recommend locked-visible: it seeds demand and explains scope; hiding is cleaner but mutes the roadmap.)
- **[FOUNDER DECISION #3]** Insurance at launch: hide (recommended) or keep with a written claim SOP you commit to executing solo within 48h of any claim?

## Implementation backlog (ordered)

**P0**
1. `code` — `app/api/shipping/rates/route.ts`: apply `resolveEffectivePhase()`; return frozen tiers with `locked: true` + reason in phase0. Acceptance: in phase0, no selectable frozen quote reaches the client; initiate 503 becomes unreachable in normal flow. Effort M. Risk if skipped: every frozen-tier attempt dead-ends post-form.
2. `code` — `initiate/route.ts:65-71` zod: `addressLine`/`postalCode` required when `deliveryMethod=delivery`. Acceptance: delivery initiate without street address returns 400 before order creation. Effort S. Risk: couriers dispatched to empty addresses (P4 already books with `?? ''`).
3. `copy+code` — cutoff line per tier tab from `getCutoffStatus` (`lib/shipping/cutoffs.ts`): id "Pesan & bayar sebelum {jam} WIB untuk pengiriman hari ini", en "Order & pay before {hour} WIB for same-day dispatch". Acceptance: after 14:00 WIB the express tab shows tomorrow's promise, at 375px, both locales. Effort M. Risk: broken same-day promises from day 1.

**P1**
4. `code` — dedupe `initiate/route.ts:511-516` (courier fields assigned twice — cosmetic but it signals unreviewed merge). Effort S.
5. `config/copy` — hide `InsuranceSelector` behind a system setting default-off (pending FD#3). Effort S.
6. `code` — reverse-geocode confirmation string under `AddressMapPicker` pin. Effort M.
7. `copy` — 503/422 gate responses already carry id-language messages; ensure checkout renders `PHASE_NOT_READY` and `INTERCITY_MIN_ORDER` codes distinctly (en fallback via next-intl). Effort S.

**P2**
8. `code` — persist a `checkoutDraft` (sessionStorage) so a rates failure doesn't wipe the form on mobile refresh. Effort M.
9. `DEFER` — saved-address default selection heuristics beyond `SavedAddressPicker`. Trigger: >30% repeat-customer rate.

## Definition of Done for this phase

- [ ] Phase0 checkout can never offer a selectable frozen quote
- [ ] Delivery orders cannot be created without street address + postal code
- [ ] Every tier tab shows its live cutoff sentence (id/en, 375px)
- [ ] Express selection is impossible without cooler-bag ack (server 409 verified by test)
- [ ] Coupon/points/insurance/markup all verified server-side (existing — regression-tested)
- [ ] A quote-changed 409 re-opens the shipping step with fresh rates, not a dead toast

## Handoff to P3

P3 may assume: the order row it creates carries a validated quote (customerCost, actualCost, markup), a complete address, an acknowledged express risk, capped discounts, and a total the customer has seen. P3 owns everything after `POST /api/checkout/initiate` executes.

## Red team

1. **The replayer:** captures the initiate payload and replays it with `insuranceFee: 0`, `customerShippingCost: 1` — server recomputes and 409s (`verifyInsuranceFee`, `verifyCustomerShippingCost`). But he can replay the *identical* payload every 50s and mint parallel `pending_payment` orders beyond the 30/60s idempotency windows (`initiate/route.ts:345-385`) — harmless to stock (none held) but it spams the daily counter and packing dashboards. Rate limit (10/min) blunts it; accept.
2. **The pin troll:** drops the map pin on Gedung Sate, writes his real address in `customerNote`. Courier goes to the pin. Reverse-geocode confirmation (backlog #6) makes his "you delivered wrong" claim self-refuting because the confirmed text is stored on the order.
3. **Biteship flaky Friday:** rates succeed at 11:58, initiate re-quote at 12:04 returns different same-day pricing → 409 "pilih ulang kurir" → customer's cutoff has now passed → tomorrow's promise. Honest, but only if the cutoff line (backlog #3) is live; otherwise it reads as the shop lying twice.
