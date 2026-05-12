'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Package, ShoppingBag, FileText, ChevronRight } from 'lucide-react';

const MENU_ITEMS = [
  {
    href: '/b2b/account/orders',
    label: 'Riwayat Pesanan',
    description: 'Lihat semua pesanan B2B Anda',
    icon: ShoppingBag,
  },
  {
    href: '/b2b/account/quotes',
    label: 'Quotes',
    description: 'Daftar penawaran yang diterima',
    icon: FileText,
  },
];

export default function B2BAccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/b2b/account');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-xl font-bold">Akun B2B</h1>
          <p className="text-text-secondary text-sm mt-1">
            {session.user.name || session.user.email}
          </p>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 py-6 container mx-auto space-y-4">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-brand-red/10 rounded-lg flex items-center justify-center">
                <Icon className="w-6 h-6 text-brand-red" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{item.label}</h3>
                <p className="text-text-secondary text-sm">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}