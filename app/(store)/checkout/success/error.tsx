'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

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
        <div className="w-16 h-16 bg-error-light rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Terjadi Kesalahan</h2>
        <p className="text-text-secondary">Gagal memuat halaman pesanan berhasil.</p>
        <Link
          href="/account/orders"
          className="inline-block h-12 px-6 bg-brand-red text-white font-bold rounded-button inline-flex items-center"
        >
          Lihat Pesanan Saya
        </Link>
      </div>
    </div>
  );
}
