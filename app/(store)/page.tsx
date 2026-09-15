import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HeroCarousel } from '@/components/store/home/HeroCarousel';
import { FeaturedProducts } from '@/components/store/home/FeaturedProducts';
import { CategoryChips } from '@/components/store/home/CategoryChips';
import { PromoBanner } from '@/components/store/home/PromoBanner';
import { WhyDapurDekaka } from '@/components/store/home/WhyDapurDekaka';
import { InstagramFeed } from '@/components/store/home/InstagramFeed';
import { Testimonials } from '@/components/store/home/Testimonials';
import { HomePageCTA } from '@/components/store/home/HomePageCTA';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories, carouselSlides, systemSettings } from '@/lib/db/schema';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { getCmsPage, getGalleryByUsage, pickSection, sectionText } from '@/lib/cms/get-page';
import { getStoreContactSettings } from '@/lib/settings/runtime-rules';
import { getSetting } from '@/lib/settings/get-settings';
import { SETTING_KEYS } from '@/lib/settings/canonical-keys';
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  buildLocalBusinessJsonLd,
} from '@/lib/seo/homepage-jsonld';
import { cloudinaryUrl } from '@/lib/seo/cloudinary-url';

export const revalidate = 1800;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  const ogImagePublicId = await getSetting<string>('og_image_public_id').catch(() => null);
  const ogImageUrl = cloudinaryUrl(ogImagePublicId) ?? '';
  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    keywords: [
      'frozen food premium',
      'dimsum halal',
      'dimsum Bandung',
      'siomay premium',
      'bakso halal',
      'lumpia frozen',
      'makanan beku berkualitas',
      'frozen food online Indonesia',
      'pesan dimsum online',
      'dimsum kirim ke rumah',
      'Chinese Indonesian food halal',
      'frozen food tanpa pengawet',
      'dapur dekaka',
    ],
    alternates: {
      canonical: 'https://dapurdekaka.com',
    },
    openGraph: {
      title: t('homeTitle'),
      description: t('homeDescription'),
      url: 'https://dapurdekaka.com',
      siteName: 'Dapur Dekaka',
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                width: 1200,
                height: 630,
                alt: 'Dapur Dekaka - Frozen Food Premium',
              },
            ],
          }
        : {}),
      locale: 'id_ID',
      alternateLocale: ['en_US'],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('homeTitle'),
      description: t('homeDescription'),
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

async function getFeaturedProducts() {
  const featured = await db.query.products.findMany({
    where: and(eq(products.isActive, true), eq(products.isFeatured, true), isNull(products.deletedAt)),
    with: {
      variants: { where: eq(productVariants.isActive, true), limit: 1 },
      images: { limit: 1 },
    },
    orderBy: [desc(products.sortOrder)],
    limit: 8,
  });
  return featured.map(p => ({
    id: p.id,
    nameId: p.nameId,
    nameEn: p.nameEn ?? '',
    slug: p.slug,
    isHalal: p.isHalal ?? true,
    variants: p.variants.map(v => ({
      id: v.id,
      nameId: v.nameId,
      nameEn: v.nameEn ?? '',
      sku: v.sku ?? '',
      price: v.price,
      stock: v.stock,
      weightGram: v.weightGram ?? 0,
      isActive: v.isActive,
    })),
    images: p.images.map(img => ({
      cloudinaryUrl: img.cloudinaryUrl,
    })),
  }));
}

async function getCategories() {
  // Single query with LEFT JOIN + GROUP BY + HAVING to get categories with active products
  const categoriesWithProducts = await db
    .select({
      id: categories.id,
      nameId: categories.nameId,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(products, and(
      eq(categories.id, products.categoryId),
      eq(products.isActive, true),
      isNull(products.deletedAt)
    ))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .having(sql`count(${products.id}) > 0`)
    .orderBy(categories.sortOrder);

  return categoriesWithProducts;
}

async function getActiveCarouselSlides() {
  const now = new Date();
  return db.query.carouselSlides.findMany({
    where: and(
      eq(carouselSlides.isActive, true),
    ),
    orderBy: [carouselSlides.sortOrder],
  }).then(slides => slides.filter(slide => {
    const startOk = !slide.startsAt || slide.startsAt <= now;
    const endOk = !slide.endsAt || slide.endsAt >= now;
    return startOk && endOk;
  }));
}

async function getPromoSettings() {
  const settings = await db.query.systemSettings.findMany({
    where: sql`${systemSettings.key} IN ('promo_code', 'promo_title', 'promo_subtitle', 'promo_active', 'carousel_speed_ms')`,
  });
  const byKey = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return {
    promoCode: byKey.promo_code ?? 'SELAMATDATANG',
    promoTitle: byKey.promo_title ?? 'Untuk pembelian pertama kamu',
    promoSubtitle: byKey.promo_subtitle ?? 'Gunakan kode:',
    promoActive: byKey.promo_active !== 'false',
    carouselSpeedMs: parseInt(byKey.carousel_speed_ms ?? '5000', 10),
  };
}

export default async function HomePage() {
  const [
    featuredProducts,
    allCategories,
    activeSlides,
    promoSettings,
    whyPage,
    ctaPage,
    galleryImages,
    contact,
    priceMin,
    priceMax,
  ] = await Promise.all([
    getFeaturedProducts().catch(() => [] as Awaited<ReturnType<typeof getFeaturedProducts>>),
    getCategories().catch(() => [] as Awaited<ReturnType<typeof getCategories>>),
    getActiveCarouselSlides().catch(() => [] as Awaited<ReturnType<typeof getActiveCarouselSlides>>),
    getPromoSettings().catch(() => ({
      promoCode: 'SELAMATDATANG',
      promoTitle: 'Untuk pembelian pertama kamu',
      promoSubtitle: 'Gunakan kode:',
      promoActive: true,
      carouselSpeedMs: 5000,
    })),
    getCmsPage('home-why').catch(() => null),
    getCmsPage('home-cta').catch(() => null),
    getGalleryByUsage('instagram_feed', 6).catch(() => []),
    getStoreContactSettings().catch(() => ({
      whatsapp: '',
      address: '',
      instagramUrl: '',
      openingHours: '',
    })),
    getSetting<number>(SETTING_KEYS.PRICE_RANGE_MIN, 'integer').catch(() => 30000),
    getSetting<number>(SETTING_KEYS.PRICE_RANGE_MAX, 'integer').catch(() => 200000),
  ]);

  const whyTitle = sectionText(pickSection(whyPage, 'title'), 'id', 'title');
  const whyFeatures = (whyPage?.sections ?? [])
    .filter((s) => s.sectionKey.startsWith('feature_'))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({
      title: sectionText(s, 'id', 'title'),
      description: sectionText(s, 'id', 'body'),
    }));

  const ctaHero = pickSection(ctaPage, 'hero');

  const organizationJsonLd = await buildOrganizationJsonLd(contact);
  const websiteJsonLd = buildWebsiteJsonLd();
  const localBusinessJsonLd = await buildLocalBusinessJsonLd({
    whatsapp: contact.whatsapp,
    address: contact.address,
    priceMin: priceMin ?? 30000,
    priceMax: priceMax ?? 200000,
  });

  return (
    <div className="bg-brand-cream pb-20 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <HeroCarousel slides={activeSlides} autoRotateSpeed={promoSettings.carouselSpeedMs} />

      <CategoryChips categories={allCategories} />

      <FeaturedProducts products={featuredProducts} />

      {promoSettings.promoActive !== false && (
        <PromoBanner
          promoCode={promoSettings.promoCode}
          promoTitle={promoSettings.promoTitle}
          promoSubtitle={promoSettings.promoSubtitle}
        />
      )}

      <WhyDapurDekaka
        title={whyTitle || undefined}
        features={whyFeatures.length > 0 ? whyFeatures : undefined}
      />

      <InstagramFeed
        instagramUrl={contact.instagramUrl}
        images={galleryImages.map((g) => ({
          id: g.id,
          publicId: g.publicId,
          alt: g.altId || 'Galeri Dapur Dekaka',
        }))}
      />

      <Testimonials />

      <HomePageCTA
        heroTitle={sectionText(ctaHero, 'id', 'title') || undefined}
        heroSubtitle={sectionText(ctaHero, 'id', 'body') || undefined}
        ctaLabel={sectionText(ctaHero, 'id', 'ctaLabel') || undefined}
        ctaHref={ctaHero?.ctaHref || '/products'}
      />
    </div>
  );
}