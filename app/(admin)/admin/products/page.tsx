import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { products, productVariants } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { formatIDR } from '@/lib/utils/format-currency';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const allProducts = await db.query.products.findMany({
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

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga Mulai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {allProducts.map((product) => {
                const lowestVariant = product.variants[0];
                const image = product.images[0];
                return (
                  <tr key={product.id} className="hover:bg-admin-content">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-cream overflow-hidden flex-shrink-0">
                          {image?.cloudinaryUrl && (
                            <Image
                              src={image.cloudinaryUrl}
                              alt={product.nameId}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.nameId}</p>
                          <p className="text-xs text-gray-500">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.categoryId ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-red">
                      {lowestVariant ? formatIDR(lowestVariant.price) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {product.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {product.isFeatured && (
                        <span className="ml-1 inline-flex px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800">
                          Unggulan
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-brand-red hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {allProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada produk
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
