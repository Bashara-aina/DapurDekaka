# L1 — TRUST: Customer Promise Charter

> Layer owner: TRUST. Session date: 2026-07-05. Ground truth: Shipping V2 (`lib/shipping/`), GO-LIVE-CHECKLIST.md. PRD Section 8 is **deprecated pending founder ratification** (RajaOngkir removed, tier model replaced it).
> FOUNDER_BRIEF not supplied — assumed defaults: soft launch, Bandung-first, solo ops, markup stance unresolved.

## Executive summary

- The single existential trust risk is **one melted-dimsum incident going viral**, and the tier most likely to produce it is the one that looks safest: `express` bike couriers in Bandung, which have **no active cooling** — only a cooler bag and time.
- The hidden 20% shipping markup is survivable **only if we never claim our ongkir equals courier list price**. The fix is language, not pricing: sell "Ongkir & Penanganan Frozen" as one bundled line, never itemized against Biteship rates.
- Insurance tiers (0.2% / 0.5% of item value) are **checkbox theater today** — there is no refund SOP behind them. Either back them with a written claim promise or hide the option at launch.
- The Promise Charter below deliberately promises **less than the system can technically do**, because a solo operator's worst week defines the brand, not the average week.
- WhatsApp is the trust escape hatch: every promise ends with "kalau ada apa-apa, WA kami" — that is an Indonesian-market feature, not a support cost.

## Core question

What may dapurdekaka.com honestly promise at checkout, on the tracking page, and in WA messages — given Shipping V2's courier mix and one human operating everything?

## Depth analysis table

| Depth | Current state | Risk | Recommendation |
|---|---|---|---|
| **D1 Surface** | Checkout shows 3 tiers with courier names + ETA strings from Biteship; express tier has a cooler-bag acknowledgment checkbox | Customers read Biteship's ETA as *our* promise; "frozen" in tier names implies cold chain that express doesn't have | Rename customer-facing labels: express = "Kilat (kurir motor, cooler bag)"; never put "frozen" in the express label |
| **D2 Operational** | Warehouse taps "Book Courier"; dispatch can fail and retry; WA via Fonnte | A failed dispatch after payment leaves a paying customer silent for hours | Promise dispatch *windows*, not booking times; failed dispatch triggers a **personal** WA within the same window |
| **D3 Financial** | 20% markup embedded in `customerCost`; insurance fees collected with no claim ledger | A refund demanded against an "insured" order with no payout policy = paying twice: refund + reputation | Every trust promise must map to a refund rule in L2's Financial Constitution (Rule 7) |
| **D4 Strategic** | Shopee offers free-ongkir subsidies we cannot match | Competing on ongkir price is unwinnable; competing on *frozen-handling credibility* is winnable | Position ongkir as premium handling; refuse to match marketplace subsidies (see non-promises) |
| **D5 Existential** | No dispute playbook exists; responses would be improvised | One improvised, defensive reply to "dimsum saya cair" screenshot-ed to Instagram kills the heritage brand | Ratify the dispute playbook below **before** launch; refund-first stance for cold-chain failures |

## Stakeholder rotation

- **Ibu RT**: wants certainty that frozen arrives frozen and someone answers WA. She does not compare Biteship rates; she compares *total* vs Shopee. Bundled ongkir language works for her.
- **Warehouse staff**: cannot execute nuanced promises. Every promise must compile down to "pack with ice pack X, book before HH:MM."
- **Bashara**: every promise is a personal SLA on his phone. Over-promising delivery windows means apologizing at 22:00 nightly.
- **Brand owner**: halal + heritage trust took years; the website borrows it. A cold-chain scandal damages Shopee and offline too — the brand bears risk the operator doesn't fully internalize. ⚠️ **STAKEHOLDER CONFLICT**: markup benefits Bashara, brand bears the disclosure risk. Resolution: disclosure stance (Option B below) protects both.

## Major decisions & options

### Decision 1 — Markup disclosure stance

| Option | Description | Failure mode |
|---|---|---|
| A. Keep hidden, itemize as "Ongkir" | Status quo | Customer screenshots Biteship/Shopee rate for same courier, cries markup — trust hit is public and R2-hard to undo |
| B. **Bundle & rename (recommended)** | One line: "Ongkir & Penanganan Frozen (termasuk ice gel + kemasan)" — no claim of pass-through | Slightly higher sticker vs marketplace; needs one honest FAQ answer |
| C. Transparent split fee | "Ongkir Rp X + Biaya Penanganan Rp Y" | Invites line-item bargaining in WA; more checkout friction |
| D. Radical simplify: zero markup | Drop `SHIPPING_MARKUP_PERCENT` to 0 | Erases ~Rp 3–16k/order of operator income; margin then rests entirely on product spread (see L2) |

**Recommendation:** Option B. Irreversibility 3 (R0 — copy change), Confidence **High**. Would change my mind: WA complaints specifically dissecting the ongkir line in the first 30 days.

### Decision 2 — Express tier promise

| Option | Description | Failure mode |
|---|---|---|
| A. Promise "tetap beku" | Marketing-friendly | A 90-minute Grab ride in 33°C afternoon breaks it; provably false promise |
| B. **Promise the method, not the outcome (recommended)** | "Dikemas dengan cooler bag + ice gel, disarankan langsung masuk freezer" + required acknowledgment | Some customers still complain; playbook handles it |
| C. Kill express tier at launch | Frozen-only couriers | Loses the highest-margin, lowest-effort Bandung same-day orders — the core Phase 0 business |

**Recommendation:** Option B. Irreversibility 2, Confidence **High**. The existing checkbox is necessary but not sufficient — the *language* on it must be plain: "Kurir motor tidak memiliki pendingin aktif."

### Decision 3 — Insurance at launch

| Option | Description | Failure mode |
|---|---|---|
| A. Ship both tiers as-is | Collect 0.2%/0.5% fees | First claim exposes there's no payout SOP — worse than no insurance |
| B. **Defer/hide insurance UI at launch (recommended, radical simplify)** | Config-level hide; replace with blanket promise: cold-chain failure = replace or refund, insured or not | Small fee revenue foregone (trivial at launch volume) |
| C. Keep premium only for intercity, with written claim policy | Real protection where risk is real | Requires writing + honoring a claim SOP on day 1 |

**Recommendation:** Option B for Week 0–4, migrate to C when intercity opens (L3 Phase 2). Irreversibility 2, Confidence **Medium** — would change with Biteship's own insurance claim terms, which may make C nearly free to honor. **[FOUNDER DECISION #1]** below.

## The Customer Promise Charter

**We promise (max 12):**
1. Semua produk halal dan diproduksi Dapur Dekaka Bandung — same product as offline/Shopee.
2. Setiap paket dikemas beku dengan ice gel dan kemasan insulasi, difoto sebelum kirim (photo ritual — see L4).
3. Pesanan pickup siap sesuai jam operasional; kode pickup = nomor pesanan.
4. Kilat (Bandung): dipacking dan dijemput kurir di hari yang sama jika dibayar sebelum cut-off (jam cut-off tayang di checkout).
5. Frozen Same-Day (Paxel/AnterAja): diserahkan ke kurir cold-chain hari yang sama/H+1 sebelum jam cut-off.
6. Frozen Express (antar kota): dikirim H+1 maksimal, dengan packing khusus perjalanan 1–2 hari.
7. Nomor resi dan link tracking dikirim via WA + email begitu kurir dibooking.
8. Jika produk tiba tidak layak (basi/cair karena kegagalan kirim kami), kami **ganti atau refund penuh** — tanpa debat.
9. Semua pembayaran diproses Midtrans; kami tidak pernah minta transfer manual di luar sistem.
10. Pertanyaan WA dijawab dalam jam operasional, maksimal H+1.
11. Harga website selalu di bawah harga Shopee untuk produk yang sama.
12. Pembatalan sebelum dikirim = refund penuh (diproses 1–7 hari kerja).

**We do NOT promise (max 12):**
1. Jam tiba spesifik — hanya rentang estimasi kurir.
2. Produk "tetap beku" saat tiba via kurir motor (Kilat) — kami jamin metode packing, bukan suhu saat tiba.
3. Gratis ongkir atau subsidi ongkir ala marketplace.
4. Ongkir sama dengan tarif publik kurir — ongkir kami termasuk penanganan frozen.
5. Pengiriman ke daerah di luar cakupan layanan (hard block, bukan "coba saja").
6. Same-day di hari libur/di luar jam operasional.
7. COD.
8. Kompensasi untuk keterlambatan murni di sisi kurir (kami bantu eskalasi, refund case-by-case).
9. Perubahan alamat setelah kurir dibooking.
10. Stok selalu tersedia — stok real-time bisa habis.
11. Respon WA 24 jam.
12. Harga sama dengan toko offline (offline tetap termurah — by design).

## Dispute playbook (top 5)

| Complaint | Approved stance |
|---|---|
| "Dimsum saya cair/basi" | Refund-first. Minta foto, jangan debat suhu. Ganti/refund penuh dalam 24 jam + WA personal dari owner. Log ke refund ledger (L2 Rule 7). Ini bukan biaya — ini asuransi merek. |
| "Kenapa ongkir lebih mahal dari Shopee?" | "Ongkir kami sudah termasuk packing frozen (ice gel + insulasi) dan hanya pakai layanan yang aman untuk frozen. Total harga produk + ongkir tetap lebih murah dari Shopee." Never itemize against Biteship. |
| "Paket belum sampai, resi tidak jalan" | Kami eskalasi ke kurir hari itu juga; update tiap hari via WA. Jika hilang: refund/kirim ulang, klaim ke kurir urusan kami, bukan customer. |
| "Salah item / kurang" | Foto → kirim susulan atau refund selisih, hari itu. No interrogation under Rp 50k value. |
| "Bisa nego / harga offline?" | "Harga offline hanya di toko. Website sudah termurah untuk pesan-antar. Sebagai gantinya ada poin loyalti." Hold the price ladder — it protects all channels. |

## Honest SLA language per tier

- **Pickup**: "Siap diambil hari ini selama jam buka setelah pembayaran terkonfirmasi."
- **Kilat (express)**: "Tiba 1–3 jam setelah kurir pickup (area Bandung). Dikemas cooler bag + ice gel; kurir motor tanpa pendingin aktif — mohon langsung simpan di freezer."
- **Frozen Same-Day**: "Tiba hari ini/besok via kurir cold-chain (Paxel/AnterAja). Estimasi mengikuti kurir."
- **Frozen Express**: "Tiba 1–2 hari via layanan frozen antar kota. Dikemas untuk perjalanan hingga 48 jam."

## Pre-mortem (90 days)

It is October 2026. The brand owner calls the website a failure. What happened: a Foodie Millennial ordered 6kg to Bekasi in week 2, the system let express-tier-thinking language ("frozen") set her expectation, Paxel's 5kg cap silently pushed her to a slower courier, the box arrived soft, she posted a 40-second TikTok. Bashara, mid-deploy, replied defensively in comments before the playbook existed. Shopee reviews started referencing the video. The root causes were all L1: tier language over-promised, no refund-first reflex, no pre-written stance. None of it was a code bug.

## Dependency graph

```text
UNLOCKS: L2 refund rules (charter promises define refund obligations); L3 geography copy; L5 positioning ("frozen-handling credibility")
BLOCKS:  any marketing claiming "dijamin beku sampai rumah"; free-ongkir promos (violates non-promise #3)
REQUIRES: founder ratification of markup stance (Option B) and insurance deferral; final cut-off times from L4
```

## [FOUNDER DECISION] items

1. **Insurance at launch**: hide entirely (B) vs premium-with-SOP for intercity (C)? (Analysis says B now, C at Phase 2.)
2. **Markup stance**: ratify Option B bundled language — this is a values call about disclosure, not math.
3. **Refund-first threshold**: auto-approve replace/refund up to what IDR value without investigation? (Suggested: Rp 200k.)
4. **Price ladder public-ness**: do we ever say out loud "website is cheaper than Shopee" in marketing (promise #11), or keep it implicit? Saying it publicly is R2.

## Decision Record

DapurDekaka.com promises packing method, not arrival temperature; bundles shipping and frozen-handling into a single non-itemized "Ongkir & Penanganan Frozen" line at ~20% over actual cost without claiming courier-rate pass-through; hides insurance at launch in favor of a blanket replace-or-refund guarantee for cold-chain failure; operates refund-first on any spoilage complaint under the founder-set threshold; and never claims specific arrival times, marketplace-style free shipping, or "guaranteed frozen" on bike couriers. PRD Section 8 language ("no markup", RajaOngkir services) is deprecated; this charter is the source of truth for all customer-facing shipping and trust copy.
