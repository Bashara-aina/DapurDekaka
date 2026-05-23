'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CheckoutSuccessError({
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
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-display text-text-primary">Pesanan Berhasil!</h2>
        <p className="text-text-secondary">Pembayaran Anda telah diterima.</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-brand-red text-white rounded-lg font-body"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}