import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Kebijakan Pengembalian - Dapur Dekaka',
  description: 'Kebijakan pengembalian dan refund produk frozen food Dapur Dekaka. Makanan frozen tidak dapat dikembalikan karena alasan keamanan pangan.',
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RefundPolicyPage() {
  const t = await getTranslations('policy');

  return (
    <div className="bg-brand-cream min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          {t('refundTitle')}
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          {t('refundLastUpdated')}
        </p>

        <div className="bg-white rounded-card shadow-card p-6 md:p-8 space-y-6">
          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('noRefundTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('noRefundDesc')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('claimableTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              {t('claimableDesc')}
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>{t('claimableItem1')}</li>
              <li>{t('claimableItem2')}</li>
              <li>{t('claimableItem3')}</li>
            </ul>
            <p className="text-text-secondary leading-relaxed mt-4">
              {t('claimablePhoto')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('howToClaimTitle')}
            </h2>
            <ol className="list-decimal list-inside text-text-secondary space-y-2">
              <li>
                {t('howToClaimStep1')}
              </li>
              <li>
                {t('howToClaimStep2')}
              </li>
              <li>
                {t('howToClaimStep3')}
              </li>
              <li>
                {t('howToClaimStep4')}
              </li>
            </ol>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('refundTimelineTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('refundTimelineDesc')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('wrongAddressTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('wrongAddressDesc')}
            </p>
          </section>

          <hr className="border-brand-cream-dark" />

          <section>
            <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
              {t('contactTitle')}
            </h2>
            <p className="text-text-secondary leading-relaxed">
              {t('contactDesc')}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-red font-medium hover:underline"
              >
                {t('contactWhatsAppLink')}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}