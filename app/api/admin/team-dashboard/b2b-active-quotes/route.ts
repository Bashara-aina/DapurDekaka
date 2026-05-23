import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bQuotes } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const [draftQuotes, sentQuotes] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(b2bQuotes)
        .where(eq(b2bQuotes.status, 'draft')),
      db.select({ count: sql<number>`count(*)::int` }).from(b2bQuotes)
        .where(eq(b2bQuotes.status, 'sent')),
    ]);

    const recentQuotes = await db.query.b2bQuotes.findMany({
      where: eq(b2bQuotes.status, 'sent'),
      orderBy: [desc(b2bQuotes.createdAt)],
      limit: 5,
      with: { b2bProfile: true },
    });

    return success({
      draftCount: draftQuotes[0]?.count ?? 0,
      sentCount: sentQuotes[0]?.count ?? 0,
      recentQuotes: recentQuotes.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        totalAmount: q.totalAmount,
        companyName: q.b2bProfile?.companyName ?? '',
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/b2b-active-quotes]', error);
    return serverError(error);
  }
}