'use client';

import { Truck, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';

interface DeliveryMethodToggleProps {
  value: 'delivery' | 'pickup';
  onChange: (method: 'delivery' | 'pickup') => void;
  onBack?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function DeliveryMethodToggle({
  value,
  onChange,
  onBack,
  isLoading,
  className,
}: DeliveryMethodToggleProps) {
  return (
    <div className={cn('bg-white rounded-card p-6 shadow-card', className)}>
      <h2 className="font-semibold text-lg mb-4">Metode Pengiriman</h2>

      <div className="space-y-3">
        <label
          className={cn(
            'flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-colors',
            value === 'delivery'
              ? 'border-brand-red bg-brand-red-muted/5'
              : 'border-brand-cream-dark hover:border-brand-red/50'
          )}
        >
          <input
            type="radio"
            name="deliveryMethod"
            value="delivery"
            checked={value === 'delivery'}
            onChange={() => onChange('delivery')}
            className="accent-brand-red"
          />
          <Truck className="w-5 h-5 text-brand-red flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Kirim ke Alamat</p>
            <p className="text-sm text-text-secondary">
              Dikirim via SiCepat FROZEN / JNE YES / AnterAja Frozen
            </p>
          </div>
        </label>

        <label
          className={cn(
            'flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-colors',
            value === 'pickup'
              ? 'border-brand-red bg-brand-red-muted/5'
              : 'border-brand-cream-dark hover:border-brand-red/50'
          )}
        >
          <input
            type="radio"
            name="deliveryMethod"
            value="pickup"
            checked={value === 'pickup'}
            onChange={() => onChange('pickup')}
            className="accent-brand-red"
          />
          <MapPin className="w-5 h-5 text-brand-red flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Ambil di Toko</p>
            <p className="text-sm text-text-secondary">
              Jl. Sinom V no. 7, Turangga, Bandung
            </p>
          </div>
        </label>
      </div>

      <div className="flex gap-4 mt-6">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Kembali
          </Button>
        )}
      </div>
    </div>
  );
}