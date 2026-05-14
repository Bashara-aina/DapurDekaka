import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, sql, and, inArray, ne, eq } from 'drizzle-orm';
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

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') ?? '30', 10);

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const ordersByDay = await db
      .select({
        date: sql<string>`DATE(created_at AT TIME ZONE 'Asia/Jakarta')::text`,
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total_amount), 0)::int`,
        paid: sql<number>`count(CASE WHEN status IN ('paid','processing','packed','shipped','delivered') THEN 1 END)::int`,
        cancelled: sql<number>`count(CASE WHEN status = 'cancelled' THEN 1 END)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, startDate),
          ne(orders.status, 'refunded')
        )
      )
      .groupBy(sql`DATE(created_at AT TIME ZONE 'Asia/Jakarta')`)
      .orderBy(sql`DATE(created_at AT TIME ZONE 'Asia/Jakarta')`);

    const paidStatuses = ['paid', 'processing', 'packed', 'shipped', 'delivered'];

    const result = ordersByDay.map(day => ({
      date: day.date,
      orders: day.count,
      revenue: day.total,
      paid: day.paid,
      cancelled: day.cancelled,
    }));

    return success(result);
  } catch (error) {
    console.error('[admin/team-dashboard/orders-per-day]', error);
    return serverError(error);
  }
}