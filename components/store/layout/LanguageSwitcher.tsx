'use client';

import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui.store';

export function LanguageSwitcher({ className }: { className?: string }) {
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => setLanguage('id')}
        className={cn(
          'px-2 py-1 text-xs font-medium rounded transition-colors',
          language === 'id'
            ? 'bg-brand-red text-white'
            : 'text-text-secondary hover:text-brand-red'
        )}
        aria-label="Switch to Indonesian"
      >
        ID
      </button>
      <span className="text-text-muted">/</span>
      <button
        onClick={() => setLanguage('en')}
        className={cn(
          'px-2 py-1 text-xs font-medium rounded transition-colors',
          language === 'en'
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