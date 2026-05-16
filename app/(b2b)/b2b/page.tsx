import Link from 'next/link';
import Image from 'next/image';
import { QuoteForm } from '@/components/b2b/QuoteForm';
import { Truck, Shield, Users, Clock, ChefHat, ArrowRight } from 'lucide-react';
import { db } from '@/lib/db';
import { categories, products, productVariants } from '@/lib/db/schema';
import { eq, and, isNull, sql, asc } from 'drizzle-orm';
import { formatIDR } from '@/lib/utils/format-currency';

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

async function getCategoryCounts() {
  const counts = await db
    .select({
      id: categories.id,
      nameId: categories.nameId,
      count: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(
      products,
      and(
        eq(categories.id, products.categoryId),
        eq(products.isActive, true),
        eq(products.isB2bAvailable, true),
        isNull(products.deletedAt)
      )
    )
    .where(eq(categories.isActive, true))
    .groupBy(categories.id, categories.nameId);

  return counts
    .filter(c => c.id !== null)
    .map(c => ({
      id: c.id,
      name: c.nameId,
      count: c.count ?? 0,
    }));
}

async function getPriceTeaserProducts() {
  return await db.query.products.findMany({
    where: and(eq(products.isActive, true), eq(products.isB2bAvailable, true), isNull(products.deletedAt)),
    with: {
      variants: { where: eq(productVariants.isActive, true), orderBy: (v, { asc }) => [asc(productVariants.price)] },
    },
    orderBy: (p, { asc }) => [asc(p.createdAt)],
    limit: 5,
  });
}

export default async function B2BLandingPage() {
  const [categoryCounts, priceTeaserProducts] = await Promise.all([
    getCategoryCounts(),
    getPriceTeaserProducts(),
  ]);

  return (
    <div className="bg-brand-cream">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-navy to-brand-navy-light text-white py-16 md:py-24">
        <div className="absolute inset-0 bg-brand-navy" />
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
            {categoryCounts.map((cat) => (
              <Link
                key={cat.id}
                href={`/b2b/products?category=${cat.id}`}
                className="bg-brand-cream rounded-lg p-4 text-center hover:bg-brand-cream-dark transition-colors block"
              >
                <div className="w-12 h-12 bg-white rounded-full mx-auto mb-3 flex items-center justify-center">
                  <ChefHat className="w-6 h-6 text-brand-red" />
                </div>
                <p className="font-medium text-sm">{cat.name}</p>
                <p className="text-text-muted text-xs mt-1">{cat.count} Produk</p>
              </Link>
            ))}
          </div>

          {/* B2B Price Teaser Table */}
          {priceTeaserProducts.length > 0 && (
            <div className="mt-8 p-6 bg-white rounded-xl border border-brand-cream-dark">
              <h3 className="font-display font-semibold text-lg mb-1">
                Contoh Harga B2B
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                Harga khusus untuk pemesanan dalam jumlah besar. Hubungi kami untuk penawaran penuh.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-cream-dark">
                      <th className="text-left py-2 px-3 font-medium text-text-secondary">Produk</th>
                      <th className="text-right py-2 px-3 font-medium text-text-secondary">Harga Retail</th>
                      <th className="text-right py-2 px-3 font-medium text-brand-red">Harga B2B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceTeaserProducts.filter(p => p.variants[0]?.b2bPrice != null).slice(0, 5).map((product) => {
                      const retailPrice = product.variants[0]?.price ?? 0;
                      const b2bPrice = product.variants[0]?.b2bPrice;
                      return (
                        <tr key={product.id} className="border-b border-brand-cream/50">
                          <td className="py-2.5 px-3 font-medium">{product.nameId}</td>
                          <td className="py-2.5 px-3 text-right text-text-secondary">
                            {formatIDR(retailPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-brand-red">
                            {b2bPrice ? formatIDR(b2bPrice) : <span className="text-brand-red text-xs">Hubungi Kami</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-text-muted mt-3">
                * Harga di atas hanya perkiraan. Harga B2B sebenarnya akan diberikan setelah konsultasi.
              </p>
            </div>
          )}

          <div className="mt-8 p-6 bg-brand-cream rounded-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold text-lg mb-1">
                  Dapatkan Harga Khusus
                </h3>
                <p className="text-text-secondary text-sm">
                  Hubungi tim kami untuk penawaran terbaik sesuai kebutuhan bisnis Anda.
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
      <section className="py-12 px-4 bg-gradient-to-br from-brand-navy to-brand-navy-light">
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