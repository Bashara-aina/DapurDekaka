import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, X } from 'lucide-react';
import { loadCmsOrNull, CmsProseSections } from '@/components/store/cms/CmsProseSections';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('promise');
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function TrustPage() {
  const cms = await loadCmsOrNull('trust');
  if (cms && cms.sections.length > 0) {
    return (
      <div className="bg-brand-cream min-h-screen pb-20 md:pb-12">
        <div className="container mx-auto px-4 py-10 max-w-3xl">
          <h1 className="font-display text-3xl font-bold mb-2">{cms.title}</h1>
          <div className="bg-white rounded-card shadow-card p-6 md:p-8 mt-6">
            <CmsProseSections page={cms} />
          </div>
        </div>
      </div>
    );
  }

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
  ];

  return (
    <div className="bg-brand-cream min-h-screen pb-20 md:pb-12">
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-10">
        <header>
          <h1 className="font-display text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-text-secondary">{t('subtitle')}</p>
        </header>

        <section className="bg-white rounded-card p-6 space-y-3">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> Janji Kami
          </h2>
          <ul className="list-disc list-inside space-y-1 text-text-secondary text-sm">
            {promises.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-card p-6 space-y-3">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <X className="w-5 h-5 text-brand-red" /> Bukan Janji Kami
          </h2>
          <ul className="list-disc list-inside space-y-1 text-text-secondary text-sm">
            {nonPromises.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-card p-6 space-y-3">
          <h2 className="font-display text-xl font-semibold">SLA Pengiriman</h2>
          <ul className="space-y-2 text-sm text-text-secondary">
            {slaLines.map((line) => (
              <li key={line.tier}>
                <strong>{line.tier}:</strong> {line.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-card p-6 space-y-3">
          <h2 className="font-display text-xl font-semibold">Dispute Playbook</h2>
          <ul className="space-y-3 text-sm text-text-secondary">
            {disputes.map((d) => (
              <li key={d.key}>
                <strong>{d.title}</strong> — {d.stance}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
