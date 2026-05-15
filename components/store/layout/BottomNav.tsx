'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';

export function BottomNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const cartItems = useCartStore((s) => s.items);
  const totalItems = hydrated
    ? cartItems.reduce((sum, item) => sum + item.quantity, 0)
    : 0;

  const isB2bUser = session?.user?.role === 'b2b' || session?.user?.role === 'superadmin';

  const navItems = [
    { href: '/', icon: '🏠', label: t('home') },
    { href: '/products', icon: '📦', label: t('products') },
    { href: '/cart', icon: '🛒', label: t('cart'), badge: totalItems },
    ...(isB2bUser ? [{ href: '/b2b/account', icon: '🏢', label: 'B2B' }] : []),
    { href: '/account', icon: '👤', label: t('account') },
    {
      href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890'}`,
      icon: '💬',
      label: 'WA',
      external: true,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-cream-dark h-20">
      <div className="flex items-center justify-around h-full px-2">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
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