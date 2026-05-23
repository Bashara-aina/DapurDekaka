import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(and(eq(productVariants.stock, 0), eq(productVariants.isActive, true)));

    return success({ count: result[0]?.count ?? 0 });
  } catch (error) {
    console.error('[admin/team-dashboard/out-of-stock-count]', error);
    return serverError(error);
  }
}