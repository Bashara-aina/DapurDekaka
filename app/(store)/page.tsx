import type { Metadata } from 'next';
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
import { eq, and, desc, isNull, lte, gte, isNull as isNullCond, sql } from 'drizzle-orm';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: { absolute: 'Dapur Dekaka | Frozen Food Premium dari Bandung' },
  description: 'Cita rasa warisan Chinese-Indonesia, kini di rumahmu. Dimsum, siomay, bakso frozen premium dari Bandung. Pesan online, kirim ke seluruh Indonesia.',
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
    title: 'Dapur Dekaka | Frozen Food Premium dari Bandung',
    description: 'Cita rasa warisan Chinese-Indonesia, kini di rumahmu. Pesan online, kirim ke seluruh Indonesia.',
    url: 'https://dapurdekaka.com',
    siteName: 'Dapur Dekaka',
    images: [
      {
        url: 'https://res.cloudinary.com/dapurdekaka/image/upload/v1/dapurdekaka/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Dapur Dekaka - Frozen Food Premium',
      },
    ],
    locale: 'id_ID',
    alternateLocale: ['en_US'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dapur Dekaka | Frozen Food Premium dari Bandung',
    description: 'Cita rasa warisan Chinese-Indonesia, kini di rumahmu.',
    images: ['https://res.cloudinary.com/dapurdekaka/image/upload/v1/dapurdekaka/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

async function getFeaturedProducts() {
  const featured = await db.query.products.findMany({
    where: and(eq(products.isActive, true), eq(products.isFeatured, true)),
    with: {
      variants: { where: eq(productVariants.isActive, true), limit: 1 },
      images: { limit: 1 },
    },
    orderBy: [desc(products.sortOrder)],
    limit: 8,
  });
  return featured.map(p => ({
    ...p,
    variants: p.variants.map(v => ({
      id: v.id,
      price: v.price,
      stock: v.stock,
      nameId: v.nameId,
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
    where: sql`${systemSettings.key} IN ('PROMO_CODE', 'PROMO_TITLE', 'PROMO_SUBTITLE', 'CAROUSEL_SPEED_MS')`,
  });
  return {
    promoCode: settings.find(s => s.key === 'PROMO_CODE')?.value ?? 'SELAMATDATANG',
    promoTitle: settings.find(s => s.key === 'PROMO_TITLE')?.value ?? 'Untuk pembelian pertama kamu',
    promoSubtitle: settings.find(s => s.key === 'PROMO_SUBTITLE')?.value ?? 'Gunakan kode:',
    carouselSpeedMs: parseInt(settings.find(s => s.key === 'CAROUSEL_SPEED_MS')?.value ?? '5000', 10),
  };
}

export default async function HomePage() {
  const [featuredProducts, allCategories, activeSlides, promoSettings] = await Promise.all([
    getFeaturedProducts().catch(() => [] as Awaited<ReturnType<typeof getFeaturedProducts>>),
    getCategories().catch(() => [] as Awaited<ReturnType<typeof getCategories>>),
    getActiveCarouselSlides().catch(() => [] as Awaited<ReturnType<typeof getActiveCarouselSlides>>),
    getPromoSettings().catch(() => ({ promoCode: 'SELAMATDATANG', promoTitle: 'Untuk pembelian pertama kamu', promoSubtitle: 'Gunakan kode:', carouselSpeedMs: 5000 })),
  ]);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dapur Dekaka',
    alternateName: '德卡',
    url: 'https://dapurdekaka.com',
    logo: 'https://dapurdekaka.com/assets/logo/logo.png',
    description: 'Premium Chinese-Indonesian frozen food from Bandung. Dimsum, siomay, bakso, lumpia. 100% halal.',
    foundingLocation: {
      '@type': 'Place',
      addressLocality: 'Bandung',
      addressRegion: 'Jawa Barat',
      addressCountry: 'ID',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
      availableLanguage: ['Indonesian', 'English', 'Chinese'],
      url: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
    },
    sameAs: [
      'https://instagram.com/dapurdekaka',
      'https://www.tokopedia.com/dapurdekaka',
      'https://shopee.co.id/dapurdekaka',
    ],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Dapur Dekaka',
    url: 'https://dapurdekaka.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://dapurdekaka.com/products?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://dapurdekaka.com/#business',
    name: 'Dapur Dekaka',
    description: 'Produsen dan toko online frozen food premium Chinese-Indonesia dari Bandung.',
    url: 'https://dapurdekaka.com',
    telephone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    priceRange: 'Rp 30.000 - Rp 200.000',
    currenciesAccepted: 'IDR',
    paymentAccepted: 'Credit Card, Bank Transfer, E-Wallet',
    servesCuisine: ['Chinese', 'Indonesian', 'Chinese-Indonesian'],
    hasMenu: 'https://dapurdekaka.com/products',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bandung',
      addressRegion: 'Jawa Barat',
      postalCode: '40261',
      addressCountry: 'ID',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -6.9175,
      longitude: 107.6191,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '17:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday'],
        opens: '09:00',
        closes: '15:00',
      },
    ],
  };

  return (
    <div className="bg-brand-cream">
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

      <PromoBanner
        promoCode={promoSettings.promoCode}
        promoTitle={promoSettings.promoTitle}
        promoSubtitle={promoSettings.promoSubtitle}
      />

      <WhyDapurDekaka />

      <InstagramFeed />

      <Testimonials />

      <HomePageCTA />
    </div>
  );
}