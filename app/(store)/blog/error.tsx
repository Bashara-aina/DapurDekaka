'use client';

import { EmptyState } from '@/components/store/common/EmptyState';

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container py-8 px-4">
      <EmptyState
        variant="error"
        title="Terjadi kesalahan"
        description="Kami sedang memperbaiki masalah ini. Silakan coba lagi nanti."
        action={{
          label: 'Coba Lagi',
          onClick: reset,
        }}
      />
    </div>
  );
}