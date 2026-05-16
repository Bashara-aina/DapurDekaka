import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql, or, isNull, gte } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';

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
      where: (c, { and, eq, or, isNull, gte }) => and(
        eq(c.isActive, true),
        eq(c.isPublic, true),
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

    const usedCouponsWithDetails = usedCouponsList.map(usage => ({
      code: couponsMap.get(usage.couponId)?.code ?? '',
      type: couponsMap.get(usage.couponId)?.type ?? 'percentage',
      nameId: couponsMap.get(usage.couponId)?.nameId ?? '',
      nameEn: couponsMap.get(usage.couponId)?.nameEn ?? '',
      descriptionId: couponsMap.get(usage.couponId)?.descriptionId ?? '',
      descriptionEn: couponsMap.get(usage.couponId)?.descriptionEn ?? '',
      discountValue: couponsMap.get(usage.couponId)?.discountValue ?? 0,
      minOrderAmount: couponsMap.get(usage.couponId)?.minOrderAmount ?? 0,
      maxDiscountAmount: couponsMap.get(usage.couponId)?.maxDiscountAmount ?? null,
      freeShipping: couponsMap.get(usage.couponId)?.freeShipping ?? false,
      usedAt: usage.createdAt,
      discountApplied: usage.discountApplied,
    }));

    // Check per-user usage limits to filter truly available coupons
    const userUsageCounts = userId
      ? await db
          .select({
            couponId: couponUsages.couponId,
            useCount: sql<number>`count(*)::int`,
          })
          .from(couponUsages)
          .where(eq(couponUsages.userId, userId))
          .groupBy(couponUsages.couponId)
      : [];
    const userUsageMap = new Map(userUsageCounts.map(u => [u.couponId, u.useCount]));

    const trulyAvailable = availableCouponsList.filter(coupon => {
      if (!coupon.maxUsesPerUser) return true;
      return (userUsageMap.get(coupon.id) ?? 0) < coupon.maxUsesPerUser;
    });

    return success({
      usedCoupons: usedCouponsWithDetails,
      availableCoupons: trulyAvailable.filter(c => !usedCouponIds.includes(c.id)),
    });

  } catch (error) {
    console.error('[account/vouchers GET]', error);
    return serverError(error);
  }
}