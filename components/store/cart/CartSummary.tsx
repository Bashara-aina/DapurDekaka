'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils/format-currency';
import { useCartStore } from '@/store/cart.store';
import { cn } from '@/lib/utils/cn';

interface CartSummaryProps {
  shippingCost?: number;
  discount?: number;
  pointsRedemption?: number;
  stockIssues?: boolean;
  addressEntered?: boolean;
}

export function CartSummary({ shippingCost = 0, discount = 0, pointsRedemption = 0, stockIssues = false, addressEntered = false }: CartSummaryProps) {
  const t = useTranslations('cartSummary');
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const getTotalWeight = useCartStore((s) => s.getTotalWeight);

  const subtotal = getSubtotal();
  const totalItems = getTotalItems();
  const totalWeight = getTotalWeight();
  const total = subtotal + (shippingCost > 0 ? shippingCost : 0) - discount - pointsRedemption;

  return (
    <div className={cn(
      'bg-white rounded-card shadow-card p-4 md:p-6',
      stockIssues && 'border-2 border-warning'
    )}>
      <h3 className="font-display font-semibold text-lg mb-4">{t('shoppingSummary')}</h3>

      {stockIssues && (
        <div className="bg-warning-light border border-warning/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-warning font-medium">
            {t('stockIssueWarning')}
          </p>
        </div>
      )}

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">{t('totalItems', { count: totalItems })}</span>
          <span className="font-medium">{formatIDR(subtotal)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">{t('estimatedWeight')}</span>
          <span className="font-medium">{(totalWeight / 1000).toFixed(1)} kg</span>
        </div>

        {shippingCost > 0 ? (
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('shippingCost')}</span>
            <span className="font-medium">{formatIDR(shippingCost)}</span>
          </div>
        ) : !addressEntered ? (
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('shippingCost')}</span>
            <span className="font-medium text-text-disabled text-xs">{t('enterAddress')}</span>
          </div>
        ) : null}

        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('discount')}</span>
            <span className="font-medium text-green-600">-{formatIDR(discount)}</span>
          </div>
        )}

        {pointsRedemption > 0 && (
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('pointsUsed')}</span>
            <span className="font-medium text-green-600">-{formatIDR(pointsRedemption)}</span>
          </div>
        )}

        <div className="border-t border-brand-cream-dark pt-3 flex justify-between">
          <span className="font-semibold text-text-primary">{t('total')}</span>
          <span className="font-body font-bold text-brand-red text-xl">{formatIDR(total)}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className={cn(
          'mt-6 w-full h-12 font-bold rounded-button flex items-center justify-center transition-colors',
          stockIssues
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-brand-red text-white hover:bg-brand-red-dark'
        )}
        onClick={(e) => {
          if (stockIssues) {
            e.preventDefault();
          }
        }}
      >
        {t('continueToCheckout')}
      </Link>
    </div>
  );
}