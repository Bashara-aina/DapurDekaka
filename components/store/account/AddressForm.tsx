'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AddressMapPicker,
  type MapPinValue,
} from '@/components/store/checkout/AddressMapPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Address } from '@/lib/db/schema';

const addressFormSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  recipientName: z.string().min(2, 'Nama penerima minimal 2 karakter'),
  recipientPhone: z.string().min(5, 'Nomor telepon tidak valid'),
  isDefault: z.boolean().optional(),
});

export type AddressFormData = z.infer<typeof addressFormSchema> & MapPinValue;

interface AddressFormProps {
  address?: Address | null;
  onSubmit: (data: AddressFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Saved address form with map pin (Biteship-compatible coordinates).
 */
export function AddressForm({
  address,
  onSubmit,
  onCancel,
  isLoading,
}: AddressFormProps) {
  const t = useTranslations('account');
  const tCheckout = useTranslations('checkout');
  const [mapPin, setMapPin] = useState<MapPinValue | null>(
    address?.latitude != null && address?.longitude != null
      ? {
          latitude: Number(address.latitude),
          longitude: Number(address.longitude),
          addressLine: address.addressLine ?? '',
          district: address.district ?? '',
          city: address.city ?? '',
          province: address.province ?? '',
          postalCode: address.postalCode ?? '',
        }
      : null
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof addressFormSchema>>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      label: address?.label ?? '',
      recipientName: address?.recipientName ?? '',
      recipientPhone: address?.recipientPhone ?? '',
      isDefault: address?.isDefault ?? false,
    },
  });

  const isDefault = watch('isDefault');

  const onFormSubmit = async (data: z.infer<typeof addressFormSchema>) => {
    if (!mapPin) return;
    await onSubmit({ ...data, ...mapPin });
  };

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-lg font-semibold text-text-primary flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {address?.id ? t('editAddress') : t('addAddress')}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-brand-cream transition-colors"
          aria-label={tCheckout('back')}
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="label">{t('addressLabel')}</Label>
          <Input
            id="label"
            {...register('label')}
            placeholder={t('addressLabel')}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recipientName">{tCheckout('recipient')} *</Label>
            <Input id="recipientName" {...register('recipientName')} required className="mt-1" />
            {errors.recipientName && (
              <p className="text-error text-xs mt-1">{errors.recipientName.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="recipientPhone">{tCheckout('phoneNumber')} *</Label>
            <Input id="recipientPhone" {...register('recipientPhone')} type="tel" required className="mt-1" />
            {errors.recipientPhone && (
              <p className="text-error text-xs mt-1">{errors.recipientPhone.message}</p>
            )}
          </div>
        </div>

        <AddressMapPicker
          defaultValues={mapPin ?? undefined}
          onConfirm={(pin) => setMapPin(pin)}
        />

        <div className="flex items-center gap-2">
          <input
            id="isDefault"
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setValue('isDefault', e.target.checked)}
            className="h-4 w-4 rounded border-brand-cream-dark text-brand-red focus:ring-brand-red"
          />
          <Label htmlFor="isDefault" className="text-sm text-text-secondary cursor-pointer">
            {t('setDefault')}
          </Label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 border border-brand-cream-dark rounded-button font-medium text-text-secondary hover:bg-brand-cream transition-colors"
          >
            {tCheckout('back')}
          </button>
          <button
            type="submit"
            disabled={isLoading || !mapPin}
            className="flex-1 h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
          >
            {isLoading ? t('loading') : t('saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
}
