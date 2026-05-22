'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw, Home } from 'lucide-react';

export default function CheckoutFailedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!orderNumber) {
      router.push('/checkout');
      return;
    }

    setIsRetrying(true);
    try {
      const retryRes = await fetch('/api/checkout/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });
      const retryData = await retryRes.json();

      if (!retryData.success) {
        router.push('/checkout');
        return;
      }

      if (retryData.data?.snapToken) {
        const snapToken = retryData.data.snapToken;
        if (typeof window !== 'undefined' && (window as Window & { snap?: { pay: (token: string, options: Record<string, unknown>) => void } }).snap) {
          const snap = (window as Window & { snap?: { pay: (token: string, options: Record<string, unknown>) => void } }).snap;
          snap?.pay(snapToken, {
            onSuccess: () => {
              router.push(`/checkout/success?order=${orderNumber}`);
            },
            onPending: () => {
              router.push(`/checkout/pending?order=${orderNumber}`);
            },
            onError: () => {
              router.push(`/checkout/failed?order=${orderNumber}`);
            },
            onClose: () => {
              // User closed popup — stay on page
            },
          });
        }
      }
    } catch {
      router.push('/checkout');
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-error" />
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
          Pembayaran Gagal
        </h1>
        <p className="text-text-secondary mb-2">
          Maaf, pembayaran Anda tidak dapat diproses.
        </p>
        <p className="text-sm text-text-secondary mb-8">
          {orderNumber
            ? 'Pembayaran tidak dapat diproses. Silakan coba lagi.'
            : 'Jangan khawatir — keranjang Anda masih tersimpan.'}
        </p>

        <div className="space-y-3">
          {orderNumber ? (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Memuat...' : 'Coba Lagi'}
            </button>
          ) : (
            <Link
              href="/checkout"
              className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </Link>
          )}

          <Link
            href="/products"
            className="flex items-center justify-center gap-2 w-full h-12 bg-white border border-brand-cream-dark text-text-primary font-medium rounded-button hover:bg-brand-cream transition-colors"
          >
            <Home className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </div>

        <p className="text-xs text-text-muted mt-8">
          Jika masalah berlanjut, silakan hubungi kami via WhatsApp.
        </p>
      </div>
    </div>
  );
}