import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi - Dapur Dekaka',
  description: 'Kebijakan privasi Dapur Dekaka sesuai UU Pelindungan Data Pribadi (UU PDP) No. 27 Tahun 2022. Bagaimana kami mengumpulkan, menggunakan, dan melindungi data Anda.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-brand-cream min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          Kebijakan Privasi
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          Terakhir diperbarui: Mei 2026 — Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)
        </p>

        <div className="bg-white rounded-card shadow-card p-6 md:p-8 space-y-6">
          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Data yang Kami Kumpulkan
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Dapur Dekaka mengumpulkan data pribadi berikut untuk memproses pesanan dan memberikan layanan terbaik:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li><strong>Nama lengkap</strong> — untuk identitas pengiriman dan faktur</li>
              <li><strong>Alamat email</strong> — untuk konfirmasi pesanan dan komunikasi</li>
              <li><strong>Nomor telepon</strong> — untuk koordinasi pengiriman via WhatsApp/SMS</li>
              <li><strong>Alamat pengiriman</strong> — untuk mengirim produk ke lokasi Anda</li>
              <li><strong>Data pembayaran</strong> — diproses oleh Midtrans, tidak disimpan di server kami</li>
              <li><strong>Riwayat pesanan</strong> — untuk layanan pelanggan dan loyalty points</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Tujuan Pengumpulan Data
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Data Anda digunakan untuk:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>Memproses dan mengirim pesanan frozen food</li>
              <li>Mengirim notifikasi status pesanan via WhatsApp dan email</li>
              <li>Memberikan loyalty points dan promo personal</li>
              <li>Memenuhi kewajiban hukum dan regulasi perpajakan (PPN)</li>
              <li>Meningkatkan layanan pelanggan</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Perlindungan Data
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Kami melindungi data Anda dengan:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mt-2">
              <li>Enkripsi SSL/TLS untuk semua transmisi data</li>
              <li>Penyimpanan di database Neon PostgreSQL yang aman</li>
              <li>Akses terbatas hanya untuk staff yang berwenang</li>
              <li>Tidak menjual atau membagikan data ke pihak ketiga untuk tujuan marketing</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Retensi Data
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Data pribadi disimpan selama akun aktif dan selama diperlukan untuk keperluan 
              hukum. Anda dapatطلب penghapusan data kapan saja — semua data pribadi akan 
              dianonimisasi atau dihapus dari sistem, kecuali data yang wajib disimpan untuk 
              keperluan hukum/perpajakan (faktur, bukti transaksi minimal 10 tahun).
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Hak Anda (UU PDP Pasal 5-13)
            </h2>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>Mendapatkan akses ke data pribadi Anda</li>
              <li>Meminta perbaikan data yang tidak akurat</li>
              <li>Meminta penghapusan data dalam kondisi tertentu</li>
              <li>Menarik persetujuan kapan saja</li>
              <li>Mengajukan keberatan atas pemrosesan tertentu</li>
              <li>Mengajukan komplain ke otoritas perlindungan data</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Cookies
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Situs dapurdekaka.com menggunakan cookies untuk:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mt-2">
              <li><strong>Fungsional</strong> — mengingat item keranjang dan preferensi bahasa</li>
              <li><strong>Analytics</strong> — memahami cara pengunjung menggunakan situs</li>
              <li><strong>Marketing</strong> — menayangkan iklan yang relevan (jika berlaku)</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-2">
              Anda dapat menonaktifkan cookies melalui pengaturan browser.
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              WhatsApp Business
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Saat Anda menghubungi kami via WhatsApp, chat akan tercatat di WhatsApp Business 
              untuk keperluan customer service. Data percakapan ditangani sesuai kebijakan 
              privasi WhatsApp Business. Kami tidak menggunakan data WhatsApp untuk tujuan 
              marketing.
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Perubahan Kebijakan
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Kebijakan privasi ini dapat diperbarui sewaktu-waktu. Perubahan signifikan 
              akan diumumkan melalui situs web dan/atau email. Penggunaan berkelanjutan 
              atas layanan kami setelah perubahan merupakan persetujuan atas kebijakan terbaru.
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Hubungi Kami
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Untuk pertanyaan tentang kebijakan privasi atau mengajukan solicitação 
              penghapusan data, hubungi:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mt-2">
              <li>
                Email: <a href="mailto:privasi@dapurdekaka.com" className="text-brand-red font-medium hover:underline">privasi@dapurdekaka.com</a>
              </li>
              <li>
                WhatsApp:{' '}
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-red font-medium hover:underline"
                >
                  Klik di sini untuk chat
                </a>
              </li>
            </ul>
            <p className="text-text-secondary text-sm mt-4">
              Atau kirim surat ke: Jl. Sinom V No. 7, Turangga, Bandung 40261, Indonesia
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}