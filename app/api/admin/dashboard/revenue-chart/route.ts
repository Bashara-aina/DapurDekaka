import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

const getRevenueChart = cache(async () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const rawData = await db
    .select({
      date: sql<string>`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')::text`,
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.paidAt, thirtyDaysAgo),
        sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
      )
    )
    .groupBy(sql`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')`)
    .orderBy(sql`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')`);

  // Build all 30 days with zero-fill for missing days
  const filled: Array<{ date: string; label: string; revenue: number; orders: number }> = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayMonth = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const found = rawData.find((r) => r.date === dateStr);
    filled.push({
      date: dateStr,
      label: dayMonth,
      revenue: found?.total ?? 0,
      orders: found?.count ?? 0,
    });
  }

  return filled;
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Akses ditolak');
    }

    const data = await getRevenueChart();
    return success(data);
  } catch (error) {
    console.error('[admin/dashboard/revenue-chart]', error);
    return serverError(error);
  }
}