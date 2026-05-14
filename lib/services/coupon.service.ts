import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { Coupon } from '@/lib/db/schema';

interface CouponValidationInput {
  code: string;
  userId?: string;
  subtotalIDR: number;
  shippingCostIDR: number;
}

interface CouponValidationResult {
  valid: boolean;
  error?: string;
  discountIDR?: number;
  coupon?: Coupon;
}

export async function validateCoupon(
  input: CouponValidationInput
): Promise<CouponValidationResult> {
  const { code, userId, subtotalIDR, shippingCostIDR } = input;

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.toUpperCase().trim()))
    .limit(1);

  if (!coupon) {
    return { valid: false, error: 'Kode kupon tidak ditemukan' };
  }

  if (!coupon.isActive) {
    return { valid: false, error: 'Kupon sudah tidak aktif' };
  }

  const now = new Date();
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { valid: false, error: 'Kupon belum berlaku' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { valid: false, error: 'Kupon sudah kedaluwarsa' };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: 'Kupon sudah mencapai batas penggunaan' };
  }

  if (coupon.minOrderAmount && subtotalIDR < coupon.minOrderAmount) {
    return {
      valid: false,
      error: `Minimal belanja Rp ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini`,
    };
  }

  if (userId && coupon.maxUsesPerUser) {
    const [usageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.userId, userId)))
      .limit(1);

    if (Number(usageCount?.count ?? 0) >= coupon.maxUsesPerUser) {
      return { valid: false, error: 'Kamu sudah menggunakan kupon ini sebelumnya' };
    }
  }

  let discountIDR = 0;

  switch (coupon.type) {
    case 'percentage':
      discountIDR = Math.floor(subtotalIDR * ((coupon.discountValue ?? 0) / 100));
      if (coupon.maxDiscountAmount) {
        discountIDR = Math.min(discountIDR, coupon.maxDiscountAmount);
      }
      break;
    case 'fixed':
      discountIDR = Math.min(coupon.discountValue ?? 0, subtotalIDR);
      break;
    case 'free_shipping':
      discountIDR = shippingCostIDR;
      break;
    case 'buy_x_get_y':
      discountIDR = coupon.discountValue ?? 0;
      break;
  }

  return { valid: true, discountIDR, coupon };
}
