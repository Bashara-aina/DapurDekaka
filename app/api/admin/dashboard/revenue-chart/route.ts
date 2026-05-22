import { NextRequest } from 'next/server';
import { unstable_cache } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, lte, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getRevenueChart = unstable_cache(async (from: string, to: string) => {
  const fromDate = from ? new Date(from) : new Date();
  fromDate.setHours(0, 0, 0, 0);
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);

  const dayCount = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000));

  const rawData = await db
    .select({
      date: sql<string>`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')::text`,
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.paidAt, fromDate),
        lte(orders.paidAt, toDate),
        sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
      )
    )
    .groupBy(sql`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')`)
    .orderBy(sql`DATE(${orders.paidAt}::timestamptz AT TIME ZONE 'Asia/Jakarta')`);

  const filled: Array<{ date: string; label: string; revenue: number; orders: number }> = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(fromDate);
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
}, ['revenue-chart'], { revalidate: 300 });

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Akses ditolak');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Akses ditolak');
    }

    const from = req.nextUrl.searchParams.get('from') ?? '';
    const to = req.nextUrl.searchParams.get('to') ?? '';
    const data = await getRevenueChart(from || '', to || '');
    return success(data);
  } catch (error) {
    console.error('[admin/dashboard/revenue-chart]', error);
    return serverError(error);
  }
}