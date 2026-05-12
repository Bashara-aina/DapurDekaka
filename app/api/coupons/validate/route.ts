import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),
  userId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ValidateCouponSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
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
      return NextResponse.json(
        { success: false, error: 'Kupon tidak ditemukan atau sudah tidak berlaku', code: 'COUPON_NOT_FOUND' },
        { status: 404 }
      );
    }

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return NextResponse.json(
        { success: false, error: 'Kupon sudah kedaluwarsa', code: 'COUPON_EXPIRED' },
        { status: 400 }
      );
    }

    if (coupon.startsAt && coupon.startsAt > now) {
      return NextResponse.json(
        { success: false, error: 'Kupon belum berlaku', code: 'COUPON_NOT_STARTED' },
        { status: 400 }
      );
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { success: false, error: 'Kupon sudah mencapai batas penggunaan', code: 'COUPON_MAXED' },
        { status: 400 }
      );
    }

    if (subtotal < coupon.minOrderAmount) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Minimal pembelian Rp ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini`, 
          code: 'MIN_ORDER_NOT_MET' 
        },
        { status: 400 }
      );
    }

    if (userId && coupon.maxUsesPerUser) {
      const usageCount = await db
        .select({ count: coupons.usedCount })
        .from(coupons)
        .where(eq(coupons.id, coupon.id));
      
      if (usageCount[0] && usageCount[0].count >= coupon.maxUsesPerUser) {
        return NextResponse.json(
          { success: false, error: 'Anda sudah menggunakan kupon ini sebelumnya', code: 'COUPON_USER_LIMIT' },
          { status: 400 }
        );
      }
    }

    let discountAmount = 0;
    let maxDiscount = coupon.maxDiscountAmount ?? null;

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
    }

    return NextResponse.json({
      success: true,
      data: {
        code: coupon.code,
        type: coupon.type,
        discountValue: coupon.discountValue,
        discountAmount,
        minOrderAmount: coupon.minOrderAmount,
        freeShipping: coupon.freeShipping,
        nameId: coupon.nameId,
        nameEn: coupon.nameEn,
      },
    });
  } catch (error) {
    console.error('[Coupon Validate]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}