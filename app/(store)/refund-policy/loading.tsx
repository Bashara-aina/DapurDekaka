export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream pb-24 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <p className="mt-4 text-text-secondary">Memuat...</p>
      </div>
    </div>
  );
}