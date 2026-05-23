import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { coupons } from '@/lib/db/schema';
import { sql, eq, and, isNull, gte, or } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));

    // Active coupons: is_active = true and (not expired or no expiry)
    const now = new Date();

    const activeCoupons = await db
      .select({
        id: coupons.id,
        code: coupons.code,
        type: coupons.type,
        discountValue: coupons.discountValue,
        maxUses: coupons.maxUses,
        usedCount: coupons.usedCount,
        expiresAt: coupons.expiresAt,
      })
      .from(coupons)
      .where(eq(coupons.isActive, true))
      .limit(limit);

    return success(activeCoupons.map(c => ({
      ...c,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    })));
  } catch (error) {
    console.error('[admin/team-dashboard/coupons]', error);
    return serverError(error);
  }
}