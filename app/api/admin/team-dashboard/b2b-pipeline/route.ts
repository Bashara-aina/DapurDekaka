import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bInquiries, b2bQuotes, orders } from '@/lib/db/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
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
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [[newInquiries], [inProgressInquiries], [openQuotes], [acceptedQuotes], [b2bOrders], recentInquiries] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(b2bInquiries)
        .where(eq(b2bInquiries.status, 'new')),
      db.select({ count: sql<number>`count(*)::int` }).from(b2bInquiries)
        .where(eq(b2bInquiries.status, 'contacted')),
      db.select({ count: sql<number>`count(*)::int` }).from(b2bQuotes)
        .where(eq(b2bQuotes.status, 'draft')),
      db.select({ count: sql<number>`count(*)::int` }).from(b2bQuotes)
        .where(eq(b2bQuotes.status, 'accepted')),
      db.select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
      }).from(orders)
        .where(and(eq(orders.isB2b, true), gte(orders.createdAt, firstOfMonth))),
      db.query.b2bInquiries.findMany({
        where: eq(b2bInquiries.status, 'new'),
        orderBy: [desc(b2bInquiries.createdAt)],
        limit: 5,
      }),
    ]);

    return success({
      newInquiries: newInquiries?.count ?? 0,
      inProgressInquiries: inProgressInquiries?.count ?? 0,
      openQuotes: openQuotes?.count ?? 0,
      acceptedQuotes: acceptedQuotes?.count ?? 0,
      b2bOrdersThisMonth: b2bOrders?.count ?? 0,
      b2bRevenueThisMonth: b2bOrders?.revenue ?? 0,
      recentInquiries: recentInquiries.map(i => ({
        id: i.id,
        companyName: i.companyName,
        picName: i.picName,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/b2b-pipeline]', error);
    return serverError(error);
  }
}
