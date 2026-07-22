'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Tag,
  MessageSquare, Image, Settings, Box, Truck, FileText, Bot, ClipboardList,
  BarChart3, X, Layers, Star
} from 'lucide-react';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { cn } from '@/lib/utils/cn';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

type NavSeparator = { separator: true };
type NavLinkItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
};
type NavItem = NavLinkItem | NavSeparator;

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['superadmin'] },
  { href: '/admin/team-dashboard', label: 'Tim Dashboard', icon: BarChart3, roles: ['superadmin'] },
  { href: '/admin/field', label: 'Gudang', icon: ClipboardList, roles: ['superadmin', 'owner', 'warehouse'] },
  { separator: true },
  { href: '/admin/orders', label: 'Pesanan', icon: ShoppingCart, roles: ['superadmin', 'owner', 'warehouse'] },
  { href: '/admin/products', label: 'Produk', icon: Package, roles: ['superadmin', 'owner'] },
  { href: '/admin/categories', label: 'Kategori', icon: Layers, roles: ['superadmin', 'owner'] },
  { href: '/admin/inventory', label: 'Inventori', icon: Box, roles: ['superadmin', 'owner', 'warehouse'] },
  { href: '/admin/shipments', label: 'Pengiriman', icon: Truck, roles: ['superadmin', 'owner', 'warehouse'] },
  { href: '/admin/customers', label: 'Pelanggan', icon: Users, roles: ['superadmin', 'owner'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['superadmin'] },
  { separator: true },
  { href: '/admin/coupons', label: 'Kupon', icon: Tag, roles: ['superadmin'] },
  { href: '/admin/blog', label: 'Blog', icon: FileText, roles: ['superadmin', 'owner'] },
  { href: '/admin/testimonials', label: 'Testimoni', icon: Star, roles: ['superadmin', 'owner'] },
  { href: '/admin/carousel', label: 'Carousel', icon: Image, roles: ['superadmin', 'owner'] },
  { href: '/admin/b2b-inquiries', label: 'B2B Inquiry', icon: MessageSquare, roles: ['superadmin', 'owner'] },
  { href: '/admin/b2b-quotes', label: 'B2B Quotes', icon: FileText, roles: ['superadmin', 'owner'] },
  { href: '/admin/ai-content', label: 'AI Content', icon: Bot, roles: ['superadmin'] },
  { separator: true },
  { href: '/admin/settings', label: 'Pengaturan', icon: Settings, roles: ['superadmin'] },
];

interface SidebarNavProps {
  pathname: string;
  userRole: string;
  onMobileClose?: () => void;
}

/**
 * Module-level panel so desktop + mobile each get a fresh element tree.
 * Reusing one JSX variable in two parents leaves content stuck in the off-screen mobile aside.
 */
function SidebarNav({ pathname, userRole, onMobileClose }: SidebarNavProps) {
  const visibleItems = NAV_ITEMS.filter((item) => {
    if ('separator' in item) return true;
    return item.roles.includes(userRole);
  }).filter((item) => {
    if ('separator' in item) return true;
    if (item.href === '/admin/b2b-inquiries' && !isFlagEnabled('b2bPortal')) return false;
    if (item.href === '/admin/b2b-quotes' && !isFlagEnabled('b2bPortal')) return false;
    if (item.href === '/admin/blog' && !isFlagEnabled('blogCMS')) return false;
    if (item.href === '/admin/ai-content' && !isFlagEnabled('aiContent')) return false;
    return true;
  });

  return (
    <>
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-white">Dapur Dekaka</span>
        </Link>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden p-1 text-admin-sidebar-text hover:text-white"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item, idx) => {
          if ('separator' in item) {
            return <div key={`sep-${idx}`} className="my-2 border-t border-white/10" />;
          }

          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-admin-sidebar-active'
                  : 'text-admin-sidebar-text hover:bg-admin-sidebar-hover hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 text-admin-sidebar-text text-xs hover:text-white transition-colors"
        >
          ← Kembali ke Store
        </Link>
      </div>
    </>
  );
}

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Server-known role — preferred so nav is not empty while client session loads */
  role?: string;
  /** Avoid double-mounting: layout uses desktop, header uses mobile */
  variant?: 'full' | 'desktop' | 'mobile';
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
  role,
  variant = 'full',
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = role ?? session?.user?.role ?? '';

  useEffect(() => {
    if (variant === 'desktop') return;
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen, variant]);

  const showDesktop = variant === 'full' || variant === 'desktop';
  const showMobile = variant === 'full' || variant === 'mobile';

  return (
    <>
      {showDesktop && (
        <aside className="hidden lg:flex flex-col w-60 bg-admin-sidebar min-h-screen fixed left-0 top-0 z-30">
          <SidebarNav pathname={pathname} userRole={userRole} />
        </aside>
      )}

      {showMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {showMobile && (
        <aside
          className={cn(
            'fixed left-0 top-0 h-full w-72 max-w-[85vw] bg-admin-sidebar flex flex-col z-50 transition-transform duration-300 lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarNav
            pathname={pathname}
            userRole={userRole}
            onMobileClose={onMobileClose}
          />
        </aside>
      )}
    </>
  );
}
