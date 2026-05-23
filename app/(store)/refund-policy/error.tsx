'use client';

import { EmptyState } from '@/components/store/common/EmptyState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Ups, ada yang tidak beres"
      description="Gagal memuat halaman. Coba lagi sebentar ya!"
      action={{ label: 'Coba Lagi', onClick: reset }}
    />
  );
}