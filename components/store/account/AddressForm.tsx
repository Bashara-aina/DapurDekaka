'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, MapPin } from 'lucide-react';

const addressFormSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  recipientName: z.string().min(2, 'Nama penerima minimal 2 karakter'),
  recipientPhone: z.string().min(5, 'Nomor telepon tidak valid'),
  addressLine: z.string().min(10, 'Alamat terlalu pendek'),
  district: z.string().min(1, 'Kecamatan harus diisi'),
  city: z.string().min(1, 'Kota harus diisi'),
  cityId: z.string().min(1, 'ID kota harus diisi'),
  province: z.string().min(1, 'Provinsi harus diisi'),
  provinceId: z.string().min(1, 'ID provinsi harus diisi'),
  postalCode: z.string().min(5, 'Kode pos tidak valid'),
  isDefault: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressFormSchema>;

interface Province {
  id: string;
  name: string;
}

interface City {
  id: string;
  name: string;
  province_id: string;
  type: string;
}

interface AddressFormProps {
  address?: (Partial<AddressFormData> & { id?: string }) | null;
  provinces: Province[];
  cities: City[];
  onSubmit: (data: AddressFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AddressForm({ address, provinces, cities, onSubmit, onCancel, isLoading }: AddressFormProps) {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      label: address?.label || '',
      recipientName: address?.recipientName || '',
      recipientPhone: address?.recipientPhone || '',
      addressLine: address?.addressLine || '',
      district: address?.district || '',
      city: address?.city || '',
      cityId: address?.cityId || '',
      province: address?.province || '',
      provinceId: address?.provinceId || '',
      postalCode: address?.postalCode || '',
      isDefault: address?.isDefault || false,
    },
  });

  const selectedProvince = watch('province');
  const selectedCity = watch('city');

  useEffect(() => {
    if (address?.provinceId) {
      setSelectedProvinceId(address.provinceId);
      setFilteredCities(cities.filter(c => c.province_id === address.provinceId));
    }
  }, [address, cities]);

  const handleProvinceChange = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    const province = provinces.find(p => p.id === provinceId);
    if (province) {
      setValue('province', province.name);
      setValue('provinceId', province.id);
    }
    setValue('city', '');
    setValue('cityId', '');
    setFilteredCities(cities.filter(c => c.province_id === provinceId));
  };

  const handleCityChange = (cityId: string) => {
    const city = filteredCities.find(c => c.id === cityId);
    if (city) {
      setValue('city', city.name);
      setValue('cityId', city.id);
    }
  };

  const onFormSubmit = async (data: AddressFormData) => {
    await onSubmit(data);
  };

  return (
    <div className="bg-white rounded-card shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-lg font-semibold text-text-primary flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {address?.id ? 'Edit Alamat' : 'Tambah Alamat Baru'}
        </h2>
        <button
          onClick={onCancel}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-brand-cream transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Label Alamat</label>
          <input
            {...register('label')}
            type="text"
            placeholder="Rumah, Kantor, dll"
            className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Penerima *</label>
            <input
              {...register('recipientName')}
              type="text"
              required
              placeholder="Nama lengkap"
              className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
            />
            {errors.recipientName && (
              <p className="text-error text-xs mt-1">{errors.recipientName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nomor Telepon *</label>
            <input
              {...register('recipientPhone')}
              type="tel"
              required
              placeholder="08xxxxxxxxxx"
              className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
            />
            {errors.recipientPhone && (
              <p className="text-error text-xs mt-1">{errors.recipientPhone.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Provinsi *</label>
          <select
            value={selectedProvinceId}
            onChange={e => handleProvinceChange(e.target.value)}
            required
            className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none bg-white"
          >
            <option value="">Pilih Provinsi</option>
            {provinces.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kota/Kabupaten *</label>
          <select
            value={watch('cityId')}
            onChange={e => handleCityChange(e.target.value)}
            required
            disabled={!selectedProvinceId}
            className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none bg-white disabled:bg-gray-50"
          >
            <option value="">Pilih Kota/Kabupaten</option>
            {filteredCities.map(c => (
              <option key={c.id} value={c.id}>
                {c.type} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kecamatan *</label>
          <input
            {...register('district')}
            type="text"
            required
            placeholder="Nama kecamatan"
            className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
          />
          {errors.district && (
            <p className="text-error text-xs mt-1">{errors.district.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Alamat Lengkap *</label>
          <textarea
            {...register('addressLine')}
            required
            rows={3}
            placeholder="Nama jalan, nomor rumah, RT/RW, dll"
            className="w-full px-3 py-2 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none resize-none"
          />
          {errors.addressLine && (
            <p className="text-error text-xs mt-1">{errors.addressLine.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kode Pos *</label>
          <input
            {...register('postalCode')}
            type="text"
            required
            placeholder="5 digit kode pos"
            className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
          />
          {errors.postalCode && (
            <p className="text-error text-xs mt-1">{errors.postalCode.message}</p>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register('isDefault')}
            className="w-5 h-5 rounded border-brand-cream-dark text-brand-red focus:ring-brand-red"
          />
          <span className="text-sm text-text-secondary">Jadikan alamat utama</span>
        </label>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-12 border border-brand-cream-dark rounded-button font-medium text-text-secondary hover:bg-brand-cream transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Simpan Alamat'}
          </button>
        </div>
      </form>
    </div>
  );
}