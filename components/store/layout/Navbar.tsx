'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ShoppingCart, User, Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { useCartStore } from '@/store/cart.store';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Navbar() {
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartItems = useCartStore((s) => s.items);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/products', label: t('products') },
    { href: '/blog', label: t('blog') },
    { href: '/b2b', label: 'B2B' },
  ];

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
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-text-primary hover:text-brand-red font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/products"
              className="p-2 text-text-secondary hover:text-brand-red transition-colors"
              aria-label="Cari produk"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              href="/cart"
              className="relative p-2 text-text-secondary hover:text-brand-red transition-colors"
              aria-label="Keranjang"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-red text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
            <Link
              href="/account"
              className="p-2 text-text-secondary hover:text-brand-red transition-colors"
              aria-label="Akun"
            >
              <User className="w-5 h-5" />
            </Link>
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
            <LanguageSwitcher />
            <Link
              href="/cart"
              className="relative p-2 text-text-secondary"
              aria-label="Keranjang"
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
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-brand-cream-dark shadow-lg z-40">
            <nav className="p-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <hr className="my-2 border-brand-cream-dark" />
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors"
              >
                Akun Saya
              </Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}