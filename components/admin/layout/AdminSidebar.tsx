'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag,
  MessageSquare, Image, Settings, Box, Truck, FileText, Bot, ClipboardList,
  BarChart3, X, Layers, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin'] },
  { href: '/admin/team-dashboard', label: 'Tim Dashboard', icon: BarChart3, roles: ['superadmin', 'owner'] },
  { href: '/admin/field', label: 'Gudang', icon: ClipboardList, roles: ['superadmin', 'owner', 'warehouse'] },
  { separator: true },
  { href: '/admin/orders', label: 'Pesanan', icon: ShoppingCart },
  { href: '/admin/products', label: 'Produk', icon: Package },
  { href: '/admin/categories', label: 'Kategori', icon: Layers },
  { href: '/admin/inventory', label: 'Inventori', icon: Box },
  { href: '/admin/shipments', label: 'Pengiriman', icon: Truck },
  { href: '/admin/customers', label: 'Pelanggan', icon: Users },
  { separator: true },
  { href: '/admin/coupons', label: 'Kupon', icon: Tag },
  { href: '/admin/blog', label: 'Blog', icon: FileText },
  { href: '/admin/testimonials', label: 'Testimoni', icon: Star },
  { href: '/admin/carousel', label: 'Carousel', icon: Image },
  { href: '/admin/b2b-inquiries', label: 'B2B', icon: MessageSquare },
  { href: '/admin/ai-content', label: 'AI Content', icon: Bot },
  { separator: true },
  { href: '/admin/settings', label: 'Pengaturan', icon: Settings },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-white">Dapur Dekaka</span>
        </Link>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 text-admin-sidebar-text hover:text-white"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item, idx) => {
          if ('separator' in item && item.separator) {
            return <div key={`sep-${idx}`} className="my-2 border-t border-white/10" />;
          }

          const navItem = item as { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
          const Icon = navItem.icon;
          const isActive = pathname === navItem.href || pathname.startsWith(`${navItem.href}/`);

          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-admin-sidebar-active'
                  : 'text-admin-sidebar-text hover:bg-admin-sidebar-hover hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {navItem.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <Link href="/" className="flex items-center gap-2 text-admin-sidebar-text text-xs hover:text-white transition-colors">
          ← Kembali ke Store
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar — fixed */}
      <aside className="hidden lg:flex flex-col w-60 bg-admin-sidebar min-h-screen fixed left-0 top-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar — slides in from left */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-72 max-w-[85vw] bg-admin-sidebar flex flex-col z-50 transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
