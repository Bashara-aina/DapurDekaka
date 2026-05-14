import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { sql, and, inArray, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin') {
      return forbidden();
    }

    const statusCounts = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.status, ['pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'])
        )
      )
      .groupBy(orders.status);

    const result = {
      pending_payment: 0,
      paid: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    statusCounts.forEach(row => {
      if (row.status in result) {
        result[row.status as keyof typeof result] = row.count;
      }
    });

    return success(result);
  } catch (error) {
    console.error('[admin/dashboard/order-funnel]', error);
    return serverError(error);
  }
}