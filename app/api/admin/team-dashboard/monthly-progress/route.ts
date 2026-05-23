import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { gte, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MONTHLY_TARGET = 100_000_000; // Rp 100 juta target bulanan

const getMonthlyProgress = cache(async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  // Current month revenue (paid orders)
  const [monthRevenueResult] = await db
    .select({ total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int` })
    .from(orders)
    .where(and(
      gte(orders.paidAt, monthStart),
      sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
    ));

  const currentRevenue = monthRevenueResult?.total ?? 0;
  const progress = Math.min(100, Math.round((currentRevenue / MONTHLY_TARGET) * 100));
  const dailyPace = currentRevenue / daysElapsed;
  const projectedRevenue = Math.round(dailyPace * daysInMonth);

  // Determine if on track
  const expectedProgress = (daysElapsed / daysInMonth) * 100;
  let isOnTrack: 'on_track' | 'below' | 'needs_attention' = 'below';
  if (progress >= expectedProgress * 1.1) {
    isOnTrack = 'on_track';
  } else if (progress >= expectedProgress * 0.8) {
    isOnTrack = 'needs_attention';
  }

  return {
    monthlyTarget: MONTHLY_TARGET,
    currentRevenue,
    progress,
    daysElapsed,
    daysInMonth,
    pace: Math.round(dailyPace),
    projectedRevenue,
    isOnTrack,
  };
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const data = await getMonthlyProgress();
    return success(data);
  } catch (error) {
    console.error('[admin/team-dashboard/monthly-progress]', error);
    return serverError(error);
  }
}