'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { useCartMerge } from '@/hooks/use-cart-merge';
import idMessages from '@/i18n/messages/id.json';

function CartMergeHandler() {
  useCartMerge();
  return null;
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
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="id" messages={idMessages} timeZone="Asia/Jakarta">
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
        </NextIntlClientProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
