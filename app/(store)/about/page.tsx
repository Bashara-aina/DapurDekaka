import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { MessageCircle, ChefHat, ShieldCheck, Snowflake } from 'lucide-react';
import { getCmsPage, getGalleryByUsage, pickSection, sectionText } from '@/lib/cms/get-page';
import { getStoreContactSettings } from '@/lib/settings/runtime-rules';
import { getSetting } from '@/lib/settings/get-settings';
import { SETTING_KEYS } from '@/lib/settings/canonical-keys';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: t('aboutTitle'),
    description: t('aboutDescription'),
    alternates: { canonical: 'https://dapurdekaka.com/about' },
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
  const [cms, heroImages, contact, foundingYear, priceMin, priceMax] = await Promise.all([
    getCmsPage('about').catch(() => null),
    getGalleryByUsage('about_hero', 1).catch(() => []),
    getStoreContactSettings().catch(() => ({
      whatsapp: '',
      address: '',
      instagramUrl: '',
      openingHours: '',
    })),
    getSetting<number>(SETTING_KEYS.FOUNDING_YEAR, 'integer').catch(() => 2020),
    getSetting<number>(SETTING_KEYS.PRICE_RANGE_MIN, 'integer').catch(() => 30000),
    getSetting<number>(SETTING_KEYS.PRICE_RANGE_MAX, 'integer').catch(() => 200000),
  ]);

  const hero = pickSection(cms, 'hero');
  const story = pickSection(cms, 'story');
  const cta = pickSection(cms, 'cta');
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const heroPublicId = hero?.imagePublicId || heroImages[0]?.publicId;
  const heroSrc = heroPublicId && cloudName
    ? `https://res.cloudinary.com/${cloudName}/image/upload/f_webp,q_auto,w_800/${heroPublicId}`
    : '';

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Tentang Dapur Dekaka',
    url: 'https://dapurdekaka.com/about',
    mainEntity: {
      '@type': 'FoodEstablishment',
      name: 'Dapur Dekaka',
      foundingDate: String(foundingYear ?? 2020),
      telephone: contact.whatsapp,
      priceRange: `Rp ${(priceMin ?? 30000).toLocaleString('id-ID')} - Rp ${(priceMax ?? 200000).toLocaleString('id-ID')}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: contact.address || '',
        addressLocality: '',
        addressCountry: 'ID',
      },
      sameAs: contact.instagramUrl ? [contact.instagramUrl] : [],
    },
  };

  const waMsg =
    sectionText(cta, 'id', 'ctaLabel') ||
    'Halo! Saya ingin tahu lebih lanjut tentang produk Dapur Dekaka';

  return (
    <div className="bg-brand-cream pb-20 md:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <section className="relative bg-brand-navy text-white py-20 md:py-28">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-brand-gold font-medium text-sm tracking-wider uppercase mb-3">
              {sectionText(hero, 'id', 'title') || t('heroTagline')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 whitespace-pre-line">
              {sectionText(hero, 'id', 'body') || t('heroTitle')}
            </h1>
            <p className="text-white/70 text-lg">
              {(hero?.meta as { desc?: string } | null)?.desc || t('heroDesc')}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl font-bold mb-6">
                {sectionText(story, 'id', 'title') || t('storyTitle')}
              </h2>
              <div className="space-y-4 text-text-secondary leading-relaxed whitespace-pre-line">
                {sectionText(story, 'id', 'body') || (
                  <>
                    <p>{t('storyP1')}</p>
                    <p>{t('storyP2')}</p>
                    <p>{t('storyP3')}</p>
                  </>
                )}
              </div>
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-brand-cream">
              {heroSrc ? (
                <Image
                  src={heroSrc}
                  alt="Produksi Dapur Dekaka"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-brand-cream">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-center mb-12">{t('valuesTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { Icon: ChefHat, title: t('qualityTitle'), desc: t('qualityDesc') },
              { Icon: ShieldCheck, title: t('halalTitle'), desc: t('halalDesc') },
              { Icon: Snowflake, title: t('coldChainTitle'), desc: t('coldChainDesc') },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-brand-red" />
                </div>
                <h3 className="font-display text-lg font-bold mb-2">{title}</h3>
                <p className="text-sm text-text-secondary">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl font-bold mb-6">{t('productionTitle')}</h2>
            <p className="text-text-secondary leading-relaxed mb-8">
              {contact.address
                ? `Semua produk Dapur Dekaka diproduksi di fasilitas kami di ${contact.address}.`
                : t('productionDesc')}
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

      <section className="py-16 bg-brand-red">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-4">
            {sectionText(cta, 'id', 'title') || t('ctaTitle')}
          </h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">
            {sectionText(cta, 'id', 'body') || t('ctaDesc')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href={cta?.ctaHref || '/products'}
              className="inline-flex items-center px-6 py-3 bg-white text-brand-red font-semibold rounded-button hover:bg-brand-cream transition-colors"
            >
              {t('viewProducts')}
            </Link>
            <a
              href={
                contact.whatsapp
                  ? `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(waMsg)}`
                  : '#'
              }
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
