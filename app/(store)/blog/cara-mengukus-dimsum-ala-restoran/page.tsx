import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Cara Mengukus Dimsum Ala Restoran — Tanpa Alat Khusus | Blog Dapur Dekaka',
    description: 'Teknik steaming dimsum yang benar untuk menghasilkan kulit yang lembut dan isian matang sempurna, tanpa steamer mahal.',
    alternates: { canonical: 'https://dapurdekaka.com/blog/cara-mengukus-dimsum-ala-restoran' },
  };
}

export default function CaraMengukusDimsumPage() {
  return (
    <main className="bg-brand-cream min-h-screen pb-24 md:pb-20">
      <div className="px-4 sm:px-6">
      <article className="prose prose-lg max-w-3xl mx-auto py-12">
        <header>
          <p className="text-xs uppercase tracking-widest text-brand-red font-semibold">Resep & Teknik</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-2">
            Cara Mengukus Dimsum Ala Restoran — Tanpa Alat Khusus
          </h1>
          <p className="text-sm text-text-muted mt-3">6 menit baca · Tim Dapur Dekaka</p>
        </header>

        <section className="mt-8 space-y-4 text-text-secondary">
          <p>
            Kunci dimsum restoran bukan alat yang mahal, tapi teknik yang benar. Berikut cara mengukus yang kami
            rekomendasikan untuk semua produk Dapur Dekaka, menggunakan panci dan saringan biasa di dapur rumah.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Alat yang Dibutuhkan</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Panci besar dengan penutup</li>
            <li>Saringan kawat / steamer basket (bisa disisipkan ke dalam panci)</li>
            <li>Kertas roti / daun kubis / daun pisang untuk alas</li>
            <li>Api kompor yang bisa diatur sedang-besar</li>
          </ul>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Langkah Demi Langkah</h2>
          <p>
            <strong>Panaskan air:</strong> Masukkan air sekitar 3–5 cm ke dalam panci, biarkan mendidih dengan api besar.
          </p>
          <p>
            <strong>Siapkan alas:</strong> Taruh kertas roti yang sudah dipotong bulat atau daun pisang di dasar steamer.
            Fungsinya agar dimsum tidak lengket.
          </p>
          <p>
            <strong>Jangan terlalu padat:</strong> Taruh dimsum dengan jarak 2 cm antar potong. Saat dikukus,
            adonan dan kulit bisa mengembang sedikit — ruang adalah teman Anda.
          </p>
          <p>
            <strong>Api penuh:</strong> Setelah dimsum masuk steamer, tutup panci rapat dan jaga api besar stabil.
            Api terlalu kecil menghasilkan kulit keras dan kering.
          </p>
          <p>
            <strong>Durasi:</strong> 8–12 menit untuk dimsum kecil (siomay, hakau), 10–15 menit untuk bakso atau
            yang lebih besar. Buka tutup sekali di menit ke-5 untuk memastikan uap merata.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Tanda Matang Sempurna</h2>
          <p>
            Kulit transparan dan tidak lagi berawan, isian padat ketika ditekan ringan dengan jari. Angkat dengan
            hati-hati — kulit panas yang tipis bisa robek.
          </p>
          <h2 className="font-semibold text-xl mt-6 text-text-primary">Saus Pendamping</h2>
          <p>
            Coba saus signature kami: chilli oil untuk rasa pedas-gurih, saus mentai mayo untuk manis-creamy,
            atau saus tartar untuk rasa segar. Semua tersedia di katalog.
          </p>
        </section>

        <footer className="mt-12 border-t pt-6">
          <p className="text-sm text-text-muted">
            Ingin bukti dimsum Dapur Dekaka?{' '}
            <a className="text-brand-red underline" href="/products">
              Lihat katalog
            </a>{' '}
            atau{' '}
            <a className="text-brand-red underline" href="https://wa.me/62812xxxxxxxx" target="_blank" rel="noreferrer">
              chat WhatsApp
            </a>
            .
          </p>
        </footer>
      </article>
      </div>
    </main>
  );
}
