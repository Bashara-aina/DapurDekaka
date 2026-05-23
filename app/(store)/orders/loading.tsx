export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
        <div className="h-8 bg-brand-cream-dark rounded w-48 mb-2" />
        <div className="h-4 bg-brand-cream-dark rounded w-64" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-card shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 bg-brand-cream-dark rounded w-32" />
              <div className="h-5 bg-brand-cream-dark rounded w-20" />
            </div>
            <div className="h-3 bg-brand-cream-dark rounded w-full mb-2" />
            <div className="h-3 bg-brand-cream-dark rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}