'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import type { QuoteOption, ShippingTier } from '@/lib/shipping/types';
import { getCutoffStatus } from '@/lib/shipping/cutoffs';

interface TierData {
  options: QuoteOption[];
  recommendedOptionId: string | null;
}

interface ShippingTierTabsProps {
  tiers: {
    express: TierData;
    frozenSameDay: TierData;
    frozenExpress: TierData;
  };
  activeTier: ShippingTier;
  selectedQuoteId: string | null;
  onTierChange: (tier: ShippingTier) => void;
  onSelectOption: (option: QuoteOption) => void;
}

const TIER_KEYS: ShippingTier[] = ['express', 'frozen_same_day', 'frozen_express'];

function tierToKey(tier: ShippingTier): keyof ShippingTierTabsProps['tiers'] {
  if (tier === 'frozen_same_day') return 'frozenSameDay';
  if (tier === 'frozen_express') return 'frozenExpress';
  return 'express';
}

/**
 * Shipping tier tabs — surfaces honest bundled-name labels (L1 Decision 1),
 * the thermal-reality description (L3 tier truth table), and the per-tier
 * SLA from the Promise Charter.
 */
export function ShippingTierTabs({
  tiers,
  activeTier,
  selectedQuoteId,
  onTierChange,
  onSelectOption,
}: ShippingTierTabsProps) {
  const t = useTranslations('shippingTiers');
  const tTier = useTranslations('tier');
  const tTierTruth = useTranslations('tierTruth');
  const tPromiseSla = useTranslations('promise.sla');
  const tierData = tiers[tierToKey(activeTier)];
  const cutoff = getCutoffStatus(activeTier);

  const tierLabel: Record<ShippingTier, string> = {
    express: tTier('express'),
    frozen_same_day: tTier('frozenSameDay'),
    frozen_express: tTier('frozenExpress'),
    pickup: tTier('pickup'),
  };

  const slaKey: Record<ShippingTier, 'kilat' | 'frozenSameDay' | 'frozenExpress' | 'pickup'> = {
    express: 'kilat',
    frozen_same_day: 'frozenSameDay',
    frozen_express: 'frozenExpress',
    pickup: 'pickup',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TIER_KEYS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => onTierChange(tier)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              activeTier === tier
                ? 'bg-brand-red text-white'
                : 'bg-brand-cream-dark text-text-secondary hover:bg-brand-cream'
            )}
          >
            {tierLabel[tier]}
          </button>
        ))}
      </div>

      <div className="bg-brand-cream-dark/40 rounded-lg px-3 py-2 space-y-1">
        <p className="text-xs text-text-secondary leading-relaxed">
          <span className="font-semibold">{tPromiseSla(slaKey[activeTier])}</span>
        </p>
        <p className="text-xs font-medium text-brand-red">
          {cutoff.beforeCutoff
            ? t('cutoffToday', { hour: cutoff.cutoffHourWIB })
            : t('cutoffTomorrow', { hour: cutoff.cutoffHourWIB })}
        </p>
        <p className="text-xs text-text-secondary italic">
          {tTierTruth(
            activeTier === 'frozen_same_day'
              ? 'frozenSameDay'
              : activeTier === 'frozen_express'
                ? 'frozenExpress'
                : 'express'
          )}
        </p>
      </div>

      <p className="text-xs text-text-secondary">{t(`${activeTier}Description`)}</p>

      {tierData.options.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 text-center">{t('noOptions')}</p>
      ) : (
        <ul className="space-y-2">
          {tierData.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={option.disabled}
                onClick={() => !option.disabled && onSelectOption(option)}
                className={cn(
                  'w-full text-left p-4 rounded-card border transition-colors',
                  option.disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
                  selectedQuoteId === option.id
                    ? 'border-brand-red bg-brand-cream'
                    : 'border-brand-cream-dark bg-white hover:border-brand-red/40'
                )}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium text-text-primary">{option.displayName}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{option.estimatedDuration}</p>
                    {option.disabled && option.disabledReason && (
                      <p className="text-xs text-amber-600 mt-1">
                        {t(`disabled.${option.disabledReason}`)}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-brand-red shrink-0">
                    Rp {option.customerCost.toLocaleString('id-ID')}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
