import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bInquiries, b2bQuotes, b2bProfiles, orders } from '@/lib/db/schema';
import { eq, sql, and, gte, ne } from 'drizzle-orm';
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
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const newInquiries = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bInquiries)
      .where(eq(b2bInquiries.status, 'new'));

    const inProgressInquiries = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bInquiries)
      .where(eq(b2bInquiries.status, 'contacted'));

    const openQuotes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bQuotes)
      .where(eq(b2bQuotes.status, 'sent'));

    const acceptedQuotes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bQuotes)
      .where(eq(b2bQuotes.status, 'accepted'));

    const b2bOrdersThisMonth = await db
      .select({ 
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total_amount), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, firstDayOfMonth),
          eq(orders.isB2b, true),
          ne(orders.status, 'cancelled')
        )
      );

    const recentInquiries = await db.query.b2bInquiries.findMany({
      where: eq(b2bInquiries.status, 'new'),
      orderBy: (b2bInquiries, { desc }) => [desc(b2bInquiries.createdAt)],
      limit: 3,
    });

    return success({
      newInquiries: newInquiries[0]?.count ?? 0,
      inProgressInquiries: inProgressInquiries[0]?.count ?? 0,
      openQuotes: openQuotes[0]?.count ?? 0,
      acceptedQuotes: acceptedQuotes[0]?.count ?? 0,
      b2bOrdersThisMonth: b2bOrdersThisMonth[0]?.count ?? 0,
      b2bRevenueThisMonth: b2bOrdersThisMonth[0]?.total ?? 0,
      recentInquiries: recentInquiries.map(i => ({
        id: i.id,
        companyName: i.companyName,
        picName: i.picName,
        createdAt: i.createdAt,
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/b2b-pipeline]', error);
    return serverError(error);
  }
}