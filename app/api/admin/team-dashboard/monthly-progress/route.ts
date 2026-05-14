import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, systemSettings } from '@/lib/db/schema';
import { eq, gte, sql, and, lt } from 'drizzle-orm';
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

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = today.getDate();

    const monthlyTargetSetting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'monthly_revenue_target'),
    });

    const monthlyTarget = monthlyTargetSetting 
      ? parseInt(monthlyTargetSetting.value, 10) 
      : 50000000;

    const monthRevenue = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, firstDayOfMonth),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const currentRevenue = monthRevenue[0]?.total ?? 0;
    const progress = monthlyTarget > 0 ? Math.round((currentRevenue / monthlyTarget) * 100) : 0;
    const pace = daysElapsed > 0 ? Math.round(currentRevenue / daysElapsed) : 0;
    const projectedRevenue = pace * daysInMonth;

    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0);

    const lastMonthRevenue = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastMonthStart),
          lt(orders.paidAt, lastMonthEnd),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const lastMonthOrders = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastMonthStart),
          lt(orders.paidAt, lastMonthEnd),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const lastMonthCustomers = await db
      .select({ count: sql<number>`count(DISTINCT user_id)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastMonthStart),
          lt(orders.paidAt, lastMonthEnd),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    return success({
      monthlyTarget,
      currentRevenue,
      progress,
      daysElapsed,
      daysInMonth,
      pace,
      projectedRevenue,
      isOnTrack: progress >= 80 ? 'on_track' : progress >= 50 ? 'below' : 'needs_attention',
      monthHistory: {
        current: { revenue: currentRevenue, orders: 0, avgOrderValue: 0, newCustomers: 0 },
        lastMonth: { 
          revenue: lastMonthRevenue[0]?.total ?? 0, 
          orders: lastMonthOrders[0]?.count ?? 0,
          avgOrderValue: 0,
          newCustomers: lastMonthCustomers[0]?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('[admin/team-dashboard/monthly-progress]', error);
    return serverError(error);
  }
}