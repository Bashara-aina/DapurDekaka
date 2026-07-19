import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, ChevronRight, ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { count, desc, eq, and } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { formatIDR } from '@/lib/utils/format-currency';
import { getTranslations } from 'next-intl/server';
import { formatWIB } from '@/lib/utils/format-date';
import { ORDER_STATUS_LABELS_SHORT, ORDER_STATUS_COLORS } from '@/lib/constants/orders';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return {
    title: t('myOrdersTitle'),
  };
}

interface OrdersPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function AccountOrdersPage({ searchParams }: OrdersPageProps) {
  const session = await auth();
  const t = await getTranslations();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { page: pageParam, status: statusParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10));
  const perPage = 10;
  const offset = (currentPage - 1) * perPage;

  const VALID_STATUSES = ['pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'] as const;
  type ValidStatus = typeof VALID_STATUSES[number];
  const validStatus = (statusParam && statusParam !== 'all' && (VALID_STATUSES as readonly string[]).includes(statusParam))
    ? statusParam as ValidStatus
    : undefined;

  const [ordersResult, totalResult] = await Promise.all([
    db.query.orders.findMany({
      where: validStatus
        ? (o, { and, eq }) => and(eq(o.userId, session.user.id!), eq(o.status, validStatus), eq(o.isB2b, false))
        : (o, { and, eq }) => and(eq(o.userId, session.user.id!), eq(o.isB2b, false)),
      with: {
        items: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      limit: perPage,
      offset,
    }),
    validStatus
      ? db.select({ total: count() }).from(orders)
        .where(and(eq(orders.userId, session.user.id!), eq(orders.status, validStatus), eq(orders.isB2b, false)))
      : db.select({ total: count() }).from(orders)
        .where(and(eq(orders.userId, session.user.id!), eq(orders.isB2b, false))),
  ]);

  const totalOrders = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(totalOrders / perPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">{t('account.orderHistory')}</h1>
        <p className="text-text-secondary text-sm mt-1">{t('account.noOrders')}</p>
      </div>

      {/* Status Filter */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
        <Link
          href="/account/orders"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            (statusParam || 'all') === 'all'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('blog.all')}
        </Link>
        <Link
          href="/account/orders?status=pending_payment"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            statusParam === 'pending_payment'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('orderStatus.pending')}
        </Link>
        <Link
          href="/account/orders?status=processing"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            statusParam === 'processing'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('orderStatus.processing_short')}
        </Link>
        <Link
          href="/account/orders?status=packed"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            statusParam === 'packed'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('orderStatus.packed_short')}
        </Link>
        <Link
          href="/account/orders?status=shipped"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            statusParam === 'shipped'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('orderStatus.shipped_short')}
        </Link>
        <Link
          href="/account/orders?status=delivered"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            statusParam === 'delivered'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('orderStatus.delivered_short')}
        </Link>
        <Link
          href="/account/orders?status=cancelled"
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            statusParam === 'cancelled'
              ? 'bg-brand-red text-white'
              : 'bg-white text-text-secondary hover:bg-brand-cream'
          }`}
        >
          {t('orderStatus.cancelled')}
        </Link>
      </div>

      {ordersResult.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-12 text-center">
          <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-text-disabled" />
          </div>
          <h2 className="font-display text-lg font-semibold text-text-primary mb-2">
            {t('account.noOrderHistory')}
          </h2>
          <p className="text-text-secondary mb-6">
            {t('account.noOrderHistoryDesc')}
          </p>
          <Link
            href="/products"
            className="inline-block h-12 px-6 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
          >
            {t('cart.startShopping')}
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
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] || ''}`}>
                        {ORDER_STATUS_LABELS_SHORT[order.status as keyof typeof ORDER_STATUS_LABELS_SHORT] || order.status}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">
                      {formatWIB(order.createdAt)}
                      {' · '}
                      {t('account.itemsCount', { count: order.items.length })}
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
                  href={`/account/orders?page=${currentPage - 1}${validStatus ? `&status=${validStatus}` : ''}`}
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
                      href={`/account/orders?page=${pageNum}${validStatus ? `&status=${validStatus}` : ''}`}
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
                  href={`/account/orders?page=${currentPage + 1}${validStatus ? `&status=${validStatus}` : ''}`}
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