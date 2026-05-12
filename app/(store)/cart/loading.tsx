export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream pb-32">
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <div className="h-8 bg-brand-cream-dark rounded w-32 animate-shimmer" />
        </div>
      </div>

      <div className="px-4 py-4 container mx-auto">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-card shadow-card p-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-brand-cream-dark rounded-lg animate-shimmer" />
                <div className="flex-1">
                  <div className="h-4 bg-brand-cream-dark rounded w-3/4 mb-2 animate-shimmer" />
                  <div className="h-3 bg-brand-cream-dark rounded w-1/2 mb-3 animate-shimmer" />
                  <div className="h-6 bg-brand-cream-dark rounded w-1/4 animate-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}