'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PaymentSuccessOverlayProps {
  orderNumber: string;
}

export function PaymentSuccessOverlay({ orderNumber }: PaymentSuccessOverlayProps) {
  useEffect(() => {
    // Block scroll while overlay is visible
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-brand-cream flex flex-col items-center justify-center px-4 animate-fade-in">
      {/* Animated checkmark */}
      <div className="w-24 h-24 bg-[#DCFCE7] rounded-full flex items-center justify-center mb-6 animate-slide-up">
        <svg viewBox="0 0 52 52" className="w-12 h-12">
          <circle
            cx="26"
            cy="26"
            r="25"
            fill="none"
            stroke="#16A34A"
            strokeWidth="2"
            className="check-circle"
          />
          <path
            fill="none"
            stroke="#16A34A"
            strokeWidth="3"
            strokeLinecap="round"
            d="M14 27l8 8 16-16"
            className="check-mark"
          />
        </svg>
      </div>

      <h1 className="font-display text-display-sm text-[#1A1A1A] mb-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
        Pesanan Diterima!
      </h1>

      <p className="text-[#6B6B6B] mb-1 animate-slide-up" style={{ animationDelay: '200ms' }}>
        Nomor pesanan kamu:
      </p>

      <p className="font-mono font-bold text-brand-red text-lg mb-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
        {orderNumber}
      </p>

      <p className="text-[#6B6B6B] text-sm max-w-[280px] text-center mb-8 animate-slide-up" style={{ animationDelay: '400ms' }}>
        Kami akan segera memproses pesananmu. Cek email untuk konfirmasi.
        Terima kasih sudah belanja di Dapur Dekaka 🙏
      </p>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs animate-slide-up" style={{ animationDelay: '600ms' }}>
        <Link href={`/orders/${orderNumber}`} className="flex-1">
          <Button className="w-full bg-brand-red hover:bg-brand-red-dark text-white">
            Lihat Pesanan
          </Button>
        </Link>
        <Link href="/products" className="flex-1">
          <Button variant="outline" className="w-full border-brand-cream-dark">
            Lanjut Belanja
          </Button>
        </Link>
      </div>
    </div>
  );
}