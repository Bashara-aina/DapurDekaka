'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream p-4">
      <div className="w-full max-w-md rounded-lg border border-brand-cream-dark bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="mb-2 text-xl font-semibold text-text-primary">Terjadi Kesalahan</h1>
          <p className="mb-6 text-sm text-text-secondary">
            Ada yang tidak beres. Silakan coba lagi atau hubungi tim support.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark transition-colors"
          >
            🔄 Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}