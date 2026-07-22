import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users, orderItems, productVariants, products } from '@/lib/db/schema';
import { gte, sql, and, isNotNull, isNull, count } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getSnapshot = cache(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    todayRevenue,
    weekRevenue,
    todayOrders,
    weekOrders,
    activeCustomersMTD,
    newCustomersToday,
    guestCheckoutsToday,
    monthRevenue,
  ] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(and(
        gte(orders.paidAt, todayStart),
        sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
      )),
    db.select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(and(
        gte(orders.paidAt, weekStart),
        sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
      )),
    db.select({ count: count() }).from(orders).where(gte(orders.createdAt, todayStart)),
    db.select({ count: count() }).from(orders).where(gte(orders.createdAt, weekStart)),
    db.select({ count: sql<number>`count(distinct ${orders.userId})::int` })
      .from(orders)
      .where(and(gte(orders.paidAt, monthStart), isNotNull(orders.userId))),
    db.select({ count: count() }).from(users)
      .where(and(gte(users.createdAt, todayStart), isNull(users.deletedAt))),
    db.select({ count: count() }).from(orders)
      .where(and(gte(orders.createdAt, todayStart), isNull(orders.userId))),
    db.select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(and(
        gte(orders.paidAt, monthStart),
        sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
      )),
  ]);

  const revenueToday = todayRevenue[0]?.total ?? 0;
  const revenueWeekAgo = weekRevenue[0]?.total ?? 0;
  const revenueDelta = revenueWeekAgo > 0
    ? ((revenueToday - revenueWeekAgo) / revenueWeekAgo) * 100
    : 0;

  const ordersTodayCount = todayOrders[0]?.count ?? 0;
  const ordersWeekAgoCount = weekOrders[0]?.count ?? 0;
  const ordersDelta = ordersWeekAgoCount > 0
    ? ((ordersTodayCount - ordersWeekAgoCount) / ordersWeekAgoCount) * 100
    : 0;

  return {
    revenueToday,
    revenueDelta: Math.round(revenueDelta * 10) / 10,
    avgOrderValue: todayOrders[0]?.count ? Math.round(revenueToday / todayOrders[0].count) : 0,
    estimatedMargin: Math.round(revenueToday * 0.18),
    ordersToday: ordersTodayCount,
    ordersDelta: Math.round(ordersDelta * 10) / 10,
    activeCustomersMTD: activeCustomersMTD[0]?.count ?? 0,
    newCustomersToday: newCustomersToday[0]?.count ?? 0,
    guestCheckoutsToday: guestCheckoutsToday[0]?.count ?? 0,
    monthRevenue: monthRevenue[0]?.total ?? 0,
  };
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const data = await getSnapshot();
    return success(data);
  } catch (error) {
    console.error('[admin/team-dashboard/snapshot]', error);
    return serverError(error);
  }
}