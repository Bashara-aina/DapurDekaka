/**
 * All user-facing error messages in Bahasa Indonesia
 * Used across components, API responses, and toast notifications
 */
export const ERROR_COPY = {
  // Cart
  insufficient_stock: (name: string, available: number) =>
    `Stok ${name} tidak cukup. Tersisa ${available} item saja.`,
  product_not_found: 'Produk tidak ditemukan atau sudah tidak tersedia.',
  cart_empty: 'Keranjang kamu kosong. Yuk pilih produk dulu!',

  // Coupon
  coupon_not_found: 'Kode kupon tidak ditemukan. Pastikan penulisan sudah benar.',
  coupon_expired: 'Sayang sekali, kupon ini sudah kedaluwarsa.',
  coupon_max_uses: 'Kupon ini sudah mencapai batas penggunaan.',
  coupon_min_order: (amount: string) =>
    `Minimum belanja ${amount} untuk menggunakan kupon ini.`,
  coupon_already_used: 'Kamu sudah pernah menggunakan kupon ini sebelumnya.',
  coupon_not_started: 'Kupon ini belum berlaku.',

  // Points
  insufficient_points: 'Saldo poin kamu tidak cukup.',
  points_max_exceeded: (max: string) =>
    `Maksimal penggunaan poin adalah 50% dari subtotal (${max} poin).`,

  // Shipping
  shipping_unavailable: 'Pengiriman ke alamat ini belum tersedia saat ini.',
  shipping_changed: 'Opsi pengiriman berubah. Silakan pilih ulang.',

  // Checkout
  checkout_failed: 'Gagal memproses pesanan. Silakan coba lagi.',
  payment_failed: 'Pembayaran gagal. Silakan coba metode lain.',
  payment_expired: 'Waktu pembayaran habis. Buat pesanan baru untuk melanjutkan.',

  // Auth
  login_required: 'Silakan masuk dulu untuk melanjutkan.',
  invalid_credentials: 'Email atau password salah.',
  account_inactive: 'Akun kamu dinonaktifkan. Hubungi CS kami.',
  email_taken: 'Email ini sudah terdaftar. Silakan masuk.',

  // Network
  network_error: 'Koneksi terputus. Pastikan internet aktif dan coba lagi.',
  server_error: 'Terjadi gangguan teknis. Tim kami sedang menanganinya.',
  rate_limited: 'Terlalu banyak percobaan. Tunggu beberapa menit ya.',

  // Forms
  required: 'Wajib diisi',
  invalid_email: 'Format email tidak valid',
  invalid_phone: 'Format nomor HP tidak valid. Contoh: 08123456789',
  invalid_postal_code: 'Kode pos harus 5 digit',
  password_too_short: 'Password minimal 8 karakter',
  password_mismatch: 'Password tidak cocok',
  address_too_short: 'Alamat terlalu pendek. Tulis dengan lengkap ya!',
} as const;
