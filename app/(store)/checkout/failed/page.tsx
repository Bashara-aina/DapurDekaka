'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { XCircle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import { useCartStore } from '@/store/cart.store';

export const dynamic = 'force-dynamic';

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
  stock: number;
  imageUrl?: string;
}

/**
 * Cart store allows stock=0 items for payment retry scenarios.
 * Stock will be re-validated server-side at checkout initiation.
 */
export default function CheckoutFailedPage() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const [orderItems, setOrderItems] = useState<FailedOrderItem[] | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreItems = useCartStore((s) => s.restoreItems);

  useEffect(() => {
    if (!orderNumber) return;

    const restoreCart = async () => {
      try {
        const res = await fetch(`/api/orders/${orderNumber}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.items) {
            setOrderItems(data.data.items);
          }
        }
      } catch (err) {
        // Non-fatal: page still renders, retry just goes to bare checkout.
        logger.warn('[checkout/failed] cart restore failed', {
          orderNumber,
          error: err instanceof Error ? err.message : String(err),
        });
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
      restoreItems(
        orderItems.map((item) => ({
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
          stock: item.stock ?? 999, // will be re-validated at checkout
          quantity: Math.min(Math.max(item.quantity ?? 1, 1), 99),
        }))
      );
      router.push('/checkout');
    } catch (err) {
      // Best-effort restore: even a partial cart is better than none.
      logger.warn('[checkout/failed] cart re-add failed, continuing anyway', {
        error: err instanceof Error ? err.message : String(err),
      });
      router.push('/checkout');
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4 pb-24 md:pb-0">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-error" />
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
          {t('failedTitle')}
        </h1>
        <p className="text-text-secondary mb-2">
          {t('failedSubtitle')}
        </p>
        <p className="text-sm text-text-secondary mb-8">
          {orderItems?.length
            ? t('failedCartRestored')
            : t('failedCartSaved')}
        </p>

        <div className="space-y-3">
          {orderItems?.length ? (
            <button
              onClick={handleRetry}
              disabled={isRestoring}
              className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              {isRestoring ? t('restoring') : t('retryAgain')}
            </button>
          ) : (
            <Link
              href="/checkout"
              className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('retryAgain')}
            </Link>
          )}

          <Link
            href="/products"
            className="flex items-center justify-center gap-2 w-full h-12 bg-white border border-brand-cream-dark text-text-primary font-medium rounded-button hover:bg-brand-cream transition-colors"
          >
            <Home className="w-4 h-4" />
            {t('backToHome')}
          </Link>
        </div>

        <p className="text-xs text-text-secondary mt-8">
          {t('failedContactWhatsApp')}
        </p>
      </div>
    </div>
  );
}