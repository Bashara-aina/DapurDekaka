'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    // Log to error monitoring service
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-brand-cream">
          <div className="text-center p-8">
            <h1 className="text-2xl font-display font-bold text-text-primary mb-4">
              {t('systemError')}
            </h1>
            <p className="text-text-secondary mb-6">
              {t('systemErrorDesc')}
            </p>
            <button
              onClick={reset}
              className="px-6 py-3 bg-brand-red text-white rounded-lg font-body font-medium"
            >
              {t('tryAgain')}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}