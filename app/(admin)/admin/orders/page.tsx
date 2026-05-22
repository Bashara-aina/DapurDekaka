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

  if (!session?.user || !['superadmin', 'owner'].includes(userRole)) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10));
  const statusFilter = params.status ?? 'active';
  const searchQuery = params.search ?? null;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const statusCondition = statusFilter === 'active'
    ? sql`${orders.status} NOT IN ('delivered', 'cancelled')`
    : statusFilter
      ? sql`${orders.status} = ${statusFilter}`
      : sql`true`;

  const whereClause = sql`
    ${statusCondition}
    AND (${searchQuery ? sql`(
      ${orders.orderNumber} ILIKE ${'%' + searchQuery + '%'}
      OR ${orders.recipientName} ILIKE ${'%' + searchQuery + '%'}
      OR ${orders.recipientEmail} ILIKE ${'%' + searchQuery + '%'}
    )` : sql`true`})
  `;

  const [orderRows, countResult] = await Promise.all([
    db.query.orders.findMany({
      where: whereClause,
      orderBy: [desc(orders.createdAt)],
      limit: PAGE_SIZE,
      offset,
      with: { items: true },
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
    items: o.items?.map(item => ({
      id: item.id,
      productNameId: item.productNameId,
      variantNameId: item.variantNameId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })) ?? [],
  }));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <OrdersClient
      initialOrders={orderItems}
      userRole={userRole}
      totalPages={totalPages}
      currentPage={currentPage}
      totalOrders={Number(total)}
      pageSize={PAGE_SIZE}
      searchQuery={searchQuery}
    />
  );
}