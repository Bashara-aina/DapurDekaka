import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories } from '@/lib/db/schema';
import { eq, and, ilike, desc, isNull } from 'drizzle-orm';
import { ProductCard } from '@/components/store/products/ProductCard';
import { ProductGrid } from '@/components/store/products/ProductGrid';
import Link from 'next/link';

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

  let query = db.query.products.findMany({
    where: and(eq(products.isActive, true)),
    with: {
      variants: { where: eq(productVariants.isActive, true) },
      images: { limit: 1 },
      category: true,
    },
    orderBy: [desc(products.sortOrder)],
  });

  // Filter by category if provided
  let productsList = await query;
  
  if (category) {
    productsList = productsList.filter(p => p.category?.slug === category);
  }

  // Search filter
  if (q) {
    const searchLower = q.toLowerCase();
    productsList = productsList.filter(p => 
      p.nameId.toLowerCase().includes(searchLower) ||
      p.nameEn.toLowerCase().includes(searchLower) ||
      p.category?.nameId.toLowerCase().includes(searchLower)
    );
  }

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
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-2xl font-bold text-text-primary">Produk</h1>
          <p className="text-text-secondary text-sm mt-1">
            {productsList.length} produk ditemukan
          </p>
        </div>
      </div>

      {/* Category Pills */}
      <div className="py-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max container mx-auto">
          <Link
            href="/products"
            className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
              !category ? 'bg-brand-red text-white' : 'bg-white text-text-primary border border-brand-cream-dark'
            }`}
          >
            Semua
          </Link>
          {allCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                category === cat.slug ? 'bg-brand-red text-white' : 'bg-white text-text-primary border border-brand-cream-dark'
              }`}
            >
              {cat.nameId}
            </Link>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="px-4 container mx-auto">
        {productsList.length > 0 ? (
          <ProductGrid products={productsList} />
        ) : (
          <div className="text-center py-12">
            <p className="text-text-secondary">Tidak ada produk ditemukan</p>
            <Link href="/products" className="text-brand-red font-medium mt-2 inline-block">
              Lihat semua produk
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}