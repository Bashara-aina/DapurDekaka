import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function Footer() {
  const t = await getTranslations('footer');

  return (
    <footer className="bg-text-primary text-brand-cream/80 pt-12 pb-20 md:pb-12 px-4 md:px-0">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="font-display text-xl font-semibold text-brand-cream mb-4">{t('brandTitle')}</h3>
            <p className="text-sm">{t('address')}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-brand-cream mb-4">{t('menuTitle')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="hover:text-brand-cream transition-colors duration-150">{t('products')}</Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-brand-cream transition-colors duration-150">{t('blog')}</Link>
              </li>
              <li>
                <Link href="/b2b" className="hover:text-brand-cream transition-colors duration-150">{t('b2b')}</Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-brand-cream transition-colors duration-150">{t('aboutUs')}</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">{t('helpTitle')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/orders/DDK-TEST-0001" className="hover:text-brand-cream">{t('trackOrder')}</Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-brand-cream">{t('refundPolicy')}</Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-brand-cream">{t('privacyPolicy')}</Link>
              </li>
              <li>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                  className="hover:text-brand-cream"
                >
                  {t('whatsapp')}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-brand-cream mb-4">{t('followUs')}</h4>
            <div className="flex gap-4">
              <a
                href="https://instagram.com/dapurdekaka"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-cream transition-colors duration-150"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4 4 2.209 1.791 4 4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-cream transition-colors duration-150"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Payment Icons */}
        <div className="border-t border-white/10 pt-6 mb-6">
          <p className="text-xs text-brand-cream/50 mb-3">{t('paymentMethods')}</p>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Visa */}
            <div className="h-7 px-2 bg-white/10 rounded flex items-center">
              <svg className="h-4 opacity-60" viewBox="0 0 48 16" fill="white">
                <path d="M18.7 14.5h-3.5L17.3 1.5h3.5L18.7 14.5zm13.3-12.6c-.7-.3-1.7-.6-3.1-.6-3.4 0-5.8 1.8-5.8 4.4 0 1.9 1.7 3 3 3.6 1.3.6 1.8 1 1.8 1.6 0 .9-1.1 1.2-2.1 1.2-1.4 0-2.2-.2-3.3-.7l-.5-.2-.5 3c.8.4 2.3.7 3.8.7 3.6 0 6-1.8 6-4.5 0-1.5-.9-2.7-3-3.6-1.2-.6-2-1-2-1.6 0-.6.7-1.1 2.1-1.1 1.1 0 1.9.2 2.6.5l.3.1.5-2.8zm8.7-.4h-2.7c-.8 0-1.4.2-1.8 1L32.5 14.5h3.6s.6-1.6.7-2h4.4c.1.5.4 2 .4 2H45L42.7 1.5zm-4.3 8.4c.3-.7 1.3-3.6 1.3-3.6s.3-.8.5-1.3l.2 1.2 .7 3.7h-2.7zm-22.8-8.4L10 10l-.4-1.8c-.6-2-2.5-4.2-4.6-5.3l3.1 11.6h3.6L18.2 1.5H14.6z"/>
              </svg>
            </div>
            {/* Text labels for other payment methods */}
            {['GoPay', 'OVO', 'QRIS', 'BCA', 'BNI', 'Mandiri'].map(method => (
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
          <div className="flex gap-4 text-xs">
            <span>{t('priceIncludesVat')}</span>
            <span>•</span>
            <span>{t('halal')}</span>
            <span>•</span>
            <span>{t('frozenFresh')}</span>
            <span>•</span>
            <span>{t('nationwideDelivery')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
