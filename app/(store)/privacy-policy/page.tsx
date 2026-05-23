import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi - Dapur Dekaka',
  description: 'Kebijakan privasi Dapur Dekaka sesuai UU Pelindungan Data Pribadi (UU PDP) No. 27 Tahun 2022. Bagaimana kami mengumpulkan, menggunakan, dan melindungi data Anda.',
  robots: {
    index: true,
    follow: true,
  },
};

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('policy');

  return (
    <div className="bg-brand-cream min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          {t('privacyTitle')}
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          {t('privacyLastUpdated')}
        </p>

        <div className="bg-white rounded-card shadow-card p-6 md:p-8 space-y-6">
          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('dataCollectedTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              {t('dataCollectedDesc')}
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li><strong>{t('dataItemName')}</strong> — {t('dataItemNameDesc')}</li>
              <li><strong>{t('dataItemEmail')}</strong> — {t('dataItemEmailDesc')}</li>
              <li><strong>{t('dataItemPhone')}</strong> — {t('dataItemPhoneDesc')}</li>
              <li><strong>{t('dataItemAddress')}</strong> — {t('dataItemAddressDesc')}</li>
              <li><strong>{t('dataItemPayment')}</strong> — {t('dataItemPaymentDesc')}</li>
              <li><strong>{t('dataItemHistory')}</strong> — {t('dataItemHistoryDesc')}</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('purposeTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              {t('purposeDesc')}
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>{t('purposeItem1')}</li>
              <li>{t('purposeItem2')}</li>
              <li>{t('purposeItem3')}</li>
              <li>{t('purposeItem4')}</li>
              <li>{t('purposeItem5')}</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('protectionTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('protectionDesc')}
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mt-2">
              <li>{t('protectionItem1')}</li>
              <li>{t('protectionItem2')}</li>
              <li>{t('protectionItem3')}</li>
              <li>{t('protectionItem4')}</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('retentionTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('retentionDesc')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('rightsTitle')}
            </h2>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>{t('rightsItem1')}</li>
              <li>{t('rightsItem2')}</li>
              <li>{t('rightsItem3')}</li>
              <li>{t('rightsItem4')}</li>
              <li>{t('rightsItem5')}</li>
              <li>{t('rightsItem6')}</li>
            </ul>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('cookiesTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('cookiesDesc')}
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mt-2">
              <li><strong>{t('cookiesFunc')}</strong> — {t('cookiesFuncDesc')}</li>
              <li><strong>{t('cookiesAnalytics')}</strong> — {t('cookiesAnalyticsDesc')}</li>
              <li><strong>{t('cookiesMarketing')}</strong> — {t('cookiesMarketingDesc')}</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-2">
              {t('cookiesDisable')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('whatsappBusinessTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('whatsappBusinessDesc')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('changesTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('changesDesc')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('contactTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('contactDesc')}
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mt-2">
              <li>
                {t('contactEmail')}<a href="mailto:privasi@dapurdekaka.com" className="text-brand-red font-medium hover:underline">{t('contactEmailLink')}</a>
              </li>
              <li>
                {t('contactWhatsApp')}{' '}
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-red font-medium hover:underline"
                >
                  {t('contactWhatsAppLink')}
                </a>
              </li>
            </ul>
            <p className="text-text-secondary text-sm mt-4">
              {t('contactAddress')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}