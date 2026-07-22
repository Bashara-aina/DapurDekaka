'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ShippingTierTabs } from './ShippingTierTabs';
import { InsuranceSelector } from './InsuranceSelector';
import { InstantDeliveryAck } from './InstantDeliveryAck';
import { CodToggle } from './CodToggle';
import type { QuoteOption, ShippingRatesResult, ShippingTier, InsuranceType } from '@/lib/shipping/types';
import { calculateInsuranceFee } from '@/lib/shipping/insurance';
import { isFlagEnabled } from '@/lib/config/feature-flags';

export interface ShippingSelection {
  shippingTier: ShippingTier;
  selectedQuoteId: string;
  courierCode: string;
  courierService: string;
  courierName: string;
  shippingCost: number;
  biteshipActualCost: number;
  customerShippingCost: number;
  insuranceType: InsuranceType;
  insuranceFee: number;
  courierInstantAck: boolean;
  cashOnDelivery: boolean;
}

interface CheckoutShippingStepProps {
  rates: ShippingRatesResult;
  subtotal: number;
  isLoading?: boolean;
  onConfirm: (selection: ShippingSelection) => void;
  onBack: () => void;
}

/**
 * Courier tier selection step with insurance and instant ack.
 */
export function CheckoutShippingStep({
  rates,
  subtotal,
  isLoading,
  onConfirm,
  onBack,
}: CheckoutShippingStepProps) {
  const t = useTranslations('checkout');
  const [activeTier, setActiveTier] = useState<ShippingTier>('frozen_express');
  const [selectedQuote, setSelectedQuote] = useState<QuoteOption | null>(null);
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('none');
  const [instantAck, setInstantAck] = useState(false);
  const [cashOnDelivery, setCashOnDelivery] = useState(false);

  const basicFee = calculateInsuranceFee('basic', subtotal);
  const premiumFee = calculateInsuranceFee('premium', subtotal);
  const insuranceFee = calculateInsuranceFee(insuranceType, subtotal);

  const canContinue =
    selectedQuote &&
    !selectedQuote.disabled &&
    (activeTier !== 'express' || instantAck);

  const handleConfirm = () => {
    if (!selectedQuote || !canContinue) return;
    onConfirm({
      shippingTier: selectedQuote.tier,
      selectedQuoteId: selectedQuote.id,
      courierCode: selectedQuote.courierCode,
      courierService: selectedQuote.courierType,
      courierName: selectedQuote.displayName,
      shippingCost: selectedQuote.customerCost,
      biteshipActualCost: selectedQuote.actualCost,
      customerShippingCost: selectedQuote.customerCost,
      insuranceType,
      insuranceFee,
      courierInstantAck: activeTier === 'express' ? instantAck : false,
      cashOnDelivery,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
        <span className="ml-2 text-text-secondary">{t('calculatingShipping')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ShippingTierTabs
        tiers={rates.tiers}
        activeTier={activeTier}
        selectedQuoteId={selectedQuote?.id ?? null}
        onTierChange={(tier) => {
          setActiveTier(tier);
          setSelectedQuote(null);
          setInstantAck(false);
        }}
        onSelectOption={setSelectedQuote}
      />

      {activeTier === 'express' && selectedQuote && (
        <InstantDeliveryAck checked={instantAck} onChange={setInstantAck} />
      )}

      {selectedQuote?.cashOnDeliveryAvailable && (
        <CodToggle checked={cashOnDelivery} onChange={setCashOnDelivery} />
      )}

      {isFlagEnabled('insuranceUI') ? (
        <InsuranceSelector
          value={insuranceType}
          basicFee={basicFee}
          premiumFee={premiumFee}
          onChange={setInsuranceType}
        />
      ) : null}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          {t('back')}
        </Button>
        <Button
          type="button"
          className="flex-1 bg-brand-red hover:bg-brand-red-dark"
          disabled={!canContinue}
          onClick={handleConfirm}
        >
          {t('continueToPayment')}
        </Button>
      </div>
    </div>
  );
}
