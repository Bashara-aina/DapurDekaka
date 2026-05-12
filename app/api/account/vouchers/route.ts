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

    const usedCouponsWithDetails = await Promise.all(
      usedCouponsList.map(async (usage) => {
        const coupon = await db.query.coupons.findFirst({
          where: eq(coupons.id, usage.couponId),
        });
        return {
          code: coupon?.code ?? '',
          type: coupon?.type ?? 'percentage',
          nameId: coupon?.nameId ?? '',
          nameEn: coupon?.nameEn ?? '',
          descriptionId: coupon?.descriptionId ?? '',
          descriptionEn: coupon?.descriptionEn ?? '',
          discountValue: coupon?.discountValue ?? 0,
          minOrderAmount: coupon?.minOrderAmount ?? 0,
          maxDiscountAmount: coupon?.maxDiscountAmount ?? null,
          freeShipping: coupon?.freeShipping ?? false,
          usedAt: usage.createdAt,
          discountApplied: usage.discountApplied,
        };
      })
    );

    return success({
      usedCoupons: usedCouponsWithDetails,
      availableCoupons: availableCouponsList.filter(c => !usedCouponIds.includes(c.id)),
    });

  } catch (error) {
    console.error('[account/vouchers GET]', error);
    return serverError(error);
  }
}