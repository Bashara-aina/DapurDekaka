import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories } from '@/lib/db/schema';
import { eq, and, isNull, desc, lt } from 'drizzle-orm';
import { ProductCatalog } from '@/components/store/products/ProductCatalog';

export const dynamic = 'force-dynamic';

const PRODUCTS_PER_PAGE = 20;

interface ProductsPageProps {
  searchParams: Promise<{ category?: string; q?: string; cursor?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: t('productsTitle'),
    description: t('productsDescription'),
    keywords: ['frozen food', 'dimsum', 'siomay', 'bakso', 'lumpia', 'pangsit', 'halal', 'makanan Indonesia'],
    openGraph: {
      title: t('productsTitle'),
      description: t('productsDescription'),
      url: 'https://dapurdekaka.com/products',
      type: 'website',
      images: [
        {
          url: 'https://res.cloudinary.com/dapurdekaka/image/upload/v1/dapurdekaka/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Dapur Dekaka - Frozen Food Premium',
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const revalidate = 300;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { category, q, cursor } = params;

  const cursorClause = cursor
    ? lt(products.createdAt, new Date(cursor))
    : undefined;

  const productsList = await db.query.products.findMany({
    where: cursor
      ? and(eq(products.isActive, true), isNull(products.deletedAt), cursorClause)
      : and(eq(products.isActive, true), isNull(products.deletedAt)),
    with: {
      variants: { where: eq(productVariants.isActive, true) },
      images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
      category: true,
    },
    limit: PRODUCTS_PER_PAGE,
    orderBy: [desc(products.createdAt)],
  });

  const nextCursor = productsList.length === PRODUCTS_PER_PAGE
    ? productsList[productsList.length - 1]?.createdAt.toISOString()
    : null;

  const allActiveProducts = await db.query.products.findMany({
    where: and(eq(products.isActive, true), isNull(products.deletedAt)),
    columns: { categoryId: true },
  });
  const categoryIdsWithProducts = new Set(allActiveProducts.map(p => p.categoryId));

  const allCategoriesRaw = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [categories.sortOrder],
  });
  const allCategories = allCategoriesRaw.filter(cat => categoryIdsWithProducts.has(cat.id));

  return (
    <ProductCatalog
      products={productsList}
      categories={allCategories.map(c => ({ id: c.id, nameId: c.nameId, slug: c.slug }))}
      initialCategory={category || ''}
      initialSearch={q || ''}
      nextCursor={nextCursor}
    />
  );
}