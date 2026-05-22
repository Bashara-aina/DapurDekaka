'use client';

import { EmptyState } from '@/components/store/common/EmptyState';

export default function BlogSlugError({
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
        title="Gagal memuat artikel"
        description="Artikel yang Anda cari tidak dapat dimuat. Silakan coba lagi nanti."
        action={{
          label: 'Kembali ke Blog',
          href: '/blog',
        }}
      />
    </div>
  );
}