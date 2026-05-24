'use client';

import { useTranslations } from 'next-intl';

interface PickupInfoPanelProps {
  storeHours: {
    openDays: string;
    openHours: string;
  };
  pickupAddress: string | null;
  onBack: () => void;
  onNext: () => void;
}

export function PickupInfoPanel({
  storeHours,
  pickupAddress,
  onBack,
  onNext,
}: PickupInfoPanelProps) {
  const t = useTranslations('checkout');

  return (
    <div className="bg-white rounded-card p-6 shadow-card">
      <h2 className="font-semibold text-lg mb-4">{t('pickupLocation')}</h2>
      <p className="text-text-secondary mb-4">
        {t('pickupInstructions')}
      </p>
      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-800 mb-2">{t('pickupLocationTitle')}</h3>
        <p className="text-sm text-green-700 mb-1">
          <strong>{t('storeName')}</strong><br/>
          {t('storeAddressLine')}<br/>
          {t('storeCity')}
        </p>
        <p className="text-xs text-green-600 mt-2">
          {t('storeHours', { days: storeHours.openDays, hours: storeHours.openHours })}<br/>
        </p>
      </div>
      <div className="flex gap-4 mt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 border border-brand-cream-dark text-text-primary font-medium rounded-button"
        >
          {t('back')}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 h-12 bg-brand-red text-white font-bold rounded-button"
        >
          {t('nextToPayment')}
        </button>
      </div>
    </div>
  );
}