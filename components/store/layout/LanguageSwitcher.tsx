'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher({ className }: { className?: string }) {
  const [locale, setLocale] = useState<'id' | 'en'>('id');
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: 'id' | 'en') => {
    setLocale(newLocale);
    // Persist locale preference in a cookie
    document.cookie = `NEXT_LOCALE=${newLocale};path=${pathname};max-age=31536000`;
  };

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