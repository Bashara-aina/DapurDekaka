'use client';

import { MapPin, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SavedAddress {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  district: string;
  city: string;
  cityId: string;
  province: string;
  provinceId: string;
  postalCode: string;
  isDefault: boolean;
}

interface SavedAddressPickerProps {
  addresses: SavedAddress[];
  selectedId?: string | null;
  onSelect: (address: SavedAddress | null) => void;
  onBack?: () => void;
  className?: string;
}

export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
  onBack,
  className,
}: SavedAddressPickerProps) {
  const selectedAddress = addresses.find((a) => a.id === selectedId);

  return (
    <div className={cn('bg-white rounded-card p-6 shadow-card', className)}>
      <h2 className="font-semibold text-lg mb-4">Pilih Alamat</h2>

      <div className="space-y-3">
        {addresses.map((address) => (
          <button
            key={address.id}
            type="button"
            onClick={() => onSelect(address)}
            className={cn(
              'w-full text-left p-4 border-2 rounded-lg transition-colors',
              selectedId === address.id
                ? 'border-brand-red bg-brand-red-muted/5'
                : 'border-brand-cream-dark hover:border-brand-red/50'
            )}
          >
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {address.label || 'Alamat'}
                    {address.isDefault && (
                      <span className="ml-2 text-xs bg-brand-gold text-white px-2 py-0.5 rounded-full">
                        Utama
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-sm text-text-secondary mt-1">{address.recipientName}</p>
                <p className="text-sm text-text-secondary">{address.recipientPhone}</p>
                <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                  {address.addressLine}, {address.district}, {address.city}, {address.province} {address.postalCode}
                </p>
              </div>
            </div>
          </button>
        ))}

        {/* Add new address option */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'w-full text-left p-4 border-2 rounded-lg transition-colors border-dashed',
            selectedId === null
              ? 'border-brand-red bg-brand-red-muted/5'
              : 'border-brand-cream-dark hover:border-brand-red/50'
          )}
        >
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-brand-red flex-shrink-0" />
            <div>
              <p className="font-medium text-brand-red">Tambah alamat baru</p>
              <p className="text-sm text-text-secondary">Masukkan alamat manual</p>
            </div>
          </div>
        </button>
      </div>

      {onBack && addresses.length > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="w-full h-12 border border-brand-cream-dark text-text-primary font-medium rounded-button mt-4"
        >
          Kembali
        </button>
      )}
    </div>
  );
}