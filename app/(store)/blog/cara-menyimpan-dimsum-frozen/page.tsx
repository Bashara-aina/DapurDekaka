import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Cara Menyimpan Dimsum Frozen yang Benar | Blog Dapur Dekaka',
    description: 'Panduan singkat menjaga dimsum frozen tetap segar dari freezer ke meja makan: suhu, durasi, dan tips repacking.',
    alternates: { canonical: 'https://dapurdekaka.com/blog/cara-menyimpan-dimsum-frozen' },
  };
}

export default function CaraMenyimpanDimsumPage() {
  return (
    <main className="bg-brand-cream min-h-screen pb-24 md:pb-20">
      <div className="px-4 sm:px-6">
      <article className="prose prose-lg max-w-3xl mx-auto py-12">
        <header>
          <p className="text-xs uppercase tracking-widest text-brand-red font-semibold">Tips Frozen Food</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">
            Cara Menyimpan Dimsum Frozen yang Benar (Agar Tetap Segar Sampai Pulang)
          </h1>
          <p className="text-sm text-text-muted mt-3">5 menit baca · Ditulis oleh tim Dapur Dekaka</p>
        </header>

        <section className="mt-8 space-y-4 text-text-secondary">
          <p>
            Dimsum frozen dari Dapur Dekaka dikemas dengan ice gel dan insulation box, tapi begitu sampai rumah,
            penyimpanan yang benar menentukan kualitas di meja makan. Berikut panduan singkatnya.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">1. Segera Pindahkan ke Freezer</h2>
          <p>
            Begitu paket diterima, langsung pindahkan produk ke dalam freezer (-18°C). Jangan biarkan pada suhu
            ruang lebih dari 30 menit. Semakin cepat masuk freezer, semakin baik rasa dan tekstur saat dimasak.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">2. Pisahkan Berdasarkan Tanggal</h2>
          <p>
            Jika Anda memesan dalam jumlah besar, pisahkan ke beberapa wadah kecil bertanggal. Ini membuat Anda
            hanya mencairkan (thawing) secukupnya. Hindari反复-反复 freeze-thaw yang merusak tekstur dimsum.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">3. Suhu Ideal</h2>
          <p>
            Freezer ideal untuk dimsum: -18°C atau lebih rendah. Hindari freezer atas pintu (suhunya tidak stabil).
            Bagian tengah-rak bawah biasanya paling konsisten dinginnya.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">4. Pemanasan Ulang</h2>
          <p>
            Panaskan langsung dari kondisi beku — tidak perlu thawing. Kukus 8–12 menit untuk dimsum kecil, atau
            10–15 menit untuk siomay/bakso. Api besar, air mendidih penuh — itulah cara restoran dimsum mempertahankan
            kekenyalan kulit.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">5. Durasi Simpan</h2>
          <p>
            Dimsum frozen Dapur Dekaka terbaik dalam 1–3 bulan sejak diproduksi. Setelah itu tekstur dan rasa tetap
            aman, tetapi mulai menurun. Selalu cek label tanggal pada kemasan.
          </p>
        </section>

        <footer className="mt-12 border-t pt-6">
          <p className="text-sm text-text-muted">
            Punya pertanyaan lain tentang penyimpanan?{' '}
            <a className="text-brand-red underline" href="https://wa.me/62812xxxxxxxx" target="_blank" rel="noreferrer">
              Chat WhatsApp kami
            </a>
            .
          </p>
        </footer>
      </article>
      </div>
    </main>
  );
}
