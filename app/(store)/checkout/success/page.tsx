'use client';

import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { formatIDR } from '@/lib/utils/format-currency';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  const { data: orderData, isLoading } = useQuery<{
    pointsEarned: number;
    totalAmount: number;
    status: string;
  }>({
    queryKey: ['order', orderNumber],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderNumber}`);
      const json = await res.json();
      if (!json.success) return { pointsEarned: 0, totalAmount: 0, status: '' };
      return json.data;
    },
    enabled: !!orderNumber,
    staleTime: 60000,
  });

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">
          Pesanan Berhasil!
        </h1>
        <p className="text-text-secondary mb-2">
          Terima kasih atas pesanan Anda.
        </p>
        <p className="text-text-secondary mb-4">
          Order number: <span className="font-bold text-brand-red">{orderNumber}</span>
        </p>

        {isLoading ? (
          <div className="animate-pulse h-16 bg-brand-cream-dark rounded-lg mb-4" />
        ) : orderData?.pointsEarned && orderData.pointsEarned > 0 ? (
          <div className="bg-gradient-to-r from-brand-gold/20 to-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 mb-6">
            <p className="text-sm text-text-secondary mb-1">Kamu mendapat</p>
            <p className="text-2xl font-bold text-brand-gold">
              +{orderData.pointsEarned.toLocaleString('id-ID')} poin
            </p>
            <p className="text-xs text-text-secondary mt-1">
              ({formatIDR(orderData.pointsEarned * 10)}) sudah masuk ke akun kamu
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <Link
            href={`/orders/${orderNumber}`}
            className="block w-full h-12 bg-brand-red text-white font-bold rounded-button flex items-center justify-center"
          >
            Lihat Detail Pesanan
          </Link>
          {orderNumber && (
            <a
              href={`/api/orders/${orderNumber}/receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full h-12 bg-white border border-brand-cream-dark text-text-primary font-medium rounded-button flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Unduh Struk PDF
            </a>
          )}
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

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="text-6xl mb-6 opacity-50">🎉</div>
          <div className="h-8 bg-brand-cream-dark rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-brand-cream-dark rounded w-64 mx-auto"></div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SuccessContent />
    </Suspense>
  );
}
