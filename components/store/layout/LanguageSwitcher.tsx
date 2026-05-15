'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export function LanguageSwitcher({ className }: { className?: string }) {
  const [locale, setLocale] = useState<'id' | 'en'>('id');

  const switchLocale = (newLocale: 'id' | 'en') => {
    setLocale(newLocale);
    // The app doesn't have full i18n yet — just toggle the state for future use
    // When i18n is fully implemented, this would update cookies/locale
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