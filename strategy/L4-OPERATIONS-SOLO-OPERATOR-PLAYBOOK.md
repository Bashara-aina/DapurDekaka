# L4 — OPERATIONS: Solo Operator Playbook

> Layer owner: OPERATIONS. Assumption (FOUNDER_BRIEF absent): Bashara solo, 40–60 hrs/week total across building + operating + support; optional warehouse helper not confirmed. GO-LIVE-CHECKLIST treated as a menu to be challenged, not a mandate.

## Executive summary

- The binding constraint is not order volume — it is **failure handling**. Happy-path orders cost ~8–15 minutes; a failed dispatch or spoilage complaint costs 30–60 minutes and emotional budget. Capacity math must price failures in.
- Sustainable solo ceiling: **~60 orders/week (~250/month)** while still building. The PRD's 500–1000/month target requires either a helper or a feature freeze — it is not reachable solo with active development. This number should be said out loud before launch, not discovered in week 6.
- The system's automation chain (Midtrans → webhook → stock/points → Fonnte/Resend → Biteship → webhook) has **seven links that fail silently**. The daily 15-minute ritual below exists to catch silent failures, because there is no team to notice them.
- Feature kills at launch: B2B portal, blog CMS workflow, AI content tools, vouchers page, insurance UI (per L1). Every killed surface is support tickets that never get filed.
- The human fallback protocol is a feature: when automation fails twice, a personal WhatsApp from the owner converts a failure into loyalty. Budget 30 min/day for exactly this.

## Core question

What is the maximum order volume and feature surface one operator can run without silent failures?

## Depth analysis table

| Depth | Current state | Risk | Recommendation |
|---|---|---|---|
| **D1 Surface** | Full store + account + points + B2B pages built | Every visible surface generates questions; unmaintained surfaces (empty blog, dead B2B portal) look abandoned | Hide what you won't operate (kill list below) |
| **D2 Operational** | Field dashboard: packing queue → Book Courier → tracking | No written SOP; no cut-off times; no daily ritual | Daily ops card + dispatch SOP below |
| **D3 Financial** | Wallet, Midtrans settlement, refunds all in different dashboards | Money truth scattered across 3 dashboards + DB | "Money minute" in daily card; Monday wallet ritual (L2 Rule 9) |
| **D4 Strategic** | Shopee handles ops for the brand's marketplace channel | Our differentiator (fresh, personal, WA) is labor-funded; ops overload destroys the very differentiator | Cap volume before quality dips — the ceiling is a strategy, not a limitation |
| **D5 Existential** | Founder is a single point of failure (illness, travel, burnout) | 3 days offline = undispatched frozen orders = L1 disaster | "Circuit breaker": maintenance_mode + WA autoreply SOP for founder downtime; pickup-only degraded mode |

## Stakeholder rotation

- **Ibu RT**: doesn't care about our ops; she experiences ops as *silence or speed*. Rituals convert to her experience directly.
- **Warehouse staff (if hired)**: needs ≤3 taps (queue → packed → book courier) and a printed packing recipe per tier. Anything else will be skipped.
- **Bashara**: is the CS, warehouse, dev, and finance dept. The playbook's job is to make his week survivable and his absence non-fatal.
- **Brand owner**: judges the channel by complaint volume reaching her. Target: zero surprises — she hears about incidents from Bashara first, with resolution attached. ⚠️ **STAKEHOLDER CONFLICT**: dev velocity vs ops reliability compete for the same 40–60 hours. Resolution: post-launch feature freeze (Decision 2).

## Time model (minutes per order, honest)

| Order type | Pack | Book/handle | Comms/monitor | Total happy path | Failure surcharge (avg) |
|---|---|---|---|---|---|
| Pickup | 4 | 1 (verify code) | 2 | **~7 min** | +10 (no-show chase) |
| Kilat (express) | 8 (bag+gel+photo) | 3 | 3 | **~14 min** | +30 (courier no-show, address issues) |
| frozen_same_day | 8 | 3 | 3 | **~14 min** | +30 |
| frozen_express | 15 (insulation build) | 3 | 4 | **~22 min** | +45 (multi-day tracking, spoilage risk) |

At a Phase-0/1 mix (~40% pickup, 40% Kilat, 20% same-day) the blended cost is ~12 min/order + ~15% failure incidence ≈ **~17 min/order all-in**.

## Capacity model

- Ops budget while still developing: ~20 hrs/week (of 40–60 total) → 1,200 min → **~65–70 orders/week theoretical, call it 60 sustainable**.
- Feature-freeze mode (ops-dominant): ~35 hrs/week ops → **~110–120 orders/week solo max** — this is the absolute solo ceiling, with zero development.
- +1 warehouse helper (packing + booking, 5 days/week): founder does CS/money/edge cases only → **~150–180 orders/week (600–700/month)**.

**Launch ops ceiling: 60 orders/week solo.** The PRD's 500/month target = 115/week — reachable solo *only* in feature-freeze mode, comfortably only with a helper. **[FOUNDER DECISION #1]**: pre-commit the trigger — "when 2 consecutive weeks exceed 80 orders, hire the helper" — so hiring is a rule, not a crisis.

## Major decisions & options

### Decision 1 — Feature surface at launch
(A) Ship everything on GO-LIVE-CHECKLIST — failure: B2B portal, blog, vouchers, AI tools all generate maintenance and questions with zero launch revenue. (B) **Kill/hide 5 surfaces (recommended, radical simplify)**: B2B portal (landing + WA inquiry form only), blog CMS workflow (3 static posts max), AI content tools, account vouchers page, insurance UI — failure: mild "coming soon" feel; acceptable. (C) Middle: keep blog + vouchers — failure: still dilutes the 20 ops hours. **Recommendation: B.** Irreversibility 1 (all R0 re-enables), Confidence **High**.

### Decision 2 — Post-launch development posture
(A) Keep building features weeks 1–4 — failure: silent ops failures while head is in the editor. (B) **4-week feature freeze: only fixes for issues the daily ritual surfaces (recommended)** — failure: roadmap envy; that's the point. (C) Freeze except audits backlog — failure: the 176-finding rabbit hole; audits inform policy (done — L1/L2), not a work queue. **Recommendation: B.** Irreversibility 1, Confidence **High**.

### Decision 3 — Who books couriers
(A) Founder books everything — failure: founder trapped at warehouse hours daily. (B) Helper books via field dashboard — requires hiring trigger. (C) **Founder for Phase 0, pre-committed helper trigger at 80 orders/week (recommended)**. Irreversibility 2, Confidence **Medium** (depends on helper availability — a founder input).

## Daily ops card (printable, ≤15 lines)

```text
DAPUR DEKAKA — RITUAL HARIAN (15 menit, jam 08:30)
 1. □ Vercel logs: [webhooks/midtrans] errors? (2m)
 2. □ Orders stuck di pending_payment > 1 jam? → cek Midtrans dashboard (2m)
 3. □ Orders paid tapi belum di packing queue? (1m)
 4. □ Dispatch failed / retrying? → SOP Gagal Booking (1m)
 5. □ Biteship wallet ≥ 2× biaya kirim 7 hari? (1m)  [Senin: TOP UP]
 6. □ Fonnte device online? Kirim tes ke nomor sendiri tiap Senin (1m)
 7. □ WA masuk semalam — balas semua (5m)
 8. □ Kilat cut-off hari ini: pesanan paid sebelum 14:00 → pack sebelum 15:30
 9. □ Refund ledger: ada kewajiban > 3 hari? → proses SEKARANG (1m)
10. □ Stok fisik vs sistem: 2 SKU acak (1m)
SORE (16:00): semua paid orders hari ini booked / siap pickup? Jika tidak → WA personal ke customer.
```

## Dispatch SOP (pack → book → track → escalate)

1. **Pack** per tier recipe (laminated): Kilat = cooler bag + 2 gel; same-day = box + 3 gel; intercity = insulated box + 4 gel + bubble. Photo of packed order (trust ritual, doubles as dispute evidence — L1 promise #2).
2. **Book**: tap Book Courier before tier cut-off (Kilat 16:00; same-day/intercity 12:00, else next morning 09:00).
3. **Track**: verify waybill appears; tracking WA/email fired (spot-check 1/day).
4. **Escalate**: booking failed → wait auto-retry 30 min → still failed → book manually in Biteship dashboard → still failed → **personal WA to customer within 1 hour of cut-off** with new ETA or refund offer. Never let a paid frozen order cross midnight unbooked without the customer hearing from a human.

## Weekly rituals (Monday, 45 min)

Wallet top-up to floor (L2 Rule 9) · Vercel cron logs: every cron ran 7/7 days · Fonnte test message · stock reconcile full count · refund ledger review · complaint tally vs phase criteria (L3) · Maps/Cloudinary/Upstash billing glance.

## Failure catalog → response

| Failure | Detection | Response |
|---|---|---|
| Midtrans webhook missed | Ritual #2 (pending>1h but Midtrans says settled) | Manually reconcile order same morning; if recurring, treat reconcile cron as untrusted and check daily |
| Dispatch failed | Ritual #4 / Fonnte alert | Dispatch SOP step 4 |
| Fonnte device offline | Monday test / delivery-rate drop | Restart device; until online, send tracking via manual WA |
| Biteship wallet empty | Ritual #5 | Emergency top-up; halt Book Courier until confirmed |
| Redis/rate-limit down | Vercel logs | Not customer-facing; note and continue (fallback unsafe but tolerable at launch volume) |
| Founder down (sick/travel) | — | Circuit breaker: maintenance_mode ON for delivery, pickup-only banner, WA autoreply with return date |

## Pre-mortem (90 days)

October 2026: the site worked; the operator broke. Orders hit 90/week in week 5 (a mini-viral IG post), exactly between the solo ceiling and the un-pulled hiring trigger. Bashara ran three weeks at 70-hour load, the daily ritual was skipped 9 times, two missed-webhook orders sat unpacked for two days, and his replies in WA got terse — the personal warmth that *was* the differentiator disappeared first. He then over-corrected by pausing ads entirely, and momentum died. The failure wasn't capacity; it was refusing to pre-commit the helper trigger and the circuit breaker.

## Dependency graph

```text
UNLOCKS: L1 promises (cut-offs make SLAs honest); L3 phase execution (rituals feed phase criteria data); L5 realistic 90-day volume targets
BLOCKS:  launching all GO-LIVE-CHECKLIST surfaces; PRD 500–1000/month target as a Week-12 goal (solo)
REQUIRES: founder ratification of ceiling (60/wk) + hiring trigger (80/wk); helper availability; final cut-off times
```

## [FOUNDER DECISION] items

1. **Hiring trigger**: ratify "2 weeks >80 orders/week → helper" (and identify the candidate now).
2. **Cut-off times**: 14:00 payment / 16:00 booking for Kilat — matches your actual daily schedule?
3. **Circuit breaker authority**: does the owner (girlfriend) get maintenance-mode + WA duty when you're down, and is she trained on the daily card?
4. **Feature freeze length**: 4 weeks ratified, or tie to first 200 orders?

## Decision Record

DapurDekaka.com launches with a hard solo ops ceiling of 60 orders/week and a pre-committed helper trigger at two consecutive 80-order weeks; five surfaces are hidden at launch (B2B portal, blog workflow, AI tools, vouchers page, insurance UI); a 4-week post-launch feature freeze holds development to ritual-surfaced fixes; daily operation runs on a 15-minute morning card and tier cut-offs (Kilat paid 14:00/booked 16:00, others 12:00), with dispatch automation handing to a human after one retry and a personal WhatsApp before any paid order crosses midnight unbooked; founder downtime triggers a pickup-only circuit breaker. The PRD's 500–1000 orders/month 3-month target is re-baselined as a with-helper target, not a solo one.
