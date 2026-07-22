export default function ProductsLoading() {
  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="h-8 bg-brand-cream-dark rounded w-48 animate-pulse" />
      </div>
      <div className="px-4 py-6 container mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-card overflow-hidden shadow-card animate-pulse">
              <div className="aspect-square bg-brand-cream-dark" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-brand-cream-dark rounded w-3/4" />
                <div className="h-3 bg-brand-cream-dark rounded w-1/2" />
                <div className="h-5 bg-brand-cream-dark rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
