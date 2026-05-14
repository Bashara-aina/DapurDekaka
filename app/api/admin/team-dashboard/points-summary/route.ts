import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { eq, sql, gte, desc, and, lt } from 'drizzle-orm';
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
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const totalPointsResult = await db
      .select({ total: sql<number>`coalesce(sum(points_balance), 0)::int` })
      .from(users);

    const expiringIn30Days = await db
      .select({ 
        points: sql<number>`coalesce(sum(points_amount), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(pointsHistory)
      .where(
        and(
          eq(pointsHistory.type, 'earn'),
          gte(pointsHistory.expiresAt, today),
          lt(pointsHistory.expiresAt, thirtyDaysFromNow),
          eq(pointsHistory.isExpired, false)
        )
      );

    const expiringIn7Days = await db
      .select({ 
        points: sql<number>`coalesce(sum(points_amount), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(pointsHistory)
      .where(
        and(
          eq(pointsHistory.type, 'earn'),
          gte(pointsHistory.expiresAt, today),
          lt(pointsHistory.expiresAt, sevenDaysFromNow),
          eq(pointsHistory.isExpired, false)
        )
      );

    const topPointsHolders = await db.query.users.findMany({
      where: eq(users.role, 'customer'),
      orderBy: [desc(users.pointsBalance)],
      limit: 5,
    });

    return success({
      totalPoints: totalPointsResult[0]?.total ?? 0,
      expiringIn30Days: expiringIn30Days[0]?.points ?? 0,
      expiringIn30DaysCount: expiringIn30Days[0]?.count ?? 0,
      expiringIn7Days: expiringIn7Days[0]?.points ?? 0,
      expiringIn7DaysCount: expiringIn7Days[0]?.count ?? 0,
      expiredThisMonth: 0,
      topHolders: topPointsHolders.map(u => ({
        name: u.name,
        points: u.pointsBalance,
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/points-summary]', error);
    return serverError(error);
  }
}