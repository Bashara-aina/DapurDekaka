# i18n Survey — Store Frontend
**Generated:** Friday May 22, 2026
**Status:** CRITICAL — i18n incomplete, English locale non-functional

---

## Current i18n Coverage

### id.json (Indonesian) — 22 keys across 5 sections
- `common`: brandName, tagline
- `nav`: home, products, cart, account, blog
- `product`: addToCart, outOfStock, remainingStock, selectVariant, halal
- `cart`: empty, emptySubtitle, startShopping, total, checkout
- `checkout`: title, delivery, pickup, payNow, identity, address, courier, payment

### en.json (English) — 22 keys (mirror of id.json)
- Same keys as id.json but English translations
- Status: **NON-FUNCTIONAL** — components don't use these keys

---

## Components with Hardcoded Strings (CRITICAL GAPS)

### Navigation & Layout
| Component | Hardcoded Strings |
|-----------|-------------------|
| `Navbar.tsx` | NAV_LINKS array: "Beranda", "Produk", "Blog"; "Akun", "Masuk" |
| `Footer.tsx` | "Produk", "Blog", "Tentang", "Kebijakan Privasi", "Kebijakan Pengembalian" |
| `BottomNav.tsx` | **Uses i18n correctly** — model component |

### Product Components
| Component | Hardcoded Strings |
|-----------|-------------------|
| `ProductCard.tsx` | "Lihat Keranjang" (button), fallback image path |
| `ProductCatalog.tsx` | Sort labels: "Urutkan", "Terbaru", "Harga Rendah-High", "Harga High-Rendah"; "Produk", "Produk tidak ditemukan", "Tampilkan Semua Produk" |
| `ProductDetailClient.tsx` | "Lihat Keranjang", breadcrumb "Beranda"/"Produk", "Produk Lainnya", "Tambah ke Keranjang", "Stok Habis" |

### Cart & Checkout
| Component | Hardcoded Strings |
|-----------|-------------------|
| `CartItem.tsx` | "Hapus item", quantity labels, stock validation messages |
| `CartSummary.tsx` | "Masukkan alamat", subtotal/total labels, "Bayar Sekarang" |
| `CouponInput.tsx` | "Masukkan kode kupon", "Cek Kupon", error messages |
| `CheckoutStepper.tsx` | Step labels: "Identitas", "Pengiriman", "Pembayaran" |
| `AddressForm.tsx` | All form labels: "Label Alamat", "Nama Penerima", "Nomor Telepon", "Provinsi", "Kota/Kabupaten", "Kecamatan", "Alamat Lengkap", "Kode Pos", "Jadikan alamat utama", "Batal", "Simpan Alamat" |
| `IdentityForm.tsx` | Form labels, placeholders, validation messages |
| `ShippingOptions.tsx` | Courier selection labels, "Pilih Kurir" |
| `PointsRedeemer.tsx` | Points redemption labels, "Gunakan Poin" |

### Account Pages
| Component | Hardcoded Strings |
|-----------|-------------------|
| `AccountAddressesPage.tsx` | "Alamat Tersimpan", "Kelola alamat pengiriman kamu", "Tambah Alamat", "Yakin ingin menghapus alamat ini?" |
| `AccountOrdersPage.tsx` | STATUS_FILTERS: "Semua", "Menunggu Bayar", "Diproses", "Dikemas", "Dikirim", "Selesai", "Dibatalkan"; "Belum Ada Pesanan", "Mulai Belanja" |
| `AccountPointsPage.tsx` | Points labels, transaction history text, "Poin Tidak的有效期" (expiry) |
| `AccountVouchersPage.tsx` | Voucher labels, "Voucher Saya", validation messages |

### Blog Components
| Component | Hardcoded Strings |
|-----------|-------------------|
| `BlogCard.tsx` | "Baca Selengkapnya", date formatting |
| `BlogSearchForm.tsx` | Search placeholder: "Cari artikel..." |
| `LatestBlogPosts.tsx` | "Dari Blog Kami" |

### Home Page Components
| Component | Hardcoded Strings |
|-----------|-------------------|
| `HomePageCTA.tsx` | "Jelajahi Produk", "Lihat Keranjang", "Mulai Belanja" |
| `HeroCarousel.tsx` | "Lihat Produk" |
| `FeaturedProducts.tsx` | "Produk Unggulan", "Lihat Semua", "Lihat semua produk" |

### Common/Shared Components
| Component | Hardcoded Strings |
|-----------|-------------------|
| `EmptyState.tsx` | All variants: "Keranjang kosong", "Tidak ada hasil pencarian", etc. |
| `StockBadge.tsx` | "Habis", "Tersisa {count} pcs" (uses Zustand + hardcoded) |
| `OrderStatusBadge.tsx` | All status labels |
| `WhatsAppButton.tsx` | Fallback phone number, tooltip "Chat WhatsApp" |
| `OrderSummaryCard.tsx` | "Ringkasan Pesanan", "Subtotal", "Diskon", "Pengiriman", "Total" |

---

## Count of Hardcoded Strings (Estimated)

| Category | Approximate Count |
|----------|------------------|
| Button labels | ~40 |
| Form labels & placeholders | ~60 |
| Error messages | ~25 |
| Success messages | ~10 |
| Empty state messages | ~15 |
| Badge text | ~10 |
| Navigation text | ~15 |
| Status labels | ~20 |
| Static page content | ~30 |
| **TOTAL** | **~225 keys needed** |

---

## Recommended i18n Structure

```json
{
  "common": { ... },
  "nav": { ... },
  "product": { ... },
  "cart": { ... },
  "checkout": { ... },
  "account": {
    "title": "Akun Saya",
    "orders": "Pesanan",
    "addresses": "Alamat",
    "points": "Poin",
    "vouchers": "Voucher",
    "profile": "Profil"
  },
  "buttons": {
    "viewCart": "Lihat Keranjang",
    "addToCart": "Tambah ke Keranjang",
    "checkout": "Checkout",
    "payNow": "Bayar Sekarang",
    "save": "Simpan",
    "cancel": "Batal",
    "delete": "Hapus",
    "edit": "Edit",
    "back": "Kembali",
    "continue": "Lanjutkan",
    "submit": "Kirim",
    "retry": "Coba Lagi"
  },
  "form": {
    "labels": { ... },
    "placeholders": { ... },
    "errors": { ... }
  },
  "messages": {
    "empty": { ... },
    "error": { ... },
    "success": { ... },
    "loading": { ... }
  },
  "status": {
    "pending_payment": "Menunggu Bayar",
    "paid": "Dibayar",
    "processing": "Diproses",
    "packed": "Dikemas",
    "shipped": "Dikirim",
    "delivered": "Selesai",
    "cancelled": "Dibatalkan"
  },
  "blog": { ... },
  "footer": { ... },
  "home": { ... }
}
```

---

## Files Using i18n (CORRECTLY)
- `BottomNav.tsx` — uses `useTranslations('nav')`

## Files NOT Using i18n (MUST FIX)
- ALL other store components

---

## Priority for i18n Migration

**Phase 1 (Critical):**
- All button labels
- All form validation messages
- Error/success messages

**Phase 2 (High):**
- Empty states
- Navigation text
- Status badges

**Phase 3 (Medium):**
- Static page content
- Blog content
- Home page text

**Phase 4 (Low):**
- Tooltips
- Accessibility labels
- SEO metadata