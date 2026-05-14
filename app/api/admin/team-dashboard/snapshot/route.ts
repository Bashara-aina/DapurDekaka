import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users } from '@/lib/db/schema';
import { eq, gte, sql, and, lt, or, isNull, isNotNull } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

const PAID_STATUSES = ['paid', 'processing', 'packed', 'shipped', 'delivered'] as const;

function buildPaidFilter(startDate: Date) {
  const statusConditions = PAID_STATUSES.map(status => eq(orders.status, status));
  const combinedStatus = statusConditions.length === 1
    ? statusConditions[0]
    : or(...statusConditions);
  return and(
    gte(orders.paidAt, startDate),
    combinedStatus
  );
}

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayOrders = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.createdAt, today));

    const todayPaidOrders = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total_amount), 0)::int`,
      })
      .from(orders)
      .where(buildPaidFilter(today));

    const lastWeekTodayOrders = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, lastWeek),
          lt(orders.createdAt, today)
        )
      );

    const lastWeekTodayPaidOrders = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total_amount), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastWeek),
          lt(orders.paidAt, today),
          buildPaidFilter(lastWeek)
        )
      );

    const activeCustomersMTD = await db
      .select({ count: sql<number>`count(DISTINCT user_id)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, new Date(today.getFullYear(), today.getMonth(), 1)),
          buildPaidFilter(new Date(today.getFullYear(), today.getMonth(), 1)),
          isNotNull(orders.userId)
        )
      );

    const newCustomersToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.role, 'customer'),
          gte(users.createdAt, today)
        )
      );

    const guestCheckoutsToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, today),
          isNull(orders.userId)
        )
      );

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

    const monthRevenue = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(buildPaidFilter(firstDayOfMonth));

    const lastMonthRevenue = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, new Date(currentYear, currentMonth - 1, 1)),
          lt(orders.paidAt, firstDayOfMonth),
          buildPaidFilter(new Date(currentYear, currentMonth - 1, 1))
        )
      );

    const todayRevenue = todayPaidOrders[0]?.total ?? 0;
    const lastWeekRevenue = lastWeekTodayPaidOrders[0]?.total ?? 0;
    const revenueDelta = lastWeekRevenue > 0
      ? ((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
      : 0;

    const todayCount = todayOrders[0]?.count ?? 0;
    const lastWeekCount = lastWeekTodayOrders[0]?.count ?? 0;
    const countDelta = lastWeekCount > 0
      ? ((todayCount - lastWeekCount) / lastWeekCount) * 100
      : 0;

    const paidCount = todayPaidOrders[0]?.count ?? 0;
    const avgOrderValue = paidCount > 0
      ? Math.round(todayRevenue / paidCount)
      : 0;

    const estimatedMargin = Math.round(todayRevenue * 0.18);

    return success({
      revenueToday: todayRevenue,
      revenueDelta,
      avgOrderValue,
      estimatedMargin,
      ordersToday: todayCount,
      ordersDelta: countDelta,
      statusBreakdown: {
        pendingPayment: todayOrders[0]?.count ?? 0,
        paid: 0,
        processing: 0,
        packed: 0,
        shipped: 0,
      },
      activeCustomersMTD: activeCustomersMTD[0]?.count ?? 0,
      newCustomersToday: newCustomersToday[0]?.count ?? 0,
      guestCheckoutsToday: guestCheckoutsToday[0]?.count ?? 0,
      monthRevenue: monthRevenue[0]?.total ?? 0,
      lastMonthRevenue: lastMonthRevenue[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('[admin/team-dashboard/snapshot]', error);
    return serverError(error);
  }
}