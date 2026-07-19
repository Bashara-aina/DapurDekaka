'use client';

import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import confetti from 'canvas-confetti';
import { formatIDR } from '@/lib/utils/format-currency';
import { CheckCircle } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';

export const dynamic = 'force-dynamic';

function SuccessContent() {
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');

  // BUG-13: useQuery must come before useEffect that depends on it (React hook ordering rules)
  const { data: orderData, isLoading } = useQuery<{
    order: {
      courierName: string;
      courierService: string;
      deliveryMethod: string;
      totalAmount: number;
      pointsEarned: number;
      status: string;
    };
    verified: boolean;
  }>({
    queryKey: ['order', orderNumber],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderNumber}`);
      const json = await res.json();
      if (!json.success) return { order: { pointsEarned: 0, totalAmount: 0, status: '', courierName: '', courierService: '', deliveryMethod: '' }, verified: false };
      return json.data;
    },
    enabled: !!orderNumber,
    staleTime: 60000,
    refetchInterval: (query) =>
      query.state.data?.order?.status === 'paid' ? false : 3000,
    retry: 20,
  });

  // FIX HIGH-1: Only clear cart + fire confetti when order is verified (paid status).
  // Cart clearing moved from checkout page's handleMidtransSuccess to here so it only
  // happens AFTER the webhook has confirmed payment. This prevents cart loss if webhook fails.
  useEffect(() => {
    if (orderData?.order?.status === 'paid') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      // Clear cart only after confirming payment is settled
      useCartStore.getState().clearCart();
    }
  }, [orderData?.order?.status]);

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4 pb-24 md:pb-0">
      <div className="text-center max-w-md w-full">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-success mx-auto" />
        </div>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">
          {t('successTitle')}
        </h1>
        <p className="text-text-secondary mb-2">
          {t('successThankYou')}
        </p>
        <p className="text-text-secondary mb-4">
          {t('successOrderNumber')}: <span className="font-bold text-brand-red">{orderNumber}</span>
        </p>

        {orderData?.order?.status !== 'paid' && !isLoading && orderNumber && (
          <p className="text-sm text-text-secondary mb-4">{t('successPendingConfirm')}</p>
        )}

        {orderData?.order?.courierName && orderData?.order?.deliveryMethod === 'delivery' && (
          <p className="text-sm text-text-secondary mb-4">
            {t('successDeliveryEstimate', { courier: orderData.order.courierName })}
          </p>
        )}

        {orderData?.order?.pointsEarned && orderData.order.pointsEarned > 0 && orderData.order.status === 'paid' ? (
          <div className="bg-gradient-to-r from-brand-gold/20 to-brand-gold/10 border border-brand-gold/30 rounded-xl p-4 mb-6">
            <p className="text-sm text-text-secondary mb-1">{t('successPointsEarned')}</p>
            <p className="text-2xl font-bold text-brand-gold">
              +{orderData.order.pointsEarned.toLocaleString('id-ID')} {t('pointsUnit')}
            </p>
            <p className="text-xs text-text-secondary mt-1">
              {t('successPointsNote')}
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <Link
            href={`/orders/${orderNumber}`}
            className="block w-full h-12 bg-brand-red text-white font-bold rounded-button flex items-center justify-center"
          >
            {t('viewOrderDetails')}
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
              {t('downloadReceipt')}
            </a>
          )}
          <Link
            href="/products"
            className="block w-full h-12 bg-white border border-brand-cream-dark text-text-primary font-medium rounded-button flex items-center justify-center"
          >
            {t('continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4 pb-24 md:pb-0">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="mb-6">
            <CheckCircle className="w-16 h-16 text-success mx-auto opacity-50" />
          </div>
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