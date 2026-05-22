export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="w-20 h-20 bg-brand-cream-dark rounded-full mx-auto mb-6"></div>
          <div className="h-8 bg-brand-cream-dark rounded w-48 mx-auto mb-3"></div>
          <div className="h-4 bg-brand-cream-dark rounded w-64 mx-auto mb-8"></div>
          <div className="bg-white rounded-card p-6 shadow-card max-w-sm mx-auto mb-6">
            <div className="h-4 bg-brand-cream-dark rounded w-24 mx-auto mb-4"></div>
            <div className="h-8 bg-brand-cream-dark rounded w-32 mx-auto mb-4"></div>
            <div className="h-4 bg-brand-cream-dark rounded w-16 mx-auto"></div>
          </div>
          <div className="h-12 bg-brand-cream-dark rounded w-64 mx-auto mb-3"></div>
          <div className="h-12 bg-brand-cream-dark rounded w-64 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}