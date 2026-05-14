'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuperadminDashboardError() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl p-8 text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Terjadi Kesalahan Sistem</h2>
        <p className="text-sm text-gray-500 mb-4">
          Gagal memuat data dashboard. Pastikan semua sistem beroperasi normal.
        </p>
        <Button onClick={() => window.location.reload()}>
          Refresh Dashboard
        </Button>
      </div>
    </div>
  );
}