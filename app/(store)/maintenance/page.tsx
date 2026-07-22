import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Wrench } from 'lucide-react';



export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('maintenance');
  return { title: t('title') };
}

/**
 * Maintenance / circuit breaker page (L4 Decision) — pickup-only fallback
 * when `systemSettings.maintenance_mode` is true.
 */
export default async function MaintenancePage() {
  const t = await getTranslations('maintenance');
  const waPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';
  const waHref = waPhone ? `https://wa.me/${waPhone}` : '#';

  return (
    <main className="bg-brand-cream min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full bg-white p-8 rounded-card shadow-card text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <Wrench className="w-7 h-7 text-amber-700" aria-hidden="true" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text-primary mb-2">{t('title')}</h1>
        <p className="text-sm text-text-secondary mb-4">{t('message')}</p>
        <p className="text-xs text-text-muted mb-6">{t('pickupOnly')}</p>
        <a
          href={waHref}
          className="inline-block bg-brand-red text-white px-5 py-3 rounded-button text-sm font-semibold"
        >
          {t('whatsappFallback')}
        </a>
      </div>
    </main>
  );
}
