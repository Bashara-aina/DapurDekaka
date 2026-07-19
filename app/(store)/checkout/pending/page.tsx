'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Clock, RefreshCw, ArrowRight, Copy, CheckCircle } from 'lucide-react';
import { getSnapUrl } from '@/lib/midtrans/client';
import { cn } from '@/lib/utils/cn';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

export const dynamic = 'force-dynamic';

function PendingContent() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [snapLoaded, setSnapLoaded] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<{
    totalAmount?: number;
    vaNumber?: string | null;
    paymentType?: string | null;
    paymentExpiresAt?: string | null;
    status?: string;
  } | null>(null);

  // FIX 6: Poll order status every 5 seconds — stop immediately on paid
  useEffect(() => {
    if (!orderNumber) return;

    let stopped = false;

    const fetchOrderDetails = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/orders/${orderNumber}`);
        const json = await res.json();
        if (stopped) return;
        if (json.success && json.data?.order) {
          const order = json.data.order;
          setOrderDetails({
            totalAmount: order.totalAmount,
            vaNumber: order.midtransVaNumber,
            paymentType: order.midtransPaymentType,
            paymentExpiresAt: order.paymentExpiresAt,
            status: order.status,
          });

          // If order is paid, stop polling and redirect immediately
          if (order.status === 'paid') {
            stopped = true;
            clearInterval(interval);
            router.push(`/checkout/success?order=${orderNumber}`);
          }
        }
      } catch {
        // Silent fail on polling
      }
    };

    fetchOrderDetails();
    const interval = setInterval(fetchOrderDetails, 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [orderNumber, router]);

  // Countdown timer — wrapped in useCallback to prevent recreation on each render
  const updateCountdown = useCallback(() => {
    if (!orderDetails?.paymentExpiresAt) {
      setCountdown(null);
      return;
    }

    const now = Date.now();
    const expiry = new Date(orderDetails.paymentExpiresAt).getTime();
    const remaining = expiry - now;

    if (remaining <= 0) {
      setCountdown('00:00');
      return;
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    setCountdown(
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
  }, [orderDetails?.paymentExpiresAt]);

  useEffect(() => {
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdownInterval);
  }, [updateCountdown]);

  const handleRetry = async () => {
    if (!orderNumber) return;
    setRetrying(true);

    try {
      const res = await fetch('/api/checkout/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });
      const data = await res.json();

      if (data.success && data.data?.snapToken) {
        if (window.snap) {
          window.snap.pay(data.data.snapToken);
        } else {
          toast.error(t('midtransNotLoaded'));
        }
      } else {
        toast.error(data.error || t('retryTokenError'));
      }
    } catch {
      toast.error(t('retryTokenError'));
    }

    setRetrying(false);
  };

  const handleCopyOrderNumber = () => {
    if (!orderNumber) return;
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSnapLoad = () => {
    setSnapLoaded(true);
  };

  if (!orderNumber) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">{t('pendingOrderNotFound')}</p>
        <Link href="/" className="text-brand-red mt-4 inline-block">
          {t('backToHome')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <Script
        src={getSnapUrl()}
        strategy="afterInteractive"
        onLoad={handleSnapLoad}
      />
      <div className="text-center">
        <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-warning" />
        </div>

        <h1 className="font-display text-3xl font-bold text-text-primary mb-3">
          {t('pendingTitle')}
        </h1>
        <p className="text-text-secondary mb-2">
          {t('pendingSubtitle')}
        </p>
        <p className="text-sm text-text-secondary mb-8">
          {orderDetails?.paymentExpiresAt
              ? `${t('pendingExpiryLabel')}: ${formatWIB(new Date(orderDetails.paymentExpiresAt))}`
              : t('pendingNoExpiry')
            }
        </p>

        {/* Order number display */}
        <div className="bg-white rounded-card p-6 shadow-card max-w-sm mx-auto mb-6">
          <p className="text-xs text-text-secondary mb-2">{t('orderNumber')}</p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <p className="font-bold text-xl text-brand-red">{orderNumber}</p>
            <button
              onClick={handleCopyOrderNumber}
              className="p-1 hover:bg-brand-cream rounded transition-colors"
              title={t('copy')}
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-text-secondary" />
              )}
            </button>
          </div>
          {orderDetails?.totalAmount && (
            <div className="border-t border-brand-cream-dark pt-4 mt-4">
              <p className="text-xs text-text-secondary mb-1">{t('totalToPay')}</p>
              <p className="font-bold text-lg text-brand-red mb-3">
                {formatIDR(orderDetails.totalAmount)}
              </p>
              {orderDetails.paymentType && (
                <p className="text-xs text-text-secondary mb-2">
                  {t('paymentMethod')}: <span className="font-medium capitalize">{orderDetails.paymentType.replace('_', ' ')}</span>
                </p>
              )}
              {orderDetails.vaNumber && (
                <div className="bg-brand-cream rounded-lg p-3 mb-3">
                  <p className="text-xs text-text-secondary mb-1">{t('virtualAccount')}</p>
                  <p className="font-mono font-bold text-lg text-text-primary">
                    {orderDetails.vaNumber}
                  </p>
                </div>
              )}
              {countdown && (
                <p className="text-xs font-medium text-warning">
                  {t('timeRemaining', { countdown })}
                </p>
              )}
              {orderDetails.paymentExpiresAt && (
                <p className="text-xs text-text-muted">
                  {t('expiryTime', { time: formatWIB(new Date(orderDetails.paymentExpiresAt)) })}
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-text-muted">
            {t('saveOrderReference')}
          </p>
        </div>

        <div className="space-y-3 max-w-sm mx-auto">
          <button
            onClick={handleRetry}
            disabled={retrying || !snapLoaded}
            className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
          >
            {retrying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t('processing')}
              </>
            ) : !snapLoaded ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t('loadingMidtrans')}
              </>
            ) : (
              <>
                {t('retryNow')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <Link
            href="/products"
            className="flex items-center justify-center gap-2 w-full h-12 bg-white border border-brand-cream-dark text-text-primary font-medium rounded-button hover:bg-brand-cream transition-colors"
          >
            {t('continueShopping')}
          </Link>
        </div>

        <p className="text-xs text-text-muted mt-8">
          {t('havingTrouble')}
        </p>
      </div>
    </>
  );
}

export default function CheckoutPendingPage() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4 pb-24 md:pb-0">
      <Suspense fallback={
        <div className="text-center">
          <div className="w-20 h-20 bg-brand-cream-dark rounded-full animate-pulse mx-auto mb-6" />
          <div className="h-8 bg-brand-cream-dark rounded animate-pulse max-w-xs mx-auto mb-3" />
          <div className="h-4 bg-brand-cream-dark rounded animate-pulse max-w-sm mx-auto" />
        </div>
      }>
        <PendingContent />
      </Suspense>
    </div>
  );
}