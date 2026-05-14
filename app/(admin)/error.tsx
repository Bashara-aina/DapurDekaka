'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Terjadi Kesalahan</h1>
          <p className="mb-6 text-sm text-slate-600">
            Ada yang tidak beres di sistem admin. Silakan coba lagi atau hubungi tim support jika masalah
            persists.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            🔄 Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}