# L3 — LOGISTICS: Cold Chain & Geography

> Layer owner: LOGISTICS. Ground truth: `lib/shipping/constants.ts` (tiers, Borzo excluded, Paxel 5kg cap, instant 15kg cap, origin −6.958/107.636), GO-LIVE-CHECKLIST §3 Biteship. PRD §8 fully deprecated.

## Executive summary

- **None of our couriers is a true cold chain end-to-end.** Kilat bikes have zero cooling; Paxel/AnterAja frozen services are chilled-hub networks with ambient last-mile; intercity "frozen" services are really *fast + our packing*. Our real cold chain is **our packing + elapsed time** — so geography policy is time policy.
- Launch geography should be **hard-blocked, not soft-warned**: Phase 0 Bandung Raya (Kilat + pickup), Phase 1 adds Jabodetabek + West Java (frozen_same_day), Phase 2 adds Java overnight lanes (frozen_express). Outside polygon → WhatsApp CTA, no checkout.
- The nastiest UX-financial trap is **weight-driven tier migration**: a cart crossing 5kg silently loses Paxel, crossing 15kg loses Kilat. Policy: show the gate *before* it bites ("tambah 1 pack lagi → hanya bisa kurir reguler frozen").
- Biteship wallet float is in our favor (customer pays Day 0, wallet debited at booking) but rate drift between quote and booking is absorbed by the 20% markup — that's a second, unstated job of the markup (L2 Rule 2).
- Automation stops at the second failed dispatch: after retry, a human books manually or calls the customer. Cron retries beyond that only delay the honest WA message.

## Core question

Where and how may we ship frozen food without breaking cold-chain credibility?

## Depth analysis table

| Depth | Current state | Risk | Recommendation |
|---|---|---|---|
| **D1 Surface** | Three tiers quoted live; disabled options show reasons | Customers can select technically-available but thermally-unwise lanes (e.g. frozen_express to Sumatra, 3 days) | Hard geographic blocks; ETA >48h = not offered at all |
| **D2 Operational** | Warehouse books courier post-packing; retry cron exists | Afternoon bookings miss courier pickups → package sits overnight, packed with melting gel | Cut-offs: Kilat book by 16:00; same-day/intercity book by 12:00 or ship next morning |
| **D3 Financial** | Wallet debited at booking; markup 20% | Rate drift + failed-then-rebooked orders double-charge risk; intercity packing eats margin (L2 archetype 3) | Wallet floor rule (L2 Rule 9); intercity min order Rp 250k |
| **D4 Strategic** | Shopee ships nationally via marketplace logistics | We cannot out-ship Shopee nationally; we can out-fresh it locally | Compete on Bandung/Jabodetabek freshness; concede national to Shopee for now |
| **D5 Existential** | One spoiled intercity order can go viral (L1 pre-mortem) | Expanding geography before packing is proven = brand roulette | Phase gates below with numeric criteria, not vibes |

## Tier truth table (courier marketing vs frozen dimsum reality)

| Tier | Couriers | Marketing claim | Thermal reality | Honest window |
|---|---|---|---|---|
| express (Kilat) | GoSend, GrabExpress | "instant" | No cooling; our cooler bag + gel only | ≤3h door-to-door, Bandung Raya only |
| frozen_same_day | Paxel, AnterAja (ice/frozen/same filter) | "frozen delivery" | Chilled hubs, ambient last-mile hops | Same/next day, ≤5kg (Paxel), metro lanes |
| frozen_express | SiCepat, JNE, AnterAja | "frozen/next-day" | Speed + our insulation; no active cold guarantee | ≤48h lanes only; our packing must survive 48h — **test before Phase 2** |
| pickup | — | — | Customer-owned from handover | Full control until handover |

Borzo stays excluded (no frozen handling posture). JNE REG-class services must stay filtered out even though the `serviceFilter` regex (`/best|frozen|yes|reg/i`) currently *matches "reg"* — that is a policy statement for the go-live courier check in Biteship dashboard (checklist §3 already says "no JNE REG"): **the dashboard-level courier/service allowlist, not the regex, is the enforcement layer.**

## Stakeholder rotation

- **Ibu RT (Bandung)**: Kilat is the product. She wants "sampai sebelum masak sore." Cut-off clarity matters more than speed.
- **Warehouse staff**: one packing recipe per tier, printed. Gel count varies by tier, not by judgment call.
- **Bashara**: every new geography = new failure modes on his phone at night. Phase gates protect his hours (L4).
- **Brand owner**: national reach flatters the brand but Phase 2 spoilage hurts it everywhere. ⚠️ **STAKEHOLDER CONFLICT**: brand wants reach, ops wants containment. Resolution: numeric phase criteria — reach is earned, not declared.

## Major decisions & options

### Decision 1 — Launch geography
(A) National day 1 (checklist implies capability) — failure: untested 48h packing, worst-margin orders, L1 pre-mortem comes true. (B) **Phased polygon with hard blocks (recommended)** — failure: some lost orders outside polygon (captured via WA CTA as demand data). (C) Radical simplify: Bandung-only + pickup for 90 days — failure: forfeits Jabodetabek, the largest addressable frozen D2C market, while Paxel lane is genuinely decent. **Recommendation: B.** Irreversibility 3 (expanding is easy; retreating from announced national coverage is R2), Confidence **High**.

### Decision 2 — Hard block vs soft warning outside polygon
(A) Soft warning + let them buy — failure: customer accepts risk in the moment, blames brand on arrival; disclaimers don't survive Instagram. (B) **Hard block + WhatsApp CTA (recommended)** — failure: lost marginal revenue; mitigated by manual WA-arranged shipments as experiments. (C) Block delivery, allow pickup nationally — trivially yes, pickup has no geography. **Recommendation: B.** Irreversibility 2, Confidence **High**.

### Decision 3 — Weight-gate UX policy
(A) Let tiers silently disappear as weight crosses gates (current behavior) — failure: "kemarin bisa instant, sekarang kok tidak" confusion, abandoned carts. (B) **Announce gates in cart before checkout (recommended)**: "Pesanan di atas 5kg dikirim kurir reguler frozen (1–2 hari)" — failure: mild copy overhead. (C) Cap cart weight at 5kg entirely (radical simplify) — failure: kills legitimate large family/B2B-ish orders. **Recommendation: B**, plus intercity minimum order Rp 250k so worst-margin lanes at least carry multi-item spread. Irreversibility 1, Confidence **Medium** (watch cart-abandonment at gate weights).

### Decision 4 — Dispatch failure automation boundary
(A) Retry cron indefinitely — failure: customer silence while robot flails; also checklist notes the retry cron's auth is unverified (treat as: automation not yet trustworthy). (B) **One auto-retry, then human (recommended)**: failed booking → 30-min retry → still failed → WA alert to ops → manual booking in Biteship dashboard or personal WA to customer with new ETA — failure: costs founder minutes; that's the correct trade. **Recommendation: B.** Irreversibility 1, Confidence **High**.

## Geographic launch map

| Phase | Coverage | Tiers on | Entry criteria (all numeric) |
|---|---|---|---|
| **Phase 0** (Week 0) | Bandung Raya (Kota Bandung, Cimahi, Kab. Bandung inner) + pickup | pickup, express | Go-live UAT passed |
| **Phase 1** (Week 2–4) | + Jabodetabek + West Java metro lanes | + frozen_same_day | ≥50 Phase-0 orders; spoilage complaints <2%; dispatch-failure rate <5%; 3 successful test shipments to Jakarta (self-addressed, temperature-checked on arrival) |
| **Phase 2** (Week 6–12) | + Java overnight lanes (≤48h ETA cities: Cirebon, Semarang, Yogya, Solo, Surabaya) | + frozen_express | ≥200 cumulative orders; 5/5 successful 48h packing tests; refund reserve funded (L2 Rule 8); insurance claim SOP written (L1 Decision 3C) |
| **Never (V1)** | Sumatra/Kalimantan/Sulawesi/Bali >48h lanes, any lane ETA >2 days | — | Route to WhatsApp manual handling only |

## Tier eligibility matrix

| Weight × destination | Bandung Raya | Jabodetabek/West Java | Java ≤48h | Beyond |
|---|---|---|---|---|
| ≤5kg | Kilat, same-day, express | same-day, express | frozen_express | blocked → WA |
| 5–15kg | Kilat, frozen_express | frozen_express | frozen_express (Phase 2, min Rp 250k) | blocked |
| >15kg | frozen_express only | frozen_express | manual/WA (quasi-B2B) | blocked |

Season note: Ramadan/Lebaran (courier overload) → suspend Phase-2 lanes for the H-7..H+7 window; rainy-season afternoons in Bandung → move Kilat cut-off earlier (16:00→15:00) since delays double exposure time.

## Courier trust tier list

- **Primary**: Paxel (only courier with genuine frozen positioning ≤5kg), GoSend (Bandung Kilat).
- **Fallback**: GrabExpress (Kilat), AnterAja frozen services (same-day + intercity), SiCepat frozen (intercity).
- **Probation**: JNE YES (speed yes, frozen handling unproven — allow, watch first 10 shipments).
- **Never**: Borzo (already excluded), any REG/economy/cargo service, any lane ETA >48h.

Promotion/demotion is data-driven monthly: a courier with >1 spoilage or >2 lost-parcel incidents per 50 shipments drops a tier.

## Pre-mortem (90 days)

October 2026: logistics killed trust not with one disaster but with drip. Phase 1 opened after 20 orders instead of 50; Jakarta afternoon bookings kept missing Paxel pickup windows so packages sat overnight; three arrived "dingin tapi lembek"; each got quietly refunded (Rule 7 saved the ledger) but repeat rate for Jakarta cohort hit 0%. Meanwhile the wallet ran dry on a Saturday — Monday-only top-up ritual (Rule 9) had been skipped — and 9 orders sat undispatched for 36 hours. The failures were cadence failures: cut-offs and rituals existed on paper but had no enforcement in the daily card. L4 owns the fix.

## Dependency graph

```text
UNLOCKS: L1 SLA copy per tier; L4 packing recipes + cut-off schedule; L5 Phase-based marketing (never advertise a lane before its phase)
BLOCKS:  national launch announcement; frozen_express marketing before 48h packing tests; Ramadan-window intercity promos
REQUIRES: founder-run packing tests (3× Jakarta, 5× 48h self-shipments); confirmed courier allowlist in Biteship dashboard; final Bandung Raya polygon boundary
```

## [FOUNDER DECISION] items

1. **Ratify phase criteria numbers** (50 orders / <2% spoilage / 5 packing tests) — these gate your growth pace.
2. **Bandung Raya polygon edge**: include Kab. Bandung Barat / Jatinangor or not? (Kilat time budget says: only if ≤3h realistic.)
3. **Intercity minimum order Rp 250k** — ratify or adjust.
4. **Ramadan policy**: suspend Phase-2 lanes entirely vs extended-ETA warnings.

## Decision Record

DapurDekaka.com ships on a phased hard-blocked polygon: Phase 0 Bandung Raya (pickup + Kilat), Phase 1 Jabodetabek/West Java (adds cold-chain same-day) after 50 clean orders and 3 verified Jakarta test shipments, Phase 2 Java ≤48h lanes (adds frozen_express, min order Rp 250k) after 5 successful 48-hour packing tests, and no lanes beyond 48h ETA in V1 — out-of-polygon demand routes to WhatsApp. Weight gates (5kg Paxel, 15kg instant) are announced in cart before they bite; dispatch automation stops after one retry and hands to a human; the courier allowlist in the Biteship dashboard is the enforcement layer for cold-chain-only services. PRD §8 (RajaOngkir couriers, city-ID origin, no-markup shipping) is deprecated in full; this document plus `lib/shipping/` is the source of truth.
