import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc, count, eq, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role ?? '';
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10));
  const statusFilter = params.status ?? null;
  const searchQuery = params.search ?? null;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const whereClause = sql`
    ${statusFilter ? sql`${orders.status} = ${statusFilter}` : sql`true`}
    AND ${searchQuery ? sql`
      ${orders.orderNumber} ILIKE ${'%' + searchQuery + '%'}
      OR ${orders.recipientName} ILIKE ${'%' + searchQuery + '%'}
      OR ${orders.recipientEmail} ILIKE ${'%' + searchQuery + '%'}
    ` : sql`true`}
  `;

  const [orderRows, countResult] = await Promise.all([
    db.query.orders.findMany({
      where: whereClause,
      orderBy: [desc(orders.createdAt)],
      limit: PAGE_SIZE,
      offset,
    }),
    db
      .select({ total: count() })
      .from(orders)
      .where(whereClause),
  ]);

  const total = countResult[0]?.total ?? 0;

  const orderItems = orderRows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    recipientName: o.recipientName,
    recipientEmail: o.recipientEmail,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt.toISOString(),
    deliveryMethod: o.deliveryMethod,
  }));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pesanan</h1>
        {statusFilter && (
          <span className="text-sm text-gray-500">
            Filter: <strong>{statusFilter}</strong>{' '}
            <a href="/admin/orders" className="text-brand-red hover:underline ml-1">
              (clear)
            </a>
          </span>
        )}
      </div>

      <OrdersClient
        initialOrders={orderItems}
        userRole={userRole}
        totalPages={totalPages}
        currentPage={currentPage}
        totalOrders={Number(total)}
        pageSize={PAGE_SIZE}
        searchQuery={searchQuery}
      />
    </div>
  );
}