'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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

/**
 * Cart summary with bundled-ongkir label (L1 Decision 1) and weight-gate
 * announcement (L3 Decision 3) before they bite at checkout.
 */
export function CartSummary({
  shippingCost = 0,
  discount = 0,
  pointsRedemption = 0,
  stockIssues = false,
  addressEntered = false,
}: CartSummaryProps) {
  const t = useTranslations('cartSummary');
  const tShipping = useTranslations('shipping');
  const tWeightGate = useTranslations('cartSummary');
  const router = useRouter();
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const getTotalWeight = useCartStore((s) => s.getTotalWeight);
  const validateStock = useCartStore((s) => s.validateStock);
  const [checking, setChecking] = useState(false);

  const subtotal = getSubtotal();
  const totalItems = getTotalItems();
  const totalWeight = getTotalWeight();
  const total = subtotal + (shippingCost > 0 ? shippingCost : 0) - discount - pointsRedemption;

  const showWeightGate15kg = totalWeight >= 15_000;
  const showWeightGate5kg = !showWeightGate15kg && totalWeight >= 5_000;

  const handleCheckout = async () => {
    if (stockIssues || checking) return;
    setChecking(true);
    try {
      const result = await validateStock();
      if (result.priceChanged) {
        toast.info(t('priceUpdated'));
      }
      if (!result.valid) {
        result.errors.forEach((err) => toast.error(err));
        return;
      }
      router.push('/checkout');
    } finally {
      setChecking(false);
    }
  };

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

      {showWeightGate15kg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-red-700 font-medium">
            {tWeightGate('weightGate15kg')}
          </p>
        </div>
      )}
      {showWeightGate5kg && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-700 font-medium">
            {tWeightGate('weightGate5kg')}
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
          <span className="font-medium">{(totalWeight / 1000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</span>
        </div>

        {shippingCost > 0 ? (
          <div className="flex justify-between">
            <span className="text-text-secondary">{tShipping('bundledLabel')}</span>
            <span className="font-medium">{formatIDR(shippingCost)}</span>
          </div>
        ) : !addressEntered ? (
          <div className="flex justify-between">
            <span className="text-text-secondary">{tShipping('bundledLabel')}</span>
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

      <button
        type="button"
        disabled={stockIssues || checking}
        onClick={handleCheckout}
        className={cn(
          'mt-6 w-full h-12 font-bold rounded-button flex items-center justify-center transition-colors',
          stockIssues || checking
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-brand-red text-white hover:bg-brand-red-dark'
        )}
      >
        {checking ? t('validating') : t('continueToCheckout')}
      </button>
    </div>
  );
}
