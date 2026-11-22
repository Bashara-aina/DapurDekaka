import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { ProductCatalog } from '@/components/store/products/ProductCatalog';
import { getSetting } from '@/lib/settings/get-settings';
import { cloudinaryUrl } from '@/lib/seo/cloudinary-url';
import { getCatalogPage, getCatalogCategories } from '@/lib/store/get-catalog';

interface ProductsPageProps {
  searchParams: Promise<{ category?: string; q?: string; cursor?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(routing.defaultLocale);
  const t = await getTranslations('metadata');
  const ogImagePublicId = await getSetting<string>('og_image_public_id').catch(() => null);
  const ogImageUrl = cloudinaryUrl(ogImagePublicId) ?? '';
  return {
    title: t('productsTitle'),
    description: t('productsDescription'),
    keywords: ['frozen food', 'dimsum', 'siomay', 'bakso', 'lumpia', 'pangsit', 'halal', 'makanan Indonesia'],
    openGraph: {
      title: t('productsTitle'),
      description: t('productsDescription'),
      url: 'https://www.dapurdekaka.com/products',
      type: 'website',
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
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const revalidate = 300;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  setRequestLocale(routing.defaultLocale);
  const params = await searchParams;
  const { category: categorySlug, q, cursor } = params;

  const [{ productsList, nextCursor }, allCategories] = await Promise.all([
    getCatalogPage(categorySlug, cursor),
    getCatalogCategories(),
  ]);

  return (
    <ProductCatalog
      products={productsList}
      categories={allCategories}
      initialCategory={categorySlug || ''}
      initialSearch={q || ''}
      nextCursor={nextCursor}
    />
  );
}
