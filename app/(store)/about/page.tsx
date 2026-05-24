import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MessageCircle, ChefHat, ShieldCheck, Snowflake, Truck, Award, Heart } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: t('aboutTitle'),
    description: t('aboutDescription'),
    alternates: {
      canonical: 'https://dapurdekaka.com/about',
    },
    openGraph: {
      title: t('aboutTitle'),
      description: t('aboutDescription'),
      url: 'https://dapurdekaka.com/about',
      type: 'website',
    },
  };
}

export default async function AboutPage() {
  const t = await getTranslations('about');

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
      <section className="relative bg-slate-800 text-white py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-brand-gold font-medium text-sm tracking-wider uppercase mb-3">
              {t('heroTagline')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 whitespace-pre-line">
              {t('heroTitle')}
            </h1>
            <p className="text-white/70 text-lg">
              {t('heroDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl font-bold mb-6">{t('storyTitle')}</h2>
              <div className="space-y-4 text-text-secondary leading-relaxed">
                <p>
                  {t('storyP1')}
                </p>
                <p>
                  {t('storyP2')}
                </p>
                <p>
                  {t('storyP3')}
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
          <h2 className="font-display text-3xl font-bold text-center mb-12">{t('valuesTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChefHat className="w-7 h-7 text-brand-red" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{t('qualityTitle')}</h3>
              <p className="text-sm text-text-secondary">
                {t('qualityDesc')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-brand-red" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{t('halalTitle')}</h3>
              <p className="text-sm text-text-secondary">
                {t('halalDesc')}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Snowflake className="w-7 h-7 text-brand-red" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{t('coldChainTitle')}</h3>
              <p className="text-sm text-text-secondary">
                {t('coldChainDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Production Location */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold mb-6">{t('productionTitle')}</h2>
            <p className="text-text-secondary leading-relaxed mb-8">
              {t('productionDesc')}
            </p>
            <div className="flex items-center justify-center gap-4">
              <Image
                src="/assets/logo/halal.png"
                alt={t('halalCert')}
                width={64}
                height={64}
                className="rounded-lg"
              />
              <div className="text-left">
                <p className="font-semibold text-sm">{t('halalCert')}</p>
                <p className="text-xs text-text-secondary">{t('halalCertOrg')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-red">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-4">
            {t('ctaTitle')}
          </h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">
            {t('ctaDesc')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/products"
              className="inline-flex items-center px-6 py-3 bg-white text-brand-red font-semibold rounded-button hover:bg-brand-cream transition-colors"
            >
              {t('viewProducts')}
            </Link>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Halo! Saya ingin tahu lebih lanjut tentang produk Dapur Dekaka`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-whatsapp-green text-white font-semibold rounded-button hover:bg-whatsapp-green-dark transition-colors"
            >
              <MessageCircle className="w-5 h-5" /> {t('chatWhatsApp')}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}