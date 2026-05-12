'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal mendaftar');
        return;
      }

      router.push('/login?registered=true');
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-card shadow-card p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-text-primary">Daftar Akun</h1>
            <p className="text-text-secondary text-sm mt-1">Buat akun baru untuk mulai berbelanja</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-error-light text-error text-sm rounded-lg">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full h-11 px-3 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
                placeholder="email@contoh.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
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
              {isLoading ? 'Memproses...' : 'Daftar'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-brand-red font-medium hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
