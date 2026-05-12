import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface Category {
  id: string;
  nameId: string;
  slug: string;
}

interface ProductFiltersProps {
  categories: Category[];
  activeCategory?: string;
  activeSearch?: string;
}

export function ProductFilters({
  categories,
  activeCategory,
  activeSearch,
}: ProductFiltersProps) {
  const searchParams = new URLSearchParams();
  if (activeCategory) searchParams.set('category', activeCategory);
  if (activeSearch) searchParams.set('q', activeSearch);

  return (
    <div className="space-y-4">
      {/* Category Pills */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          <Link
            href="/products"
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors',
              !activeCategory
                ? 'bg-brand-red text-white'
                : 'bg-white border border-brand-cream-dark text-text-primary hover:border-brand-red hover:text-brand-red'
            )}
          >
            Semua
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}${activeSearch ? `&q=${activeSearch}` : ''}`}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors',
                activeCategory === cat.slug
                  ? 'bg-brand-red text-white'
                  : 'bg-white border border-brand-cream-dark text-text-primary hover:border-brand-red hover:text-brand-red'
              )}
            >
              {cat.nameId}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}