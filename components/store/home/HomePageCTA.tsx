'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/store/cart.store';

interface HomePageCTAProps {
  heroTitle?: string;
  heroSubtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function HomePageCTA({
  heroTitle,
  heroSubtitle,
  ctaLabel,
  ctaHref = '/products',
}: HomePageCTAProps) {
  const t = useTranslations('homePageCTA');
  const { data: session } = useSession();
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalItems = mounted ? getTotalItems() : 0;

  const guestContent = (
    <section className="py-12 px-4 bg-brand-red">
      <div className="container mx-auto text-center">
        <h2 className="font-display text-2xl font-bold text-white mb-4">
          {heroTitle || t('heroTitle')}
        </h2>
        <p className="text-white/80 mb-6 max-w-md mx-auto">
          {heroSubtitle || t('heroSubtitle')}
        </p>
        <Link
          href={ctaHref}
          className="inline-flex items-center h-12 px-8 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
        >
          {ctaLabel || t('exploreProducts')}
        </Link>
      </div>
    </section>
  );

  if (!mounted) return guestContent;

  if (session?.user) {
    return (
      <section className="py-12 px-4 bg-brand-red">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-4">
            {totalItems > 0 ? t('continueShoppingTitle') : t('retryShoppingTitle')}
          </h2>
          <p className="text-white/80 mb-6 max-w-md mx-auto">
            {totalItems > 0
              ? t('continueShoppingSubtitle', { totalItems })
              : t('retryShoppingSubtitle')}
          </p>
          <Link
            href={totalItems > 0 ? '/cart' : '/products'}
            className="inline-flex items-center h-12 px-8 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            {totalItems > 0 ? t('viewCart') : t('startShopping')}
          </Link>
        </div>
      </section>
    );
  }

  return guestContent;
}
