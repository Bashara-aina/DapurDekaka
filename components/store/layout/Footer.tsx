import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getStoreContactSettings } from '@/lib/settings/runtime-rules';

export default async function Footer() {
  const t = await getTranslations('footer');
  const contact = await getStoreContactSettings().catch(() => ({
    whatsapp: '',
    address: '',
    instagramUrl: '',
    openingHours: '',
  }));

  const address = contact.address || '';
  const waNumber = contact.whatsapp;
  const igUrl = contact.instagramUrl;

  return (
    <footer className="bg-text-primary text-brand-cream/80 pt-12 pb-20 md:pb-12 px-4 md:px-0">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-display text-xl font-semibold text-brand-cream mb-4">
              {t('brandTitle')}
            </h3>
            {address ? <p className="text-sm">{address}</p> : null}
            {contact.openingHours ? (
              <p className="text-sm mt-2 text-brand-cream/60">{contact.openingHours}</p>
            ) : null}
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">{t('menuTitle')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/products"
                  className="hover:text-brand-cream transition-colors duration-150"
                >
                  {t('products')}
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="hover:text-brand-cream transition-colors duration-150"
                >
                  {t('blog')}
                </Link>
              </li>
              <li>
                <Link
                  href="/b2b"
                  className="hover:text-brand-cream transition-colors duration-150"
                >
                  {t('b2b')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-brand-cream transition-colors duration-150"
                >
                  {t('aboutUs')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">{t('helpTitle')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={waNumber ? `https://wa.me/${waNumber}` : '#'}
                  className="hover:text-brand-cream"
                >
                  {t('whatsapp')}
                </a>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-brand-cream">
                  {t('privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-brand-cream">
                  {t('refundPolicy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-cream">
                  {t('terms')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">{t('followUs')}</h4>
            <div className="flex gap-2">
              <a
                href={igUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-brand-cream transition-colors duration-150"
                aria-label="Instagram Dapur Dekaka"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4 4 2.209 1.791 4 4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href={waNumber ? `https://wa.me/${waNumber}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-brand-cream transition-colors duration-150"
                aria-label="WhatsApp Dapur Dekaka"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 mb-6">
          <p className="text-xs text-brand-cream/50 mb-3">{t('paymentMethods')}</p>
          <div className="flex flex-wrap gap-3 items-center">
            {['GoPay', 'OVO', 'QRIS', 'BCA', 'BNI', 'Mandiri'].map((method) => (
              <div key={method} className="h-7 px-2.5 bg-white/10 rounded flex items-center">
                <span className="text-[10px] font-bold text-brand-cream/60 tracking-wider">
                  {method}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm">{t('copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
