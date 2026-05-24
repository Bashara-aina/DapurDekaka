'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, User, Search, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { useCartStore } from '@/store/cart.store';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = (t: (key: string) => string) => [
  { href: '/', label: t('nav.home') },
  { href: '/products', label: t('nav.products') },
  { href: '/blog', label: t('nav.blog') },
  { href: '/b2b', label: t('nav.b2b') },
];

export function Navbar() {
  const t = useTranslations();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const cartItems = useCartStore((s) => s.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const navLinks = NAV_LINKS(t);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut({ callbackUrl: '/' });
  };

  return (
    <>
      {/* Desktop Navbar */}
      <header className="hidden md:block sticky top-0 z-50 bg-white border-b border-brand-cream-dark">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/assets/logo/logo.png" alt="Dapur Dekaka" width={40} height={40} />
            <span className="font-display text-xl font-semibold text-brand-red">Dapur Dekaka</span>
          </Link>

          {/* Nav Links */}
          <nav className="flex items-center gap-8">
            {navLinks.map((link) => {
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'font-medium transition-colors relative pb-0.5',
                  isActive
                    ? 'text-brand-red after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-red after:rounded-full'
                    : 'text-text-primary hover:text-brand-red'
                )}
              >
                {link.label}
              </Link>
            );
          })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* <LanguageSwitcher /> */}
            <Link
              href="/products"
              className="p-2 text-text-secondary hover:text-brand-red transition-colors"
              aria-label={t('navbar.search')}
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              href="/cart"
              className="relative p-2 text-text-secondary hover:text-brand-red transition-colors"
              aria-label={t('navbar.cart')}
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-red text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
            {session?.user ? (
              <Link
                href="/account"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-cream hover:bg-brand-cream-dark transition-colors"
                aria-label={t('navbar.account')}
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? 'User'}
                    width={28}
                    height={28}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {((session.user.name ?? session.user.email ?? 'U')[0] ?? 'U').toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-text-primary hidden lg:block">
                  {session.user.name?.split(' ')[0] ?? 'Akun'}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors"
              >
                <User className="w-4 h-4" />
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b border-brand-cream-dark">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/assets/logo/logo.png" alt="Dapur Dekaka" width={32} height={32} />
            <span className="font-display text-lg font-semibold text-brand-red">Dapur Dekaka</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* <LanguageSwitcher /> */}
            <Link
              href="/cart"
              className="relative p-2 text-text-secondary"
              aria-label={t('navbar.cart')}
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-text-secondary"
              aria-label={t('navbar.menu')}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 z-30"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            {/* Menu */}
            <div className="absolute top-14 left-0 right-0 bg-white border-b border-brand-cream-dark shadow-lg z-40 animate-slide-up">
              <nav className="p-4 space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center"
                  >
                    {link.label}
                  </Link>
                ))}
                <hr className="my-2 border-brand-cream-dark" />
                {session?.user ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center"
                    >
                      {t('nav.accountMy')}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left py-3 px-4 text-error hover:bg-error-light rounded-lg transition-colors min-h-[44px] flex items-center"
                    >
                      {t('nav.logout')}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center"
                  >
                    {t('nav.login')}
                  </Link>
                )}
              </nav>
            </div>
          </>
        )}
      </header>
    </>
  );
}