import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kebijakan Pengembalian - Dapur Dekaka',
  description: 'Kebijakan pengembalian dan refund produk frozen food Dapur Dekaka. Makanan frozen tidak dapat dikembalikan karena alasan keamanan pangan.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="bg-brand-cream min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          Kebijakan Pengembalian
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          Terakhir diperbarui: Mei 2026
        </p>

        <div className="bg-white rounded-card shadow-card p-6 md:p-8 space-y-6">
          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Makanan Frozen Tidak Dapat Dikembalikan
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Mengingat sifat produk kami yang berupa makanan frozen (beku), 
              <strong> semua produk Dapur Dekaka tidak dapat dikembalikan</strong> setelah 
              diterima. Ini sesuai dengan regulasi keamanan pangan Indonesia yang tidak 
              mengizinkan makanan beku yang telah meninggalkan rantai pendingin untuk 
              dikembalikan ke peredaran commerce.
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Kondisi yang Dapat Diklaim
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Kami menerima klaim dalam kondisi berikut:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>Produk yang diterima salah atau tidak sesuai pesanan</li>
              <li>Kemasan rusak atau tidak kedap yang menyebabkan produk mencair</li>
              <li>Produk yang diterima tidak lengkap dari yang dipesan</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              <strong>Bukti foto wajib</strong> dilampirkan saat mengklaim: foto kemasan 
              luar, foto produk, dan foto label pengiriman.
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Cara Mengajukan Klaim
            </h2>
            <ol className="list-decimal list-inside text-text-secondary space-y-2">
              <li>
                Hubungi kami via WhatsApp dalam <strong>24 jam</strong> setelah produk diterima
              </li>
              <li>
                Lampirkan foto-foto yang diperlukan (kemasan, produk, label pengiriman)
              </li>
              <li>
                Tim kami akan memverifikasi dalam 1x24 jam kerja
              </li>
              <li>
                Jika klaim disetujui, refund atau pengiriman ulang akan diproses
              </li>
            </ol>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Timeline Refund
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Setelah klaim disetujui, refund akan diproses dalam{' '}
              <strong>1-7 hari kerja</strong> ke rekening pengirim atau melalui metode 
              pembayaran semula. Jika pembayaran dilakukan via Midtrans (kartu kredit, 
              VA, dll), refund akan masuk sesuai kebijakan Midtrans (3-14 hari kerja).
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Produk Tidak Diterima karena Alamat Salah
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Jika paket dikembalikan karena alamat penerima tidak valid atau无人认领, 
              kami akan menghubungi Anda untuk konfirmasi ulang. Ongkos kirim kedua 
              ditanggung oleh pembeli.
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              Hubungi Kami
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Untuk setiap pertanyaan terkait kebijakan pengembalian, silakan hubungi 
              tim kami via WhatsApp:{' '}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-red font-medium hover:underline"
              >
                Klik di sini untuk chat WhatsApp
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}