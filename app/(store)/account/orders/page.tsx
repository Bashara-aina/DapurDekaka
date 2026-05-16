import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, ChevronRight, ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { count, desc, eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pesanan Saya — Dapur Dekaka',
};

interface OrdersPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'pending_payment', label: 'Menunggu Bayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'packed', label: 'Dikemas' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'delivered', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
];

export default async function AccountOrdersPage({ searchParams }: OrdersPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { page: pageParam, status: statusParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10));
  const perPage = 10;
  const offset = (currentPage - 1) * perPage;

  // Build status filter condition
  let statusFilter = undefined;
  if (statusParam && statusParam !== 'all') {
    statusFilter = statusParam;
  }

  const ordersCondition = statusFilter
    ? (o: ReturnType<typeof eq>, { and, eq }: any) => and(eq(o.userId, session.user.id!), eq(o.status, statusFilter))
    : (o: any, { eq }: any) => eq(o.userId, session.user.id!);

  const [ordersResult, totalResult] = await Promise.all([
    db.query.orders.findMany({
      where: ordersCondition,
      with: {
        items: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      limit: perPage,
      offset,
    }),
    statusFilter
      ? db.select({ total: count() }).from(orders)
        .where(and(eq(orders.userId, session.user.id!), eq(orders.status, statusFilter)))
      : db.select({ total: count() }).from(orders)
        .where(eq(orders.userId, session.user.id!)),
  ]);

  const totalOrders = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(totalOrders / perPage);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Pesanan Saya</h1>
        <p className="text-text-secondary text-sm mt-1">Lihat semua pesanan kamu</p>
      </div>

      {/* Status Filter */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={filter.key === 'all' ? '/account/orders' : `/account/orders?status=${filter.key}`}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              (statusParam || 'all') === filter.key
                ? 'bg-brand-red text-white'
                : 'bg-white text-text-secondary hover:bg-brand-cream'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {ordersResult.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-12 text-center">
          <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-text-disabled" />
          </div>
          <h2 className="font-display text-lg font-semibold text-text-primary mb-2">
            Belum Ada Pesanan
          </h2>
          <p className="text-text-secondary mb-6">
            Pesanan pertamamu akan muncul di sini
          </p>
          <Link
            href="/products"
            className="inline-block h-12 px-6 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
          >
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {ordersResult.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.orderNumber}`}
                className="block bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary truncate">{order.orderNumber}</p>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium
                        ${order.status === 'pending_payment' ? 'bg-warning-light text-warning' : ''}
                        ${order.status === 'paid' ? 'bg-info-light text-info' : ''}
                        ${order.status === 'processing' ? 'bg-purple-100 text-purple-700' : ''}
                        ${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
                        ${order.status === 'shipped' ? 'bg-success-light text-success' : ''}
                        ${order.status === 'delivered' ? 'bg-success-light text-success' : ''}
                        ${order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : ''}
                      `}>
                        {order.status === 'pending_payment' && 'Menunggu Bayar'}
                        {order.status === 'paid' && 'Dibayar'}
                        {order.status === 'processing' && 'Diproses'}
                        {order.status === 'packed' && 'Dikemas'}
                        {order.status === 'shipped' && 'Dikirim'}
                        {order.status === 'delivered' && 'Selesai'}
                        {order.status === 'cancelled' && 'Dibatalkan'}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                      {new Date(order.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {' · '}
                      {order.items.length} item
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-brand-red">{formatIDR(order.totalAmount)}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-disabled flex-shrink-0" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/account/orders?page=${currentPage - 1}${statusFilter ? `&status=${statusFilter}` : ''}`}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-brand-cream-dark hover:bg-brand-cream transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Link>
              )}

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <Link
                      key={pageNum}
                      href={`/account/orders?page=${pageNum}${statusFilter ? `&status=${statusFilter}` : ''}`}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors
                        ${pageNum === currentPage
                          ? 'bg-brand-red text-white'
                          : 'border border-brand-cream-dark hover:bg-brand-cream'
                        }
                      `}
                    >
                      {pageNum}
                    </Link>
                  );
                })}
              </div>

              {currentPage < totalPages && (
                <Link
                  href={`/account/orders?page=${currentPage + 1}${statusFilter ? `&status=${statusFilter}` : ''}`}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-brand-cream-dark hover:bg-brand-cream transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}