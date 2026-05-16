'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ShoppingBag, ChevronRight, Loader2 } from 'lucide-react';

export default function B2BAccountOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['b2b', 'orders'],
    queryFn: async () => {
      const res = await fetch('/api/b2b/orders');
      const json = await res.json();
      return json.success ? json.data : [];
    },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/b2b/account/orders');
    }
  }, [status, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-red animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-xl font-bold">Riwayat Pesanan B2B</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 container mx-auto">
        {ordersData && ordersData.length > 0 ? (
          <div className="space-y-4">
            {ordersData.map((order: { id: string; orderNumber: string; status: string; totalAmount: number; createdAt: string }) => (
              <Link
                key={order.id}
                href={`/b2b/account/orders/${order.orderNumber}`}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(order.createdAt).toLocaleDateString('id-ID')}
                    </p>
                    <p className="text-sm font-medium text-brand-red mt-1">
                      Rp {order.totalAmount.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      order.status === 'paid' ? 'bg-green-100 text-green-700' :
                      order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'packed' ? 'bg-purple-100 text-purple-700' :
                      order.status === 'shipped' ? 'bg-indigo-100 text-indigo-700' :
                      order.status === 'delivered' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status === 'paid' ? 'Lunas' :
                       order.status === 'pending_payment' ? 'Menunggu Bayar' :
                       order.status === 'processing' ? 'Diproses' :
                       order.status === 'packed' ? 'Dikemas' :
                       order.status === 'shipped' ? 'Dikirim' :
                       order.status === 'delivered' ? 'Selesai' :
                       order.status === 'cancelled' ? 'Dibatalkan' :
                       order.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-text-muted" />
            </div>
            <h2 className="font-display text-lg font-semibold mb-2">
              Belum Ada Pesanan
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Pesanan B2B Anda akan muncul di sini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}