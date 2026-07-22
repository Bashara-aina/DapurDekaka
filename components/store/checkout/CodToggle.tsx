'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

interface CodToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CodToggle({ checked, onChange }: CodToggleProps) {
  const t = useTranslations('checkout');

  return (
    <div className="bg-white rounded-card p-4 shadow-card space-y-2">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
        />
        <div>
          <p className="font-semibold text-text-primary">{t('codTitle')}</p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            {t('codDescription')}
          </p>
        </div>
      </label>
      {checked && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <span className="font-medium">{t('codNotice')}</span>
        </div>
      )}
    </div>
  );
}
