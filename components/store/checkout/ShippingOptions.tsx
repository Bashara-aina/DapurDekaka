'use client';

import { Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

export interface ShippingOption {
  courier: string;
  service: string;
  displayName: string;
  cost: number;
  estimatedDays: string;
}

interface ShippingOptionsProps {
  options: ShippingOption[];
  selected: ShippingOption | null;
  onSelect: (option: ShippingOption) => void;
  onBack?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ShippingOptions({
  options,
  selected,
  onSelect,
  onBack,
  isLoading,
  className,
}: ShippingOptionsProps) {
  const t = useTranslations('shippingOptions');

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-card p-6 shadow-card', className)}>
        <h2 className="font-semibold text-lg mb-4">{t('selectCourier')}</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-brand-cream animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-card p-6 shadow-card', className)}>
      <h2 className="font-semibold text-lg mb-4">{t('selectCourier')}</h2>

      {options.length === 0 ? (
        <p className="text-text-secondary text-center py-8">
          {t('noOptions')}
        </p>
      ) : (
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={`${option.courier}-${option.service}`}
              onClick={() => onSelect(option)}
              className={cn(
                'w-full flex items-center gap-4 p-4 border-2 rounded-lg transition-colors text-left',
                selected?.courier === option.courier &&
                  selected?.service === option.service
                  ? 'border-brand-red bg-brand-red-muted/5'
                  : 'border-brand-cream-dark hover:border-brand-red/50'
              )}
            >
              <Truck className="w-5 h-5 text-brand-red flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{option.displayName}</p>
                <p className="text-sm text-text-secondary">
                  {t('estimate', { days: option.estimatedDays })}
                </p>
              </div>
              <p className="font-bold text-brand-red">{formatIDR(option.cost)}</p>
            </button>
          ))}
        </div>
      )}

      {onBack && (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="w-full mt-4"
        >
          {t('back')}
        </Button>
      )}
    </div>
  );
}