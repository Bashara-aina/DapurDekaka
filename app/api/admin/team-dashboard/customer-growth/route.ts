import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql, gte, desc } from 'drizzle-orm';
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
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const weeklyNewCustomers = await db
      .select({
        weekStart: sql<string>`DATE_TRUNC('week', created_at)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(
        eq(users.role, 'customer')
      )
      .groupBy(sql`DATE_TRUNC('week', created_at)`)
      .orderBy(sql`DATE_TRUNC('week', created_at) DESC`)
      .limit(12);

    const totalCustomers = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'customer'));

    return success({
      weeklyNewCustomers,
      totalCustomers: totalCustomers[0]?.count ?? 0,
      newCustomersToday: 0,
    });
  } catch (error) {
    console.error('[admin/team-dashboard/customer-growth]', error);
    return serverError(error);
  }
}