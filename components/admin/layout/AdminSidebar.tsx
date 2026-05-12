'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Tag, 
  MessageSquare, Image, Settings, Box, Truck, FileText, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Pesanan', icon: ShoppingCart },
  { href: '/admin/products', label: 'Produk', icon: Package },
  { href: '/admin/inventory', label: 'Inventori', icon: Box },
  { href: '/admin/shipments', label: 'Pengiriman', icon: Truck },
  { href: '/admin/customers', label: 'Pelanggan', icon: Users },
  { href: '/admin/coupons', label: 'Kupon', icon: Tag },
  { href: '/admin/blog', label: 'Blog', icon: FileText },
  { href: '/admin/carousel', label: 'Carousel', icon: Image },
  { href: '/admin/b2b-inquiries', label: 'B2B', icon: MessageSquare },
  { href: '/admin/ai-content', label: 'AI Content', icon: Bot },
  { href: '/admin/settings', label: 'Pengaturan', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-admin-sidebar min-h-screen fixed left-0 top-0">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-white">Dapur Dekaka</span>
          </Link>
          <p className="text-admin-sidebar-text text-xs mt-1">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-white/10 text-admin-sidebar-active' 
                    : 'text-admin-sidebar-text hover:bg-admin-sidebar-hover'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <Link href="/" className="text-admin-sidebar-text text-xs hover:text-white">
            ← Kembali ke Store
          </Link>
        </div>
      </aside>
    </>
  );
}
