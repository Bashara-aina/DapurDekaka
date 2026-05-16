'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw, Home } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';

interface FailedOrderItem {
  variantId: string;
  productId: string;
  productNameId: string;
  productNameEn: string;
  variantNameId: string;
  variantNameEn: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  weightGram: number;
  imageUrl?: string;
}

export default function CheckoutFailedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const [orderItems, setOrderItems] = useState<FailedOrderItem[] | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (!orderNumber) return;

    const restoreCart = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.order?.items) {
            setOrderItems(data.data.order.items);
          }
        }
      } catch {
        // Silent fail — order items couldn't be fetched
      }
    };
    restoreCart();
  }, [orderNumber]);

  const handleRetry = async () => {
    if (!orderItems?.length) {
      router.push('/checkout');
      return;
    }

    setIsRestoring(true);
    try {
      for (const item of orderItems) {
        // FIX 8: Cart restored with stock=0 may block addItem — use 999 (will be re-validated at checkout)
        // Alternatively, we could fetch current stock from /api/cart/validate but that adds complexity
        // Since checkout initiate re-validates all prices/stock server-side anyway, high placeholder is safe
        addItem({
          variantId: item.variantId,
          productId: item.productId,
          productNameId: item.productNameId,
          productNameEn: item.productNameEn ?? '',
          variantNameId: item.variantNameId,
          variantNameEn: item.variantNameEn ?? '',
          sku: item.sku ?? '',
          imageUrl: item.imageUrl ?? '',
          unitPrice: item.unitPrice,
          weightGram: item.weightGram,
          stock: 999,
        });
      }
      router.push('/checkout');
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
          {orderItems?.length
            ? 'Keranjang Anda telah dipulihkan. Silakan coba lagi.'
            : 'Jangan khawatir — keranjang Anda masih tersimpan.'}
        </p>

        <div className="space-y-3">
          {orderItems?.length ? (
            <button
              onClick={handleRetry}
              disabled={isRestoring}
              className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {isRestoring ? 'Memulihkan...' : 'Coba Lagi'}
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