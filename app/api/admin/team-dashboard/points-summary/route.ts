import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { sql, desc, gte, lt, and, eq } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total points in circulation - use the latest balance per user from pointsHistory
    // pointsBalanceAfter for 'earn' type represents current balance
    const [totalResult] = await db
      .select({ total: sql<number>`coalesce(sum(subquery.balance), 0)::int` })
      .from(
        db
          .select({
            userId: pointsHistory.userId,
            balance: sql<number>`max(${pointsHistory.pointsBalanceAfter})`,
          })
          .from(pointsHistory)
          .groupBy(pointsHistory.userId)
          .as('subquery')
      );

    // Points expiring within 30 days
    const [expiring30dResult] = await db
      .select({ total: sql<number>`coalesce(sum(${pointsHistory.pointsAmount}), 0)::int` })
      .from(pointsHistory)
      .where(and(
        gte(pointsHistory.expiresAt, now),
        lt(pointsHistory.expiresAt, thirtyDaysFromNow),
        eq(pointsHistory.isExpired, false)
      ));

    // Points expiring within 7 days
    const [expiring7dResult] = await db
      .select({ total: sql<number>`coalesce(sum(${pointsHistory.pointsAmount}), 0)::int` })
      .from(pointsHistory)
      .where(and(
        gte(pointsHistory.expiresAt, now),
        lt(pointsHistory.expiresAt, sevenDaysFromNow),
        eq(pointsHistory.isExpired, false)
      ));

    // Expired this month
    const [expiredResult] = await db
      .select({ total: sql<number>`coalesce(sum(${pointsHistory.pointsAmount}), 0)::int` })
      .from(pointsHistory)
      .where(and(
        gte(pointsHistory.expiresAt, startOfMonth),
        lt(pointsHistory.expiresAt, now),
        eq(pointsHistory.isExpired, true)
      ));

    // Top balances - get latest balance per user
    const topBalancesRaw = await db
      .select({
        userId: pointsHistory.userId,
        name: users.name,
        balance: sql<number>`max(${pointsHistory.pointsBalanceAfter})`,
      })
      .from(pointsHistory)
      .innerJoin(users, sql`${pointsHistory.userId} = ${users.id}`)
      .groupBy(pointsHistory.userId, users.name)
      .orderBy(desc(sql`max(${pointsHistory.pointsBalanceAfter})`))
      .limit(5);

    return success({
      totalPoints: totalResult?.total ?? 0,
      expiringSoon30d: expiring30dResult?.total ?? 0,
      expiringSoon7d: expiring7dResult?.total ?? 0,
      expiredThisMonth: expiredResult?.total ?? 0,
      topBalances: topBalancesRaw.map(b => ({
        name: b.name ?? 'Unknown',
        points: b.balance,
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/points-summary]', error);
    return serverError(error);
  }
}