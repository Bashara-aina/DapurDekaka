import type { Metadata } from 'next';
import { HeroCarousel } from '@/components/store/home/HeroCarousel';
import { FeaturedProducts } from '@/components/store/home/FeaturedProducts';
import { CategoryChips } from '@/components/store/home/CategoryChips';
import { PromoBanner } from '@/components/store/home/PromoBanner';
import { WhyDapurDekaka } from '@/components/store/home/WhyDapurDekaka';
import { InstagramFeed } from '@/components/store/home/InstagramFeed';
import { Testimonials } from '@/components/store/home/Testimonials';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories } from '@/lib/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
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
  // Get all active products grouped by category to find which categories have products
  const allProducts = await db.query.products.findMany({
    where: and(eq(products.isActive, true), isNull(products.deletedAt)),
    columns: { categoryId: true },
  });

  // Get all active categories
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [categories.sortOrder],
  });

  // Filter to only categories that have at least one active product
  const categoryIdsWithProducts = new Set(allProducts.map(p => p.categoryId));
  return allCategories.filter(cat => categoryIdsWithProducts.has(cat.id));
}

export default async function HomePage() {
  const [featuredProducts, allCategories] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
  ]);

  return (
    <div className="bg-brand-cream">
      <HeroCarousel />

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