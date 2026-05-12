import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden animate-shimmer">
      {/* Image skeleton */}
      <div className="aspect-square bg-brand-cream-dark" />

      {/* Content skeleton */}
      <div className="p-4">
        <div className="h-4 bg-brand-cream-dark rounded w-3/4 mb-2" />
        <div className="h-3 bg-brand-cream-dark rounded w-1/2 mb-4" />
        <div className="flex items-center justify-between">
          <div className="h-6 bg-brand-cream-dark rounded w-1/3" />
          <div className="w-10 h-10 bg-brand-cream-dark rounded-full" />
        </div>
      </div>
    </div>
  );
}