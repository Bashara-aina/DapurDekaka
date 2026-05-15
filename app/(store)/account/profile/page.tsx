'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, CheckCircle, AlertCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils/cn';

const profileFormSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(255),
  phone: z
    .string()
    .regex(/^(\+62|62|0)[0-9]{8,13}$/, 'Masukkan nomor HP yang valid (contoh: 08123456789)')
    .or(z.literal('')),
  languagePreference: z.enum(['id', 'en']),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  languagePreference: string;
}

export default function AccountProfilePage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      languagePreference: 'id' as const,
    },
  });

  const selectedLang = watch('languagePreference');

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/account/profile');
      const response = await res.json();
      if (response.success && response.data) {
        setProfile(response.data);
        setValue('name', response.data.name || '');
        setValue('phone', response.data.phone || '');
        setValue('languagePreference', response.data.languagePreference || 'id');
      }
    } catch {
      setServerError('Gagal memuat profil');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setServerError(null);
    setServerSuccess(null);

    try {
      const payload = {
        name: data.name,
        phone: data.phone || undefined,
        languagePreference: data.languagePreference,
      };

      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await res.json();

      if (!response.success) {
        setServerError(response.error || 'Gagal memperbarui profil');
        return;
      }

      setProfile(response.data);
      setServerSuccess('Profil berhasil diperbarui');

      if (session?.user) {
        await update({
          user: {
            ...session.user,
            name: response.data.name,
          },
        });
      }

      setTimeout(() => setServerSuccess(null), 4000);
    } catch {
      setServerError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
          <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded-lg" />
            <div className="h-12 bg-gray-200 rounded-lg" />
            <div className="h-12 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Profil Saya</h1>
        <p className="text-text-secondary text-sm mt-1">Kelola informasi akun kamu</p>
      </div>

      {/* Success/Error Alerts */}
      {serverSuccess && (
        <div className="bg-success-light border border-success/30 rounded-card p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <p className="text-sm text-success font-medium">{serverSuccess}</p>
        </div>
      )}

      {serverError && (
        <div className="bg-error-light border border-error/30 rounded-card p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <p className="text-sm text-error font-medium">{serverError}</p>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-brand-red" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-text-primary">Informasi Akun</h2>
            <p className="text-xs text-text-secondary">Perbarui data diri kamu</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg bg-gray-50 text-text-disabled cursor-not-allowed"
            />
            <p className="text-xs text-text-disabled mt-1">
              Email tidak dapat diubah
            </p>
          </div>

          {/* Google OAuth users with null phone */}
          {!profile?.phone && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Nomor HP belum diisi. Silakan tambahkan nomor HP untuk menerima notifikasi pesanan.
              </p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nama Lengkap *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="Masukkan nama lengkap"
              className={cn(
                'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                errors.name
                  ? 'border-error'
                  : 'border-brand-cream-dark'
              )}
            />
            {errors.name && (
              <p className="text-error text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Nomor HP
            </label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="08xxxxxxxxxx"
              className={cn(
                'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                errors.phone
                  ? 'border-error'
                  : 'border-brand-cream-dark'
              )}
            />
            {errors.phone && (
              <p className="text-error text-xs mt-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Language Preference */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Bahasa
            </label>
            <div className="flex gap-3">
              <label
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-11 border rounded-lg cursor-pointer transition-colors',
                  selectedLang === 'id'
                    ? 'border-brand-red bg-brand-red/5 text-brand-red font-medium'
                    : 'border-brand-cream-dark text-text-secondary hover:border-brand-red/50'
                )}
              >
                <input
                  type="radio"
                  value="id"
                  {...register('languagePreference')}
                  className="sr-only"
                />
                🇮🇩 Indonesia
              </label>
              <label
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-11 border rounded-lg cursor-pointer transition-colors',
                  selectedLang === 'en'
                    ? 'border-brand-red bg-brand-red/5 text-brand-red font-medium'
                    : 'border-brand-cream-dark text-text-secondary hover:border-brand-red/50'
                )}
              >
                <input
                  type="radio"
                  value="en"
                  {...register('languagePreference')}
                  className="sr-only"
                />
                🇬🇧 English
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
          >
            {isLoading ? 'Memproses...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>
    </div>
  );
}