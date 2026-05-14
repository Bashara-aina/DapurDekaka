import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq, sql, and, inArray, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role ?? '')) {
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
          inArray(orders.status, ['pending_payment', 'paid', 'processing', 'packed', 'shipped'])
        )
      )
      .groupBy(orders.status);

    const result = {
      pending_payment: 0,
      paid: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
    };

    statusCounts.forEach(row => {
      result[row.status as keyof typeof result] = row.count;
    });

    return success(result);
  } catch (error) {
    console.error('[admin/team-dashboard/order-pipeline]', error);
    return serverError(error);
  }
}