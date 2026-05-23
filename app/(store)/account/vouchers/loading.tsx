export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
        <div className="h-8 bg-brand-cream-dark rounded w-32 mb-2" />
        <div className="h-4 bg-brand-cream-dark rounded w-48" />
      </div>

      <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
        <div className="h-6 w-24 bg-brand-cream-dark rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-20 bg-brand-cream-dark rounded-lg" />
          <div className="h-20 bg-brand-cream-dark rounded-lg" />
        </div>
      </div>
    </div>
  );
}