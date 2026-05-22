'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';
import { useCartMerge } from '@/hooks/use-cart-merge';
import idMessages from '@/i18n/messages/id.json';
import enMessages from '@/i18n/messages/en.json';

function CartMergeHandler() {
  useCartMerge();
  return null;
}

function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<'id' | 'en'>('id');

  useEffect(() => {
    // Read persisted locale from cookie on mount
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(id|en)/);
    if (match) {
      setLocale(match[1] as 'id' | 'en');
    }
  }, []);

  const messages = locale === 'en' ? enMessages : idMessages;

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Jakarta">
      {children}
    </NextIntlClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <SessionProvider
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <CartMergeHandler />
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: 'font-body',
              },
            }}
          />
        </LocaleProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}