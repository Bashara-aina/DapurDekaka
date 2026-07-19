'use client';

import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import type { InsuranceType } from '@/lib/shipping/types';

interface InsuranceSelectorProps {
  value: InsuranceType;
  basicFee: number;
  premiumFee: number;
  onChange: (type: InsuranceType) => void;
}

/**
 * Optional shipping insurance selector with plain-language explanation.
 */
export function InsuranceSelector({
  value,
  basicFee,
  premiumFee,
  onChange,
}: InsuranceSelectorProps) {
  const t = useTranslations('shippingInsurance');

  const options: Array<{ type: InsuranceType; fee: number; label: string }> = [
    { type: 'none', fee: 0, label: t('none') },
    { type: 'basic', fee: basicFee, label: t('basic') },
    { type: 'premium', fee: premiumFee, label: t('premium') },
  ];

  return (
    <div className="bg-white rounded-card p-4 shadow-card space-y-3">
      <div>
        <h3 className="font-semibold text-text-primary">{t('title')}</h3>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{t('explanation')}</p>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label={t('title')}>
        {options.map((opt) => (
          <button
            key={opt.type}
            type="button"
            role="radio"
            aria-checked={value === opt.type}
            onClick={() => onChange(opt.type)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
              value === opt.type
                ? 'border-brand-red bg-brand-cream'
                : 'border-brand-cream-dark hover:border-brand-red/40'
            )}
          >
            <span
              className={cn(
                'w-4 h-4 rounded-full border-2 shrink-0',
                value === opt.type ? 'border-brand-red bg-brand-red' : 'border-gray-300'
              )}
            />
            <span className="flex-1">
              <span className="font-medium">{opt.label}</span>
              {opt.fee > 0 && (
                <span className="text-brand-red font-bold ml-2">{formatIDR(opt.fee)}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
