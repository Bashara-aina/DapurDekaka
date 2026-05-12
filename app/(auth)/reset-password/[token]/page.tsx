'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-card shadow-card p-8 text-center">
            <div className="w-16 h-16 bg-error-light rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Link Tidak Valid</h1>
            <p className="text-text-secondary mb-6">Token reset password sudah tidak berlaku atau tidak ditemukan.</p>
            <Link href="/auth/forgot-password" className="text-brand-red font-medium hover:underline">
              Minta link reset baru
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password minimal 8 karakter');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal mereset password');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    }
    setIsLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-card shadow-card p-8 text-center">
            <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Password Berhasil Diubah</h1>
            <p className="text-text-secondary mb-6">Silakan masuk dengan password baru kamu.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full h-12 bg-brand-red text-white font-bold rounded-button"
            >
              Masuk Sekarang
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-card shadow-card p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-text-primary">Reset Password</h1>
            <p className="text-text-secondary text-sm mt-1">Masukkan password baru untuk akunmu</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-error-light text-error text-sm rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Password Baru</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Konfirmasi Password</label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
                placeholder="Ulangi password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50 mt-4"
            >
              {isLoading ? 'Memproses...' : 'Reset Password'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            <Link href="/login" className="text-brand-red font-medium hover:underline">
              Kembali ke halaman masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-card shadow-card p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-brand-cream-dark rounded w-1/2 mx-auto"></div>
          <div className="h-12 bg-brand-cream-dark rounded"></div>
          <div className="h-12 bg-brand-cream-dark rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}