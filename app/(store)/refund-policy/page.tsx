import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { loadCmsOrNull, CmsProseSections } from '@/components/store/cms/CmsProseSections';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Kebijakan Pengembalian - Dapur Dekaka',
  description:
    'Kebijakan pengembalian dan refund produk frozen food Dapur Dekaka. Makanan frozen tidak dapat dikembalikan karena alasan keamanan pangan.',
  robots: { index: true, follow: true },
};

export default async function RefundPolicyPage() {
  const t = await getTranslations('policy');
  const cms = await loadCmsOrNull('refund');

  if (cms && cms.sections.length > 0) {
    return (
      <div className="bg-brand-cream min-h-screen pb-20 md:pb-12">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            {cms.title || t('refundTitle')}
          </h1>
          <p className="text-text-secondary text-sm mb-8">{t('refundLastUpdated')}</p>
          <div className="bg-white rounded-card shadow-card p-6 md:p-8">
            <CmsProseSections page={cms} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-cream min-h-screen pb-20 md:pb-12">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          {t('refundTitle')}
        </h1>
        <p className="text-text-secondary text-sm mb-8">{t('refundLastUpdated')}</p>
        <div className="bg-white rounded-card shadow-card p-6 md:p-8 text-text-secondary text-sm">
          <p>Konten kebijakan pengembalian sedang disiapkan.</p>
        </div>
      </div>
    </div>
  );
}
