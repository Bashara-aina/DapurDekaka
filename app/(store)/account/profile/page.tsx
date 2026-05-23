'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, CheckCircle, AlertCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

const profileFormSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(255),
  phone: z
    .string()
    .regex(/^(\+62|62|0)[0-9]{8,13}$/, 'Masukkan nomor HP yang valid (contoh: 08123456789)')
    .or(z.literal('')),
  languagePreference: z.enum(['id', 'en']),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini diperlukan'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter').max(128),
  confirmPassword: z.string().min(1, 'Konfirmasi password diperlukan'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;

const setPasswordFormSchema = z.object({
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter').max(128),
  confirmPassword: z.string().min(1, 'Konfirmasi password diperlukan'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirmPassword'],
});

type SetPasswordFormData = z.infer<typeof setPasswordFormSchema>;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  languagePreference: string;
  hasPassword: boolean;
  linkedProviders: string[];
}

export default function AccountProfilePage() {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      languagePreference: 'id' as const,
    },
  });

  const {
    register: registerChangePassword,
    handleSubmit: handleSubmitChangePassword,
    formState: { errors: changePasswordErrors },
    reset: resetChangePassword,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const {
    register: registerSetPassword,
    handleSubmit: handleSubmitSetPassword,
    formState: { errors: setPasswordErrors },
    reset: resetSetPassword,
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

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
      setServerError(t('loadProfileError') || 'Gagal memuat profil');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [t]);

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
        setServerError(response.error || t('updateProfileError') || 'Gagal memperbarui profil');
        return;
      }

      setProfile(response.data);
      setServerSuccess(t('updateProfileSuccess') || 'Profil berhasil diperbarui');

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
      setServerError(t('updateProfileError') || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (data: ChangePasswordFormData) => {
    setIsPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const response = await res.json();

      if (!response.success) {
        setPasswordError(response.error || t('updatePasswordError') || 'Gagal memperbarui password');
        return;
      }

      setPasswordSuccess(t('updatePasswordSuccess') || 'Password berhasil diperbarui');
      resetChangePassword();
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch {
      setPasswordError(t('updatePasswordError') || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleSetPassword = async (data: SetPasswordFormData) => {
    setIsPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: data.newPassword,
        }),
      });

      const response = await res.json();

      if (!response.success) {
        setPasswordError(response.error || t('createPasswordError') || 'Gagal membuat password');
        return;
      }

      setPasswordSuccess(t('createPasswordSuccess') || 'Password berhasil dibuat');
      resetSetPassword();
      await fetchProfile();
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch {
      setPasswordError(t('createPasswordError') || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsPasswordLoading(false);
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

  const isGoogleUser = profile?.linkedProviders.includes('google');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">{t('profile')}</h1>
        <p className="text-text-secondary text-sm mt-1">{t('profile')}</p>
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
            <h2 className="font-display font-semibold text-text-primary">{t('editProfile')}</h2>
            <p className="text-xs text-text-secondary">{t('editProfile')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {tAuth('email')}
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg bg-gray-50 text-text-disabled cursor-not-allowed"
            />
            <p className="text-xs text-text-disabled mt-1">
              {t('emailCannotChange') || 'Email tidak dapat diubah'}
            </p>
          </div>

          {/* Google OAuth users with null phone */}
          {!profile?.phone && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                {t('phoneMissingWarning') || 'Nomor HP belum diisi. Silakan tambahkan nomor HP untuk menerima notifikasi pesanan.'}
              </p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('fullName') || 'Nama Lengkap'} *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder={t('enterFullName') || 'Masukkan nama lengkap'}
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
              {t('phoneNumber')}
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
              {t('language') || 'Bahasa'}
            </label>
            <div className="flex items-center gap-2 h-11 px-3 border border-brand-cream-dark rounded-lg bg-gray-50">
              <span>🇮🇩 Indonesia</span>
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {t('englishComingSoon') || 'Bahasa Inggris segera hadir'}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
          >
            {isLoading ? t('processing') : t('saveChanges')}
          </button>
        </form>
      </div>

      {/* Password Section - conditionally rendered */}
      {profile?.hasPassword ? (
        /* Change Password form for email users */
        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text-primary">{t('changePassword') || 'Ubah Password'}</h2>
              <p className="text-xs text-text-secondary">{t('changePassword') || 'Perbarui password akun kamu'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmitChangePassword(handleChangePassword)} className="space-y-5">
            {passwordSuccess && (
              <div className="bg-success-light border border-success/30 rounded-card p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <p className="text-sm text-success font-medium">{passwordSuccess}</p>
              </div>
            )}

            {passwordError && (
              <div className="bg-error-light border border-error/30 rounded-card p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-error font-medium">{passwordError}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('currentPassword') || 'Password Saat Ini'}
              </label>
              <input
                type="password"
                placeholder={t('enterCurrentPassword') || 'Masukkan password saat ini'}
                {...registerChangePassword('currentPassword')}
                className={cn(
                  'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                  'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                  changePasswordErrors.currentPassword
                    ? 'border-error'
                    : 'border-brand-cream-dark'
                )}
              />
              {changePasswordErrors.currentPassword && (
                <p className="text-error text-xs mt-1">{changePasswordErrors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('newPassword') || 'Password Baru'}
              </label>
              <input
                type="password"
                placeholder={t('minCharsPassword') || 'Minimal 8 karakter'}
                {...registerChangePassword('newPassword')}
                className={cn(
                  'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                  'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                  changePasswordErrors.newPassword
                    ? 'border-error'
                    : 'border-brand-cream-dark'
                )}
              />
              {changePasswordErrors.newPassword && (
                <p className="text-error text-xs mt-1">{changePasswordErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('confirmNewPassword') || 'Konfirmasi Password Baru'}
              </label>
              <input
                type="password"
                placeholder={t('enterNewPasswordAgain') || 'Masukkan password baru lagi'}
                {...registerChangePassword('confirmPassword')}
                className={cn(
                  'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                  'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                  changePasswordErrors.confirmPassword
                    ? 'border-error'
                    : 'border-brand-cream-dark'
                )}
              />
              {changePasswordErrors.confirmPassword && (
                <p className="text-error text-xs mt-1">{changePasswordErrors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPasswordLoading}
              className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
            >
              {isPasswordLoading ? t('processing') : t('changePassword') || 'Ubah Password'}
            </button>
          </form>
        </div>
      ) : (
        /* Set Password form for OAuth users */
        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-text-primary">{t('createPassword') || 'Buat Password'}</h2>
              <p className="text-xs text-text-secondary">{t('createPassword') || 'Akun kamu terhubung via Google'}</p>
            </div>
          </div>

          {isGoogleUser && (
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-4 bg-brand-cream rounded-lg p-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-1 7.28-2.81l-3.57-2.77c-.99.67-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{t('connectedWithGoogle', { email: session?.user?.email }) || `Terhubung dengan Google (${session?.user?.email})`}</span>
            </div>
          )}

          <p className="text-sm text-text-secondary mb-4">
            {t('createPasswordDesc') || 'Buat password untuk bisa masuk dengan email juga.'}
          </p>

          <form onSubmit={handleSubmitSetPassword(handleSetPassword)} className="space-y-5">
            {passwordSuccess && (
              <div className="bg-success-light border border-success/30 rounded-card p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                <p className="text-sm text-success font-medium">{passwordSuccess}</p>
              </div>
            )}

            {passwordError && (
              <div className="bg-error-light border border-error/30 rounded-card p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-error font-medium">{passwordError}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('newPassword') || 'Password Baru'}
              </label>
              <input
                type="password"
                placeholder={t('minCharsPassword') || 'Minimal 8 karakter'}
                {...registerSetPassword('newPassword')}
                className={cn(
                  'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                  'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                  setPasswordErrors.newPassword
                    ? 'border-error'
                    : 'border-brand-cream-dark'
                )}
              />
              {setPasswordErrors.newPassword && (
                <p className="text-error text-xs mt-1">{setPasswordErrors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {t('confirmNewPassword') || 'Konfirmasi Password Baru'}
              </label>
              <input
                type="password"
                placeholder={t('enterNewPasswordAgain') || 'Masukkan password baru lagi'}
                {...registerSetPassword('confirmPassword')}
                className={cn(
                  'w-full h-11 px-3 border rounded-lg outline-none transition-colors',
                  'focus:border-brand-red focus:ring-2 focus:ring-brand-red/10',
                  setPasswordErrors.confirmPassword
                    ? 'border-error'
                    : 'border-brand-cream-dark'
                )}
              />
              {setPasswordErrors.confirmPassword && (
                <p className="text-error text-xs mt-1">{setPasswordErrors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPasswordLoading}
              className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50 hover:bg-brand-red-dark transition-colors"
            >
              {isPasswordLoading ? t('processing') : t('createPassword') || 'Buat Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}