export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="text-6xl mb-6 opacity-50">🎉</div>
          <div className="h-8 bg-brand-cream-dark rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-brand-cream-dark rounded w-64 mx-auto mb-6"></div>
          <div className="h-12 bg-brand-cream-dark rounded w-64 mx-auto mb-3"></div>
          <div className="h-12 bg-brand-cream-dark rounded w-64 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}