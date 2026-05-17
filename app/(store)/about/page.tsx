import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tentang Kami | Dapur Dekaka',
  description: 'Dapur Dekaka adalah produsen frozen food premium Chinese-Indonesia dari Bandung. Dimsum, siomay, bakso halal bersertifikat MUI.',
  alternates: {
    canonical: 'https://dapurdekaka.com/about',
  },
  openGraph: {
    title: 'Tentang Kami | Dapur Dekaka',
    description: 'Dapur Dekaka adalah produsen frozen food premium Chinese-Indonesia dari Bandung.',
    url: 'https://dapurdekaka.com/about',
    type: 'website',
  },
};

export default function AboutPage() {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Tentang Dapur Dekaka',
    description: 'Produsen frozen food premium Chinese-Indonesia dari Bandung dengan sertifikasi halal MUI.',
    url: 'https://dapurdekaka.com/about',
    mainEntity: {
      '@type': 'FoodEstablishment',
      name: 'Dapur Dekaka',
      alternateName: '德卡',
      description: 'Produsen dan toko online frozen food premium Chinese-Indonesia dari Bandung. Dimsum, siomay, bakso, lumpia. 100% halal bersertifikat MUI.',
      foundingDate: '2020',
      foundingLocation: {
        '@type': 'Place',
        addressLocality: 'Bandung',
        addressRegion: 'Jawa Barat',
        addressCountry: 'ID',
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Jl. Sinom V No. 7, Turangga',
        addressLocality: 'Bandung',
        addressRegion: 'Jawa Barat',
        postalCode: '40261',
        addressCountry: 'ID',
      },
      servesCuisine: ['Dimsum', 'Chinese-Indonesian', 'Frozen Food'],
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'Sertifikat Halal MUI',
        recognizedBy: {
          '@type': 'Organization',
          name: 'Majelis Ulama Indonesia (MUI)',
        },
      },
      priceRange: 'Rp 25.000 - Rp 150.000',
      telephone: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
      url: 'https://dapurdekaka.com',
      sameAs: [
        'https://instagram.com/dapurdekaka',
      ],
    },
  };

  return (
    <div className="bg-brand-cream pb-20 md:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* Hero */}
      <section className="relative bg-[#1A1A1A] text-white py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-brand-gold font-medium text-sm tracking-wider uppercase mb-3">
              Tentang Kami
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              Cita Rasa Warisan,<br />Kini di Rumahmu
            </h1>
            <p className="text-white/70 text-lg">
              Dapur Dekaka (德卡) adalah produsen frozen food premium Chinese-Indonesia dari Bandung, membawa resep turun-temurun dengan standar halal MUI untuk seluruh Indonesia.
            </p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl font-bold mb-6">Cerita Dapur Dekaka</h2>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>
                  Berawal dari sebuah dapur kecil di Turangga, Bandung, Dapur Dekaka lahir dari mimpi untuk membawa cita rasa authentic Chinese-Indonesian ke setiap rumah tangga Indonesia.
                </p>
                <p>
                  Dengan pengalaman puluhan tahun meracik frozen food berkualitas, kami menyajikan produk-produk seperti dimsum, siomay, bakso, dan lumpia yang dibuat dari bahan-bahan pilihan dan proses produksi higienis.
                </p>
                <p>
                  Setiap produk Dapur Dekaka dilengkapi sertifikasi halal dari MUI, sehingga Anda tidak perlu khawatir tentang kehalalan produk yang kami buat. Kami percaya bahwa kualitas dan keyakinan agama bukanlah pilihan — keduanya adalah standar.
                </p>
              </div>
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-brand-cream">
              <Image
                src="/assets/gallery/gallery-01.jpg"
                alt="Produksi Dapur Dekaka"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-brand-cream">
        <div className="container">
          <h2 className="font-display text-3xl font-bold text-center mb-12">Nilai-Nilai Kami</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🍖</span>
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Bahan Pilihan</h3>
              <p className="text-sm text-text-secondary">
                Kami hanya menggunakan bahan-bahan berkualitas tinggi, dipilih langsung oleh tenaga ahli kami untuk memastikan rasa dan tekstur yang sempurna.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Halal Terjamin</h3>
              <p className="text-sm text-text-secondary">
                Semua produk bersertifikat halal MUI. Kehalalan bukan sekadar label, tapi adalah janji kami kepada setiap pelanggan.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">❄️</span>
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Cold Chain Terjaga</h3>
              <p className="text-sm text-text-secondary">
                Dari dapur hingga pintu rumah Anda, rantai dingin kami terjaga ketat untuk memastikan kesegaran dan kualitas produk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Production Location */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold mb-6">Diproduksi di Bandung</h2>
            <p className="text-text-secondary leading-relaxed mb-8">
              Semua produk Dapur Dekaka diproduksi di fasilitas kami di Jl. Sinom V No. 7, Turangga, Bandung. Bandung dipilih bukan tanpa alasan — kota ini dikenal sebagai pusat kuliner Chinese-Indonesia terbaik di Indonesia, dan kami bangga menjadi bagian dari tradisi kuliner tersebut.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Image
                src="/assets/logo/halal.png"
                alt="Sertifikat Halal MUI"
                width={64}
                height={64}
                className="rounded-lg"
              />
              <div className="text-left">
                <p className="font-semibold text-sm">Sertifikasi Halal</p>
                <p className="text-xs text-text-secondary">Majelis Ulama Indonesia (MUI)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-red">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-4">
            Siap mencicipi frozen food premium kami?
          </h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">
            Pesan sekarang dan nikmati gratis ongkir untuk pembelian pertama. Dikirim ke seluruh Indonesia dengan cold chain terjaga.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 bg-white text-brand-red font-semibold rounded-button hover:bg-brand-cream transition-colors"
            >
              Lihat Produk
            </Link>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Halo! Saya ingin tahu lebih lanjut tentang produk Dapur Dekaka`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white font-semibold rounded-button hover:bg-[#20BD5A] transition-colors"
            >
              <span>💬</span> Chat WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}