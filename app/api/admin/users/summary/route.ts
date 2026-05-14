import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, orders } from '@/lib/db/schema';
import { eq, sql, and, isNull, gte } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalResult,
      customerResult,
      b2bResult,
      warehouseResult,
      ownerResult,
      superadminResult,
      newCustomersTodayResult,
      activeUsersResult,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(isNull(users.deletedAt)),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'customer'), isNull(users.deletedAt))),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'b2b'), isNull(users.deletedAt))),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'warehouse'), isNull(users.deletedAt))),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'owner'), isNull(users.deletedAt))),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'superadmin'), isNull(users.deletedAt))),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(
          eq(users.role, 'customer'),
          gte(users.createdAt, today),
          isNull(users.deletedAt)
        )),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.isActive, true), isNull(users.deletedAt))),
    ]);

    return success({
      total: totalResult[0]?.count ?? 0,
      byRole: {
        customer: customerResult[0]?.count ?? 0,
        b2b: b2bResult[0]?.count ?? 0,
        warehouse: warehouseResult[0]?.count ?? 0,
        owner: ownerResult[0]?.count ?? 0,
        superadmin: superadminResult[0]?.count ?? 0,
      },
      newCustomersToday: newCustomersTodayResult[0]?.count ?? 0,
      activeUsers: activeUsersResult[0]?.count ?? 0,
      inactiveUsers: (totalResult[0]?.count ?? 0) - (activeUsersResult[0]?.count ?? 0),
    });
  } catch (error) {
    console.error('[Admin Users Summary GET]', error);
    return serverError(error);
  }
}