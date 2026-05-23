import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getRevenueChart = cache(async (period: string) => {
  const now = new Date();
  let startDate = new Date(now);
  let days = 30;

  if (period === '7d') { startDate.setDate(now.getDate() - 6); days = 7; }
  else if (period === '14d') { startDate.setDate(now.getDate() - 13); days = 14; }
  else if (period === '90d') { startDate.setDate(now.getDate() - 89); days = 90; }
  else { startDate.setDate(now.getDate() - 29); }

  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const rawData = await db
    .select({
      date: sql<string>`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')::text`,
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.paidAt, startDate),
        sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
      )
    )
    .groupBy(sql`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')`)
    .orderBy(sql`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')`);

  const filled: Array<{ date: string; label: string; revenue: number; orders: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
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

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') ?? '30d';
    const data = await getRevenueChart(period);
    return success(data);
  } catch (error) {
    console.error('[admin/team-dashboard/revenue-chart]', error);
    return serverError(error);
  }
}