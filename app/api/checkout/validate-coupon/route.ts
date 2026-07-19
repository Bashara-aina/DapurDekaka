import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { coupons, couponUsages, orders, products } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { success, validationError, conflict, serverError } from '@/lib/utils/api-response';
import {
  MAX_COUPON_VALUE_IDR,
  MAX_COUPON_PERCENT,
  MIN_ORDER_FOR_COUPON_IDR,
} from '@/lib/constants/financial-rules';
import { enforceCouponCap } from '@/lib/finance/points-calculator';
import { auth } from '@/lib/auth';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const validateSchema = z.object({
  code: z.string().min(1, 'Kode kupon harus diisi'),
  subtotal: z.number().int().min(0),
  productIds: z.array(z.string().uuid()).optional(),
});

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { code, subtotal, productIds } = parsed.data;
    const normalizedCode = code.toUpperCase().trim();

    const session = await auth();
    const userId = session?.user?.id ?? null;
    const recipientEmail = session?.user?.email ?? null;

    const coupon = await db.query.coupons.findFirst({
      where: and(
        eq(coupons.code, normalizedCode),
        eq(coupons.isActive, true)
      ),
    });

    if (!coupon) {
      return conflict('Kupon tidak ditemukan atau sudah tidak berlaku');
    }

    // ── L2 Rule 6 caps (constitutional) ──────────────────────────────────
    if (coupon.type === 'free_shipping') {
      return conflict('Kupon free shipping tidak tersedia saat ini (90 hari pertama)');
    }
    if (subtotal < MIN_ORDER_FOR_COUPON_IDR) {
      return conflict(`Minimal belanja Rp ${MIN_ORDER_FOR_COUPON_IDR.toLocaleString('id-ID')} untuk menggunakan kupon`);
    }

    // Rule 1: starts_at check — coupon not yet active
    if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) {
      return conflict('Kupon belum berlaku');
    }

    // Rule 2: expires_at check — coupon expired
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return conflict('Kupon sudah kedaluwarsa');
    }

    // Rule 3: max_uses check — coupon fully redeemed
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return conflict('Kupon sudah mencapai batas penggunaan');
    }

    // Rule 4: min_order_amount check
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return conflict(`Minimal belanja Rp ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini`);
    }

    // Rule 5: max_uses_per_user check
    if (coupon.maxUsesPerUser) {
      if (userId) {
        const userUsageCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(couponUsages)
          .where(and(
            eq(couponUsages.couponId, coupon.id),
            eq(couponUsages.userId, userId)
          ));

        if ((userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
          return conflict('Anda sudah menggunakan kupon ini sebelumnya');
        }
      } else if (recipientEmail) {
        const guestUsageCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(couponUsages)
          .innerJoin(orders, eq(couponUsages.orderId, orders.id))
          .where(and(
            eq(couponUsages.couponId, coupon.id),
            eq(orders.recipientEmail, recipientEmail.toLowerCase())
          ));

        if ((guestUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
          return conflict('Kupon ini sudah digunakan dengan email yang sama');
        }
      }
    }

    // Rule 8: Check applicable_product_ids
    if (coupon.applicableProductIds && coupon.applicableProductIds.length > 0) {
      if (!productIds || productIds.length === 0) {
        return conflict('Kupon ini tidak berlaku untuk produk yang dipilih');
      }
      const hasApplicableProduct = productIds.some((pid: string) =>
        coupon.applicableProductIds!.includes(pid)
      );
      if (!hasApplicableProduct) {
        return conflict('Kupon ini tidak berlaku untuk produk yang dipilih');
      }
    }

    // Rule 9: Check applicable_category_ids
    if (coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0) {
      if (!productIds || productIds.length === 0) {
        return conflict('Kupon ini tidak berlaku untuk kategori produk yang dipilih');
      }
      const cartProducts = await db.query.products.findMany({
        where: inArray(products.id, productIds),
      });
      const cartCategoryIds = cartProducts
        .map((p: { categoryId: string | null }) => p.categoryId)
        .filter((cid): cid is string => cid !== null);
      const hasApplicableCategory = cartCategoryIds.some((cid: string) =>
        coupon.applicableCategoryIds!.includes(cid)
      );
      if (!hasApplicableCategory) {
        return conflict('Kupon ini tidak berlaku untuk kategori produk yang dipilih');
      }
    }

    // Calculate discount based on coupon type
    let discountAmount = 0;

    if (coupon.type === 'percentage') {
      discountAmount = Math.floor((coupon.discountValue! / 100) * subtotal);
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.discountValue!;
      if (discountAmount > subtotal) {
        discountAmount = subtotal;
      }
    }

    // L2 Rule 6: cap discount at MAX_COUPON_VALUE_IDR or 10% of subtotal (whichever lower).
    discountAmount = enforceCouponCap(subtotal, discountAmount);

    return success({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      discountAmount,
      minOrderAmount: coupon.minOrderAmount ?? 0,
      maxDiscountAmount: coupon.maxDiscountAmount,
      freeShipping: coupon.freeShipping,
      descriptionId: coupon.descriptionId,
      descriptionEn: coupon.descriptionEn,
    });
  } catch (error) {
    logger.error('[checkout/validate-coupon]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, { windowMs: 60000, maxRequests: 10 });