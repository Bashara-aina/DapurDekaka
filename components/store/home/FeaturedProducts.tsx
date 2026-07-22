'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/store/products/ProductCard';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface FeaturedProductsProps {
  products: {
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    isHalal: boolean;
    variants: Array<{
      id: string;
      nameId: string;
      nameEn: string;
      sku: string;
      price: number;
      stock: number;
      weightGram: number;
      isActive: boolean;
    }>;
    images: Array<{ cloudinaryUrl: string | null }>;
  }[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  const t = useTranslations('featuredProducts');
  const [MotionComp, setMotionComp] = useState<typeof import('framer-motion') | null>(null);

  useEffect(() => {
    import('framer-motion').then((m) => setMotionComp(m));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (!MotionComp) {
    return (
      <section className="py-8 px-4 container mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary">
              {t('title')}
            </h2>
            <p className="text-text-secondary text-sm">{t('subtitle')}</p>
          </div>
          <Link
            href="/products"
            className="flex items-center gap-1 text-brand-red font-medium text-sm hover:underline"
          >
            {t('viewAll')}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="md:grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.slice(0, 8).map((product) => {
            const variant = product.variants[0];
            const image = product.images[0];
            if (!variant) return null;
            return (
              <ProductCard
                key={product.id}
                product={{
                  id: product.id,
                  nameId: product.nameId,
                  nameEn: product.nameEn,
                  slug: product.slug,
                  isHalal: product.isHalal,
                  imageUrl: image?.cloudinaryUrl ?? undefined,
                }}
                variant={variant}
              />
            );
          })}
        </div>
        {products.length === 0 && (
          <div className="bg-white rounded-card p-10 text-center">
            <p className="text-text-secondary">{t('empty')}</p>
            <Link href="/products" className="mt-3 inline-block text-brand-red font-medium text-sm hover:underline">
              {t('viewAllProducts')}
            </Link>
          </div>
        )}
      </section>
    );
  }

  if (!products || products.length === 0) {
    return (
      <section className="py-8 px-4 container mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary">
              {t('title')}
            </h2>
            <p className="text-text-secondary text-sm">{t('subtitle')}</p>
          </div>
        </div>
        <div className="bg-white rounded-card p-8 text-center">
          <p className="text-text-secondary">{t('empty')}</p>
          <Link href="/products" className="text-brand-red font-medium text-sm mt-2 inline-block hover:underline">
            {t('viewAllProducts')}
          </Link>
        </div>
      </section>
    );
  }

  const { motion: MotionFn } = MotionComp;

  return (
    <section className="py-8 px-4 container mx-auto">
      <MotionFn.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary">
            {t('title')}
          </h2>
          <p className="text-text-secondary text-sm">{t('subtitle')}</p>
        </div>
        <Link
          href="/products"
          className="flex items-center gap-1 text-brand-red font-medium text-sm hover:underline"
        >
          {t('viewAll')}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </MotionFn.div>

      {/* Mobile: horizontal scroll */}
      <div className="md:hidden -mx-4 overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch]">
        <MotionFn.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex gap-3 pl-4 pr-4 pb-2 min-w-max"
        >
          {products.slice(0, 6).map((product) => {
            const variant = product.variants[0];
            const image = product.images[0];
            if (!variant) return null;
            return (
              <MotionFn.div key={product.id} variants={itemVariants} className="w-44 flex-shrink-0">
                <ProductCard
                  product={{
                    id: product.id,
                    nameId: product.nameId,
                    nameEn: product.nameEn,
                    slug: product.slug,
                    isHalal: product.isHalal,
                    imageUrl: image?.cloudinaryUrl ?? undefined,
                  }}
                  variant={variant}
                />
              </MotionFn.div>
            );
          })}
        </MotionFn.div>
      </div>

      {/* Desktop: 4-col grid */}
      <MotionFn.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {products.slice(0, 8).map((product) => {
          const variant = product.variants[0];
          const image = product.images[0];
          if (!variant) return null;
          return (
            <MotionFn.div key={product.id} variants={itemVariants}>
              <ProductCard
                product={{
                  id: product.id,
                  nameId: product.nameId,
                  nameEn: product.nameEn,
                  slug: product.slug,
                  isHalal: product.isHalal,
                  imageUrl: image?.cloudinaryUrl ?? undefined,
                }}
                variant={variant}
              />
            </MotionFn.div>
          );
        })}
      </MotionFn.div>
    </section>
  );
}