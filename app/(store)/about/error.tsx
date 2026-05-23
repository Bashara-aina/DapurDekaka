'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="font-display text-2xl text-text-primary mb-4">
          Terjadi Kesalahan
        </h2>
        <p className="text-text-secondary mb-6">
          Maaf, halaman ini tidak dapat dimuat. Silakan coba lagi.
        </p>
        <button
          onClick={reset}
          className="bg-brand-red text-white px-6 py-3 rounded-lg font-body hover:bg-brand-red-dark transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}