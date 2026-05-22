'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Script from 'next/script';
import { getSnapUrl } from '@/lib/midtrans/client';

interface PayNowButtonProps {
  orderNumber: string;
  className?: string;
}

export function PayNowButton({ orderNumber, className }: PayNowButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapLoaded, setSnapLoaded] = useState(false);

  const handleSnapLoad = () => {
    setSnapLoaded(true);
  };

  const handlePay = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Gagal memproses pembayaran');
        setIsLoading(false);
        return;
      }

      if (window.snap) {
        window.snap.pay(data.data.snapToken, {
          onSuccess: () => {
            setIsLoading(false);
            window.location.href = `/checkout/success?order=${orderNumber}`;
          },
          onPending: () => {
            setIsLoading(false);
            setError('Pembayaran sedang diproses. Silakan selesaikan pembayaran.');
          },
          onError: () => {
            setIsLoading(false);
            setError('Pembayaran gagal. Silakan coba lagi.');
          },
          onClose: () => {
            setIsLoading(false);
          },
        });
      } else {
        setError('Midtrans belum dimuat. Silakan coba beberapa saat lagi.');
        setIsLoading(false);
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Script
        src={getSnapUrl()}
        strategy="afterInteractive"
        onLoad={handleSnapLoad}
      />
      <div className={className}>
        <p className="text-sm text-text-secondary mb-4">
          Pesanan ini menunggu pembayaran. Selesaikan pembayaran sebelum expired.
        </p>
        <button
          onClick={handlePay}
          disabled={isLoading}
          className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
        >
          {isLoading ? 'Memproses...' : 'Bayar Sekarang'}
        </button>
        {error && (
          <div className="mt-3 p-3 bg-error-light text-error text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>
    </>
  );
}

declare global {
  interface Window {
    snap?: {
      pay: (
        snapToken: string,
        options?: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export {};