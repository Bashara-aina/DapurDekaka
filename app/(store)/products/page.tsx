import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { ProductCatalog } from '@/components/store/products/ProductCatalog';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
  searchParams: Promise<{ category?: string; q?: string }>;
}

export const metadata: Metadata = {
  title: 'Katalog Produk - Dapur Dekaka',
  description: 'Jelajahi koleksi lengkap frozen food premium: dimsum, siomay, bakso, lumpia, dan pangsit. Semua produk 100% halal dan dikirim segar ke seluruh Indonesia.',
  keywords: ['frozen food', 'dimsum', 'siomay', 'bakso', 'lumpia', 'pangsit', 'halal', 'makanan Indonesia'],
  openGraph: {
    title: 'Katalog Produk - Dapur Dekaka',
    description: 'Jelajahi koleksi lengkap frozen food premium dari Bandung. Semua produk 100% halal.',
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

export const revalidate = 300;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const { category, q } = params;

  // Fetch all products (sort/filter done client-side for URL state)
  const productsList = await db.query.products.findMany({
    where: and(eq(products.isActive, true), isNull(products.deletedAt)),
    with: {
      variants: { where: eq(productVariants.isActive, true) },
      images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
      category: true,
    },
  });

  // Get only categories that have at least one active product
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
    />
  );
}