import { NextRequest } from 'next/server';
import { unstable_cache } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users, systemSettings, webhookEvents } from '@/lib/db/schema';
import { eq, gte, sql, and, lt, isNull, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getKpis = unstable_cache(async (fromDate?: Date, toDate?: Date) => {
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
      where: eq(systemSettings.key, 'estimated_margin_pct'),
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

    const [kpis, systemHealth] = await Promise.all([
      getKpis(fromDate, toDate),
      getSystemHealth(),
    ]);

    return success({ ...(kpis ?? {}), systemHealth });
  } catch (error) {
    console.error('[admin/dashboard/kpis]', error);
    return serverError(error);
  }
}

async function getSystemHealth() {
  const health = {
    status: 'operational' as const,
    midtransWebhook: 'ok' as const,
    neonDB: 'ok' as const,
    lastCronCheck: 'N/A' as const,
  };

  try {
    const recentWebhook = await db.query.webhookEvents.findFirst({
      where: eq(webhookEvents.source, 'midtrans'),
      orderBy: [desc(webhookEvents.createdAt)],
      columns: { createdAt: true },
    });
    const webhookAge = recentWebhook
      ? Date.now() - new Date(recentWebhook.createdAt).getTime()
      : Infinity;
    if (webhookAge > 3600000) {
      (health as Record<string, string>).midtransWebhook = 'late';
      (health as Record<string, string>).status = 'degraded';
    }
    if (webhookAge > 86400000) {
      (health as Record<string, string>).midtransWebhook = 'missing';
      (health as Record<string, string>).status = 'degraded';
    }
  } catch {
    (health as Record<string, string>).neonDB = 'slow';
    (health as Record<string, string>).status = 'degraded';
  }

  try {
    const lastCron = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'last_cron_check'),
      columns: { value: true, updatedAt: true },
    });
    if (lastCron?.updatedAt) {
      const dt = new Date(lastCron.updatedAt);
      (health as Record<string, string>).lastCronCheck = dt.toISOString().split('T')[0] + ' ' + dt.toTimeString().split(' ')[0];
    }
  } catch {
    // Non-critical
  }

  return health;
}