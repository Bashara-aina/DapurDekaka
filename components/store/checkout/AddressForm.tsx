'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const addressSchema = z.object({
  addressLine: z.string().min(10, 'Alamat terlalu pendek'),
  district: z.string().min(2, 'Kecamatan wajib diisi'),
  city: z.string().min(2, 'Kota wajib diisi'),
  cityId: z.string().min(1, 'Pilih kota dari dropdown'),
  province: z.string().min(2, 'Provinsi wajib diisi'),
  provinceId: z.string().min(1, 'Pilih provinsi dari dropdown'),
  postalCode: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Province {
  province_id: string;
  province: string;
}

interface City {
  city_id: string;
  city_name: string;
  postal_code: string;
  type: string;
}

interface AddressFormProps {
  onSubmit: (data: AddressFormData) => void;
  onBack?: () => void;
  defaultValues?: Partial<AddressFormData>;
  className?: string;
}

export function AddressForm({ onSubmit, onBack, defaultValues, className }: AddressFormProps) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues,
  });

  const selectedProvinceId = watch('provinceId');
  const selectedProvince = watch('province');

  const filteredProvinces = useMemo(() => {
    if (!provinceSearch) return provinces;
    const q = provinceSearch.toLowerCase();
    return provinces.filter(p => p.province.toLowerCase().includes(q));
  }, [provinces, provinceSearch]);

  const filteredCities = useMemo(() => {
    if (!citySearch) return cities;
    const q = citySearch.toLowerCase();
    return cities.filter(c => `${c.type} ${c.city_name}`.toLowerCase().includes(q));
  }, [cities, citySearch]);

  // Fetch provinces on mount
  useEffect(() => {
    async function fetchProvinces() {
      try {
        const res = await fetch('/api/shipping/provinces');
        const data = await res.json();
        if (data.success) {
          setProvinces(data.data);
        }
      } catch {
        // silent fail
      } finally {
        setLoadingProvinces(false);
      }
    }
    fetchProvinces();
  }, []);

  // Fetch cities when province changes
  useEffect(() => {
    if (!selectedProvinceId) return;

    async function fetchCities() {
      setLoadingCities(true);
      setCities([]);
      setCitySearch('');
      setValue('cityId', '');
      setValue('city', '');
      try {
        const res = await fetch(`/api/shipping/cities?provinceId=${selectedProvinceId}`);
        const data = await res.json();
        if (data.success) {
          setCities(data.data);
        }
      } catch {
        // silent fail
      } finally {
        setLoadingCities(false);
      }
    }
    fetchCities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvinceId]);

  const selectProvince = (provinceId: string) => {
    const province = provinces.find((p) => p.province_id === provinceId);
    if (province) {
      setValue('provinceId', provinceId);
      setValue('province', province.province);
      setProvinceOpen(false);
      setProvinceSearch('');
    }
  };

  const selectCity = (cityId: string) => {
    const city = cities.find((c) => c.city_id === cityId);
    if (city) {
      setValue('cityId', cityId);
      setValue('city', `${city.type} ${city.city_name}`);
      setValue('postalCode', city.postal_code);
      setCityOpen(false);
      setCitySearch('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('bg-white rounded-card p-6 shadow-card', className)}
    >
      <h2 className="font-semibold text-lg mb-4">Alamat Pengiriman</h2>

      <div className="space-y-4">
        {/* Province — searchable */}
        <div>
          <label className="block text-sm font-medium mb-1">Provinsi</label>
          {loadingProvinces ? (
            <div className="h-10 flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat provinsi...
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={provinceOpen ? provinceSearch : (selectedProvince ?? '')}
                  onChange={(e) => {
                    setProvinceSearch(e.target.value);
                    setProvinceOpen(true);
                  }}
                  onFocus={() => setProvinceOpen(true)}
                  placeholder="Ketik untuk cari provinsi..."
                  className="w-full h-10 pl-10 pr-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none bg-white text-sm"
                />
              </div>
              {provinceOpen && filteredProvinces.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-brand-cream-dark rounded-lg shadow-card max-h-48 overflow-y-auto">
                  {filteredProvinces.map((p) => (
                    <button
                      key={p.province_id}
                      type="button"
                      onClick={() => selectProvince(p.province_id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-brand-cream transition-colors',
                        selectedProvinceId === p.province_id && 'bg-brand-cream font-medium'
                      )}
                    >
                      {p.province}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors.provinceId && (
            <p className="text-error text-xs mt-1">{errors.provinceId.message}</p>
          )}
        </div>

        {/* City — searchable */}
        <div>
          <label className="block text-sm font-medium mb-1">Kota/Kabupaten</label>
          {loadingCities ? (
            <div className="h-10 flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat kota...
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={cityOpen ? citySearch : watch('city') ?? ''}
                  onChange={(e) => {
                    setCitySearch(e.target.value);
                    setCityOpen(true);
                  }}
                  onFocus={() => {
                    if (!selectedProvinceId) return;
                    setCityOpen(true);
                  }}
                  placeholder={selectedProvinceId ? 'Ketik untuk cari kota...' : 'Pilih provinsi dulu'}
                  disabled={!selectedProvinceId}
                  className="w-full h-10 pl-10 pr-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none bg-white text-sm disabled:opacity-50"
                />
              </div>
              {cityOpen && filteredCities.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-brand-cream-dark rounded-lg shadow-card max-h-48 overflow-y-auto">
                  {filteredCities.map((c) => (
                    <button
                      key={c.city_id}
                      type="button"
                      onClick={() => selectCity(c.city_id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-brand-cream transition-colors',
                        watch('cityId') === c.city_id && 'bg-brand-cream font-medium'
                      )}
                    >
                      {c.type} {c.city_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors.cityId && (
            <p className="text-error text-xs mt-1">{errors.cityId.message}</p>
          )}
        </div>

        {/* District */}
        <div>
          <label className="block text-sm font-medium mb-1">Kecamatan</label>
          <Input
            {...register('district')}
            placeholder="Contoh: Cibeunying Kaler"
            error={errors.district?.message}
          />
        </div>

        {/* Address Line */}
        <div>
          <label className="block text-sm font-medium mb-1">Alamat Lengkap</label>
          <textarea
            {...register('addressLine')}
            rows={3}
            className="w-full px-3 py-2 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
            placeholder="Jl. jalan, No. RT/RW, Kelurahan"
          />
          {errors.addressLine && (
            <p className="text-error text-xs mt-1">{errors.addressLine.message}</p>
          )}
        </div>

        {/* Postal Code */}
        <div>
          <label className="block text-sm font-medium mb-1">Kode Pos (opsional)</label>
          <Input
            {...register('postalCode')}
            placeholder="40111"
          />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Kembali
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1"
          disabled={!selectedProvinceId || loadingCities}
        >
          {!selectedProvinceId
            ? 'Pilih Provinsi Dulu'
            : loadingCities
              ? 'Memuat...'
              : 'Lanjut'}
        </Button>
      </div>
    </form>
  );
}

const addressSchema = z.object({
  addressLine: z.string().min(10, 'Alamat terlalu pendek'),
  district: z.string().min(2, 'Kecamatan wajib diisi'),
  city: z.string().min(2, 'Kota wajib diisi'),
  cityId: z.string().min(1, 'Pilih kota dari dropdown'),
  province: z.string().min(2, 'Provinsi wajib diisi'),
  provinceId: z.string().min(1, 'Pilih provinsi dari dropdown'),
  postalCode: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface Province {
  province_id: string;
  province: string;
}

interface City {
  city_id: string;
  city_name: string;
  postal_code: string;
  type: string;
}

interface AddressFormProps {
  onSubmit: (data: AddressFormData) => void;
  onBack?: () => void;
  defaultValues?: Partial<AddressFormData>;
  className?: string;
}

export function AddressForm({ onSubmit, onBack, defaultValues, className }: AddressFormProps) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues,
  });

  const selectedProvinceId = watch('provinceId');
  const selectedProvince = watch('province');

  // Fetch provinces on mount
  useEffect(() => {
    async function fetchProvinces() {
      try {
        const res = await fetch('/api/shipping/provinces');
        const data = await res.json();
        if (data.success) {
          setProvinces(data.data);
        }
      } catch {
        // silent fail
      } finally {
        setLoadingProvinces(false);
      }
    }
    fetchProvinces();
  }, []);

  // Fetch cities when province changes
  useEffect(() => {
    if (!selectedProvinceId) return;

    async function fetchCities() {
      setLoadingCities(true);
      setCities([]);
      setValue('cityId', '');
      setValue('city', '');
      try {
        const res = await fetch(`/api/shipping/cities?provinceId=${selectedProvinceId}`);
        const data = await res.json();
        if (data.success) {
          setCities(data.data);
        }
      } catch {
        // silent fail
      } finally {
        setLoadingCities(false);
      }
    }
    fetchCities();
  }, [selectedProvinceId, setValue]);

  const handleProvinceChange = (provinceId: string) => {
    const province = provinces.find((p) => p.province_id === provinceId);
    if (province) {
      setValue('provinceId', provinceId);
      setValue('province', province.province);
    }
  };

  const handleCityChange = (cityId: string) => {
    const city = cities.find((c) => c.city_id === cityId);
    if (city) {
      setValue('cityId', cityId);
      setValue('city', city.city_name);
      setValue('postalCode', city.postal_code);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('bg-white rounded-card p-6 shadow-card', className)}
    >
      <h2 className="font-semibold text-lg mb-4">Alamat Pengiriman</h2>

      <div className="space-y-4">
        {/* Province */}
        <div>
          <label className="block text-sm font-medium mb-1">Provinsi</label>
          {loadingProvinces ? (
            <div className="h-10 flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat provinsi...
            </div>
          ) : (
            <select
              className="w-full h-10 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none bg-white"
              value={selectedProvinceId ?? ''}
              onChange={(e) => handleProvinceChange(e.target.value)}
            >
              <option value="">Pilih Provinsi</option>
              {provinces.map((p) => (
                <option key={p.province_id} value={p.province_id}>
                  {p.province}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium mb-1">Kota/Kabupaten</label>
          {loadingCities ? (
            <div className="h-10 flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat kota...
            </div>
          ) : (
            <select
              className="w-full h-10 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none bg-white"
              value={watch('cityId') ?? ''}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={!selectedProvinceId}
            >
              <option value="">Pilih Kota</option>
              {cities.map((c) => (
                <option key={c.city_id} value={c.city_id}>
                  {c.type} {c.city_name}
                </option>
              ))}
            </select>
          )}
          {errors.cityId && (
            <p className="text-error text-xs mt-1">{errors.cityId.message}</p>
          )}
        </div>

        {/* District */}
        <div>
          <label className="block text-sm font-medium mb-1">Kecamatan</label>
          <Input
            {...register('district')}
            placeholder="Contoh: Cibeunying Kaler"
            error={errors.district?.message}
          />
        </div>

        {/* Address Line */}
        <div>
          <label className="block text-sm font-medium mb-1">Alamat Lengkap</label>
          <textarea
            {...register('addressLine')}
            rows={3}
            className="w-full px-3 py-2 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
            placeholder="Jl. jalan, No. RT/RW, Kelurahan"
          />
          {errors.addressLine && (
            <p className="text-error text-xs mt-1">{errors.addressLine.message}</p>
          )}
        </div>

        {/* Postal Code */}
        <div>
          <label className="block text-sm font-medium mb-1">Kode Pos (opsional)</label>
          <Input
            {...register('postalCode')}
            placeholder="40111"
          />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Kembali
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1"
          disabled={!selectedProvinceId || loadingCities}
        >
          {!selectedProvinceId
            ? 'Pilih Provinsi Dulu'
            : loadingCities
              ? 'Memuat...'
              : 'Lanjut'}
        </Button>
      </div>
    </form>
  );
}