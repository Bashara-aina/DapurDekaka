'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';

interface ReviewCollapsibleProps {
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
  };
  subtotal: number;
  couponDiscount: number;
  pointsDiscount: number;
  totalAmount: number;
}

export function ReviewCollapsible({
  formData,
  subtotal,
  couponDiscount,
  pointsDiscount,
  totalAmount,
}: ReviewCollapsibleProps) {
  const t = useTranslations('checkout');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 border-b border-brand-cream-dark mb-4"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-sm text-text-primary">{t('orderReview')}</span>
        <ChevronDown className={cn('w-4 h-4 text-text-secondary transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
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
                <span>{t('pointsUsed')}</span>
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
    </>
  );
}