'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';
import { Home, Package, ShoppingCart, User, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
    { href: '/', Icon: Home, label: t('home') },
    { href: '/products', Icon: Package, label: t('products') },
    { href: '/blog', Icon: FileText, label: 'Blog' },
    { href: '/cart', Icon: ShoppingCart, label: t('cart'), badge: totalItems },
    ...(isB2bUser ? [{ href: '/b2b/account', Icon: Package, label: 'B2B' }] : []),
    { href: '/account', Icon: User, label: t('account') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-cream-dark h-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around h-full px-2">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          const content = (
            <>
              <item.Icon
                className={cn(
                  'w-6 h-6 transition-colors',
                  isActive ? 'text-brand-red' : 'text-text-secondary'
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-brand-red' : 'text-text-secondary'
                }`}
              >
                {item.label}
              </span>
            </>
          );

          return (
            <Link
              key={index}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 ${
                isActive ? 'text-brand-red' : 'text-text-secondary'
              }`}
            >
              {content}
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-2 w-5 h-5 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}