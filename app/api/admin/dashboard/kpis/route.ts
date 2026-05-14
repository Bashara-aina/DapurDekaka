import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users, orderItems } from '@/lib/db/schema';
import { eq, gte, sql, and, lt, isNull } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

const getKpis = cache(async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const [todayRevenueResult, lastWeekRevenueResult, ordersTodayResult, ordersLastWeekResult, newCustomersResult, guestCheckoutsResult] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, today),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastWeek),
          lt(orders.paidAt, today),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.createdAt, today)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, lastWeek),
          lt(orders.createdAt, today)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.role, 'customer'),
          gte(users.createdAt, today)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, today),
          isNull(orders.userId)
        )
      ),
  ]);

  const todayTotal = todayRevenueResult[0]?.total ?? 0;
  const lastWeekTotal = lastWeekRevenueResult[0]?.total ?? 0;
  const revenueDelta = lastWeekTotal > 0
    ? parseFloat((((todayTotal - lastWeekTotal) / lastWeekTotal) * 100).toFixed(1))
    : 0;

  const todayCount = ordersTodayResult[0]?.count ?? 0;
  const lastWeekCount = ordersLastWeekResult[0]?.count ?? 0;
  const ordersDelta = lastWeekCount > 0
    ? parseFloat((((todayCount - lastWeekCount) / lastWeekCount) * 100).toFixed(1))
    : 0;

  const newCustomersToday = newCustomersResult[0]?.count ?? 0;
  const guestCheckoutsToday = guestCheckoutsResult[0]?.count ?? 0;
  const averageOrderValue = todayCount > 0 ? Math.round(todayTotal / todayCount) : 0;

  return {
    revenueToday: todayTotal,
    revenueDelta,
    ordersToday: todayCount,
    ordersDelta,
    newCustomersToday,
    guestCheckoutsToday,
    averageOrderValue,
    estimatedMargin: Math.round(todayTotal * 0.18),
  };
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

    const kpis = await getKpis();
    return success(kpis);
  } catch (error) {
    console.error('[admin/dashboard/kpis]', error);
    return serverError(error);
  }
}