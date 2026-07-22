import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, X } from 'lucide-react';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('promise');
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

/**
 * Customer Promise Charter (L1 Decision) — single source of truth for
 * trust/SLA copy. Rendered as a static Server Component, with a header
 * disclaimer pointing at it as the canonical reference.
 */
export default async function TrustPage() {
  const t = await getTranslations('promise');
  const tSla = await getTranslations('promise.sla');
  const tTier = await getTranslations('tier');
  const tDispute = await getTranslations('promise.disputePlaybook');

  const promises = Array.from({ length: 12 }, (_, i) => t(`wePromise.${i + 1}`));
  const nonPromises = Array.from({ length: 12 }, (_, i) => t(`weDoNotPromise.${i + 1}`));

  const slaLines: ReadonlyArray<{ tier: string; text: string }> = [
    { tier: tTier('pickup'), text: tSla('pickup') },
    { tier: tTier('express'), text: tSla('kilat') },
    { tier: tTier('frozenSameDay'), text: tSla('frozenSameDay') },
    { tier: tTier('frozenExpress'), text: tSla('frozenExpress') },
  ];

  const disputes = [
    { key: 'spoilage', title: tDispute('spoilage.title'), stance: tDispute('spoilage.stance') },
    { key: 'ongkir', title: tDispute('ongkir.title'), stance: tDispute('ongkir.stance') },
    { key: 'lost', title: tDispute('lost.title'), stance: tDispute('lost.stance') },
    { key: 'wrongItem', title: tDispute('wrongItem.title'), stance: tDispute('wrongItem.stance') },
    { key: 'negotiate', title: tDispute('negotiate.title'), stance: tDispute('negotiate.stance') },
  ] as const;

  const waPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';
  const waHref = waPhone ? `https://wa.me/${waPhone}` : '#';

  return (
    <main className="bg-brand-cream min-h-screen pb-24 md:pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <header className="pt-10 pb-8">
          <p className="text-xs uppercase tracking-widest text-brand-red font-semibold">{t('charter')}</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-2 text-text-primary">{t('title')}</h1>
          <p className="mt-4 text-text-secondary">{t('subtitle')}</p>
          <p className="mt-3 text-xs italic text-text-secondary">{t('disclaimer')}</p>
        </header>

        <section aria-labelledby="we-promise" className="space-y-3 mb-10">
          <h2 id="we-promise" className="font-semibold text-lg text-text-primary">{t('headings.wePromise')}</h2>
          <ul className="space-y-2">
            {promises.map((line, idx) => (
              <li key={`p-${idx}`} className="flex items-start gap-3 bg-white p-3 rounded-card border border-brand-cream-dark">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-text-secondary">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="we-do-not" className="space-y-3 mb-10">
          <h2 id="we-do-not" className="font-semibold text-lg text-text-primary">{t('headings.weDoNotPromise')}</h2>
          <ul className="space-y-2">
            {nonPromises.map((line, idx) => (
              <li key={`n-${idx}`} className="flex items-start gap-3 bg-white p-3 rounded-card border border-brand-cream-dark">
                <X className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-text-secondary">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sla" className="space-y-3 mb-10">
          <h2 id="sla" className="font-semibold text-lg text-text-primary">{t('headings.slaPerTier')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {slaLines.map((s) => (
              <div key={s.tier} className="bg-white p-4 rounded-card border border-brand-cream-dark">
                <p className="font-semibold text-text-primary text-sm mb-1">{s.tier}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="dispute" className="space-y-3 mb-10">
          <h2 id="dispute" className="font-semibold text-lg text-text-primary">{t('headings.disputePlaybook')}</h2>
          <div className="space-y-3">
            {disputes.map((d) => (
              <div key={d.key} className="bg-white p-4 rounded-card border border-brand-cream-dark">
                <p className="font-semibold text-text-primary text-sm mb-1">{d.title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{d.stance}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary italic">{t('headings.contactCta')}</p>
          <a href={waHref} className="inline-block mt-2 bg-brand-red text-white px-5 py-3 rounded-button text-sm font-semibold">Chat WhatsApp</a>
        </section>
      </div>
    </main>
  );
}
