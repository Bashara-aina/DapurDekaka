'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Mail, Lock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';

interface Order {
  orderNumber: string;
  status: string;
  deliveryMethod: string;
  createdAt: string;
  recipientName?: string;
  recipientPhone?: string;
  addressLine?: string;
  district?: string;
  city?: string;
  province?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  subtotal?: number;
  discountAmount?: number;
  pointsDiscount?: number;
  shippingCost?: number;
  totalAmount?: number;
  pointsEarned?: number;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  items?: Array<{
    productNameId: string;
    variantNameId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    productImageUrl: string | null;
  }>;
}

interface VerifiedOrder extends Order {
  verified: true;
  requiresEmailVerification?: false;
}

export function OrderTrackingClient({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const t = useTranslations('checkout');
  const tOrderStatus = useTranslations('orderStatus');
  const tApiErrors = useTranslations('apiErrors');

  const STATUS_TIMELINE: Record<string, { label: string; index: number }> = {
    pending_payment: { label: tOrderStatus('pending_payment'), index: 0 },
    paid: { label: tOrderStatus('paid'), index: 1 },
    processing: { label: tOrderStatus('processing'), index: 2 },
    packed: { label: tOrderStatus('packed'), index: 3 },
    shipped: { label: tOrderStatus('shipped'), index: 4 },
    delivered: { label: tOrderStatus('delivered'), index: 5 },
    cancelled: { label: tOrderStatus('cancelled'), index: 0 },
  };

  const TIMELINE_STEPS = [
    { label: t('orderCreated'), description: t('orderCreatedDesc') },
    { label: t('paymentReceived'), description: t('paymentReceivedDesc') },
    { label: t('beingPrepared'), description: t('beingPreparedDesc') },
    { label: t('readyToShip'), description: t('readyToShipDesc') },
    { label: t('outForDelivery'), description: t('outForDeliveryDesc') },
    { label: t('orderComplete'), description: t('orderCompleteDesc') },
  ];

  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [preVerifyStatus, setPreVerifyStatus] = useState<string | null>(null);

  // Status comes from verified order data after email verification
  const currentStatus = order?.status ?? preVerifyStatus ?? 'pending_payment';
  const timelineInfo = STATUS_TIMELINE[currentStatus] ?? { label: currentStatus, index: 0 };
  const currentIndex = currentStatus === 'cancelled' ? 0 : timelineInfo.index;

  // Auto-verify for logged-in users who own the order
  useEffect(() => {
    async function tryAutoVerify() {
      try {
        const res = await fetch(`/api/orders/${orderNumber}`);
        const data = await res.json();
        const payload = data?.data;
        if (payload?.order && payload?.verified) {
          setOrder(payload.order as Order);
          setVerified(true);
        }
      } catch {
        toast.error(tApiErrors('networkError') || 'Gagal memuat data pesanan');
      }
    }
    tryAutoVerify();
  }, [orderNumber, tApiErrors]);

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsVerifying(true);
    setError('');

    try {
      const res = await fetch(`/api/orders/${orderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success && data.data?.verified) {
        setOrder(data.data.order as Order);
        setVerified(true);
      } else {
        setError(data.error || tApiErrors('emailNotMatch') || 'Email tidak cocok dengan pesanan');
      }
    } catch {
      toast.error(tApiErrors('networkError') || 'Terjadi kesalahan saat verifikasi');
    }

    setIsVerifying(false);
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-display text-xl font-bold">
              {t('storeName')}
            </Link>
            <span className="text-sm text-text-secondary">{t('trackOrder')}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Order number + status */}
        <div className="bg-white rounded-card p-6 shadow-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-text-secondary mb-1">{t('orderNumber')}</p>
              <p className="font-bold text-xl text-brand-red">{orderNumber}</p>
            </div>
            <div
              className={cn(
                'px-3 py-1 rounded-pill text-sm font-medium',
                currentStatus === 'cancelled'
                  ? 'bg-error-light text-error'
                  : currentStatus === 'delivered'
                    ? 'bg-success-light text-success'
                    : 'bg-warning-light text-warning'
              )}
            >
              {timelineInfo.label}
            </div>
          </div>
        </div>

        {/* Email verification gate */}
        {!verified && (
          <div className="bg-white rounded-card p-6 shadow-card mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-brand-red" />
              </div>
              <h2 className="font-display text-xl font-bold text-text-primary mb-2">
                {t('emailVerificationRequired')}
              </h2>
              <p className="text-text-secondary text-sm">
                {t('enterEmailToTrack')}
              </p>
            </div>

            <form onSubmit={handleVerifyEmail} className="max-w-sm mx-auto">
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
                  {t('emailVerificationRequired')}
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  className="w-full h-12 px-4 border border-brand-cream-dark rounded-button focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                />
              </div>

              {error && (
                <p className="text-error text-sm mb-4 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
              >
                {isVerifying ? t('verifying') : t('verify')}
              </button>
            </form>
          </div>
        )}

        {/* Verified order details */}
        {verified && order && (
          <>
            {/* Timeline using OrderTimeline component */}
            {currentStatus !== 'cancelled' && (
              <div className="bg-white rounded-card p-6 shadow-card mb-6">
                <h3 className="font-semibold mb-4">{t('orderStatus')}</h3>
                <OrderTimeline
                  steps={TIMELINE_STEPS}
                  currentStepIndex={currentIndex}
                />
              </div>
            )}

            {/* Order items */}
            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-card p-6 shadow-card mb-6">
                <h3 className="font-semibold mb-4">{t('orderItems')}</h3>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {item.productImageUrl && (
                        <div className="w-12 h-12 rounded bg-brand-cream overflow-hidden">
                          <Image
                            src={item.productImageUrl}
                            alt={item.productNameId}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{item.productNameId}</p>
                        <p className="text-xs text-text-secondary">{item.variantNameId} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-brand-red">{formatIDR(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery info */}
            <div className="bg-white rounded-card p-6 shadow-card mb-6">
              <h3 className="font-semibold mb-4">{t('shippingInfo')}</h3>

              <div className="space-y-3 text-sm">
                {order.recipientName && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('recipientLabel')}</span>
                    <span className="font-medium">{order.recipientName}</span>
                  </div>
                )}
                {order.recipientPhone && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('phoneLabel')}</span>
                    <span className="font-medium">{order.recipientPhone}</span>
                  </div>
                )}
                {order.addressLine && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{t('addressDeliveryLabel')}</span>
                      <span className="font-medium text-right max-w-[60%]">
                        {order.addressLine}, {order.district}, {order.city}, {order.province}
                      </span>
                    </div>
                    {order.courierName && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">{t('courierDeliveryLabel')}</span>
                        <span className="font-medium">{order.courierName}</span>
                      </div>
                    )}
                    {order.trackingNumber && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">{t('trackingNumberLabel')}</span>
                        <span className="font-medium">{order.trackingNumber}</span>
                      </div>
                    )}
                  </>
                )}
                {order.deliveryMethod === 'pickup' && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('method')}</span>
                    <span className="font-medium">{t('pickupMethod')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white rounded-card p-6 shadow-card">
              <h3 className="font-semibold mb-4">{t('paymentSummary')}</h3>
              <div className="space-y-2 text-sm">
                {order.subtotal !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('subtotalLabel')}</span>
                    <span>{formatIDR(order.subtotal)}</span>
                  </div>
                )}
                {order.discountAmount !== undefined && order.discountAmount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{t('discountLabel')}</span>
                    <span>-{formatIDR(order.discountAmount)}</span>
                  </div>
                )}
                {order.pointsDiscount !== undefined && order.pointsDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{t('pointsUsedLabel')}</span>
                    <span>-{formatIDR(order.pointsDiscount)}</span>
                  </div>
                )}
                {order.shippingCost !== undefined && order.shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">{t('shippingLabel')}</span>
                    <span>{formatIDR(order.shippingCost)}</span>
                  </div>
                )}
                {order.totalAmount !== undefined && (
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-brand-cream-dark">
                    <span>{t('totalLabel')}</span>
                    <span className="text-brand-red">{formatIDR(order.totalAmount)}</span>
                  </div>
                )}
                {order.pointsEarned !== undefined && order.pointsEarned > 0 && (
                  <div className="flex justify-between text-success">
                    <span>{t('pointsEarnedLabel')}</span>
                    <span>+{order.pointsEarned} {t('pointsUnit')}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Minimal info for unverified - just status */}
        {!verified && (
          <div className="bg-white rounded-card p-6 shadow-card">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-text-secondary" />
              </div>
              <h3 className="font-semibold mb-2">{t('detailAfterVerify')}</h3>
              <p className="text-sm text-text-secondary">
                {t('verifyEmailForDetails')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}