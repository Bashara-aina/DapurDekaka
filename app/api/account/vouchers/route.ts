import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql, or, isNull, gte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const now = new Date();

    const usedCouponsList = await db.query.couponUsages.findMany({
      where: (usages, { eq }) => eq(usages.userId, session.user.id!),
    });

    const usedCouponIds = usedCouponsList.map(u => u.couponId);

    const availableCouponsList = await db.query.coupons.findMany({
      where: (c, { and, eq, or, isNull, gte, lte }) => and(
        eq(c.isActive, true),
        eq(c.isPublic, true),
        // BUG-06: Filter out coupons that haven't started yet
        or(
          isNull(c.startsAt),
          lte(c.startsAt, now)
        ),
        or(
          isNull(c.expiresAt),
          gte(c.expiresAt, now)
        ),
        or(
          isNull(c.maxUses),
          sql`${c.usedCount} < ${c.maxUses}`
        )
      ),
    });

    // Batch-fetch coupon details for used coupons (avoids N+1 queries)
    const couponsData = usedCouponIds.length > 0
      ? await db.query.coupons.findMany({
          where: (c, { inArray }) => inArray(c.id, usedCouponIds),
        })
      : [];
    const couponsMap = new Map(couponsData.map(c => [c.id, c]));

    const usedCouponsWithDetails = usedCouponsList.map(usage => {
      const coupon = couponsMap.get(usage.couponId);
      return {
        ...coupon,
        usedAt: usage.createdAt,
        discountApplied: usage.discountApplied,
      };
    });

    // BUG-03: Check per-user usage limits using session.user.id (userId was never declared)
    const userUsageCounts = await db
      .select({
        couponId: couponUsages.couponId,
        useCount: sql<number>`count(*)::int`,
      })
      .from(couponUsages)
      .where(eq(couponUsages.userId, session.user.id!))
      .groupBy(couponUsages.couponId);
    const userUsageMap = new Map(userUsageCounts.map(u => [u.couponId, u.useCount]));

    const trulyAvailable = availableCouponsList.filter(coupon => {
      if (!coupon.maxUsesPerUser) return true;
      return (userUsageMap.get(coupon.id) ?? 0) < coupon.maxUsesPerUser;
    });

    return success({
      usedCoupons: usedCouponsWithDetails,
      // BUG-04: Use trulyAvailable directly — it's already filtered by per-user limit via userUsageMap
      availableCoupons: trulyAvailable,
    });

  } catch (error) {
    console.error('[account/vouchers GET]', error);
    return serverError(error);
  }
}