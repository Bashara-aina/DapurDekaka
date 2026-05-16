'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface PayNowButtonProps {
  orderNumber: string;
  className?: string;
}

export function PayNowButton({ orderNumber, className }: PayNowButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        return;
      }

      if (window.Midtrans) {
        window.Midtrans.pay(data.data.snapToken);
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
  );
}

declare global {
  interface Window {
    Midtrans?: {
      pay: (snapToken: string) => void;
    };
  }
}