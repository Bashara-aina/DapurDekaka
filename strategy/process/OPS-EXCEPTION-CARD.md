# OPS-EXCEPTION-CARD — DapurDekaka.com

> Print version of P5 exception triage. Customer templates in **id**; internal notes in **en** where noted.

## F1 — Payment pending > 1h

- **Detection:** Ops card `pendingOrdersOver1h`
- **SOP:** Cek Midtrans dashboard → kirim link retry ke customer via WA
- **Customer (id):** "Halo Kak, pembayaran pesanan {no} belum kita terima. Silakan selesaikan di link ini atau balas WA jika sudah bayar."

## F2 — Late settlement (expire-then-pay)

- **Detection:** `needs_attention` reason `late_settlement` + refund row
- **SOP:** Refund penuh via Midtrans dashboard → PATCH refund completed. Revive manual hanya jika customer balas WA dan stok ada.
- **Customer (id):** "Pembayaran diterima setelah pesanan kedaluwarsa — dana dikembalikan penuh dalam 7 hari, atau balas WA ini jika masih ingin pesanannya."

## F3 — Oversell at settlement

- **Detection:** Webhook `settlement_insufficient_stock` + WA ops alert
- **SOP:** ≤15 menit: WA minta maaf → refund penuh ATAU tunggu restock (customer pilih). Jangan kirim partial tanpa konfirmasi.
- **Customer (id):** "Maaf Kak, stok {sku} habis saat pembayaran kami proses. Kami refund penuh / atau kirim H+1 — pilih mana?"

## F4 — Bad / incomplete address

- **Detection:** Dispatch gagal / courier WA "alamat tidak ditemukan"
- **SOP:** Hubungi customer → perbaiki pin + alamat → re-book sebelum cutoff
- **Customer (id):** "Kak, kurir tidak menemukan alamat. Bisa kirim pin Maps + detail jalan? Kami booking ulang hari ini jika sebelum jam cut-off."

## F5 — Dispatch failed (×3 / wallet)

- **Detection:** `dispatchStatus=failed` atau retry cron gagal
- **SOP:** Jika error wallet → TOP UP Biteship dulu. Re-book manual atau tunggu cron 30 menit. WA proactive template.
- **Customer (id):** "Maaf, penjemputan kurir dijadwalkan ulang. Pesanan {no} tetap kami jaga beku & prioritas besok pagi."

## F6 — Delay / no scan > 6h

- **Detection:** Ops card `shippedNoScanOver6h`
- **SOP:** Cek Biteship tracking → WA customer dengan ETA jujur
- **Customer (id):** "Pesanan {no} masih dalam perjalanan. Update terakhir: {status}. Estimasi: {eta}."

## F7 — Melt / spoilage claim

- **Detection:** Dispute category `spoilage` atau WA foto
- **SOP:** ≤15 menit balas → minta foto outer box + produk + label → ganti atau refund (FD#9: default ganti jika pertama kali)
- **Customer (id):** "Mohon maaf Kak. Kirim foto kemasan luar, isi, dan label pengiriman. Kami ganti atau refund penuh — tanpa debat."

## F8 — Wrong item / incomplete

- **Detection:** Dispute `wrongItem`
- **SOP:** Verifikasi packing list vs order_items snapshot → kirim ulang item yang kurang / refund selisih
- **Customer (id):** "Terima kasih sudah lapor. Kami cek gudang & kirim item yang kurang / refund sesuai."

## F9 — Refund overdue > 3d

- **Detection:** Ops card `refundsOverdue3d`
- **SOP:** Proses Midtrans refund hari ini → PATCH completed → pastikan points clawback

## F10 — Pickup no-show > 48h

- **Detection:** `needs_attention` reason `pickup_no_show`
- **SOP:** FD#7: default hold + WA terakhir → jika no response, refund penuh (goodwill)
- **Customer (id):** "Kak, pesanan pickup {no} belum diambil. Mau ambil hari ini atau kami refund?"

## F11 — Maintenance mode

- **Detection:** Bashara unavailable through booking cutoff
- **SOP:** Set `maintenance_mode=true` in system_settings → banner ON → WA auto-reply
- **Banner (id):** "Sementara tidak menerima pesanan baru — silakan WA untuk bantuan."
- **WA auto-reply (id):** "Terima kasih sudah hubungi Dapur Dekaka. Tim kami sedang libur singkat; pesanan online buka lagi {date}. Order urgent? Balas WA ini."

## Dry-run checklist (pre-launch)

1. Fake melt: dispute row → refund row → points clawback → resolved < 20 min
2. Kill Biteship booking → alert → retry succeeds
3. Hand-verify ops card numbers vs SQL once
