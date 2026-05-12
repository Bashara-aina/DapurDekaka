import Image from 'next/image';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { formatIDR } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function ProductDetailPage({ params }: Props) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, params.id),
    with: {
      variants: true,
      images: true,
      category: true,
    },
  });

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{product.nameId}</h1>
        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {product.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-admin-border p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Info Produk</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nama (ID)</dt>
              <dd className="font-medium">{product.nameId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Nama (EN)</dt>
              <dd className="font-medium">{product.nameEn}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Slug</dt>
              <dd className="font-mono text-xs">{product.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Kategori</dt>
              <dd className="font-medium">{product.category?.nameId ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Unggulan</dt>
              <dd className="font-medium">{product.isFeatured ? 'Ya' : 'Tidak'}</dd>
            </div>
          </dl>
          {product.descriptionId && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Deskripsi</p>
              <p className="text-sm">{product.descriptionId}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-admin-border p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Varian & Stok</h2>
          <div className="space-y-3">
            {product.variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium">{variant.nameId}</p>
                  <p className="text-xs text-gray-500 font-mono">{variant.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-red">{formatIDR(variant.price)}</p>
                  <p className={`text-xs font-medium ${variant.stock === 0 ? 'text-red-600' : variant.stock < 10 ? 'text-amber-600' : 'text-green-600'}`}>
                    Stok: {variant.stock}
                  </p>
                </div>
              </div>
            ))}
            {product.variants.length === 0 && (
              <p className="text-sm text-gray-500">Belum ada varian</p>
            )}
          </div>
        </div>
      </div>

      {product.images.length > 0 && (
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Gambar Produk</h2>
          <div className="flex gap-3 flex-wrap">
            {product.images.map((img) => (
              <div key={img.id} className="w-24 h-24 rounded-lg bg-brand-cream overflow-hidden">
                <Image src={img.cloudinaryUrl} alt="" width={96} height={96} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
