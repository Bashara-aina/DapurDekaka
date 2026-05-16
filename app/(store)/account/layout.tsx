'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Package,
  MapPin,
  Gift,
  User,
  LogOut,
} from 'lucide-react';

interface AccountLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard },
  { href: '/account/orders', label: 'Pesanan', icon: Package },
  { href: '/account/addresses', label: 'Alamat', icon: MapPin },
  { href: '/account/points', label: 'Poin', icon: Gift },
  { href: '/account/profile', label: 'Profil', icon: User },
];

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <nav className="bg-white rounded-card shadow-card p-4 sticky top-4">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/account' && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-red text-white'
                          : 'text-text-secondary hover:bg-brand-cream hover:text-text-primary'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-brand-cream-dark">
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-brand-cream hover:text-text-primary transition-colors w-full disabled:opacity-50"
                >
                  <LogOut className="w-5 h-5" />
                  {isSigningOut ? 'Memproses...' : 'Keluar'}
                </button>
              </div>
            </nav>
          </aside>

          {/* Mobile Account Nav */}
          <div className="md:hidden bg-white border-b border-brand-cream-dark sticky top-16 z-10 -mx-4 px-4">
            <div className="flex overflow-x-auto scrollbar-hide py-2 gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/account' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-brand-red text-white'
                        : 'bg-brand-cream text-text-secondary'
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}