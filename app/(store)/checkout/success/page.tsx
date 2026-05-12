'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import confetti from 'canvas-confetti';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">
          Pesanan Berhasil!
        </h1>
        <p className="text-text-secondary mb-2">
          Terima kasih atas pesanan Anda.
        </p>
        <p className="text-text-secondary mb-8">
          Order number: <span className="font-bold text-brand-red">{orderNumber}</span>
        </p>
        <div className="space-y-3">
          <Link
            href={`/orders/${orderNumber}`}
            className="block w-full h-12 bg-brand-red text-white font-bold rounded-button flex items-center justify-center"
          >
            Lihat Detail Pesanan
          </Link>
          <Link
            href="/products"
            className="block w-full h-12 bg-white border border-brand-cream-dark text-text-primary font-medium rounded-button flex items-center justify-center"
          >
            Lanjut Belanja
          </Link>
        </div>
      </div>
    </div>
  );
}
