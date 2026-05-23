'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/store/common/EmptyState';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  return (
    <EmptyState
      variant="error"
      title={t('title')}
      description={t('description')}
      action={{ label: t('retry'), onClick: reset }}
    />
  );
}