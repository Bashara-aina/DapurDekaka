import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { success, serverError, validationError, notFound, conflict, badRequest } from '@/lib/utils/api-response';

const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),
  userId: z.string().uuid().optional().nullable(),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = ValidateCouponSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { code, subtotal, userId } = parsed.data;
      const normalizedCode = code.toUpperCase().trim();

      const coupon = await db.query.coupons.findFirst({
        where: and(
          eq(coupons.code, normalizedCode),
          eq(coupons.isActive, true)
        ),
      });

      if (!coupon) {
        return notFound('Kupon tidak ditemukan atau sudah tidak berlaku');
      }

      const now = new Date();
      if (coupon.expiresAt && coupon.expiresAt < now) {
        return badRequest('Kupon sudah kedaluwarsa');
      }

      if (coupon.startsAt && coupon.startsAt > now) {
        return badRequest('Kupon belum berlaku');
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return conflict('Kupon sudah mencapai batas penggunaan');
      }

      if (subtotal < coupon.minOrderAmount) {
        return badRequest(
          `Minimal pembelian Rp ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini`
        );
      }

      if (userId && coupon.maxUsesPerUser) {
        const usageCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(couponUsages)
          .where(and(
            eq(couponUsages.couponId, coupon.id),
            eq(couponUsages.userId, userId)
          ));

        if (usageCount[0] && Number(usageCount[0].count) >= coupon.maxUsesPerUser) {
          return conflict('Anda sudah menggunakan kupon ini sebelumnya');
        }
      }

      let discountAmount = 0;
      let maxDiscount = coupon.maxDiscountAmount ?? null;
      let buyXgetY: { buyQuantity: number; getQuantity: number } | null = null;

      if (coupon.type === 'percentage') {
        discountAmount = Math.floor(subtotal * (coupon.discountValue ?? 0) / 100);
        if (maxDiscount !== null && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
      } else if (coupon.type === 'fixed') {
        discountAmount = coupon.discountValue ?? 0;
        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }
      } else if (coupon.type === 'buy_x_get_y') {
        discountAmount = 0;
        buyXgetY = {
          buyQuantity: coupon.buyQuantity ?? 1,
          getQuantity: coupon.getQuantity ?? 1,
        };
      }

      return success({
        code: coupon.code,
        type: coupon.type,
        discountValue: coupon.discountValue,
        discountAmount,
        minOrderAmount: coupon.minOrderAmount,
        freeShipping: coupon.freeShipping,
        nameId: coupon.nameId,
        nameEn: coupon.nameEn,
        buyXgetY,
      });
    } catch (error) {
      console.error('[Coupon Validate]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 20 }
);