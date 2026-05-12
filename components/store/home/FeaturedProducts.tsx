'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/store/products/ProductCard';

interface FeaturedProductsProps {
  products: {
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    variants: { id: string; price: number; stock: number; nameId: string }[];
    images: { cloudinaryUrl: string }[];
  }[];
}

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

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  return (
    <section className="py-8 px-4 container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h2 className="font-display text-xl md:text-2xl font-semibold text-text-primary">
            Produk Unggulan
          </h2>
          <p className="text-text-secondary text-sm">Pilihan terbaik dari dapur kami</p>
        </div>
        <Link
          href="/products"
          className="flex items-center gap-1 text-brand-red font-medium text-sm hover:underline"
        >
          Lihat Semua
          <ChevronRight className="w-4 h-4" />
        </Link>
      </motion.div>

      {/* Mobile: horizontal scroll */}
      <div className="md:hidden -mx-4 overflow-x-auto scrollbar-hide">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex gap-3 px-4 pb-2 min-w-max"
        >
          {products.slice(0, 6).map((product) => {
            const variant = product.variants[0];
            const image = product.images[0];
            if (!variant) return null;
            return (
              <motion.div key={product.id} variants={itemVariants} className="w-40 flex-shrink-0">
                <ProductCard
                  product={{
                    id: product.id,
                    nameId: product.nameId,
                    nameEn: product.nameEn,
                    slug: product.slug,
                    imageUrl: image?.cloudinaryUrl,
                  } as never}
                  variant={variant as never}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Desktop: 4-col grid */}
      <motion.div
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
            <motion.div key={product.id} variants={itemVariants}>
              <ProductCard
                product={{
                  id: product.id,
                  nameId: product.nameId,
                  nameEn: product.nameEn,
                  slug: product.slug,
                  imageUrl: image?.cloudinaryUrl,
                } as never}
                variant={variant as never}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}