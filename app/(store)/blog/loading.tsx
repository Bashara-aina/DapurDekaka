export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream pb-24">
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-card shadow-card p-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-brand-cream-dark rounded-lg animate-pulse" />
                <div className="flex-1">
                  <div className="h-5 bg-brand-cream-dark rounded w-3/4 mb-2" />
                  <div className="h-4 bg-brand-cream-dark rounded w-1/2 mb-3" />
                  <div className="h-4 bg-brand-cream-dark rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}