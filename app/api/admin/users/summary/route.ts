import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
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

    const roleCounts = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .groupBy(users.role);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSignups = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          gte(users.createdAt, sevenDaysAgo),
          eq(users.role, 'customer')
        )
      );

    const result = {
      superadmin: 0,
      owner: 0,
      warehouse: 0,
      b2b: 0,
      customer: 0,
      inactive: 0,
      recentSignups: recentSignups[0]?.count ?? 0,
    };

    roleCounts.forEach(row => {
      if (row.role in result) {
        result[row.role as keyof typeof result] = row.count;
      }
    });

    return success(result);
  } catch (error) {
    console.error('[admin/users/summary]', error);
    return serverError(error);
  }
}