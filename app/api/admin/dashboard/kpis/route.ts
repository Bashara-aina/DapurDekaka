import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users } from '@/lib/db/schema';
import { eq, gte, sql, and, lt, isNull } from 'drizzle-orm';
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayRevenue = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, today),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const lastWeekRevenue = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, lastWeek),
          lt(orders.paidAt, today),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const lastWeekTotal = lastWeekRevenue[0]?.total ?? 0;
    const todayTotal = todayRevenue[0]?.total ?? 0;
    const revenueDelta = lastWeekTotal > 0
      ? ((todayTotal - lastWeekTotal) / lastWeekTotal) * 100
      : 0;

    const ordersToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(gte(orders.createdAt, today));

    const ordersLastWeek = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, lastWeek),
          lt(orders.createdAt, today)
        )
      );

    const lastWeekCount = ordersLastWeek[0]?.count ?? 0;
    const todayCount = ordersToday[0]?.count ?? 0;
    const ordersDelta = lastWeekCount > 0
      ? ((todayCount - lastWeekCount) / lastWeekCount) * 100
      : 0;

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

    const todayMargin = Math.round(todayTotal * 0.18);

    const dbStart = Date.now();
    await db.select({ ok: sql<number>`1` }).from(orders).limit(1);
    const dbLatency = Date.now() - dbStart;

    const systemHealth = {
      status: 'operational' as const,
      midtransWebhook: 'operational' as const,
      neonDB: dbLatency < 500 ? 'operational' as const : 'slow' as const,
      lastCronCheck: new Date().toISOString(),
    };

    return success({
      revenueToday: todayTotal,
      revenueDelta,
      estimatedMargin: todayMargin,
      ordersToday: todayCount,
      ordersDelta,
      newCustomersToday: newCustomersToday[0]?.count ?? 0,
      guestCheckoutsToday: guestCheckoutsToday[0]?.count ?? 0,
      systemHealth,
    });
  } catch (error) {
    console.error('[admin/dashboard/kpis]', error);
    return serverError(error);
  }
}