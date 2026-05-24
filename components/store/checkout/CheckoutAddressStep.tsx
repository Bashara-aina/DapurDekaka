'use client';

import { useTranslations } from 'next-intl';
import { AddressForm } from './AddressForm';
import { SavedAddressPicker } from './SavedAddressPicker';
import type { SavedAddress } from './SavedAddressPicker';
import { Loader2 } from 'lucide-react';

interface CheckoutAddressStepProps {
  session: { user?: { id: string; name?: string | null; email?: string | null } } | undefined;
  savedAddresses: SavedAddress[];
  selectedSavedAddressId: string | null;
  showNewAddressForm: boolean;
  loadingShipping: boolean;
  formData: {
    addressLine: string;
    district: string;
    city: string;
    cityId: string;
    province: string;
    provinceId: string;
    postalCode: string;
  };
  totalWeight: number;
  updateForm: (updates: Record<string, string>) => void;
  fetchShippingCost: (cityId: string) => Promise<void>;
  onAddressSubmit: (data: {
    addressLine: string;
    district: string;
    city: string;
    cityId: string;
    province: string;
    provinceId: string;
    postalCode?: string;
  }) => void;
  onBack: () => void;
  onShowNewAddressForm: () => void;
  onHideNewAddressForm: () => void;
  onSelectSavedAddress: (address: SavedAddress | null) => void;
}

export function CheckoutAddressStep({
  session,
  savedAddresses,
  selectedSavedAddressId,
  showNewAddressForm,
  loadingShipping,
  formData,
  totalWeight,
  updateForm,
  fetchShippingCost,
  onAddressSubmit,
  onBack,
  onShowNewAddressForm,
  onHideNewAddressForm,
  onSelectSavedAddress,
}: CheckoutAddressStepProps) {
  const t = useTranslations('checkout');

  return (
    <div className="mt-4">
      {loadingShipping && (
        <div className="bg-white rounded-card p-6 shadow-card mb-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
            <span className="ml-2 text-text-secondary">{t('calculatingShipping')}</span>
          </div>
        </div>
      )}
      {session?.user && savedAddresses.length > 0 && !showNewAddressForm ? (
        <>
          <SavedAddressPicker
            addresses={savedAddresses}
            selectedId={selectedSavedAddressId}
            onSelect={onSelectSavedAddress}
            onBack={onBack}
          />
          <button
            type="button"
            onClick={() => {
              if (!selectedSavedAddressId) return;
              const address = savedAddresses.find(a => a.id === selectedSavedAddressId);
              if (address) {
                updateForm({
                  addressLine: address.addressLine,
                  district: address.district,
                  city: address.city,
                  cityId: address.cityId,
                  province: address.province,
                  provinceId: address.provinceId,
                  postalCode: address.postalCode,
                });
                fetchShippingCost(address.cityId);
              }
            }}
            disabled={!selectedSavedAddressId || loadingShipping}
            className="w-full h-12 bg-brand-red text-white font-bold rounded-button mt-4 disabled:opacity-50"
          >
            {loadingShipping ? t('calculatingShipping') : t('continueToCourier')}
          </button>
        </>
      ) : (
        <AddressForm
          defaultValues={{
            addressLine: formData.addressLine,
            district: formData.district,
            city: formData.city,
            cityId: formData.cityId,
            province: formData.province,
            provinceId: formData.provinceId,
            postalCode: formData.postalCode,
          }}
          onSubmit={(data) => {
            onHideNewAddressForm();
            onAddressSubmit(data);
          }}
          onBack={() => {
            if (session?.user && savedAddresses.length > 0) {
              onHideNewAddressForm();
              onShowNewAddressForm();
            } else {
              onBack();
            }
          }}
        />
      )}
    </div>
  );
}