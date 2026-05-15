'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Package, ShoppingBag, FileText, ChevronRight, Loader2, CheckCircle, Clock, MessageCircle } from 'lucide-react';
import { formatIDR } from '@/lib/utils/format-currency';

interface B2BProfile {
  id: string;
  companyName: string;
  isApproved: boolean;
  isNet30Approved: boolean;
  assignedWaContact: string | null;
}

interface PointsBalance {
  pointsBalance: number;
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid: { label: 'Lunas', className: 'bg-green-100 text-green-700' },
  pending_payment: { label: 'Menunggu Bayar', className: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Diproses', className: 'bg-blue-100 text-blue-700' },
  packed: { label: 'Dikemas', className: 'bg-indigo-100 text-indigo-700' },
  shipped: { label: 'Dikirim', className: 'bg-purple-100 text-purple-700' },
  delivered: { label: 'Selesai', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Dibatalkan', className: 'bg-red-100 text-red-700' },
};

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
  {
    href: '/b2b/products',
    label: 'Katalog B2B',
    description: 'Lihat produk dan harga khusus',
    icon: Package,
  },
];

export default function B2BAccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: b2bProfile, isLoading: profileLoading } = useQuery<B2BProfile | null>({
    queryKey: ['b2b', 'profile'],
    queryFn: async () => {
      const res = await fetch('/api/b2b/profile');
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: !!session?.user,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<OrderSummary[]>({
    queryKey: ['b2b', 'orders', 'recent'],
    queryFn: async () => {
      const res = await fetch('/api/b2b/orders?limit=3');
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!session?.user,
  });

  const { data: pointsData } = useQuery<{ pointsBalance: number }>({
    queryKey: ['b2b', 'points'],
    queryFn: async () => {
      const res = await fetch('/api/b2b/points');
      const json = await res.json();
      return json.success ? json.data : { pointsBalance: 0 };
    },
    enabled: !!session?.user,
  });

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'b2b' && session?.user?.role !== 'superadmin') {
        router.push('/b2b');
      }
    } else if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/b2b/account');
    }
  }, [status, session, router]);

  if (status === 'loading' || profileLoading) {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const pointsBalance = pointsData?.pointsBalance ?? 0;

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

      {/* B2B Profile Card */}
      {b2bProfile && (
        <div className="px-4 py-6 container mx-auto">
          <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-text-primary">
                  {b2bProfile.companyName}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {b2bProfile.isApproved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      Pending Approval
                    </span>
                  )}
                </div>
              </div>
              {b2bProfile.assignedWaContact && (
                <a
                  href={`https://wa.me/${b2bProfile.assignedWaContact.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#25D366] hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  Hubungi Kami
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Net-30 Status */}
              <div className="bg-brand-cream rounded-lg p-3">
                <p className="text-text-secondary text-xs mb-1">Pembayaran</p>
                <p className="font-medium text-sm">
                  {b2bProfile.isNet30Approved ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      Net-30 Aktif
                    </span>
                  ) : (
                    <span className="text-text-muted">Bayar di места</span>
                  )}
                </p>
              </div>

              {/* Points Balance */}
              <div className="bg-brand-cream rounded-lg p-3">
                <p className="text-text-secondary text-xs mb-1">Saldo Poin</p>
                <p className="font-bold text-brand-red">
                  {pointsBalance.toLocaleString('id-ID')} <span className="text-xs font-normal text-text-secondary">poin</span>
                </p>
                <p className="text-[10px] text-text-muted">2x earning rate aktif</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="px-4 container mx-auto space-y-4 mb-6">
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

      {/* Recent Orders */}
      {ordersLoading ? (
        <div className="px-4 container mx-auto flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-brand-red animate-spin" />
        </div>
      ) : ordersData && ordersData.length > 0 && (
        <div className="px-4 container mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm">Pesanan Terbaru</h3>
            <Link href="/b2b/account/orders" className="text-brand-red text-xs font-medium hover:underline">
              Lihat Semua
            </Link>
          </div>
          <div className="space-y-3">
            {ordersData.slice(0, 3).map((order) => {
              const statusConfig = STATUS_CONFIG[order.status] ?? { label: order.status, className: 'bg-gray-100 text-gray-700' };
              return (
                <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-text-secondary">
                        {new Date(order.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-sm font-bold text-brand-red mt-1">
                        {formatIDR(order.totalAmount)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}