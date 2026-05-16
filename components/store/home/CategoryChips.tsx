'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface CategoryChipsProps {
  categories: { id: string; nameId: string; slug: string }[];
  activeSlug?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function CategoryChips({ categories, activeSlug }: CategoryChipsProps) {
  return (
    <section className="py-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        <motion.div variants={itemVariants}>
          <Link
            href="/products"
            className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
              !activeSlug
                ? 'bg-brand-red text-white'
                : 'bg-white border border-brand-cream-dark text-text-primary hover:border-brand-red hover:text-brand-red'
            }`}
          >
            Semua
          </Link>
        </motion.div>
        {categories.map((cat) => (
          <motion.div key={cat.id} variants={itemVariants}>
            <Link
              href={`/products?category=${cat.slug}`}
              className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                activeSlug === cat.slug
                  ? 'bg-brand-red text-white'
                  : 'bg-white border border-brand-cream-dark text-text-primary hover:border-brand-red hover:text-brand-red'
              }`}
            >
              {cat.nameId}
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}