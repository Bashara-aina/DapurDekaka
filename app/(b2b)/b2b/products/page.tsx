import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { formatIDR } from '@/lib/utils/format-currency';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Katalog B2B - Dapur Dekaka',
  description: 'Katalog produk frozen food untuk bisnis. Harga khusus untuk pemesanan dalam jumlah besar.',
};

export const revalidate = 300;

async function getB2BProducts() {
  return await db.query.products.findMany({
    where: and(eq(products.isActive, true), eq(products.isB2bAvailable, true)),
    with: {
      variants: {
        where: eq(productVariants.isActive, true),
        orderBy: [productVariants.sortOrder],
      },
      images: { limit: 1 },
      category: true,
    },
    orderBy: [desc(products.sortOrder)],
  });
}

interface ProductCardProps {
  product: {
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    category: { nameId: string } | null;
    variants: Array<{
      id: string;
      nameId: string;
      b2bPrice: number | null;
      price: number;
      stock: number;
    }>;
    images: Array<{ cloudinaryUrl: string }>;
  };
}

function B2BProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images[0];
  const hasB2BPrice = product.variants.some(v => v.b2bPrice && v.b2bPrice > 0);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-square bg-brand-cream">
        {primaryImage ? (
          <Image
            src={primaryImage.cloudinaryUrl}
            alt={product.nameId}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🥟</span>
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-medium">
          {product.category?.nameId || 'Frozen'}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-display font-semibold text-sm mb-2 line-clamp-2">
          {product.nameId}
        </h3>

        <div className="space-y-1">
          {product.variants.slice(0, 2).map(variant => (
            <div key={variant.id} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{variant.nameId}</span>
              <span className="font-bold text-brand-red">
                {hasB2BPrice && variant.b2bPrice
                  ? formatIDR(variant.b2bPrice)
                  : formatIDR(variant.price)}
              </span>
            </div>
          ))}
        </div>

        {hasB2BPrice && (
          <div className="mt-3 pt-3 border-t border-brand-cream-dark">
            <div className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="w-3 h-3" />
              <span>Harga B2B tersedia</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function B2BProductsPage() {
  const b2bProducts = await getB2BProducts();

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4 sticky top-0 z-10">
        <div className="container mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/b2b"
              className="p-2 -ml-2 hover:bg-brand-cream rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-xl font-bold">Katalog B2B</h1>
              <p className="text-text-secondary text-sm">
                {b2bProducts.length} produk tersedia
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 py-6 container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {b2bProducts.map(product => (
            <B2BProductCard key={product.id} product={product} />
          ))}
        </div>

        {b2bProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
            <h2 className="font-display text-lg font-semibold mb-2">
              Produk belum tersedia
            </h2>
            <p className="text-text-secondary text-sm">
              Katalog B2B sedang dalam pengembangan.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 py-6 container mx-auto">
        <div className="bg-admin-sidebar rounded-xl p-6 text-white text-center">
          <h3 className="font-display text-lg font-semibold mb-2">
            Butuh Penawaran Harga?
          </h3>
          <p className="text-white/70 text-sm mb-4">
            Hubungi tim kami untuk mendapatkan harga khusus bisnis Anda.
          </p>
          <a
            href="/b2b#quote-form"
            className="inline-flex items-center h-10 px-5 bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark transition-colors"
          >
            Minta Penawaran
          </a>
        </div>
      </div>
    </div>
  );
}