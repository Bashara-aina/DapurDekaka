# P1 — DISCOVER → CART TRUTH

> Layer owner: PROCESS. Scope: homepage → catalog → PDP → add-to-cart → cart review → "Checkout" tap.
> Ground truth: `store/cart.store.ts`, `app/(store)/products/**`, `app/(store)/cart/page.tsx`, `app/api/cart/validate`, `components/store/cart/**`. Date: 2026-07-19.
> Depends on: L1 (promise honesty), L3 (geo/soft-launch), L5 (soft-launch scope). Feeds: P2.
> Non-goals: checkout form, shipping quotes, payment (P2/P3). No SEO/growth advice (L5 owns that).

## Executive summary

- The cart is **client-truth by default**: Zustand + localStorage persists `unitPrice` and `stock` snapshots; `validateStock()` refreshes **stock only, never price** (`store/cart.store.ts:105-140`). A customer can stare at a stale price all the way to the pay button, then be charged the server-recomputed price from `app/api/checkout/initiate/route.ts:141-179` — silent price drift is a trust wound, not a bug ticket.
- `addItem` deliberately allows out-of-stock adds (`store/cart.store.ts:60-66`, comment "no longer blocked") but with `stock=0` computes `quantity: Math.min(1, 0) = 0` — a **ghost line-item with quantity 0** that survives in localStorage and confuses subtotal math and the checkout gate.
- `validateStock` **excludes stock-0 items from its error list** (`i.stock > 0` filter at `store/cart.store.ts:134`), so an OOS cart passes cart-page validation and dies late with a 409 at initiate — the worst place to learn your dimsum is gone.
- Login merge **loses guest cart lines**: `loadFromDb` builds `merged` by mapping over `dbItems` only (`store/cart.store.ts:177-183`); any local item not already in the DB cart vanishes unless `syncToDb` was called first and succeeded.
- There is **no "should this SKU be buyable" gate** at PDP/cart beyond `isActive` — geo, soft-launch phase, and cutoff realities first appear at checkout (P2), so P1's job is to stop making promises P2 must retract.

## Core question

Can a mobile customer in Bandung fill a cart whose prices, quantities, and availability are still true at the moment they tap "Checkout"?

## Happy-path swimlane

| # | Actor | System | State change | Customer-visible effect | Ops action |
|---|-------|--------|--------------|------------------------|-----------|
| 1 | Customer | `app/(store)/page.tsx` + `FeaturedProducts` | none | Sees products, soft-launch banner (`components/store/layout/SoftLaunchBanner.tsx`) | none |
| 2 | Customer | PDP `app/(store)/products/[slug]/page.tsx` | none | Variant, pack size, price, stock badge, frozen-handling copy | none |
| 3 | Customer | `useCartStore.addItem` | localStorage cart += item (price/stock snapshot) | Cart badge increments | none |
| 4 | Customer | `app/(store)/cart/page.tsx` → `validateStock()` → `POST /api/cart/validate` | item.stock refreshed from DB | Qty errors surfaced (partially — see D1) | none |
| 5 | Customer | Checkout CTA | navigate to `/checkout` | P2 begins | none |
| 6 | (logged-in) | `syncToDb` / `loadFromDb` via `/api/auth/merge-cart`, `/api/auth/cart` | server cart merged | cart continuity across devices | none |

## Depth analysis table

| Depth | Current state | Break mode | Customer impact | Solo-ops impact | Recommendation |
|-------|---------------|-----------|-----------------|-----------------|----------------|
| D1 Surface | Stock badge from page-load snapshot; `validateStock` refreshes stock on cart page only | Badge says "tersedia", initiate says 409 | Rage-quit at last step, WA complaint | Bashara answers "kok gagal terus?" WAs | Re-validate on cart mount AND on checkout CTA; show per-line "stok berubah" banner |
| D2 Operational | OOS items addable; qty-0 ghost lines possible; merge drops local lines | Cart shows items that can never convert | Confusion, phantom subtotals | Support WAs; abandoned carts miscounted | Block add at stock=0 (show "Ingatkan saya" instead); floor quantity at 1 or reject; fix merge to union not map |
| D3 Financial / Inventory | Price is a localStorage snapshot; initiate recomputes from `productVariants.price` silently | Price rises after admin edit → customer charged more than cart showed | "Ditagih beda dari keranjang" — a Midtrans dispute waiting | Refund/dispute labor | `POST /api/cart/validate` must return current `price`; if changed, update line + show "harga berubah" notice; initiate should 409 on client/server subtotal mismatch instead of silently repricing |
| D4 Strategic | No buyability gate (geo/phase/cutoff) before checkout | Jakarta visitor builds a frozen cart the phase gate will 503 (see P2) | Feels like a broken shop, not a scoped launch | Zero — until the WA complaints | Surface "Bandung-first" scope on PDP for frozen-only SKUs; keep gate logic in P2 but message it in P1 |
| D5 Existential brand risk | Frozen-handling expectations set by PDP copy only | Customer expects "fresh chilled" and receives frozen block, or vice versa | One bad unboxing photo on Instagram | Brand damage is unrecoverable per L1 | PDP must state: dikirim beku, wajib freezer, tahan X jam di perjalanan — same words as L1 Promise Charter |

## State machine

Cart-line states (client-side, implicit today — make them explicit):

```
ABSENT → IN_CART_OK          (addItem, stock ≥ qty)
IN_CART_OK → IN_CART_STALE   (server stock/price changed; detected by validate)
IN_CART_STALE → IN_CART_OK   (customer accepts new qty/price)
IN_CART_OK|STALE → REMOVED   (removeItem / qty→0)
```

Illegal (currently reachable, must become unreachable):
- `ABSENT → IN_CART_QTY_0` (stock=0 add path, `cart.store.ts:64`)
- `IN_CART_OK → CHECKOUT` while `quantity > stock` (validate's `stock > 0` filter lets stock=0 lines through)
- `IN_CART_OK → VANISHED` on login (merge drops local-only lines)

## Failure matrix

| Failure | Detection | Auto-recovery | Human SOP | Customer message | Money effect | Max time-to-ack |
|---|---|---|---|---|---|---|
| Stock sold out after add | `validateStock` on cart page | qty clamp | none | "Stok {produk} berubah, sisa {n}" | none (pre-payment) | instant (client) |
| Price changed after add | **none today** | none | none | needed: "Harga {produk} berubah dari Rp X ke Rp Y" | customer charged unseen delta | must be instant |
| `/api/cart/validate` down | catch → generic error string | none | none | "Gagal memvalidasi stok. Silakan coba lagi." | none | instant |
| Ghost qty-0 line | not detected | none | none | line shows qty 0, Rp 0 | subtotal noise | fix at source |
| Login merge loses lines | not detected | none | Bashara can't see it | silent | lost revenue | fix at source |
| localStorage cleared / private mode | cart empty | logged-in: `loadFromDb` | none | empty cart | lost revenue | n/a (accepted for guests) |
| Abandoned cart (frozen urgency) | none — no capture | none | DEFER: no abandoned-cart email at launch (guest email unknown pre-checkout anyway) | none | lost revenue | DEFER — trigger: >100 carts/week with <10% conversion |

## Stakeholder rotation

- **Ibu RT (customer):** wants the price on the cart page to be the price she pays. Silent repricing at initiate betrays her even when the delta is Rp 2.000.
- **Warehouse (Bashara's packing hat):** every oversold line that sneaks past P1 becomes a P5 dispute. Cart truth is his first line of defense.
- **Bashara (ops):** zero cart-related WA questions is the KPI. Every "kok error pas checkout?" is 5 minutes he doesn't have.
- **Brand owner:** the heritage brand can survive "stok habis"; it cannot survive "ditagih lebih mahal dari keranjang". **Conflict:** brand wants OOS SKUs visible (assortment pride) vs ops wants them unbuyable — resolve with visible-but-blocked + notify-me copy.

## Major decisions (max 3)

### Decision 1 — Out-of-stock add behavior
| Option | Description | Cost | Risk |
|---|---|---|---|
| A | Block add at stock=0, show "Stok habis — beritahu saya" (no backend, WA link) | S | none |
| B | Keep current allow-add, fix qty-0 to qty-1, rely on late 409 | none | late failure, trust hit |

**Recommend A.** Irreversibility R0 (pure client change). Confidence: high. Would change my mind: if a wishlist/restock-notify feature ships, B becomes a deliberate funnel.

### Decision 2 — Price drift handling
| Option | Description | Cost | Risk |
|---|---|---|---|
| A | `cart/validate` returns price; client updates + notices; initiate rejects on mismatch with clear message | M | slightly more checkout friction |
| B | Keep silent server repricing | none | disputes, chargeback ammunition |

**Recommend A.** Irreversibility R0. Confidence: high. Would change my mind: nothing — L1 makes silent repricing indefensible.

### Decision 3 — Cart merge semantics on login
| Option | Description | Cost | Risk |
|---|---|---|---|
| A | Union merge: local lines not in DB are kept (then `syncToDb`) | S | possible dupes if variant renamed — keyed by variantId so no |
| B | Server-wins (current) | none | silent lost lines |

**Recommend A.** Irreversibility R0. Confidence: high.

## Founder decisions required

- **[FOUNDER DECISION #1]** When a price changes while an item sits in a cart, do we honor the old price for carts < 24h old (goodwill, costs margin) or always charge current price with a visible notice (recommended)? L2 says prices are never client-trusted — this is about *display honesty*, not trust of client input.

## Implementation backlog (ordered)

**P0**
1. `code` — `store/cart.store.ts:60-66`: block add when `stock === 0`; never create qty-0 lines. Acceptance: adding an OOS variant shows a disabled state, cart never contains quantity 0. Effort S. Risk if skipped: ghost lines + late 409s at launch.
2. `code` — `store/cart.store.ts:134` + `/api/cart/validate`: return and reconcile **price**; drop the `i.stock > 0` filter so stock-0 lines error too. Acceptance: raising a variant price in admin updates the cart line within one cart-page visit and shows an id/en notice (`id: "Harga berubah"`, `en: "Price updated"`). Effort M. Risk: silent overcharge dispute in week 1.
3. `code` — `store/cart.store.ts:177-183`: union merge (keep local-only lines). Acceptance: guest adds item A, logs in with server cart holding item B → cart shows A+B. Effort S. Risk: lost conversions, invisible.

**P1**
4. `copy` — PDP frozen-handling block using L1 Charter language (id primary / en secondary): "Dikirim beku dengan ice pack. Simpan di freezer maks. 1 jam setelah diterima." Acceptance: string present on every frozen SKU PDP at 375px without truncation. Effort S.
5. `code` — re-run `validateStock()` on checkout CTA click, not only cart mount. Acceptance: stock zeroed between cart view and CTA produces inline error, not a navigation. Effort S.

**P2**
6. `copy` — OOS PDP state with WA deep-link "Beritahu saya kalau ready" (no backend). Effort S.
7. `DEFER` — abandoned-cart recovery. Trigger: >100 carts/week AND checkout conversion <10%.

## Definition of Done for this phase

- [ ] Cart can never contain quantity-0 or stock-0 lines at CTA time
- [ ] Price shown on cart page == price initiate will charge, or an explicit notice was shown
- [ ] Login never silently discards cart lines
- [ ] Frozen-handling expectation copy live on every frozen SKU (id + en)
- [ ] `validateStock` runs at cart mount and at checkout CTA
- [ ] All of the above verified at 375px width

## Handoff to P2

P2 may assume: every line entering checkout has server-verified stock ≥ qty and a price the customer has actually seen. P2 must NOT re-litigate cart contents; it owns address, shipping, and quote truth.

## Red team

1. **The reseller sniper:** scripts `addItem` payloads with stale low prices hoping initiate honors client `unitPrice` — it doesn't (server reprices, `initiate/route.ts:153-155`), but the *silent* repricing means he can also screenshot "price manipulation" theater to smear the brand. Fix Decision 2 and the screenshot is boring.
2. **The two-tab mom:** cart open in two tabs, edits quantity in both; Zustand `version` counter exists (`checkExternalChange`) but nothing consumes it across tabs — last-write-wins can resurrect a removed item. Accept for launch; document.
3. **Flaky 3G in Dago:** `/api/cart/validate` times out, customer proceeds on stale stock, initiate 409s with `"Stok tidak mencukupi untuk ..."` — make sure that 409 message renders as a cart-page redirect with the offending line highlighted, not a dead toast on the pay screen.
