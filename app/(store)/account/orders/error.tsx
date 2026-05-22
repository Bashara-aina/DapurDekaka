'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-card shadow-card p-8 text-center">
        <div className="w-16 h-16 bg-error-light rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <h2 className="font-display text-lg font-semibold text-text-primary mb-2">
          Terjadi Kesalahan
        </h2>
        <p className="text-text-secondary text-sm mb-6">
          Gagal memuat daftar pesanan. Silakan coba lagi.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 h-11 px-6 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </button>
          <Link
            href="/account"
            className="h-11 px-6 border border-brand-cream-dark rounded-button font-medium hover:bg-brand-cream transition-colors"
          >
            Kembali ke Akun
          </Link>
        </div>
      </div>
    </div>
  );
}