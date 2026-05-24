'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';

interface PromoBannerProps {
  promoCode?: string;
  promoTitle?: string;
  promoSubtitle?: string;
  promoLabel?: string;
}

export function PromoBanner({
  promoCode = 'SELAMATDATANG',
  promoTitle,
  promoSubtitle,
  promoLabel,
}: PromoBannerProps) {
  const t = useTranslations('promo');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  return (
    <section className="py-6 px-4 container mx-auto">
      <div className="bg-brand-red rounded-card p-6 md:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))]from-white/20_at_50%_50%,_transparent]" />
        </div>
        <div className="relative z-10">
          <span className="inline-block px-4 py-1 bg-white/20 text-white rounded-pill text-sm font-semibold mb-4">
            {promoLabel ?? t('badge')}
          </span>
          <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
            {promoTitle ?? t('title')}
          </h3>
          <p className="text-white/80 mb-4">{promoSubtitle ?? t('subtitle')}</p>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-6 py-2 bg-white text-brand-red font-mono font-bold rounded-lg text-lg md:text-xl mb-6 hover:bg-brand-cream transition-colors active:scale-95"
            aria-label={`Salin kode kupon ${promoCode}`}
          >
            {promoCode}
            {copied ? (
              <Check className="w-5 h-5 text-success" />
            ) : (
              <Copy className="w-4 h-4 opacity-60" />
            )}
          </button>
          <br />
          <Link
            href="/products"
            className="inline-flex items-center h-11 px-6 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            {t('cta')}
          </Link>
        </div>
      </div>
    </section>
  );
}