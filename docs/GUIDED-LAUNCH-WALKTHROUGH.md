# Guided Launch Walkthrough — Developer + Agent

**Purpose:** Session-by-session script. Agent drives each step; Bashara watches, clicks dashboards, and enters secrets only when asked.

**Roles:**
| Role | Owns |
|------|------|
| **Developer (Bashara)** | Env, Midtrans, Biteship, Redis/Resend/Fonnte/Maps, webhooks, sandbox UAT, deploy, live flip |
| **Warehouse / Admin (content ops)** | Catalog, stock, media, CMS — **only** via `/admin/*` (never code/seed/SQL). See [`WAREHOUSE-ADMIN-PLAYBOOK.md`](WAREHOUSE-ADMIN-PLAYBOOK.md) |
| **Agent (Cursor)** | Exact click scripts, smoke commands, logs/DB checks, code fixes if UAT breaks |

**Master checklist:** [`HUMAN-LAUNCH-CHECKLIST.md`](HUMAN-LAUNCH-CHECKLIST.md)  
**Sandbox commands:** [`SANDBOX-UAT-SUPPORT.md`](SANDBOX-UAT-SUPPORT.md)

**Rule:** After each session → short **green / blocked** report. Say **“next”** to continue. Do **not** flip live Midtrans/Biteship keys until Sessions 2–5 are green.

---

## Session order

| # | Owner | Goal |
|---|--------|------|
| 1 | Developer | Midtrans sandbox keys + notification URL |
| 2 | Developer | Payment matrix (QRIS, VA, retry, expire, refund path) |
| 3 | Developer + Warehouse UI | Biteship test + Gudang pack → Book Kurir + pickup code |
| 4 | Warehouse / Admin | Catalog truth (prices, images, stock, dims) |
| 5 | Warehouse / Admin | Carousel, gallery, testimonials, CMS, settings |
| 6 | Developer | Soft gate / health before Phase M live flip |

---

## Session 1 — Midtrans sandbox setup

### Preconditions
- App reachable at `NEXT_PUBLIC_APP_URL` (local or Preview).
- `.env` / Vercel Preview: `MIDTRANS_IS_PRODUCTION=false`.
- Sandbox server key (`SB-…`) + client key set.

### Steps (agent narrates; you click)

**S1.1 — Confirm sandbox mode**  
Agent checks env (read-only). Expect:
```
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=<sandbox client key>
MIDTRANS_SERVER_KEY=SB-Mid-server-…
```
Reply **done** if that matches your dashboard keys.

**S1.2 — Payment Notification URL**  
1. Open [Midtrans Sandbox Dashboard](https://dashboard.sandbox.midtrans.com)  
2. **Settings → Payment → Notification URL**  
3. Paste a **public `https://` URL** (Midtrans rejects `localhost`):
   ```
   https://www.dapurdekaka.com/api/webhooks/midtrans
   ```
   Or a Preview/tunnel host + `/api/webhooks/midtrans`. That host’s Vercel env must use the **same sandbox Midtrans keys**.  
4. Optional finish redirect: `https://www.dapurdekaka.com/checkout/success`  
5. Save. Reply **done**.

**S1.3 — Finish / Unfinish / Error URLs (optional but recommended)**  
Same Settings page if available:
```
Finish:   {HOST}/orders/success
Unfinish: {HOST}/orders/pending
Error:    {HOST}/orders/pending
```
(Exact paths may redirect by order number — agent confirms against routes.)

**S1.4 — Agent verifies Snap host**  
Checkout should load `https://app.sandbox.midtrans.com/snap/snap.js` (not production).

### Exit criteria
- [ ] Sandbox keys + `MIDTRANS_IS_PRODUCTION=false`
- [ ] Notification URL saved
- [ ] Snap loads sandbox host on a dry checkout open (Session 2)

**Report:** green / blocked + blocker one-liner.

---

## Session 2 — Midtrans payment matrix

Agent watches logs (`[checkout/initiate]`, `[Midtrans Webhook]`). You pay in Snap.

| Case | You do | Agent confirms |
|------|--------|----------------|
| Guest QRIS | Guest checkout → pay QRIS | `status=paid`, stock ↓, **no** points |
| Logged-in VA | Login → VA → settle | `paid` + points + stock ↓ |
| Retry | Let Snap expire / fail → retry pay | Midtrans order id `…-retry-N`, new snap token |
| Cancel / expire | Cancel unpaid or let expire | Coupon/points reversed if applied |
| Admin refund path | Owner marks refund per admin UI | Status + stock/points rules match docs |

After matrix: purge test orders
```bash
npx tsx --env-file=.env scripts/purge-e2e-orders.ts --dry-run
npx tsx --env-file=.env scripts/purge-e2e-orders.ts --confirm
```

**Exit:** all rows green; no live keys.

---

## Session 3 — Biteship test + Gudang dry-run

**S3.1 — Env**  
```
BITESHIP_API_KEY=biteship_test.…
BITESHIP_WEBHOOK_SECRET=<dedicated secret, NOT the API key>
```
Webhook URL in Biteship dashboard: `{HOST}/api/webhooks/biteship`

**S3.2 — Agent smoke**
```bash
npm run smoke:biteship
```

**S3.3 — Delivery order (you or warehouse)**  
1. Place paid delivery order (sandbox Midtrans).  
2. Open `/admin/field` → tab **Packing** → **Tandai Selesai Dikemas**.  
3. Tab **Kirim** → **Book Kurir (Biteship)**.  
4. Agent checks dispatch + webhook status updates.

**S3.4 — Pickup order**  
1. Paid pickup order.  
2. Pack on Gudang.  
3. Tab **Pickup** → enter **Kode Ambil** → serahkan.  
4. Agent confirms `pickup_code` ≠ `order_number`.

**Exit:** smoke + one delivery book + one pickup handover green.

---

## Session 4 — Catalog truth (admin UI only)

Follow [`WAREHOUSE-ADMIN-PLAYBOOK.md`](WAREHOUSE-ADMIN-PLAYBOOK.md) **Bag A–C**.  
Owner/superadmin edits prices/images; warehouse adjusts stock via Gudang/Inventori.

**Exit:** every launch SKU has real price, image, stock, weight/dims; inactive unfinished SKUs off.

---

## Session 5 — Media + homepage content

Playbook **Bag D–E**: carousel, gallery, testimonials, CMS, settings Toko/Promo/Pengiriman.

**Exit:** homepage + about look intentional (not seed placeholders). Legal CMS can wait for lawyer.

---

## Session 6 — Soft gate before live

- Soft-launch banner / noindex still on.  
- Health / config card: sandbox Midtrans + Biteship test still.  
- Sessions 2–5 green.  
- **Then** separate Phase M session: live keys + production webhooks (see `GO-LIVE-CHECKLIST.md`).

---

## How a step looks in chat

> **Step S1.2 — Developer**  
> Open Midtrans Sandbox → Settings → Payment Notification.  
> Paste: `https://YOUR_HOST/api/webhooks/midtrans`  
> Reply **done** when saved. I verify next.

Warehouse:

> **Step W4.1 — Admin (owner)**  
> Go to `/admin/products` → open Dimsum Crabstick → set harga 25pcs → upload gambar → Simpan.  
> Reply **done**. I check storefront PDP.
