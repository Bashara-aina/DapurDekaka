'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils/cn';

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = useCallback(
    (newLocale: string) => {
      router.replace(`/${newLocale}${pathname}`);
    },
    [router, pathname]
  );

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => switchLocale('id')}
        className={cn(
          'px-2 py-1 text-xs font-medium rounded transition-colors',
          locale === 'id'
            ? 'bg-brand-red text-white'
            : 'text-text-secondary hover:text-brand-red'
        )}
        aria-label="Switch to Indonesian"
      >
        ID
      </button>
      <span className="text-text-muted">/</span>
      <button
        onClick={() => switchLocale('en')}
        className={cn(
          'px-2 py-1 text-xs font-medium rounded transition-colors',
          locale === 'en'
            ? 'bg-brand-red text-white'
            : 'text-text-secondary hover:text-brand-red'
        )}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
}