export function SkeletonCard() {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden animate-shimmer">
      <div className="aspect-square bg-brand-cream-dark" />
      <div className="p-4">
        <div className="h-4 bg-brand-cream-dark rounded w-3/4 mb-2" />
        <div className="h-3 bg-brand-cream-dark rounded w-1/2 mb-4" />
        <div className="h-6 bg-brand-cream-dark rounded w-1/3" />
      </div>
    </div>
  );
}