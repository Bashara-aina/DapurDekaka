'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import { POINTS_MIN_REDEEM, POINTS_VALUE_IDR } from '@/lib/constants/points';
import { CouponInput } from './CouponInput';
import { PointsRedeemer } from './PointsRedeemer';

interface PaymentStepProps {
  formData: {
    recipientName: string;
    recipientPhone: string;
    addressLine: string;
    district: string;
    city: string;
    province: string;
    deliveryMethod: 'delivery' | 'pickup';
    courierName: string;
    courierService: string;
    shippingCost: number;
    couponCode: string;
    pointsUsed: number;
  };
  subtotal: number;
  couponDiscount: number;
  couponType: string | null;
  couponBuyXgetY: { buyQuantity: number; getQuantity: number } | null;
  isFreeShippingCoupon: boolean;
  pointsBalance: number;
  pointsDiscount: number;
  totalAmount: number;
  updateForm: (updates: Record<string, unknown>) => void;
  onCouponApply: () => Promise<void>;
  onPointsToggle: (use: boolean) => void;
  onPlaceOrder: () => void;
  onBack: () => void;
  isLoading: boolean;
  couponError: string;
  onClearCouponError: () => void;
}

export function PaymentStep({
  formData,
  subtotal,
  couponDiscount,
  couponType,
  couponBuyXgetY,
  isFreeShippingCoupon,
  pointsBalance,
  pointsDiscount,
  totalAmount,
  updateForm,
  onCouponApply,
  onPointsToggle,
  onPlaceOrder,
  onBack,
  isLoading,
  couponError,
  onClearCouponError,
}: PaymentStepProps) {
  const t = useTranslations('checkout');
  const [showOrderReview, setShowOrderReview] = useState(false);

  const effectiveShippingCost = isFreeShippingCoupon && formData.deliveryMethod === 'delivery'
    ? 0
    : formData.shippingCost;

  return (
    <div className="bg-white rounded-card p-6 shadow-card">
      <h2 className="font-semibold text-lg mb-4">{t('payment')}</h2>

      {/* Order Review Collapsible */}
      <button
        type="button"
        onClick={() => setShowOrderReview(!showOrderReview)}
        className="w-full flex items-center justify-between py-3 border-b border-brand-cream-dark mb-4"
        aria-expanded={showOrderReview}
      >
        <span className="font-medium text-sm text-text-primary">{t('orderReview')}</span>
        <ChevronDown className={cn('w-4 h-4 text-text-secondary transition-transform', showOrderReview && 'rotate-180')} />
      </button>

      {showOrderReview && (
        <div className="mb-6 p-4 bg-brand-cream rounded-lg text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('recipient')}</span>
            <span className="font-medium">{formData.recipientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('phoneNumber')}</span>
            <span className="font-medium">{formData.recipientPhone}</span>
          </div>
          {formData.deliveryMethod === 'delivery' && (
            <>
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('addressLabel')}</span>
                <span className="font-medium text-right max-w-[60%]">
                  {formData.addressLine}, {formData.district}, {formData.city}, {formData.province}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('courierLabel')}</span>
                <span className="font-medium">{formData.courierName} {formData.courierService}</span>
              </div>
            </>
          )}
          {formData.deliveryMethod === 'pickup' && (
            <div className="flex justify-between">
              <span className="text-text-secondary">{t('method')}</span>
              <span className="font-medium">{t('pickupLocation')}</span>
            </div>
          )}
          <div className="border-t border-brand-cream-dark pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>{t('subtotal')}</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-xs text-success">
                <span>{t('discount')}</span>
                <span>-{formatIDR(couponDiscount)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-xs text-success">
                <span>{t('pointsLabel', { used: formData.pointsUsed })}</span>
                <span>-{formatIDR(pointsDiscount)}</span>
              </div>
            )}
            {formData.shippingCost > 0 && (
              <div className="flex justify-between text-xs text-text-secondary">
                <span>{t('shippingCost')}</span>
                <span>{formatIDR(formData.shippingCost)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-brand-red pt-1">
              <span>{t('totalPay')}</span>
              <span>{formatIDR(totalAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Coupon */}
      <div role="alert" aria-live="polite" className="mb-6">
        <CouponInput
          code={formData.couponCode}
          onCodeChange={(code) => updateForm({ couponCode: code })}
          onClearError={onClearCouponError}
          onApply={onCouponApply}
          discountAmount={couponDiscount}
          error={couponError}
          isLoading={false}
        />
        {couponType === 'buy_x_get_y' && couponBuyXgetY && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              <span className="font-semibold">{t('freeShippingCouponActive')}</span>
              <br />
              {t('freeShippingCouponDesc', { buy: couponBuyXgetY.buyQuantity, get: couponBuyXgetY.getQuantity })}
            </p>
          </div>
        )}
      </div>

      {/* Points */}
      <div role="status" aria-live="polite" className="mb-6">
        <PointsRedeemer
          pointsBalance={pointsBalance}
          subtotal={subtotal - couponDiscount}
          usedPoints={formData.pointsUsed}
          onToggle={onPointsToggle}
        />
      </div>

      {/* Back button - show different label based on delivery method */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-text-secondary hover:underline mb-4 text-left"
      >
        {formData.deliveryMethod === 'pickup' ? t('backToDelivery') : t('backToCourier')}
      </button>

      <button
        type="button"
        onClick={onPlaceOrder}
        disabled={isLoading}
        className="w-full h-14 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
      >
        {isLoading ? t('processing') : t('payNowButton', { amount: formatIDR(totalAmount) })}
        <span className="block text-xs font-normal mt-0.5 opacity-80">{t('payNowNote')}</span>
      </button>
    </div>
  );
}