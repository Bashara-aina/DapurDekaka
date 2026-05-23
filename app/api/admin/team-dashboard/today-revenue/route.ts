import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, lt, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const result = await db.select({
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, todayStart),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const todayRevenue = result[0]?.total ?? 0;
    const todayOrders = result[0]?.count ?? 0;

    // Get week-ago revenue for delta
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekResult = await db.select({
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
    })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, weekAgo),
          lt(orders.paidAt, todayStart),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const weekRevenue = weekResult[0]?.total ?? 0;
    const revenueDelta = weekRevenue > 0
      ? Math.round(((todayRevenue - weekRevenue) / weekRevenue) * 1000) / 10
      : 0;

    return success({
      revenue: todayRevenue,
      orders: todayOrders,
      delta: revenueDelta,
    });
  } catch (error) {
    console.error('[admin/team-dashboard/today-revenue]', error);
    return serverError(error);
  }
}