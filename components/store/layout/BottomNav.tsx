'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/store/cart.store';

export function BottomNav() {
  const t = useTranslations('nav');
  const cartItems = useCartStore((s) => s.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const navItems = [
    { href: '/', icon: '🏠', label: t('home') },
    { href: '/products', icon: '📦', label: t('products') },
    { href: '/cart', icon: '🛒', label: t('cart'), badge: totalItems },
    { href: '/account', icon: '👤', label: t('account') },
    {
      href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
      icon: '💬',
      label: 'WA',
      external: true,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-cream-dark h-20">
      <div className="flex items-center justify-around h-full px-2">
        {navItems.map((item, index) => {
          const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;
          const content = (
            <>
              <span className="text-2xl relative">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-5 h-5 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-brand-red' : 'text-text-secondary'
                }`}
              >
                {item.label}
              </span>
            </>
          );

          if (item.external) {
            return (
              <a
                key={index}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-0.5 py-2 px-3 text-text-secondary"
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={index}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 ${
                isActive ? 'text-brand-red' : 'text-text-secondary'
              }`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}