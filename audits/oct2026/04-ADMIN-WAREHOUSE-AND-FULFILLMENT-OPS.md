# 04 — Admin, Warehouse & Fulfillment Operations

**Audit date:** 2026-10-19 · **Commit:** `d646f56`
**Perspectives:** Owner/Superadmin (runs the business), Warehouse (packs & hands over), System (crons, Biteship).
**Scope:** `app/(admin)/admin/*`, `app/api/admin/**`, `lib/shipping/dispatch.ts`, `app/api/webhooks/biteship`, `cron/retry-dispatch`, `cron/pickup-release`, `middleware.ts`.

## What's solid
- Every `app/api/admin/**` route checks role (swept all 90+ handlers — none unauthenticated). Middleware (now correctly at repo root after PR #11) restricts warehouse to `/admin/inventory|shipments|field|orders`.
- Order status changes use an optimistic lock (`WHERE status = current`) and write history + audit log.
- Dispatch is session-free and shared by warehouse UI and the retry cron; stuck `booking` states are recovered.
- Admin surface is broad: orders, products/variants/images, inventory, shipments, field dashboard, coupons, customers, refunds, disputes, CMS, carousel, gallery, testimonials, settings, users/invite, audit logs, KPI/ops dashboards, CSV exports.

---

## A day in the life — where it breaks

### Owner morning: "new orders?"
- **No new-order alert.** Nothing notifies the owner when an order is paid (no email to `admin_email`, no WA). Ops alerts exist only for failures — and they depend on `FONNTE_API_KEY` (unverified, see file 01). **Add:** on settlement, WA + email to owner with order number, items, delivery/pickup, total.
- **Test orders pollute queues.** 4 `DDK-E2E-*` orders are in prod (2 `paid` waiting to be packed). Delete before launch.

### Warehouse: pack & ship (delivery)
Flow: `paid → processing → packed → [Book courier] → shipped → delivered (Biteship webhook)`.

| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| W1 | **CRIT** | Biteship origin address is empty: `biteship_origin_address` (and lat/lng) missing from `system_settings` → booking sent with `originAddress: ''` | `dispatch.ts:62-64` + DB query | Add the three settings (Settings page) and make dispatch refuse to run if empty |
| W2 | **HIGH** | **Double booking race.** `dispatchStatus` is set to `booking` with an unconditional update after a stale read → two clicks / click + cron = two Biteship orders, two courier charges | `dispatch.ts:59` | `UPDATE … SET dispatch_status='booking' WHERE id=? AND dispatch_status IN ('pending','failed','retrying') RETURNING id`; abort if 0 rows |
| W3 | HIGH | Booking uses hard-coded 30×22×12 cm per item, but checkout quoted with real variant dims → Biteship re-prices (`order.price` webhook) and you absorb the gap | `dispatch.ts:67-77` vs `initiate:573-585` | Store dims on order items (or re-read variants) and use them in both places |
| W4 | HIGH | **Biteship webhook verification may never pass.** Code expects an HMAC-SHA256 hex in `x-biteship-signature`; Biteship's dashboard lets you configure a static *signature key + header name*, and it sends a test call on registration that must return 200. If the scheme doesn't match, every update 401s → orders never become `delivered`, no delivered email, no review prompt | `lib/shipping/providers/biteship/webhook.ts:24-44` | Confirm against Biteship docs / a real delivery in the Biteship test env; support the static-header mode; return 200 to the empty registration ping |
| W5 | MED | Two parallel status machines: field route allows manual `packed→shipped` with typed resi (bypasses Biteship), admin route + dispatch also do it; pickup orders can be set `shipped` from the field route | `field/orders/[id]/route.ts:53-64` | One `ORDER_TRANSITIONS` map in `lib/constants/orders.ts` keyed by delivery method; manual ship only as an explicit "kirim manual" fallback with reason |
| W6 | MED | `order.price` events are rejected if they lack `status` | `webhook.ts` `parseBiteshipWebhook` | Accept events without status |
| W7 | MED | Biteship cancel failure while cancelling a shipped order is only logged | `status/route.ts:132-146` | Block cancel or set `needsAttention` |
| W8 | LOW | Shipping email sent twice in some paths (dispatch sends; admin `shipped` transition also sends) | `dispatch.ts:120`, `status/route.ts:317` | Send from one place |

### Warehouse: pickup orders
| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| W9 | **HIGH** | **Pickup handover never verifies the customer's code.** `pickupCode` is accepted but unused; any `packed` pickup order can be marked delivered by order id | `field/pickup-queue/route.ts:43-93` | Require `pickupCode` match (case-insensitive) before `delivered`; log who handed over |
| W10 | HIGH | Inconsistent pickup states: admin route allows `paid→processing→delivered` (no `packed`), but the pickup queue only lists/accepts `packed`. Orders moved via the admin page never appear in the pickup queue | `status/route.ts:91-97` vs `pickup-queue:24-26,74` | Same state machine for both: `paid→processing→packed(ready)→delivered` |
| W11 | MED | Customer gets "siap diambil" at payment time, not when packed (file 02 M12) | webhook | Send on `packed` |
| W12 | MED | Pickup code = order number — guessable by anyone who saw the receipt | `settle-order.ts:85` | Random 6-digit code shown only to the customer |
| W13 | LOW | `pickup-release` cron only sends reminders; `PICKUP_AUTO_RELEASE_HOURS = 48` is never enforced (no auto-cancel/refund policy for no-shows) | `cron/pickup-release` | Decide policy; implement or remove the constant |

### Owner: cancellations & refunds
- **Cannot cancel a VA/QRIS-paid order** (refund API failure aborts cancel) — file 02 C4. This is the #1 ops blocker after go-live.
- Cancellation of unpaid orders doesn't cancel the Midtrans transaction (file 02 M4).
- Refund completion vs cancel reversal double-claws points (file 03 P5).
- Refund `reason` is hard-coded `customer_request` for auto-created obligations — misleading in reports. Add `late_settlement`, `payment_cancelled`, `oversell`.

### Owner: inventory
- Field inventory adjust/restock is now open to warehouse (✅ fixed since May).
- Oversell has no prevention (no reservation) — file 02 H3. With a 21-SKU catalog and low stock levels, set a **safety stock** per variant and hide "add to cart" below it.
- No low-stock notification push (dashboard widgets only).

### Owner: dashboards
- KPI/phase metrics count E2E orders. Phase gate (`computePhaseMetrics`) will decide `frozen_same_day` eligibility based on them.
- `/api/health` is cached (file 01) — any "system health" tile derived from it is stale.

### Superadmin: users & security
- **Deactivating a staff member doesn't take effect for up to 30 days** — role/isActive live in the JWT and are only refreshed on `update()`; `tokenVersion` is stored but never compared (file 05 S1). A fired warehouse worker keeps admin access.
- Warehouse can export full order CSV (names, phones, addresses) — `export/orders` allows `warehouse`. Restrict to owner/superadmin or strip PII for warehouse.
- Settings PATCH is superadmin-only ✅; settings list GET allows owner ✅.

### Feature-flagged areas (off at launch — fine)
B2B portal (`/admin/b2b-*`), blog CMS, AI content, vouchers, insurance UI. Middleware redirects them. Note: `b2b-profiles` admin page is **not** behind the flag while the B2B portal is.

---

## Recommended warehouse SOP (once fixes land)

1. 08:00 — open **Field → Packing queue** (paid orders, oldest first). Print packing list.
2. Mark **processing** when you start, **packed** when sealed with ice gel.
3. Delivery: press **Book courier** (Biteship). Never type a resi manually unless Biteship is down.
4. Pickup: when customer arrives, enter their **6-digit pickup code** → delivered.
5. 16:00 — check **Shipments** for `dispatch failed` and **Attention** flags.
6. Daily — Refunds queue ≤ 7 days old (L2 rule).
