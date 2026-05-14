import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, sql, and, inArray, ne, desc, lt } from 'drizzle-orm';
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

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') ?? '30', 10);
    const channel = url.searchParams.get('channel') ?? 'all';

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const ordersByDay = await db
      .select({
        date: sql<string>`DATE(paid_at AT TIME ZONE 'Asia/Jakarta')::text`,
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total_amount), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, startDate),
          inArray(orders.status, ['paid', 'processing', 'packed', 'shipped', 'delivered'])
        )
      )
      .groupBy(sql`DATE(paid_at AT TIME ZONE 'Asia/Jakarta')`)
      .orderBy(sql`DATE(paid_at AT TIME ZONE 'Asia/Jakarta')`);

    const result = ordersByDay.map(day => ({
      date: day.date,
      revenue: day.total,
      orders: day.count,
    }));

    return success(result);
  } catch (error) {
    console.error('[admin/dashboard/revenue-chart]', error);
    return serverError(error);
  }
}