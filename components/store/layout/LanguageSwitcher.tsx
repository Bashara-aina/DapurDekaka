'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    router.replace(pathname);
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
      <span className="text-text-muted">/</span>
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