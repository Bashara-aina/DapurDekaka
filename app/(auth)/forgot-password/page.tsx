'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal mengirim email reset');
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
            <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Email Terkirim</h1>
            <p className="text-text-secondary mb-2">
              Kami telah mengirim link reset password ke:
            </p>
            <p className="font-medium text-text-primary mb-6">{email}</p>
            <p className="text-text-secondary text-sm mb-6">
              Cek inbox atau folder spam kamu. Link berlaku selama 1 jam.
            </p>
            <Link href="/login" className="text-brand-red font-medium hover:underline">
              Kembali ke halaman masuk
            </Link>
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
            <h1 className="font-display text-2xl font-bold text-text-primary">Lupa Password</h1>
            <p className="text-text-secondary text-sm mt-1">Masukkan email untuk reset password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-error-light text-error text-sm rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
                placeholder="email@contoh.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
            >
              {isLoading ? 'Memproses...' : 'Kirim Link Reset'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Ingat password?{' '}
            <Link href="/login" className="text-brand-red font-medium hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}