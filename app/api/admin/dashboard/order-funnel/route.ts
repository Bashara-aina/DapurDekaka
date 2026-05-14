import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

const ALL_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

type OrderStatus = typeof ALL_STATUSES[number];

const getOrderFunnel = cache(async () => {
  const statusCounts = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(inArray(orders.status, [...ALL_STATUSES]))
    .groupBy(orders.status);

  const result = {
  pending_payment: 0,
  paid: 0,
  processing: 0,
  packed: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
  refunded: 0,
};

for (const row of statusCounts) {
  const status = row.status as OrderStatus;
  result[status] = row.count;
}

return result;
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') {
      return forbidden();
    }

    const funnel = await getOrderFunnel();

    const total = Object.values(funnel).reduce((sum, count) => sum + count, 0);
    const activeTotal = funnel.pending_payment + funnel.paid + funnel.processing + funnel.packed + funnel.shipped;

    return success({
      counts: funnel,
      total,
      activeTotal,
      completedTotal: funnel.delivered + funnel.cancelled + funnel.refunded,
    });
  } catch (error) {
    console.error('[admin/dashboard/order-funnel]', error);
    return serverError(error);
  }
}