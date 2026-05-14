'use client';

import { Menu, Bell, Search, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AdminSidebar } from './AdminSidebar';

const BREADCRUMB_MAP: Record<string, string> = {
  'admin': 'Admin',
  'dashboard': 'Dashboard',
  'team-dashboard': 'Tim Dashboard',
  'field': 'Gudang',
  'orders': 'Pesanan',
  'products': 'Produk',
  'inventory': 'Inventori',
  'shipments': 'Pengiriman',
  'customers': 'Pelanggan',
  'coupons': 'Kupon',
  'blog': 'Blog',
  'carousel': 'Carousel',
  'b2b-inquiries': 'B2B Inquiries',
  'b2b-quotes': 'B2B Quotes',
  'ai-content': 'AI Content',
  'settings': 'Pengaturan',
  'users': 'Pengguna',
  'new': 'Baru',
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/');
    const label = BREADCRUMB_MAP[seg] ?? seg;
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm text-gray-400">
      {crumbs.map((crumb, idx) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="w-3 h-3" />}
          {crumb.isLast ? (
            <span className="text-gray-700 font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-gray-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AdminHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="h-14 bg-white border-b border-admin-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
        {/* Left: hamburger + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Buka menu"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <Breadcrumb />
        </div>

        {/* Right: search + bell */}
        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            aria-label="Cari"
            title="Cari (segera hadir)"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            aria-label="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {/* Unread badge — placeholder */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-red rounded-full" />
          </button>

          {/* User avatar placeholder */}
          <div className="w-8 h-8 rounded-full bg-admin-sidebar text-white flex items-center justify-center text-xs font-bold select-none">
            B
          </div>
        </div>
      </header>

      {/* Mobile sidebar — rendered here so it overlays content */}
      <AdminSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
}
