# Field Worker Dashboard — DapurDekaka
**Role:** `warehouse`  
**Route:** `/admin/field` (redirect from `/admin` for warehouse role)  
**Access Level:** Order processing, packing, shipment entry, inventory updates — nothing financial, no customer PII beyond what's needed for delivery  
**Intended User:** Adi, Siti (warehouse/packing staff) — non-technical, mobile-first  
**Stack context:** Next.js 14 App Router · Drizzle ORM · shadcn/ui · Tailwind CSS · PWA-optimised

---

## 1. Purpose & Philosophy

The field worker arrives at the warehouse, opens their phone, and needs to know **exactly what to do right now**. There is no analysis, no charts, no financial data. The entire experience is task-list driven: *Pick these orders → Pack them → Enter the tracking numbers → Flag any stock issues*.

Design principles:
- **Mobile-first, touch-optimised** — large tap targets (min 48px), no hover-dependent interactions
- **Action-oriented** — every screen has one clear primary action
- **Minimal cognitive load** — one task per screen, clear labels in Indonesian
- **Offline-resilient** — show cached order list even if network is spotty (service worker / PWA)
- **Error prevention** — confirmations before irreversible actions (status changes)
- **Zero financial data** — workers do not see prices, margins, or revenue

---

## 2. Page Layout (Mobile First)

The entire UI is designed for a ~390px wide phone screen. Desktop is a single centred column max-width 480px.

```
┌─────────────────────────────┐
│  🍜 DapurDekaka — Gudang    │
│  [Adi]  •  Kamis 14 Mei     │
│  🔔 (3)                     │
├─────────────────────────────┤
│                             │
│  TUGAS HARI INI             │
│  ┌─────────────────────────┐│
│  │ 🔵 Perlu Dikemas    12  ││
│  │ 🟡 Perlu Resi         7  ││
│  │ ✅ Selesai hari ini   5  ││
│  └─────────────────────────┘│
│                             │
│  ─── ANTRIAN PACKING ──────  │
│  [Order card 1]             │
│  [Order card 2]             │
│  [Order card 3]             │
│  [Lihat semua...]           │
│                             │
│  ─── PERLU RESI ───────────  │
│  [Packed order card 1]      │
│  [Packed order card 2]      │
│  [Lihat semua...]           │
│                             │
│  ─── STOK MENIPIS ─────────  │
│  [Low stock card 1]         │
│                             │
│  ─── SUDAH SELESAI ────────  │
│  [Completed today list]     │
│                             │
└─────────────────────────────┘
```

**Bottom navigation bar (fixed):**
```
[ 📦 Packing ] [ 🚚 Pengiriman ] [ 📋 Inventori ] [ ✅ Selesai ]
```

---

## 3. Header

```
┌─────────────────────────────────────────────────────┐
│  🍜  DapurDekaka — Gudang                           │
│  Halo, Adi 👋  •  Kamis, 14 Mei 2026  •  09:14     │
│                                       🔔 3 notif    │
└─────────────────────────────────────────────────────┘
```

**Header elements:**
- App name + "Gudang" label (so it's clear which app view this is)
- Worker's name (from session)
- Current date + time (auto-updated every minute)
- Notification bell with badge count

---

## 4. Tugas Hari Ini (Today's Task Summary)

A prominent summary card at the top — workers should know at a glance what their workload is.

```
┌────────────────────────────────────────────────────┐
│  TUGAS HARI INI                                    │
│  ─────────────────────────────────────────────────│
│  📦  Perlu dikemas (sudah dibayar):     12 pesanan │
│  🚚  Perlu nomor resi (sudah dikemas):   7 pesanan │
│  ✅  Sudah selesai hari ini:             5 pesanan │
│  ─────────────────────────────────────────────────│
│  Total dikerjakan: 24 pesanan                      │
│  Estimasi selesai packing: ~2 jam (12 × 10 menit) │
└────────────────────────────────────────────────────┘
```

**Tap on any row** → scrolls to that section below  
**Estimation logic:** Configurable in admin settings: `packing_minutes_per_order = 10`

---

## 5. Antrian Packing (Packing Queue)

The most important section. Shows all orders with `status = 'paid'` that need to be packed. Sorted by `paidAt ASC` (oldest first — FIFO).

### 5.1 Order Card Design

Each order is a full-width card:

```
┌────────────────────────────────────────────────────┐
│  #DDK-20240514-0041             📅 Bayar 2j 14m lalu │
│  ─────────────────────────────────────────────────  │
│  SIOMAY UDANG L (500g)  ×2                          │
│  HAKAU UDANG M (300g)   ×1                          │
│  BAKSO URAT S (250g)    ×3                          │
│  ─────────────────────────────────────────────────  │
│  📦 Total berat: ~1.250 gram                        │
│  🚚 JNE REG — Jakarta Selatan                       │
│  ❄️  PERLU DRY ICE  (zona: luar kota)               │
│  ─────────────────────────────────────────────────  │
│  🏠 Alamat: Jl. Kemang Raya No. 12, Jakarta Selatan │
│                                      (jarak: kota) │
│  ─────────────────────────────────────────────────  │
│  📝 Catatan: "Tolong dikemas rapi, buat kado"       │
│  ─────────────────────────────────────────────────  │
│  [   LIHAT DETAIL   ]  [ ✅ TANDAI SELESAI DIKEMAS ] │
└────────────────────────────────────────────────────┘
```

**Key information shown on the card:**
- Order number + time since payment (urgency indicator — > 4h turns amber, > 8h turns red)
- **Item list with quantity** (this is the packing checklist — most critical info)
- Total weight estimate (sum of `productVariants.weightGram × quantity`)
- Courier + service + destination district
- **Dry ice / cold chain indicator** (all dimsum is frozen — if delivering outside Jakarta, flag prominently)
- Customer note (if any)
- Two actions: detail view + mark as packed

### 5.2 Sorting & Filtering

```
[ Terlama dulu ▼ ]  [ Filter: Semua | JNE | JNT | SiCepat | Pickup ]
```

Workers can filter by courier to batch-pack orders going out with the same courier.

### 5.3 Marking as Packed

Tapping `[ ✅ TANDAI SELESAI DIKEMAS ]` shows a confirmation bottom sheet:

```
┌────────────────────────────────────────────────────┐
│  Konfirmasi Pengemasan                             │
│  ─────────────────────────────────────────────────│
│  Pesanan #DDK-20240514-0041                        │
│                                                    │
│  Apakah semua item sudah dikemas dengan benar?     │
│  • Siomay Udang L ×2     ☑                        │
│  • Hakau Udang M ×1      ☑                        │
│  • Bakso Urat S ×3       ☑                        │
│                                                    │
│  Kondisi es batu/dry ice: [Baik ▼]                 │
│  Kondisi kemasan:         [Baik ▼]                 │
│                                                    │
│  Catatan (opsional): ________________________      │
│                                                    │
│  [  BATAL  ]              [ ✅ KONFIRMASI KEMAS ]  │
└────────────────────────────────────────────────────┘
```

**On confirmation:**
- PATCH `/api/admin/orders/:id/status` → `{ status: 'packed', packedBy: workerId }`
- Card disappears from packing queue
- Card appears in "Perlu Resi" section
- Worker sees a brief success toast: "✅ Pesanan #DDK-0041 berhasil dikemas!"

**Stock deduction:** Triggered server-side via `inventoryService.deductStock()` on status change from paid → packed (or processing → packed). Creates `inventoryLog` with `type = 'sale'`.

---

## 6. Perlu Resi (Needs Tracking Number)

All orders with `status = 'packed'` AND `trackingNumber IS NULL`. These are packed orders waiting for the courier tracking number to be entered.

### 6.1 Tracking Entry Card

```
┌────────────────────────────────────────────────────┐
│  #DDK-20240514-0039             📦 Dikemas 1j lalu  │
│  ─────────────────────────────────────────────────  │
│  Siomay Mix Pack ×5                                 │
│  ─────────────────────────────────────────────────  │
│  🚚 JNE REG → Jakarta Timur                         │
│  ─────────────────────────────────────────────────  │
│  Nomor Resi:                                        │
│  ┌───────────────────────────────────────────────┐ │
│  │  Ketik atau scan barcode resi...              │ │
│  └───────────────────────────────────────────────┘ │
│                          [ 📷 SCAN ]  [ ✅ SIMPAN ] │
└────────────────────────────────────────────────────┘
```

**Input behaviour:**
- Text input auto-capitalises and trims whitespace
- `[ 📷 SCAN ]` → opens device camera to scan courier waybill barcode (via `jsQR` or native camera input with `capture`)
- Basic validation: tracking number must be 8–30 chars, alphanumeric + hyphens only
- `[ ✅ SIMPAN ]` → PATCH `/api/admin/orders/:id/tracking` → `{ trackingNumber, courierCode }`

**On success:**
- Toast: "✅ Resi #JNE123456789 berhasil disimpan untuk pesanan #DDK-0039"
- Order disappears from this section (status moves to `shipped` automatically on server when trackingNumber is added)
- Or optionally: status stays at `packed` and owner manually moves to shipped (configurable)

**Batch Entry Option (for days with many orders going to same courier):**

A `[ + Masukkan Resi Sekaligus ]` button at the top of this section opens a list view where all packed orders are shown with input fields together — worker can fill in all tracking numbers at once and submit in bulk.

---

## 7. Pickup Orders Section

Orders where customer chose pickup (`deliveryType = 'pickup'`). Separate from courier orders.

```
┌────────────────────────────────────────────────────┐
│  PESANAN AMBIL SENDIRI                             │
│  ─────────────────────────────────────────────────│
│  #DDK-20240514-0044                                │
│  Hakau Udang M ×2 + Siomay Ikan S ×1               │
│  Kode Ambil: DDK-8821                              │
│  Estimasi ambil: Hari ini, jam 14:00–16:00         │
│  ─────────────────────────────────────────────────│
│  Ketika pelanggan datang dan tunjukkan kode:        │
│  [ ✅ SERAHKAN KE PELANGGAN ]                       │
└────────────────────────────────────────────────────┘
```

**On tapping "Serahkan ke Pelanggan":**
- Confirmation dialog: "Apakah kode ambil sudah diverifikasi dari pelanggan?"
- Input field: "Masukkan kode ambil pelanggan:" (worker verifies by asking customer to show `pickupCode`)
- If kode matches → status → `delivered`, toast success
- If kode doesn't match → error message "Kode tidak cocok. Tanyakan ke pelanggan kode yang benar."

---

## 8. Pembaruan Inventori (Inventory Updates)

Accessible from bottom nav `[ 📋 Inventori ]`.

### 8.1 Stock Level View

A list of all product variants sorted by stock level ascending (most urgent first).

```
┌────────────────────────────────────────────────────┐
│  STOK PRODUK                                       │
│  ─────────────────────────────────────────────────│
│  Filter: [ Semua ▼ ]  [ Rendah saja ] [ Habis saja]│
│  ─────────────────────────────────────────────────│
│  🔴 Bakso Aci S (250g)           0 unit  [+Restock] │
│  🔴 Dimsum Pelangi M (400g)      0 unit  [+Restock] │
│  🟡 Hakau Udang M (300g)         8 unit  [+Restock] │
│  🟡 Siomay Ikan XL (500g)        5 unit  [+Restock] │
│  🟡 Charsiu Bun L (400g)         3 unit  [+Restock] │
│  🟢 Siomay Udang L (500g)       23 unit            │
│  🟢 Baso Urat S (250g)          31 unit            │
│  ... (scroll for more)                              │
└────────────────────────────────────────────────────┘
```

### 8.2 Restock Entry

Tapping `[+Restock]` opens a bottom sheet:

```
┌────────────────────────────────────────────────────┐
│  Tambah Stok                                       │
│  ─────────────────────────────────────────────────│
│  Produk: Hakau Udang M (300g)                      │
│  Stok saat ini: 8 unit                             │
│  ─────────────────────────────────────────────────│
│  Jumlah yang ditambahkan:                          │
│  ┌────────────────────────────────────────────┐   │
│  │  [ - ]      50 unit      [ + ]             │   │
│  └────────────────────────────────────────────┘   │
│  ─────────────────────────────────────────────────│
│  Stok setelah update: 58 unit                      │
│  ─────────────────────────────────────────────────│
│  Catatan (opsional):                               │
│  [ Kiriman supplier 14 Mei             ]           │
│  ─────────────────────────────────────────────────│
│  [ BATAL ]              [ ✅ SIMPAN RESTOCK ]      │
└────────────────────────────────────────────────────┘
```

**On confirm:**
- POST `/api/admin/inventory/restock` → `{ variantId, quantityAdded, note, workerId }`
- Creates `inventoryLog` with `type = 'restock'`, `userId = worker.id`
- Toast: "✅ Stok Hakau Udang M diperbarui: 8 → 58 unit"

### 8.3 Stock Adjustment (Correction)

Sometimes a count is wrong. A separate `[Koreksi Stok]` option per item:

```
┌────────────────────────────────────────────────────┐
│  Koreksi Stok                                      │
│  ─────────────────────────────────────────────────│
│  Produk: Siomay Udang L (500g)                     │
│  Stok sistem: 23 unit                              │
│  ─────────────────────────────────────────────────│
│  Stok aktual (hitung ulang):                       │
│  ┌────────────────────────────────────────────┐   │
│  │  [ - ]      21 unit      [ + ]             │   │
│  └────────────────────────────────────────────┘   │
│  ─────────────────────────────────────────────────│
│  Selisih: -2 unit (akan dikurangi)                 │
│  ─────────────────────────────────────────────────│
│  Alasan koreksi (wajib diisi):                     │
│  [ Rusak/tidak layak jual              ]           │
│  ─────────────────────────────────────────────────│
│  [  BATAL  ]            [ ✅ SIMPAN KOREKSI ]       │
└────────────────────────────────────────────────────┘
```

**Note:** Stock adjustments require a reason (not optional). Creates `inventoryLog` with `type = 'adjustment'`. This is flagged in the superadmin audit view.

---

## 9. Sudah Selesai Hari Ini (Today's Completed Work)

The bottom section (also accessible from nav `[ ✅ Selesai ]`) shows what the worker has done today — a personal work log.

```
SELESAI HARI INI — Kamis, 14 Mei 2026

📦 Dikemas oleh kamu: 5 pesanan
🚚 Resi dimasukkan:    3 pesanan
✅ Diserahkan (pickup): 1 pesanan

─────────────────────────────────────────────────

✅ #DDK-0041  Dikemas jam 09:14  •  JNE REG
✅ #DDK-0039  Dikemas jam 09:31  •  JNT EZ
✅ #DDK-0038  Dikemas jam 09:48  •  Pickup → Diserahkan 10:05
✅ #DDK-0037  Resi masuk jam 10:15  •  JNE REG CGKFT...
✅ #DDK-0035  Dikemas jam 10:30  •  SiCepat REG
```

Tapping any entry opens the order detail in read-only view.

---

## 10. Order Detail View (Read-Only for Workers)

When a worker taps "Lihat Detail" on any order card, they see a clean detail page — no financial info.

```
┌────────────────────────────────────────────────────┐
│  ← Kembali        Pesanan #DDK-20240514-0041       │
│  ─────────────────────────────────────────────────│
│  Status: 💳 Sudah Dibayar                          │
│  Waktu bayar: 14 Mei 2026, 07:03                   │
│  ─────────────────────────────────────────────────│
│  ITEM PESANAN:                                     │
│  • Siomay Udang L (500g)     ×2   SKU: SMUL-500    │
│  • Hakau Udang M (300g)      ×1   SKU: HAUM-300    │
│  • Bakso Urat S (250g)       ×3   SKU: BAUS-250    │
│                                                    │
│  Total berat estimasi: 1.250 gram                  │
│  ─────────────────────────────────────────────────│
│  PENGIRIMAN:                                       │
│  Kurir: JNE REGULER                                │
│  Tujuan: Jl. Kemang Raya No. 12, Jakarta Selatan   │
│                                        12730       │
│  ─────────────────────────────────────────────────│
│  CATATAN PELANGGAN:                                │
│  "Tolong dikemas rapi, buat kado"                  │
│  ─────────────────────────────────────────────────│
│  PACKAGING NOTES:                                  │
│  ❄️ Gunakan dry ice / gel pack                     │
│  📦 Gunakan kardus double wall untuk jarak jauh    │
│  🎁 Ada request kemasan kado — tambah pita/sticker │
│  ─────────────────────────────────────────────────│
│  [    TANDAI SELESAI DIKEMAS    ]                  │
└────────────────────────────────────────────────────┘
```

**What workers CAN see:**
- Item list with SKU and quantity
- Total weight estimate
- Courier and destination district (not full address unless needed for pickup)
- Customer notes
- System packaging reminders

**What workers CANNOT see:**
- Item prices or total order value
- Customer full name (shown as initials or first name only)
- Customer phone/email
- Payment method
- Financial information of any kind

---

## 11. Packaging Guidelines Reference

A persistent `[ 📋 Panduan Kemas ]` button in the header or as a floating help button. Opens a reference sheet:

```
PANDUAN PENGEMASAN DAPURDEKAKA
──────────────────────────────

SEMUA PRODUK:
• Gunakan plastik wrap rapat di setiap produk
• Segel dengan lakban es

PENGIRIMAN DALAM KOTA (< 1 hari):
• Gel pack 1–2 buah
• Styrofoam box ukuran S/M

PENGIRIMAN LUAR KOTA (1–3 hari):
• Dry ice 200–500 gram
• Styrofoam box ukuran M/L + bubble wrap
• Tambah label "FROZEN — JANGAN DIBUKA" di luar

PENGIRIMAN JAUH (> 3 hari) / PULAU LAIN:
• Dry ice 500 gram minimum
• Styrofoam box L + double wall kardus
• Tandai "FRAGILE" dan "KEEP FROZEN"

REQUEST KADO:
• Gunakan pita + sticker ucapan
• Bungkus ulang dengan kertas kado jika ada stok

PICKUP:
• Pastikan kode ambil dari pelanggan cocok
• Berikan dalam kondisi terbungkus rapi
```

---

## 12. Notifications for Workers

The bell icon in the header shows worker-relevant notifications only:

- 📦 Pesanan baru masuk dan sudah dibayar (siap dikemas)
- ⚠️ Stok produk habis (reminder to report to owner)
- ✅ Resi yang dimasukkan sudah dikonfirmasi kurir
- 📋 Pesan dari admin (manual notification from owner/superadmin)
- 🔔 Pengingat: Ada X pesanan sudah dikemas >12 jam, belum ada resi

Workers **do not receive:**
- Financial notifications
- B2B or customer registration alerts
- System/platform health alerts

---

## 13. Search Within Worker Dashboard

A simple search bar at the top of Packing and Tracking sections — search by order number only:

```
🔍  Cari nomor pesanan...  (contoh: DDK-0041)
```

Useful when a worker has a physical packing list and wants to find a specific order quickly.

---

## 14. Shift Summary / End-of-Day Report

A button `[ 📋 Rekap Shift Saya ]` in the nav or header. Shows the worker's full activity for the current day:

```
REKAP SHIFT — Adi — Kamis, 14 Mei 2026
──────────────────────────────────────
Mulai kerja (estimasi): 08:00
Waktu sekarang: 14:32

Aktivitas hari ini:
  📦  Dikemas:              12 pesanan
  🚚  Resi dimasukkan:       9 pesanan
  ✅  Diserahkan (pickup):   2 pesanan
  📋  Update stok:           3 kali

Catatan stok yang diupdate:
  • Hakau Udang M: +50 unit (kiriman supplier)
  • Siomay Ikan XL: +30 unit (kiriman supplier)
  • Dimsum Pelangi M: koreksi -2 unit (rusak)

[ 📤 Kirim Rekap ke Admin ]
```

`[ Kirim Rekap ke Admin ]` → sends a summary notification to the owner/superadmin with the shift summary data. Implementation: POST to internal notification endpoint.

---

## 15. Error States & Edge Cases

### 15.1 No Orders in Queue

```
┌────────────────────────────────────────────────────┐
│  📭 Tidak ada pesanan yang perlu dikemas            │
│                                                    │
│  Semua pesanan sudah diproses!                     │
│  Kamu bisa cek inventori atau istirahat dulu ☕    │
│                                                    │
│  [ Refresh ]                                       │
└────────────────────────────────────────────────────┘
```

### 15.2 Network Error / Offline State

```
┌────────────────────────────────────────────────────┐
│  ⚠️ Koneksi terputus                               │
│                                                    │
│  Data terakhir dari 5 menit lalu.                  │
│  Kamu masih bisa lihat pesanan, tapi perubahan     │
│  akan tersimpan saat internet kembali.             │
│                                                    │
│  [ Coba lagi ]                                     │
└────────────────────────────────────────────────────┘
```

### 15.3 Conflict: Order Already Processed

If two workers are logged in simultaneously and one marks an order packed before the other:

```
⚠️  Pesanan ini sudah dikemas oleh Siti jam 09:47.
    Tidak ada tindakan yang diperlukan.
```

### 15.4 Stock Below Zero Warning

If packing an order would make a variant's stock go negative:

```
⚠️  PERHATIAN — Stok tidak cukup
    ─────────────────────────────
    Hakau Udang M: butuh 3 unit, tersisa 1 unit
    
    Apakah kamu yakin produk fisik tersedia?
    
    [Batal]   [Lanjutkan dan koreksi stok nanti]
```

---

## 16. API Endpoints Used by Field Worker

Protected by `role IN ('superadmin', 'owner', 'warehouse')`:

```
GET  /api/admin/field/packing-queue        → orders with status='paid', sorted by paidAt ASC
GET  /api/admin/field/tracking-queue       → orders with status='packed' AND trackingNumber IS NULL
GET  /api/admin/field/pickup-queue         → orders with deliveryType='pickup' AND status IN ('paid','packed')
GET  /api/admin/field/today-summary        → counts of packed/shipped/pickup today by this worker
GET  /api/admin/field/worker-activity      → today's activity log for shift summary

PATCH /api/admin/orders/:id/status         → { status: 'packed', note, coldChainCondition }
PATCH /api/admin/orders/:id/tracking       → { trackingNumber, courierCode }
PATCH /api/admin/orders/:id/status         → { status: 'delivered' } (for pickup confirmation)

GET  /api/admin/inventory                  → full variant list with stock, sorted by stock ASC
POST /api/admin/inventory/restock          → { variantId, quantityAdded, note }
POST /api/admin/inventory/adjust           → { variantId, newQuantity, reason }

GET  /api/admin/orders/:id                 → order detail (filtered: no prices returned for warehouse role)
```

**Note on role-filtered response:** The orders API should check `session.user.role === 'warehouse'` and strip `subtotal`, `shippingCost`, `discountAmount`, `totalAmount` from the response before returning. Worker sees item names, quantities, weights, courier, address — but not money.

---

## 17. Permissions Matrix for Warehouse Role

| Action | warehouse |
|--------|-----------|
| View packing queue (paid orders) | ✅ |
| Mark order as packed | ✅ |
| Enter tracking number | ✅ |
| Confirm pickup order delivered | ✅ |
| View inventory stock levels | ✅ |
| Add restock (increase stock) | ✅ |
| Adjust stock with reason | ✅ |
| View order items and courier info | ✅ |
| View customer full name | ❌ (first name only) |
| View customer phone/email | ❌ |
| View order prices/totals | ❌ |
| Cancel an order | ❌ |
| Manage products | ❌ |
| Manage coupons | ❌ |
| Access blog/carousel | ❌ |
| Access B2B quotes/inquiries | ❌ |
| Access financial data | ❌ |
| Access audit logs | ❌ |
| Access user management | ❌ |

---

## 18. PWA / Mobile Optimisation Details

### Install prompt
On first visit on mobile, show "Add to Home Screen" prompt:
```
Tambahkan DapurDekaka Gudang ke layar utama untuk akses lebih cepat!
[Nanti]  [Tambahkan]
```

### Touch targets
- All buttons: minimum height `48px`, minimum width `120px`
- Card tap areas extend to full card width
- Destructive actions (cancel, adjust down) have red colour + confirmation dialogs

### Font sizes
- Body text: `16px` minimum (prevents iOS auto-zoom on input focus)
- Labels: `14px`
- Order numbers: `18px` bold (easy to scan)

### Loading states
Every section shows a skeleton loader (grey animated rectangles) while fetching. Not spinners — skeletons reduce perceived load time.

### Haptic feedback (if supported)
- On successful action (mark as packed): success vibration pattern
- On error: error vibration pattern

### Camera integration
The `[ 📷 SCAN ]` button for tracking number uses:
```html
<input type="text" inputmode="text" autocomplete="off"
       x-webKit-speech />
<!-- + optional barcode scanner via BarcodeDetector API or jsQR library -->
```

### Orientation
Designed primarily for portrait. Landscape works but is not optimised.

---

## 19. Implementation Notes

### Status transition guard
The server must enforce the state machine even when called from worker routes:
- Worker can only move: `paid → packed` and `packed → shipped` (via tracking entry) and `packed → delivered` (pickup only)
- Any attempt to set other statuses returns `403 Forbidden`

### Worker ID tracking
Every status change and inventory update includes `performedBy: session.user.id` — important for the shift summary and audit trail.

### Multi-worker support
If two warehouse staff are working simultaneously:
- Packing queue uses optimistic locking: when a worker opens a card, it's not "locked" (too complex), but if two workers submit at the same time, the second gets a friendly conflict error
- Last-writer-wins for inventory updates (acceptable for now)

### Cron-triggered notifications
Workers receive a push notification (or bell badge) when:
- A new paid order arrives (via server-sent events or polling every 30s)
- Admin sends a manual message (stored in `systemSettings` as a temp key, cleared on read)

---

## 20. Implementation Priority

Phase 1 (MVP — essential for daily operations):
- Packing queue with order cards
- Mark as packed with confirmation
- Tracking number entry
- Today's task summary

Phase 2:
- Pickup order handling
- Inventory stock view + restock entry
- Shift summary / end-of-day recap
- Barcode scan for tracking number

Phase 3:
- Stock adjustment with reason (correction)
- Offline support (PWA service worker)
- Push notifications for new orders
- Batch tracking number entry
- Packaging guidelines reference page

---

*Last updated: 14 May 2026 · DapurDekaka Field Worker Dashboard Spec v1.0*
