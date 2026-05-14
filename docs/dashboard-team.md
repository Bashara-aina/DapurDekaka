# Team Dashboard (Owner / Business Manager) — DapurDekaka
**Role:** `owner` (and `superadmin` can also access this view)  
**Route:** `/admin/team-dashboard`  
**Access Level:** Business intelligence, financial overview, operational health — no system/developer controls  
**Intended User:** Bashara's girlfriend (the owner/operator) and any future business manager  
**Stack context:** Next.js 14 App Router · Drizzle ORM · PostgreSQL (Neon) · shadcn/ui · Recharts · Tailwind CSS

---

## 1. Purpose & Philosophy

The owner doesn't need to see raw audit trails or system settings. She needs to understand **how the business is performing** — revenue trends, order volumes, best-selling products, customer growth, and what needs her attention today. The design principle is **"business health at a glance, with the ability to drill down"**. Everything shown should be answerable with the question *"Is the business growing, healthy, and on track this month?"*

The dashboard is deliberately **read-heavy with selective write access** — she can update order statuses, approve B2B quotes, publish blog posts, and manage coupons, but cannot touch roles, system settings, or audit logs.

---

## 2. Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AdminHeader: "Good morning, [Name] 👋  Today is Thursday, 14 May 2026"    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ── TODAY'S SNAPSHOT ─────────────────────────────────────────────────────  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Revenue  │ │  Orders  │ │  Margin  │ │  Active  │ │ New Cust │         │
│  │  Today   │ │  Today   │ │  Today   │ │ Cust MTD │ │  Today   │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                              │
│  ── MONTHLY PROGRESS ─────────────────────────────────────────────────────  │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Monthly Revenue vs Target  │  │  Orders per Day (this month)         │  │
│  │  Progress bar + trend chart │  │  Bar chart with daily breakdown      │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ── ORDERS & FULFILMENT ──────────────────────────────────────────────────  │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Order Status Pipeline      │  │  Today's Orders Needing Action       │  │
│  │  (counts per stage, today)  │  │  (paid→process, process→pack, etc.)  │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ── PRODUCTS & INVENTORY ─────────────────────────────────────────────────  │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Top 10 Products This Month │  │  Inventory Alerts                    │  │
│  │  (revenue + units sold)     │  │  (low stock / out of stock SKUs)     │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ── CUSTOMERS & GROWTH ───────────────────────────────────────────────────  │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Customer Growth Chart      │  │  Loyalty Points Summary              │  │
│  │  (cumulative + new per week)│  │  (active balance, expiring soon)     │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ── B2B PIPELINE ─────────────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  B2B Inquiries · Quotes · Orders in one Kanban-style row            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ── MARKETING & PROMOTIONS ───────────────────────────────────────────────  │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Active Coupons Performance │  │  Blog Content Status                 │  │
│  └─────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                              │
│  ── RECENT ORDER ACTIVITY ────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Last 15 orders (simplified — no technical details)                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Today's Snapshot (KPI Row)

Five business-focused cards. Language is friendly Indonesian + number formatting in IDR.

### 3.1 Pendapatan Hari Ini (Revenue Today)
- **Value:** Sum of paid+ orders today in IDR
- **Sub-line:** "Rata-rata per pesanan: Rp 247.000"
- **Delta:** vs. same weekday last week (percentage + arrow)
- **Colour:** Green if positive delta, red if negative, grey if < 5% difference
- **Sparkline:** 7-day bar

### 3.2 Pesanan Hari Ini (Orders Today)
- **Value:** Total orders created today
- **Sub-breakdown (pill badges):**
  - 💳 Menunggu bayar: X
  - ✅ Sudah bayar: X
  - 🔄 Diproses: X
  - 📦 Dikemas: X
  - 🚚 Dikirim: X
- **Delta:** vs. same weekday last week
- **Click:** Scroll to order section below

### 3.3 Estimasi Keuntungan Hari Ini (Est. Margin Today)
- **Value:** Paid+ order revenue today × 18% (margin estimate)
- **Sub-line:** "Target harian: Rp X.XXX.XXX"
- **Progress:** mini progress bar towards daily target (if configured in system settings)
- **Tooltip:** "Angka ini adalah estimasi. Margin aktual bergantung pada HPP."

### 3.4 Pelanggan Aktif Bulan Ini (Active Customers MTD)
- **Value:** Count of unique customers who placed at least one paid order this month
- **Sub-line:** "Repeat buyers: X (XX%)"
- **Delta:** vs. last month same date
- **Definition of "active":** `orders.userId IS NOT NULL` + status in (paid, processing, packed, shipped, delivered)

### 3.5 Pelanggan Baru Hari Ini (New Customers Today)
- **Value:** Count of new user registrations today (role = customer)
- **Sub-line:** "Guest checkout today: X"
- **Sparkline:** 7-day new registrations

---

## 4. Monthly Progress Section

### 4.1 Monthly Revenue vs Target

```
  Mei 2026 Progress
  ─────────────────────────────────────────────────────
  Target bulan ini:  Rp 50.000.000  (configurable in settings)
  Sudah tercapai:    Rp 23.450.000  (47.0%)

  [██████████████████░░░░░░░░░░░░░░░░░░░░]  47%

  Hari berjalan: 14/31 (45% waktu bulan ini)
  Pace saat ini: Rp 1.675.000/hari
  Proyeksi akhir bulan: Rp 51.925.000  ✅ On track
```

**Projection logic:** `(current revenue / days elapsed) × days in month`  
**Status label:**
- `✅ On track` if projected ≥ target
- `⚠️ Sedikit di bawah` if projected is 80–99% of target
- `🔴 Perlu akselerasi` if projected < 80% of target

**Below:** Month-over-month comparison mini-table:

| Bulan | Revenue | Orders | Avg Order Value | New Customers |
|-------|---------|--------|-----------------|---------------|
| Mei 2026 (YTD) | Rp 23.4jt | 94 | Rp 248k | 31 |
| Apr 2026 | Rp 38.2jt | 154 | Rp 248k | 67 |
| Mar 2026 | Rp 31.5jt | 127 | Rp 248k | 54 |
| Feb 2026 | Rp 22.1jt | 89 | Rp 248k | 41 |

### 4.2 Orders Per Day Chart (This Month)

**Component:** Recharts `BarChart`  
**X-axis:** Days 1–31 of the current month  
**Y-axis:** Number of orders  
**Colour segments per bar:**
- Green: delivered
- Blue: shipped/packed/processing
- Amber: pending payment
- Red: cancelled

**Hover tooltip:** Date · Total orders · Revenue for that day · Cancellation rate  
**Reference line:** 7-day rolling average (dashed line)

---

## 5. Order Status Pipeline

### 5.1 Status Flow Visual

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Menunggu Bayar   →   Dibayar   →   Diproses   →   Dikemas   →   Dikirim
  │      47               12              23              15             38
  │   [Lihat]           [Proses]       [Kemas]          [Kirim]      [Lacak]
  └──────────────────────────────────────────────────────────────────────┘
```

Each stage box shows:
- Count of orders currently in that stage
- Average age of orders in that stage ("avg 1.2 jam")
- If avg age exceeds threshold → stage box turns amber/red
- Primary CTA button for the owner's typical action at that stage

**Thresholds (from system settings):**
- `paid` avg age > 2h → orange, > 4h → red
- `processing` avg age > 6h → orange
- `packed` avg age > 12h → orange (not picked up)

### 5.2 Pesanan Butuh Tindakan (Orders Needing Action)

A table of orders that the owner should touch today — similar to the superadmin action queue but focused on operational flow, not system issues.

| # | Pesanan | Pelanggan | Produk | Nilai | Status | Sejak | Aksi |
|---|---------|-----------|--------|-------|--------|-------|------|
| 1 | DDK-0041 | Ibu Sari | 3 items | Rp 215k | Sudah Bayar | 2j 14m | [Proses] |
| 2 | DDK-0039 | Budi S. | 5 items | Rp 480k | Diproses | 5j 02m | [Kemas] |
| 3 | DDK-0037 | Guest | 1 item | Rp 95k | Dikemas | 8j | [Isi Resi] |

**Filter tabs:** `Semua · Perlu Diproses · Perlu Dikemas · Perlu Resi · Pesanan Terlambat`

---

## 6. Top Products This Month

### 6.1 Top 10 Table

| Rank | Produk | Varian | Terjual | Revenue | % Total Rev | Stok Sisa |
|------|--------|--------|---------|---------|-------------|-----------|
| 1 | Siomay Udang | L (500g) | 47 pcs | Rp 4.230.000 | 18.1% | 23 unit |
| 2 | Hakau Udang | M (300g) | 39 pcs | Rp 3.120.000 | 13.3% | 8 unit 🟡 |
| 3 | Dimsum Mix Pack | — | 31 pcs | Rp 2.790.000 | 11.9% | 15 unit |
| ... | | | | | | |

**Colour indicator on stock column:**
- 🔴 0 units
- 🟡 1–9 units
- 🟢 10+ units

**Click on product name** → opens product edit page in a side-panel

### 6.2 Sales Trend for Top 3

Small sparklines (7-day) for the top 3 products showing whether sales are trending up or down.

### 6.3 Slow Movers Alert

A secondary mini-table below showing **bottom 5 products** (by units sold this month) with their current stock levels — helps identify products that may need a promotion push.

---

## 7. Inventory Alerts

```
🔴 Habis Stok (perlu restock segera):
   • Bakso Aci S — 0 unit
   • Dimsum Pelangi M — 0 unit

🟡 Stok Menipis (< 10 unit):
   • Hakau Udang M — 8 unit
   • Siomay Ikan XL — 5 unit
   • Charsiu Bun L — 3 unit
   • Baso Urat S — 7 unit

✅ Semua produk lain dalam kondisi sehat
```

**Quick restock note:** Each item has a `[Catat Restock]` inline button. Opens a modal:
- Input: Jumlah unit yang ditambahkan
- Input: Catatan (optional: "Kiriman dari supplier 14 Mei")
- Submit → creates `inventoryLog` with `type = 'restock'`

**"Download Restock List"** button → CSV of all low/out-of-stock items for sharing with supplier

---

## 8. Customer Growth Chart

**Component:** Recharts `ComposedChart`  
**Data:** Weekly from `users` table, past 12 weeks  
**Series:**
- Bar: New customers per week
- Line: Cumulative total customers (secondary axis)

**Below chart — Cohort snapshot table:**

| Bulan Daftar | Total Cust | Beli ≥ 1x | Beli ≥ 2x | Repeat Rate |
|-------------|-----------|-----------|-----------|-------------|
| Mei 2026 | 31 | 18 | 4 | 22% |
| Apr 2026 | 67 | 49 | 21 | 43% |
| Mar 2026 | 54 | 38 | 18 | 47% |

**Note:** Repeat rate = customers with ≥2 orders / customers with ≥1 order in that cohort

**Customer Lifetime Segments (simple):**
- Baru (1 order): X customers
- Loyal (2–4 orders): X customers
- VIP (5+ orders): X customers

---

## 9. Loyalty Points Summary

```
Program Poin Aktif
───────────────────────────────────────
Total poin beredar:    247.500 poin
(setara Rp 247.500 kewajiban diskon)

Akan kadaluarsa dalam 30 hari:   18.200 poin (73 pelanggan)
Akan kadaluarsa dalam 7 hari:     3.400 poin (14 pelanggan)
Poin yang sudah expire bulan ini:  2.100 poin

Pelanggan dengan poin tertinggi:
  • Ibu Hartini — 4.200 poin
  • Budi Santoso — 3.800 poin
  • Rina W. — 3.100 poin
```

**Quick actions:**
- `[Kirim Reminder Email]` → calls `/api/admin/points/expiry-reminders` for those expiring in 7 days
- `[Lihat Semua]` → `/admin/customers` sorted by points

---

## 10. B2B Pipeline (Kanban Row)

A horizontal kanban-style view showing the full B2B customer journey in one strip.

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐
│  INQUIRY BARU  │  │  PENAWARAN     │  │  PENAWARAN     │  │  PESANAN B2B    │
│  (Belum dibuka)│  │  DIKIRIM       │  │  DISETUJUI     │  │  AKTIF          │
│                │  │                │  │                │  │                 │
│  2 inquiries   │  │  3 quotes      │  │  1 quote       │  │  8 orders MTD   │
│                │  │                │  │                │  │                 │
│  • PT Sinar... │  │  • Hotel Grand │  │  • CV Maju...  │  │  Rev: Rp 12.5jt │
│  • UD Berkah.. │  │  • Catering Ar │  │                │  │                 │
│                │  │  • PT Indo...  │  │  [Proses Pesn] │  │  [Lihat Semua]  │
│  [Buka]        │  │  [Follow Up]   │  │                │  │                 │
└────────────────┘  └────────────────┘  └────────────────┘  └─────────────────┘
```

**Additional B2B metrics below the kanban:**

| Metrik | Nilai |
|--------|-------|
| Pipeline value (total open quotes) | Rp 34.500.000 |
| Quote-to-order conversion rate (all time) | 62% |
| Avg quote response time | 1.8 hari |
| B2B revenue as % of total this month | 33.6% |
| Largest B2B client this month | Hotel Grand Sari — Rp 4.200.000 |

**Click on any kanban card** → opens the inquiry or quote detail page

---

## 11. Active Coupons Performance

A compact table of all active/scheduled coupons:

| Kode | Tipe | Diskon | Terpakai / Maks | Revenue Terpengaruh | Berlaku Sampai | Status |
|------|------|--------|----------------|---------------------|----------------|--------|
| RAMADAN30 | 30% off | max Rp 50k | 170 / 200 | Rp 8.4jt | 15 Jun | 🟡 85% |
| FIRSTBUY | Rp 25.000 off | min Rp 100k | 43 / 100 | Rp 2.1jt | 31 Mei | 🟢 43% |
| FREESHIP500 | Free shipping | min Rp 500k | 8 / 50 | Rp 4.0jt | No exp | 🟢 16% |
| LEBARAN25 | 25% off | max Rp 75k | 38 / 40 | Rp 3.2jt | 5 Jun | 🔴 95% |

**Quick actions per row:**
- `[Pause]` → sets coupon isActive = false
- `[Extend]` → opens date picker to extend expiresAt
- `[Duplicate]` → pre-fills new coupon form with this coupon's settings

**"+ Buat Kupon Baru"** button → `/admin/coupons/new`

---

## 12. Blog Content Status

```
Konten Blog
─────────────────────────────────────────────
Dipublish:    8 artikel
Draft:        3 artikel (terlama: 6 hari lalu)
Dijadwalkan:  1 artikel (tayang 20 Mei)

Artikel terpopuler bulan ini:
  • "7 Cara Menyimpan Dimsum Beku" — terakhir diedit 3 hari lalu
  • "Resep Saus Dimsum Rumahan"    — terakhir diedit 1 minggu lalu

Draft yang perlu diselesaikan:
  • "Panduan Memilih Dimsum Halal" (draft 6 hari)    [Edit] [Publish]
  • "Tips Memasak Dimsum Frozen"   (draft 2 hari)    [Edit] [Publish]
  • "Sejarah Dimsum di Indonesia"  (draft 1 hari)    [Edit] [Publish]
```

---

## 13. Recent Order Activity Feed

A simplified version of the order feed — focused on business facts, not technical details.

| Waktu | Pelanggan | Produk | Nilai | Status |
|-------|-----------|--------|-------|--------|
| 14 min lalu | Ibu Sri Wahyuni | Siomay Udang L ×2 | Rp 180k | ✅ Dibayar |
| 32 min lalu | Guest | Hakau M ×3 + Siomay S ×2 | Rp 310k | ✅ Dibayar |
| 1j lalu | Budi Santoso | Mix Pack ×5 | Rp 450k | 🚚 Dikirim |
| 2j lalu | Catering Arya | (B2B) 20 pak dimsum | Rp 1.800k | 🔄 Diproses |

**"Lihat Semua Pesanan"** → `/admin/orders`

---

## 14. Period Selector (Global)

A sticky period selector at the top of the dashboard that controls all "This Month" metrics simultaneously.

```
Tampilkan data untuk:  [ Hari Ini ▼ ]  [ Minggu Ini ]  [ ● Bulan Ini ]  [ Bulan Lalu ]  [ Kustom ]
```

Changing the period re-fetches all metrics sections simultaneously. The Today's Snapshot row always shows live today data regardless of period selection.

---

## 15. Key Business Health Indicators (Bottom Summary Row)

A row of simple "traffic light" indicators that summarise the overall health at a glance — meant to be read in 10 seconds:

| Indikator | Status | Keterangan |
|-----------|--------|-----------|
| Revenue pace this month | 🟢 On track | Proyeksi Rp 51.9jt vs target Rp 50jt |
| Order fulfilment speed | 🟡 Sedikit lambat | Avg processing time 3.8j (target <2j) |
| Inventory availability | 🟡 Perhatian | 2 produk habis stok |
| Customer growth | 🟢 Baik | +23 pelanggan baru bulan ini |
| Repeat purchase rate | 🟢 Baik | 43% pelanggan beli lagi |
| B2B pipeline | 🟢 Aktif | 3 quote open, Rp 34.5jt pipeline value |
| Coupon health | 🟡 Perhatian | LEBARAN25 hampir habis |

---

## 16. Notifications & Alerts for Owner

The header notification bell shows owner-relevant events only (not system/technical alerts):

- ✅ Pesanan baru masuk dan sudah dibayar
- 💬 Inquiry B2B baru dari [perusahaan]
- 📋 Quote B2B disetujui oleh [perusahaan]
- 🏷️ Kupon [kode] hampir habis (< 10 sisa)
- 📦 Stok [produk] habis
- 🎉 Milestone: 100 pesanan bulan ini tercapai!
- 📈 Trending: [produk] terjual 2× lebih banyak dari biasanya hari ini

---

## 17. Data Fetching Strategy

| Section | Method | Refresh |
|---------|--------|---------|
| KPI Cards | React Query `staleTime: 60s` | Auto ~1 min |
| Monthly Progress | React Query `staleTime: 300s` | ~5 min |
| Orders per Day Chart | React Query `staleTime: 300s` | ~5 min |
| Order Pipeline Counts | React Query `refetchInterval: 60s` | Live ~1 min |
| Orders Needing Action | React Query `refetchInterval: 60s` | Live ~1 min |
| Top Products | React Query `staleTime: 300s` | ~5 min |
| Inventory Alerts | React Query `refetchInterval: 120s` | ~2 min |
| Customer Growth | React Query `staleTime: 600s` | ~10 min |
| B2B Pipeline | React Query `staleTime: 120s` | ~2 min |
| Coupon Performance | React Query `staleTime: 300s` | ~5 min |

---

## 18. API Endpoints Required

Protected by `role IN ('superadmin', 'owner')`:

```
GET  /api/admin/team-dashboard/snapshot         → today's 5 KPIs
GET  /api/admin/team-dashboard/monthly-progress → revenue progress vs target
GET  /api/admin/team-dashboard/orders-per-day   → daily bar chart data for current month
GET  /api/admin/team-dashboard/order-pipeline   → status counts + avg ages
GET  /api/admin/team-dashboard/action-orders    → orders needing action
GET  /api/admin/team-dashboard/top-products     → top 10 products by revenue + units
GET  /api/admin/team-dashboard/slow-movers      → bottom 5 products
GET  /api/admin/team-dashboard/inventory-alerts → out of stock + low stock SKUs
GET  /api/admin/team-dashboard/customer-growth  → weekly new customers + cohort table
GET  /api/admin/team-dashboard/points-summary   → expiring points + top balances
GET  /api/admin/team-dashboard/b2b-pipeline     → kanban data + B2B metrics
GET  /api/admin/team-dashboard/coupons          → active coupon usage stats
GET  /api/admin/team-dashboard/blog-status      → published/draft/scheduled counts
GET  /api/admin/team-dashboard/health-indicators → traffic light statuses
```

---

## 19. Permissions Within This Dashboard

| Action | owner | superadmin |
|--------|-------|-----------|
| View all metrics | ✅ | ✅ |
| Update order status | ✅ | ✅ |
| Pause/extend coupon | ✅ | ✅ |
| Publish blog draft | ✅ | ✅ |
| Add inventory restock note | ✅ | ✅ |
| Send points expiry email | ✅ | ✅ |
| View B2B pipeline | ✅ | ✅ |
| See raw audit log | ❌ | ✅ |
| Change system settings | ❌ | ✅ |
| Create new coupons | ❌ | ✅ |
| Manage user roles | ❌ | ✅ |
| Export data CSV | ❌ | ✅ |

---

## 20. Mobile Optimisation

This dashboard is primarily used on desktop (owner working from home/office), but should be functional on a tablet for quick checks.

- KPI row: 2×3 grid on tablet, scrollable horizontal on mobile
- Charts: stacked vertically, simplified (fewer data points on small screens)
- Order pipeline: vertical list instead of horizontal flow
- B2B kanban: accordion per stage (collapsed by default)
- Tables: horizontal scroll with sticky first column (order number / product name)
- Period selector: dropdown instead of tab row

---

*Last updated: 14 May 2026 · DapurDekaka Team Dashboard Spec v1.0*
