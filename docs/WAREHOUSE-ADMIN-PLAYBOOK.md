# Warehouse & Admin Playbook — Admin UI Only

**Rule:** Everything here is done in the **website admin** (`/admin/*`). Never edit `.env`, seed scripts, SQL, or Cloudinary folders outside the admin uploader.

**Base URL:** `{NEXT_PUBLIC_APP_URL}` → local `http://localhost:3000` · prod `https://dapurdekaka.com`

---

## Who does what

| Job | Login role | Where you work |
|-----|------------|----------------|
| Harga, deskripsi, foto produk, aktif/featured, berat & dimensi | **owner** atau **superadmin** | `/admin/products` |
| Carousel, galeri, testimoni, CMS, pengaturan toko | **owner** atau **superadmin** | `/admin/carousel`, `/admin/gallery`, `/admin/testimonials`, `/admin/cms`, `/admin/settings` |
| Packing, book kurir, serah pickup, koreksi stok harian | **warehouse** (juga owner/superadmin) | `/admin/field` (**Gudang**) |
| Koreksi stok cepat (desktop) | warehouse / owner | `/admin/inventory` |
| Input resi manual (hanya jika Book Kurir gagal) | warehouse / owner | `/admin/shipments` |

**Warehouse tidak bisa** membuka `/admin/products` atau carousel/gallery. Harga & foto = tugas **owner**. Stok & fulfillment = tugas **gudang**.

### Owner — tambah / edit / hapus tanpa coding
Semua lewat sidebar admin (tombol jelas + panduan di atas setiap halaman):
| Apa | URL | Tombol |
|-----|-----|--------|
| Produk + varian + foto | `/admin/products` | Tambah / Edit / Nonaktif / Hapus |
| Banner homepage | `/admin/carousel` | Buat Slide / Hapus |
| Galeri | `/admin/gallery` | Tambah / Edit / Hapus |
| Testimoni | `/admin/testimonials` | Tambah / Edit / Aktif / Hapus |
| Halaman legal/CMS | `/admin/cms` | Halaman Baru / Edit / Hapus |
| Kupon | `/admin/coupons` | (superadmin) |
| Pengaturan toko & fase kirim | `/admin/settings` | Edit value per baris |
| Feature flags | `/admin/feature-flags` | Toggle ON/OFF |

---

## Peta layar (hafalkan urutan)

```
PESANAN SUDAH DIBAYAR
        │
        ▼
┌───────────────────┐
│  /admin/field     │  ← mulai shift di sini (Gudang)
│  tab Packing      │  Pesanan paid → kemas
└─────────┬─────────┘
          │
     ┌────┴────┐
     ▼         ▼
 Delivery   Pickup
     │         │
     ▼         ▼
 tab Kirim   tab Pickup
 Book Kurir  Kode Ambil → Serahkan
     │
     ▼ (gagal saja)
 /admin/shipments  ← resi manual
```

**Stok:**
- HP / shift: `/admin/field` → tab **Stok**
- Desktop cepat: `/admin/inventory`

---

## Form A — Produk (owner) — `/admin/products`

### Alur yang jelas
1. Buka **Produk** di sidebar.
2. Klik produk → halaman edit.
3. Isi **nama, deskripsi ID/EN, kategori, aktif, featured**.
4. Upload **gambar** lewat tombol upload (Cloudinary) — jangan tempel URL sembarangan.
5. Per **varian**: harga jual IDR (integer), harga B2B jika ada, SKU, **berat (gram)**, panjang/lebar/tinggi, stok awal jika perlu.
6. **Simpan**.
7. Buka storefront PDP → cek harga + foto + badge stok.

### Checklist per SKU launch
Untuk tiap produk yang dijual:

| Field | Done? |
|-------|-------|
| Foto real (bukan placeholder) | ☐ |
| Harga retail benar (Rp, integer) | ☐ |
| Berat + dimensi untuk ongkir | ☐ |
| Stok awal realistis | ☐ |
| `is_active` = on jika siap jual | ☐ |
| Featured hanya untuk hero picks | ☐ |

SKU belum siap → **nonaktifkan** di admin, jangan biarkan tampil di katalog.

---

## Form B — Inventori (gudang / owner)

### Preferensi
| Situasi | Pakai |
|---------|--------|
| Sedang packing / di HP | `/admin/field` → **Stok** → `+` restock atau `↻` koreksi |
| Di laptop, banyak SKU | `/admin/inventory` → klik angka stok → isi alasan → simpan |

### Alur koreksi stok (Field)
1. Tab **Stok**.
2. Filter **Habis** / **Menipis** bila perlu.
3. **+** = tambah barang masuk (isi qty + catatan opsional).
4. **↻ Koreksi** = set stok baru (alasan **wajib**, contoh: “Rusak cold chain”).
5. Simpan → angka di daftar berubah.

### Alur Inventori desktop
1. Banner atas mengingatkan: packing tetap di **Gudang**.
2. Klik angka stok → ubah → konfirmasi → isi **alasan**.
3. Role warehouse: **tidak** ada link Edit Produk (hubungi owner untuk harga/gambar).

---

## Form C — Shift fulfillment (gudang) — `/admin/field`

Login warehouse → otomatis masuk **Dashboard Gudang**.

### Kartu “Tugas Hari Ini”
| Tile | Artinya | Klik → |
|------|---------|--------|
| **Perlu Dikemas** | Sudah bayar, belum dikemas | tab Packing |
| **Perlu Book Kurir** | Sudah dikemas, delivery, belum book | tab Kirim |
| **Rekap Hari Ini** | Angka selesai hari ini | tab Selesai |

### C1 — Packing (wajib dulu)
1. Tab **Packing** — subtitle: pesanan **sudah dibayar**.
2. Buka kartu → centang **semua** item.
3. Pilih kondisi cold chain.
4. **Konfirmasi Kemas**.
5. Delivery → lanjut tab **Kirim**. Pickup → lanjut tab **Pickup**.

Empty state = tidak ada yang menunggu. Pickup setelah dikemas muncul di tab Pickup.

### C2 — Kirim (delivery only)
1. Tab **Kirim**.
2. **Book Kurir (Biteship)** → konfirmasi.
3. Jika gagal: cek error di sheet → WA ops → fallback `/admin/shipments` (resi manual).

### C3 — Pickup
1. Tab **Pickup**.
2. **Serahkan ke Pelanggan**.
3. Minta pelanggan tunjukkan **Kode Ambil** → ketik kode → konfirmasi.
4. Tanpa kode cocok = **tidak** boleh serahkan.

### C4 — Jangan salah layar
| Salah | Benar |
|-------|--------|
| Pack dari `/admin/orders` | Pack di `/admin/field` Packing |
| Langsung isi resi di Pengiriman | Book Kurir di tab Kirim dulu |
| Ubah harga di SQL / seed | Owner di `/admin/products` |

---

## Form D — Media homepage (owner)

| Tugas | URL | Urutan |
|-------|-----|--------|
| Banner homepage | `/admin/carousel` | Urutan slide, gambar, CTA, aktif |
| Galeri lifestyle | `/admin/gallery` | Foto real, caption singkat |
| Testimoni | `/admin/testimonials` | Nama, kota, teks, tampil |
| Teks beranda / about | `/admin/cms` | `home-why`, `home-cta`, `about` dulu; legal menunggu lawyer |

Setelah simpan: hard-refresh homepage mobile (375px) — satu hero, brand jelas, tanpa placeholder.

---

## Form E — Pengaturan toko (owner) — `/admin/settings`

| Tab | Isi |
|-----|-----|
| Toko | Nama, jam, alamat pickup, WhatsApp toko |
| Promo | Hanya jika kupon sudah dibuat di `/admin/coupons` |
| Pengiriman | Origin / opsi yang relevan (jangan matikan cold-chain) |

---

## Form F — Dry-run satu order (gudang + developer)

1. Developer buat 1 order sandbox **delivery** + 1 **pickup**.
2. Gudang: Packing → Kirim (Book Kurir) untuk delivery.
3. Gudang: Packing → Pickup → Kode Ambil untuk pickup.
4. Developer cek log webhook + status order.
5. Purge order test setelah selesai (developer).

---

## URL cepat

| Tujuan | Path |
|--------|------|
| Mulai shift | `/admin` atau `/admin/field` |
| Pack | `/admin/field` (Packing) |
| Book kurir | `/admin/field` (Kirim) |
| Serah pickup | `/admin/field` (Pickup) |
| Stok HP | `/admin/field` (Stok) |
| Stok desktop | `/admin/inventory` |
| Resi manual | `/admin/shipments` |
| Harga / foto | `/admin/products` (**owner**) |
| Carousel / galeri | `/admin/carousel`, `/admin/gallery` |

---

## Definisi “selesai” konten

- [ ] Semua SKU launch: harga + foto + stok + berat/dimensi
- [ ] SKU belum siap: nonaktif
- [ ] Carousel + galeri + testimoni bukan seed dummy
- [ ] CMS home/about diisi
- [ ] Gudang bisa packing → book → pickup tanpa bingung layar mana
- [ ] Tidak ada edit katalog lewat code/seed
