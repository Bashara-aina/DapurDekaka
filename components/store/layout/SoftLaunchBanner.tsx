'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isFlagEnabled } from '@/lib/config/feature-flags';

const STORAGE_KEY = 'softLaunch:dismissed';

export interface SoftLaunchBannerProps {
  className?: string;
  enabledFromSettings?: boolean;
  whatsappNumber?: string;
  waMessage?: string;
}

export function SoftLaunchBanner({
  className,
  enabledFromSettings = true,
  whatsappNumber,
  waMessage,
}: SoftLaunchBannerProps) {
  const flagEnabled = isFlagEnabled('softLaunch');
  const enabled = flagEnabled && enabledFromSettings;
  const t = useTranslations('softLaunch');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(STORAGE_KEY) === '1') return;
    setVisible(true);
  }, [enabled]);

  if (!enabled || !visible) return null;

  const whatsappRaw = whatsappNumber || '';
  const message = waMessage || '';
  const href = whatsappRaw
    ? `https://wa.me/${whatsappRaw}?text=${encodeURIComponent(message)}`
    : undefined;

  return (
    <div
      role="region"
      aria-label={t('bannerTitle')}
      className={'relative h-12 bg-brand-red text-white shadow-sm ' + (className ?? '')}
    >
      <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between gap-3 px-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex shrink-0 items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Soft Launch
          </span>
          <p className="truncate text-xs font-medium sm:text-sm">
            <span className="hidden sm:inline">{t('bannerBody')} — </span>
            <span className="sm:hidden">{t('bannerTitle')}</span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline underline-offset-2 hover:text-white/90"
              >
                {t('bannerCta')}
              </a>
            ) : (
              <span className="ml-1">{t('bannerCta')}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(STORAGE_KEY, '1');
            }
            setVisible(false);
          }}
          aria-label="Tutup banner"
          className="shrink-0 rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
