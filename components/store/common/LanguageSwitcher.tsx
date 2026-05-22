'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = () => {
    const newLocale = locale === 'id' ? 'en' : 'id';
    router.replace(pathname, { locale: newLocale } as never);
  };

  return (
    <button
      onClick={toggle}
      className="text-sm font-medium text-text-secondary hover:text-brand-red transition-colors"
      aria-label="Switch language"
    >
      {locale === 'id' ? 'EN' : 'ID'}
    </button>
  );
}