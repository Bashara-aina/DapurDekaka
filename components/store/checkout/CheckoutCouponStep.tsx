'use client';

import { useTranslations } from 'next-intl';
import { CouponInput } from './CouponInput';
import { PointsRedeemer } from './PointsRedeemer';

interface CheckoutCouponStepProps {
  formData: {
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
  updateForm: (updates: Record<string, unknown>) => void;
  onCouponApply: () => Promise<void>;
  onPointsToggle: (use: boolean) => void;
  couponError: string;
  onClearCouponError: () => void;
}

export function CheckoutCouponStep({
  formData,
  subtotal,
  couponDiscount,
  couponType,
  couponBuyXgetY,
  isFreeShippingCoupon,
  pointsBalance,
  pointsDiscount,
  updateForm,
  onCouponApply,
  onPointsToggle,
  couponError,
  onClearCouponError,
}: CheckoutCouponStepProps) {
  const t = useTranslations('checkout');

  return (
    <>
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
    </>
  );
}