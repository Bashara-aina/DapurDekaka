'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CheckoutPendingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    toast.error('Terjadi kesalahan');
  }, [error]);

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-5xl">⏳</div>
        <h2 className="text-xl font-display text-text-primary">Memuat Pembayaran</h2>
        <p className="text-text-secondary">Gagal memuat halaman pembayaran.</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-brand-red text-white rounded-lg font-body"
        >
          Coba Lagi
        </button>
        <Link href="/" className="block text-brand-red font-body underline">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}