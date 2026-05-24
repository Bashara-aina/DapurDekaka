'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/store/common/EmptyState';

export function EmptyCart() {
  const t = useTranslations('emptyCart');

  return (
    <EmptyState
      variant="cart"
      title={t('title')}
      description={t('description')}
      action={{ label: t('cta'), href: '/products' }}
    />
  );
}