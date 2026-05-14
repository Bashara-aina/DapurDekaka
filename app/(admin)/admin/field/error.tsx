'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FieldError() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 text-center max-w-md w-full">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Terjadi Kesalahan</h2>
        <p className="text-sm text-gray-500 mb-4">
          Gagal memuat data. Pastikan koneksi internet stabil.
        </p>
        <Button onClick={() => window.location.reload()}>
          Coba Lagi
        </Button>
      </div>
    </div>
  );
}