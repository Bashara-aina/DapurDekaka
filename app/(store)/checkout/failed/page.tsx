'use client';

import Link from 'next/link';
import { XCircle, RefreshCw, ArrowRight, Home } from 'lucide-react';

export default function CheckoutFailedPage() {
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
          Jangan khawatir — keranjang Anda masih tersimpan. Silakan coba lagi.
        </p>

        <div className="space-y-3">
          <Link
            href="/checkout"
            className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </Link>

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