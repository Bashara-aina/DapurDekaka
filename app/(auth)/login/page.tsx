'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';

function getSafeCallbackUrl(raw: string | null): string {
  const fallback = '/account';
  if (!raw) return fallback;
  try {
    if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    // Handle error query param from OAuth failures
    const errorParam = searchParams.get('error');
    if (errorParam && typeof errorParam === 'string') {
      const errorMessages: Record<string, string> = {
        OAuthSignin: 'Terjadi kesalahan saat memulai login Google. Coba lagi.',
        OAuthCallback: 'Google menolak koneksi. Pastikan kamu memberi izin akses.',
        OAuthCreateAccount: 'Gagal membuat akun baru. Email mungkin sudah terdaftar.',
        OAuthAccountNotLinked: 'Email ini sudah terdaftar dengan cara lain. Silakan masuk dengan email & password.',
        EmailSignin: 'Link masuk tidak valid atau sudah kadaluarsa.',
        CredentialsSignin: 'Email atau password salah.',
        SessionRequired: 'Silakan masuk untuk mengakses halaman ini.',
      };
      const msg = errorMessages[errorParam];
      setError(msg ?? 'Terjadi kesalahan. Silakan coba lagi.');
    }

    // Handle success message for newly registered users
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Akun berhasil dibuat! Silakan masuk.');
    }

    if (session) {
      const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
      router.push(callbackUrl);
    }
  }, [session, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError('Email atau password salah');
      } else if (result?.url) {
        // Refresh session to mitigate session fixation (L-02)
        await update();
        const cartItems = JSON.parse(localStorage.getItem('dapur-cart') || '{}');
        if (cartItems?.state?.items?.length > 0) {
          try {
            const mergeRes = await fetch('/api/auth/merge-cart', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: cartItems.state.items }),
            });
            if (!mergeRes.ok) {
              localStorage.removeItem('dapur-cart');
              toast.error('Gagal menggabungkan keranjang. Item lokal akan dihapus.');
            } else {
              const mergeData = await mergeRes.json();
              if (!mergeData.success) {
                localStorage.removeItem('dapur-cart');
                toast.error('Gagal menggabungkan keranjang. Item lokal akan dihapus.');
              } else {
                localStorage.removeItem('dapur-cart');
                toast.success('Keranjang berhasil digabungkan');
              }
            }
          } catch (err) {
            localStorage.removeItem('dapur-cart');
            toast.error('Gagal menggabungkan keranjang. Item di lok Lokal akan dihapus.');
            logger.error('[auth/login] Cart merge failed', { error: err });
          }
        }
        router.push(callbackUrl);
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
    await signIn('google', { callbackUrl });
    // Note: if signIn redirects, this line never runs
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-card shadow-card p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-text-primary">Masuk</h1>
            <p className="text-text-secondary text-sm mt-1">Selamat datang kembali!</p>
          </div>

          {successMessage && (
            <div className="mb-4 p-3 bg-success-light text-success text-sm rounded-lg">
              {successMessage}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || isLoading}
            className="w-full h-12 border border-brand-cream-dark rounded-button flex items-center justify-center gap-3 font-medium hover:bg-brand-cream transition-colors mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Menghubungkan ke Google...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-1 7.28-2.81l-3.57-2.77c-.99.67-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Masuk dengan Google
              </>
            )}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-cream-dark"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-text-secondary">atau</span>
            </div>
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
                placeholder="••••••••"
              />
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-brand-red hover:underline">
                Lupa password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
            >
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Belum punya akun?{' '}
            <Link href="/register" className="text-brand-red font-medium hover:underline">
              Daftar di sini
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}