'use client';
import { useEffect } from 'react';

export default function ProductNewError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-card p-6 text-center">
        <h2 className="text-xl font-semibold text-red-700 mb-2">Terjadi Kesalahan</h2>
        <p className="text-red-600 mb-4">Gagal memuat halaman produk baru.</p>
        <button onClick={reset} className="px-6 py-3 bg-brand-red text-white rounded-lg">Coba Lagi</button>
      </div>
    </div>
  );
}