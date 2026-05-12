export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 bg-brand-red rounded-full"></div>
        <p className="mt-4 text-text-secondary">Memuat...</p>
      </div>
    </div>
  );
}