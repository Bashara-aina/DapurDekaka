import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users, systemSettings } from '@/lib/db/schema';
import { eq, gte, sql, and, lt, isNull } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

const getKpis = cache(async (fromDate?: Date, toDate?: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const from = fromDate ?? today;
  const to = toDate ?? today;

  const lastWeekStart = new Date(from);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(from);
  lastWeekEnd.setTime(lastWeekEnd.getTime() - 1);

  // Get estimated margin percentage from systemSettings (default to 18)
  let marginPercent = 18;
  try {
    const marginSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'ESTIMATED_MARGIN_PERCENT'),
      columns: { value: true },
    });
    if (marginSetting && marginSetting.value) {
      const parsed = parseFloat(marginSetting.value);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
        marginPercent = parsed;
      }
    }
  } catch {
    // Use default 18%
  }

  const [todayRevenueResult, lastWeekRevenueResult, ordersTodayResult, ordersLastWeekResult, newCustomersResult, guestCheckoutsResult] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, from),
          lt(orders.paidAt, new Date(to.getTime() + 86400000)),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastWeekStart),
          lt(orders.paidAt, lastWeekEnd),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(gte(orders.createdAt, from), lt(orders.createdAt, new Date(to.getTime() + 86400000)))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, lastWeekStart),
          lt(orders.createdAt, lastWeekEnd)
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.role, 'customer'),
          gte(users.createdAt, from),
          lt(users.createdAt, new Date(to.getTime() + 86400000))
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, from),
          lt(orders.createdAt, new Date(to.getTime() + 86400000)),
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
    estimatedMargin: Math.round(todayTotal * (marginPercent / 100)),
    marginPercent,
  };
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') {
      return forbidden();
    }

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (fromParam) {
      const parsed = new Date(fromParam);
      if (!isNaN(parsed.getTime())) {
        fromDate = parsed;
      }
    }
    if (toParam) {
      const parsed = new Date(toParam);
      if (!isNaN(parsed.getTime())) {
        toDate = parsed;
      }
    }

    const kpis = await getKpis(fromDate, toDate);
    return success(kpis);
  } catch (error) {
    console.error('[admin/dashboard/kpis]', error);
    return serverError(error);
  }
}