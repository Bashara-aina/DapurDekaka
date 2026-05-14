import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, sql, and, gte, isNull, or } from 'drizzle-orm';
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

    const activeCoupons = await db.query.coupons.findMany({
      where: eq(coupons.isActive, true),
      orderBy: (coupons, { asc }) => [asc(coupons.expiresAt)],
    });

    const couponStats = await Promise.all(
      activeCoupons.slice(0, 10).map(async (coupon) => {
        const usage = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(couponUsages)
          .where(eq(couponUsages.couponId, coupon.id));

        return {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          discountValue: coupon.discountValue,
          maxUses: coupon.maxUses,
          usedCount: usage[0]?.count ?? 0,
          minOrderAmount: coupon.minOrderAmount,
          expiresAt: coupon.expiresAt,
          isActive: coupon.isActive,
        };
      })
    );

    return success(couponStats);
  } catch (error) {
    console.error('[admin/team-dashboard/coupons]', error);
    return serverError(error);
  }
}