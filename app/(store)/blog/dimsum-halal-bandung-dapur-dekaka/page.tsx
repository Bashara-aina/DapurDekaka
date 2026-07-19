import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Dimsum Halal Bandung — Cerita Dapur Dekaka 德卡 | Blog',
    description: 'Bagaimana resep keluarga Chinese-Indonesian di Bandung menjadi brand premium halal: sejarah singkat, nilai, dan komitmen kami.',
    alternates: { canonical: 'https://dapurdekaka.com/blog/dimsum-halal-bandung-dapur-dekaka' },
  };
}

export default function DimsumHalalBandungPage() {
  return (
    <main className="bg-brand-cream min-h-screen pb-24 md:pb-20">
      <div className="px-4 sm:px-6">
      <article className="prose prose-lg max-w-3xl mx-auto py-12">
        <header>
          <p className="text-xs uppercase tracking-widest text-brand-red font-semibold">Cerita & Nilai</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">
            Dimsum Halal Bandung — Cerita Dapur Dekaka
          </h1>
          <p className="text-sm text-text-muted mt-3">4 menit baca · Tim Dapur Dekaka</p>
        </header>

        <section className="mt-8 space-y-4 text-text-secondary">
          <p>
            Dapur Dekaka 德卡 berdiri dari resep keluarga yang sudah turun lebih dari satu generasi, di sebuah dapur
            kecil di Turangga, Bandung. Nama 德卡 sendiri berarti &ldquo;kebajikan karakter&rdquo; &mdash; nilai yang — nilai yang
            kami bawa ke setiap potong dimsum, siomay, bakso, dan lumpia yang kami produksi.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Akar Bandung</h2>
          <p>
            Bandung adalah rumah. Kami percaya kota ini memiliki standar tertinggi untuk kuliner Chinese-Indonesia,
            dan tinggal di sini memaksa kami memasak yang terbaik. Setiap produk kami keluar dari fasilitas
            produksi di Jl. Sinom V No. 7, Turangga.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Halal Itu Non-Negotiable</h2>
          <p>
            Sertifikat halal MUI adalah janji minimum — bukan jualan. Semua bahan ditelusuri, proses produksi
            diaudit, dan kami menolak shortcut yang bisa mengganggu keyakinan pelanggan.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Cold Chain Jujur</h2>
          <p>
            Tidak ada klaim &ldquo;dijamin beku sampai rumah&rdquo; untuk kurir motor. Curang soal suhu = rusak trust.
            Yang kami janjikan: packing yang benar, ice gel yang cukup, dan — kalau gagal — refund penuh tanpa
            debat. Itulah aturan main kami.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Website, Bukan Etalase</h2>
          <p>
            Toko fisik dan Shopee sudah melayani banyak keluarga Bandung. Website ini adalah tambahan jalur untuk
            mereka yang sudah kenal kami — lebih cepat, lebih personal, dengan loyalty points untuk pelanggan
            yang berulang. Bukan marketplace, bukan iklan besar. Hanya alat yang lebih dekat.
          </p>
        </section>

        <footer className="mt-12 border-t pt-6">
          <p className="text-sm text-text-muted">
            Pesan via WhatsApp atau langsung checkout di website — keduanya berakhir di dapur yang sama.
          </p>
        </footer>
      </article>
      </div>
    </main>
  );
}
