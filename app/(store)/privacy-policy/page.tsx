import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { loadCmsOrNull, CmsProseSections } from '@/components/store/cms/CmsProseSections';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Kebijakan Privasi - Dapur Dekaka',
  description:
    'Kebijakan privasi Dapur Dekaka sesuai UU Pelindungan Data Pribadi (UU PDP) No. 27 Tahun 2022.',
  robots: { index: true, follow: true },
};

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('policy');
  const cms = await loadCmsOrNull('privacy');

  if (cms && cms.sections.length > 0) {
    return (
      <div className="bg-brand-cream min-h-screen pb-20 md:pb-12">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            {cms.title || t('privacyTitle')}
          </h1>
          <p className="text-text-secondary text-sm mb-8">{t('privacyLastUpdated')}</p>
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
          {t('privacyTitle')}
        </h1>
        <p className="text-text-secondary text-sm mb-8">{t('privacyLastUpdated')}</p>
        <div className="bg-white rounded-card shadow-card p-6 md:p-8 text-text-secondary text-sm">
          <p>Konten kebijakan privasi sedang disiapkan.</p>
        </div>
      </div>
    </div>
  );
}
