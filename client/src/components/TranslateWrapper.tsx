
import React from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type Props = {
  children: string;
  translationKey?: string;
};

export function TranslateWrapper({ children, translationKey }: Props) {
  const { t } = useLanguage();
  
  if (translationKey) {
    return <>{t(translationKey)}</>;
  }
  
  return <>{children}</>;
}
