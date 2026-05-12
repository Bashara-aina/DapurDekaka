import { ProductCardSkeleton } from '@/components/store/products/ProductCardSkeleton';

export default function Loading() {
  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header skeleton */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <div className="h-8 bg-brand-cream-dark rounded w-32 animate-shimmer" />
        </div>
      </div>

      {/* Category pills skeleton */}
      <div className="py-4 px-4">
        <div className="flex gap-2 container mx-auto">
          <div className="h-9 w-16 bg-brand-cream-dark rounded-pill animate-shimmer" />
          <div className="h-9 w-20 bg-brand-cream-dark rounded-pill animate-shimmer" />
          <div className="h-9 w-24 bg-brand-cream-dark rounded-pill animate-shimmer" />
        </div>
      </div>

      {/* Product grid skeleton */}
      <div className="px-4 container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}