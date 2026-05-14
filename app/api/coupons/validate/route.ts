import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, serverError, notFound, validationError, conflict } from '@/lib/utils/api-response';
import { ratelimit } from '@/lib/utils/rate-limit';

const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  subtotalIDR: z.number().int().nonnegative(),
  userId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success: rateOk, limit, remaining, reset } = await ratelimit.coupon.limit(ip);
  if (!rateOk) {
    return conflict('Terlalu banyak validasi kupon. Coba lagi nanti.');
  }

  try {
    const body = await req.json();
    const parsed = ValidateCouponSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { code, subtotalIDR, userId } = parsed.data;
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
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      return conflict('Kupon sudah kedaluwarsa');
    }

    if (coupon.startsAt && new Date(coupon.startsAt) > now) {
      return conflict('Kupon belum berlaku');
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return conflict('Kupon sudah mencapai batas penggunaan');
    }

    if (subtotalIDR < coupon.minOrderAmount) {
      return conflict(
        `Minimal pembelian Rp ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini`
      );
    }

    if (userId && coupon.maxUsesPerUser) {
      const [usageCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(couponUsages)
        .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, userId)))
        .limit(1);

      if (Number(usageCount?.count ?? 0) >= coupon.maxUsesPerUser) {
        return conflict('Anda sudah menggunakan kupon ini sebelumnya');
      }
    }

    let discountAmount = 0;
    let maxDiscount = coupon.maxDiscountAmount ?? null;

    if (coupon.type === 'percentage') {
      discountAmount = Math.floor(subtotalIDR * (coupon.discountValue ?? 0) / 100);
      if (maxDiscount !== null && discountAmount > maxDiscount) {
        discountAmount = maxDiscount;
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.discountValue ?? 0;
      if (discountAmount > subtotalIDR) {
        discountAmount = subtotalIDR;
      }
    }

    return success({
      code: coupon.code,
      type: coupon.type,
      discountValue: coupon.discountValue,
      discountIDR: discountAmount,
      minOrderAmount: coupon.minOrderAmount,
      freeShipping: coupon.freeShipping,
      nameId: coupon.nameId,
      nameEn: coupon.nameEn,
    });
  } catch (error) {
    console.error('[Coupon Validate]', error);
    return serverError(error);
  }
}