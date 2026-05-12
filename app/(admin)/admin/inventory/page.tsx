import Link from 'next/link';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const variants = await db.query.productVariants.findMany({
    where: eq(productVariants.isActive, true),
    with: {
      product: true,
    },
    orderBy: [asc(productVariants.stock)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventaris</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-admin-border p-4">
          <p className="text-sm text-gray-500">Total Varian</p>
          <p className="text-2xl font-bold text-text-primary">{variants.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-4">
          <p className="text-sm text-gray-500">Stok Habis</p>
          <p className="text-2xl font-bold text-red-600">{variants.filter(v => v.stock === 0).length}</p>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-4">
          <p className="text-sm text-gray-500">Stok Rendah (&lt;10)</p>
          <p className="text-2xl font-bold text-amber-600">{variants.filter(v => v.stock > 0 && v.stock < 10).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Varian</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {variants.map((variant) => (
                <tr key={variant.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-sm">{variant.product.nameId}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.nameId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{variant.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded ${
                      variant.stock === 0
                        ? 'bg-red-100 text-red-800'
                        : variant.stock < 10
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {variant.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/admin/products/${variant.productId}`}
                      className="text-brand-red hover:underline"
                    >
                      Edit Produk
                    </Link>
                  </td>
                </tr>
              ))}
              {variants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada varian produk
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
