'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function ForgotPasswordError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-display text-text-primary">Terjadi Kesalahan</h2>
        <p className="text-text-secondary">Silakan coba lagi.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-6 py-3 bg-brand-red text-white rounded-lg">Coba Lagi</button>
          <Link href="/forgot-password" className="px-6 py-3 bg-white border border-brand-red text-brand-red rounded-lg">Kembali</Link>
        </div>
      </div>
    </div>
  );
}