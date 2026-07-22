'use client';

import { Suspense } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

function LanguageSwitcherInner({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSwitch = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    const qs = searchParams.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    router.replace(url);
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => handleSwitch('id')}
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
      <span className="text-text-secondary">/</span>
      <button
        onClick={() => handleSwitch('en')}
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

export function LanguageSwitcher({ className }: { className?: string }) {
  return (
    <Suspense fallback={<div className={cn('flex items-center gap-1', className)}><span className="px-2 py-1 text-xs font-medium text-text-secondary">ID</span><span className="text-text-secondary">/</span><span className="px-2 py-1 text-xs font-medium text-text-secondary">EN</span></div>}>
      <LanguageSwitcherInner className={className} />
    </Suspense>
  );
}