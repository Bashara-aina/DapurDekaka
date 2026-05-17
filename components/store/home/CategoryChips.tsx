'use client';

import Link from 'next/link';

interface CategoryChipsProps {
  categories: { id: string; nameId: string; slug: string }[];
  activeSlug?: string;
}

export function CategoryChips({ categories, activeSlug }: CategoryChipsProps) {
  return (
    <section className="py-4">
      <div
        className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        <Link
          href="/products"
          className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors whitespace-nowrap ${
            !activeSlug
              ? 'bg-brand-red text-white'
              : 'bg-white border border-brand-cream-dark text-text-primary hover:border-brand-red hover:text-brand-red'
          }`}
        >
          Semua
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors whitespace-nowrap ${
              activeSlug === cat.slug
                ? 'bg-brand-red text-white'
                : 'bg-white border border-brand-cream-dark text-text-primary hover:border-brand-red hover:text-brand-red'
            }`}
          >
            {cat.nameId}
          </Link>
        ))}
      </div>
    </section>
  );
}