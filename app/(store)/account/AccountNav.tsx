'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Package,
  MapPin,
  Gift,
  User,
  LogOut,
  Ticket,
} from 'lucide-react';

const rawNavItems = [
  { href: '/account', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/account/orders', labelKey: 'orders', icon: Package },
  { href: '/account/addresses', labelKey: 'addresses', icon: MapPin },
  { href: '/account/points', labelKey: 'points', icon: Gift },
  { href: '/account/vouchers', labelKey: 'vouchers', icon: Ticket },
  { href: '/account/profile', labelKey: 'profile', icon: User },
];

const navItems = rawNavItems.filter(
  (item) => item.href !== '/account/vouchers' || isFlagEnabled('vouchersPage')
);

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/account' && pathname.startsWith(href));
}

/**
 * Client-only account navigation (sidebar + mobile bar + sign-out).
 * Split out of the route layout so the layout itself stays a Server
 * Component and account pages can progressively move back to RSC.
 */
export function AccountNav() {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const t = useTranslations('account');

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut({ callbackUrl: '/' });
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <nav className="bg-white rounded-card shadow-card p-4 sticky top-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  isActive(pathname, item.href)
                    ? 'bg-brand-red text-white'
                    : 'text-text-secondary hover:bg-brand-cream hover:text-text-primary'
                )}
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey)}
              </Link>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-brand-cream-dark">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-brand-cream hover:text-text-primary transition-colors w-full disabled:opacity-50"
            >
              <LogOut className="w-5 h-5" />
              {isSigningOut ? t('signingOut') : t('signOut')}
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile Account Nav */}
      <div className="md:hidden bg-white border-b border-brand-cream-dark sticky top-16 z-10 -mx-4 px-4">
        <div className="flex overflow-x-auto scrollbar-hide py-2 gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                isActive(pathname, item.href)
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-cream text-text-secondary'
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
