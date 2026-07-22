'use client';

import { Menu, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
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

interface AdminHeaderProps {
  role?: string;
}

export function AdminHeader({ role }: AdminHeaderProps) {
  const { data: session } = useSession();
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
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Buka menu"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <Breadcrumb />
        </div>

        {/* Right: search placeholder + user avatar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden md:inline">Admin</span>

          <div className="w-8 h-8 rounded-full bg-admin-sidebar text-white flex items-center justify-center text-xs font-bold select-none">
            {session?.user?.name?.[0] ?? 'U'}
          </div>
        </div>
      </header>

      {/* Mobile drawer only — desktop sidebar lives in admin layout */}
      <AdminSidebar
        role={role}
        variant="mobile"
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
}
