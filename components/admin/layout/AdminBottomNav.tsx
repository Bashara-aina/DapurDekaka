'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Box, Truck, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const WAREHOUSE_TABS = [
  { href: '/admin/field', label: 'Gudang', Icon: ClipboardList },
  { href: '/admin/inventory', label: 'Inventori', Icon: Box },
  { href: '/admin/shipments', label: 'Kirim', Icon: Truck },
  { href: '/admin/orders', label: 'Pesanan', Icon: ShoppingCart },
];

export function AdminBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  if (role !== 'warehouse') return null;

  return (
    <nav
      aria-label="Navigasi gudang"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-admin-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {WAREHOUSE_TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-h-[64px] py-2 text-[11px] font-medium',
                isActive ? 'text-brand-red' : 'text-gray-500'
              )}
            >
              <Icon className="w-6 h-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
