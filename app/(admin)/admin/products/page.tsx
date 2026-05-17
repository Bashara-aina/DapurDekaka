import Link from 'next/link';
import { db } from '@/lib/db';
import { products, productVariants } from '@/lib/db/schema';
import { desc, eq, isNull } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const allProducts = await db.query.products.findMany({
    where: isNull(products.deletedAt),
    orderBy: [desc(products.createdAt)],
    with: {
      variants: {
        where: eq(productVariants.isActive, true),
        limit: 1,
      },
      images: { limit: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produk</h1>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Produk
        </Link>
      </div>

      <ProductsClient allProducts={allProducts} />
    </div>
  );
}
