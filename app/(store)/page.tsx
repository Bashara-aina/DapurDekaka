import type { Metadata } from 'next';
import { HeroCarousel } from '@/components/store/home/HeroCarousel';
import { FeaturedProducts } from '@/components/store/home/FeaturedProducts';
import { CategoryChips } from '@/components/store/home/CategoryChips';
import { PromoBanner } from '@/components/store/home/PromoBanner';
import { WhyDapurDekaka } from '@/components/store/home/WhyDapurDekaka';
import { InstagramFeed } from '@/components/store/home/InstagramFeed';
import { Testimonials } from '@/components/store/home/Testimonials';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories, carouselSlides } from '@/lib/db/schema';
import { eq, and, desc, isNull, lte, gte, isNull as isNullCond } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Dapur Dekaka | Frozen Food Premium dari Bandung' },
  description: 'Cita rasa warisan Chinese-Indonesia, kini di rumahmu. Dimsum, siomay, bakso frozen premium dari Bandung. Pesan online, kirim ke seluruh Indonesia.',
  keywords: ['frozen food', 'dimsum', 'siomay', 'bakso', ' Bandung', 'halal', 'makanan frozen'],
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
  // Single query with LEFT JOIN + GROUP BY to get categories with active products
  const categoriesWithProducts = await db
    .select({
      id: categories.id,
      nameId: categories.nameId,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .leftJoin(products, and(
      eq(categories.id, products.categoryId),
      eq(products.isActive, true),
      isNull(products.deletedAt)
    ))
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder);

  // Filter to only categories that have at least one active product
  return categoriesWithProducts.filter(cat => cat.id !== null);
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

export default async function HomePage() {
  const [featuredProducts, allCategories, activeSlides] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
    getActiveCarouselSlides(),
  ]);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dapur Dekaka',
    alternateName: '德卡',
    url: 'https://dapurdekaka.com',
    logo: 'https://dapurdekaka.com/assets/logo/logo.png',
    description: 'Premium Chinese-Indonesian frozen food from Bandung. Dimsum, siomay, bakso, lumpia. 100% halal.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Jl. Sinom V No. 7, Turangga',
      addressLocality: 'Bandung',
      addressRegion: 'West Java',
      postalCode: '40261',
      addressCountry: 'ID',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Indonesian', 'English', 'Chinese'],
      url: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
    },
    sameAs: [
      'https://instagram.com/dapurdekaka',
    ],
  };

  return (
    <div className="bg-brand-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <HeroCarousel slides={activeSlides} />

      <CategoryChips categories={allCategories} />

      <FeaturedProducts products={featuredProducts} />

      <PromoBanner />

      <WhyDapurDekaka />

      <InstagramFeed />

      <Testimonials />

      {/* CTA Section */}
      <section className="py-12 px-4 bg-brand-red">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-4">
            Siap Mencicipi Kelezatan Dapur Dekaka?
          </h2>
          <p className="text-white/80 mb-6 max-w-md mx-auto">
            Pesan sekarang dan nikmati dimsum, siomay, dan bakso premium langsung di rumahmu
          </p>
          <Link
            href="/products"
            className="inline-flex items-center h-12 px-8 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            Jelajahi Produk
          </Link>
        </div>
      </section>
    </div>
  );
}