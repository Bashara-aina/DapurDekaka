import Link from 'next/link';
import Image from 'next/image';
import { QuoteForm } from '@/components/b2b/QuoteForm';
import { Truck, Shield, Users, Clock, ArrowRight, Package } from 'lucide-react';
import { db } from '@/lib/db';
import { products, productVariants, categories } from '@/lib/db/schema';
import { eq, and, isNull, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BENEFITS = [
  {
    icon: Truck,
    title: 'Pengiriman ke Seluruh Indonesia',
    description: 'Kami mengirim ke semua kota besar di Indonesia dengan kemasan frozen yang menjaga kualitas produk.',
  },
  {
    icon: Shield,
    title: '100% Halal & Berkualitas',
    description: 'Semua produk bersertifikat halal dan dibuat dari bahan-bahan berkualitas tinggi.',
  },
  {
    icon: Users,
    title: 'Dedicated Account Manager',
    description: 'Anda akan mendapat kontak WhatsApp langsung untuk koordinasi pesanan.',
  },
  {
    icon: Clock,
    title: 'Fleksibel & Responsive',
    description: 'Kami siap menerima pesanan dalam jumlah besar dengan waktu pengiriman yang fleksibel.',
  },
];

async function getProductCategories() {
  // Get all active categories
  const allCategories = await db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [categories.sortOrder],
  });

  // Get product counts per category
  const categoryStats = await db
    .select({
      categoryId: products.categoryId,
      productCount: count(),
    })
    .from(products)
    .where(and(eq(products.isActive, true), isNull(products.deletedAt)))
    .groupBy(products.categoryId);

  const productCountMap = new Map(categoryStats.map(s => [s.categoryId, s.productCount]));

  // Get variant counts per category
  const variantStats = await db
    .select({
      categoryId: products.categoryId,
      variantCount: count(),
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(products.isActive, true), eq(productVariants.isActive, true), isNull(products.deletedAt)))
    .groupBy(products.categoryId);

  const variantCountMap = new Map(variantStats.map(s => [s.categoryId, s.variantCount]));

  // Filter categories that have active products
  return allCategories
    .filter(cat => productCountMap.has(cat.id))
    .map(cat => ({
      id: cat.id,
      nameId: cat.nameId,
      nameEn: cat.nameEn,
      slug: cat.slug,
      productCount: productCountMap.get(cat.id) ?? 0,
      variantCount: variantCountMap.get(cat.id) ?? 0,
    }));
}

export default async function B2BLandingPage() {
  const productCategories = await getProductCategories();

  return (
    <div className="bg-brand-cream">
      {/* Hero Section */}
      <section className="relative bg-admin-sidebar text-white py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-admin-sidebar to-slate-800" />
        <div className="relative container mx-auto px-4">
          <div className="max-w-3xl">
            <p className="text-white/60 text-sm font-medium mb-3 tracking-wide">
              B2B PARTNERSHIP
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Kerjasama Bisnis<br />dengan Dapur Dekaka
            </h1>
            <p className="text-white/80 text-lg mb-8 max-w-xl">
              Dapur Dekaka menyediakan produk frozen food berkualitas untuk hotel, restoran, catering, dan event organizer di seluruh Indonesia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#quote-form"
                className="inline-flex items-center justify-center h-12 px-6 bg-brand-red text-white font-bold rounded-lg hover:bg-brand-red-dark transition-colors"
              >
                Minta Penawaran
              </a>
              <Link
                href="/b2b/products"
                className="inline-flex items-center justify-center h-12 px-6 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-colors"
              >
                Lihat Katalog B2B
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl font-bold mb-2">
              Mengapa Bermitra dengan Kami?
            </h2>
            <p className="text-text-secondary">
              Kami siap menjadi partner bisnis jangka panjang Anda
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-brand-red/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-brand-red" />
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-text-secondary text-sm">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Products Preview */}
      <section className="py-12 px-4 bg-white">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-2xl font-bold mb-1">
                Produk untuk Bisnis
              </h2>
              <p className="text-text-secondary text-sm">
                Harga khusus untuk pemesanan dalam jumlah besar
              </p>
            </div>
            <Link
              href="/b2b/products"
              className="text-brand-red font-medium text-sm flex items-center hover:underline"
            >
              Lihat Semua
              <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {productCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/b2b/products?category=${cat.slug}`}
                className="bg-brand-cream rounded-lg p-4 text-center hover:bg-brand-cream-dark transition-colors cursor-pointer group"
              >
                <div className="w-12 h-12 bg-white rounded-full mx-auto mb-3 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Package className="w-6 h-6 text-brand-red" />
                </div>
                <p className="font-medium text-sm">{cat.nameId}</p>
                <p className="text-text-muted text-xs mt-1">
                  {cat.variantCount} Varian
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-8 p-6 bg-brand-cream rounded-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold text-lg mb-1">
                  Dapatkan Harga Khusus
                </h3>
                <p className="text-text-secondary text-sm">
                  Untuk pesanan minimal 50 item per varian. Hubungi tim kami untuk penawaran terbaik.
                </p>
              </div>
              <a
                href="#quote-form"
                className="inline-flex items-center h-10 px-5 bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark transition-colors"
              >
                Hubungi Kami
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Form Section */}
      <section id="quote-form" className="py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl font-bold mb-2">
              Minta Penawaran Harga
            </h2>
            <p className="text-text-secondary text-sm">
              Isi formulir di bawah dan tim kami akan menghubungi Anda dalam 1x24 jam
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
            <QuoteForm />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 bg-admin-sidebar">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-3">
            Siap Bermitra dengan Dapur Dekaka?
          </h2>
          <p className="text-white/70 mb-6 max-w-md mx-auto">
            Hubungi kami sekarang untuk diskusi lebih lanjut tentang kebutuhan bisnis Anda.
          </p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Halo%20Dapur%20Dekaka,%20saya%20tertarik%20untuk%20kerjasama%20B2B`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-12 px-6 bg-[#25D366] text-white font-bold rounded-lg hover:bg-[#20BD5A] transition-colors"
          >
            Chat via WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}