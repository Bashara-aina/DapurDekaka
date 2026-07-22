import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { coupons, couponUsages, products, orders } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { success, serverError, validationError, conflict } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

const ValidateCouponSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),
  userId: z.string().uuid().optional().nullable(),
  email: z.string().email().optional().nullable(),
  productIds: z.array(z.string().uuid()).optional(),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = ValidateCouponSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { code, subtotal, userId, email, productIds } = parsed.data;
      const normalizedCode = code.toUpperCase().trim();

      const coupon = await db.query.coupons.findFirst({
        where: and(
          eq(coupons.code, normalizedCode),
          eq(coupons.isActive, true)
        ),
      });

      if (!coupon) {
        return conflict('Kupon tidak valid');
      }

      const now = new Date();
      if (coupon.expiresAt && coupon.expiresAt < now) {
        return conflict('Kupon tidak valid');
      }

      if (coupon.startsAt && coupon.startsAt > now) {
        return conflict('Kupon tidak valid');
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return conflict('Kupon tidak valid');
      }

      if (subtotal < coupon.minOrderAmount) {
        return conflict('Kupon tidak valid untuk pesanan ini');
      }

      // For guest checkouts, reject coupons with per-user limits
      if (!userId && coupon.maxUsesPerUser) {
        return Response.json({
          success: false,
          error: 'Kupon ini tidak dapat digunakan untuk guest checkout',
          code: 'GUEST_NOT_ALLOWED',
        }, { status: 422 });
      }

      if (userId && coupon.maxUsesPerUser) {
        const usageCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(couponUsages)
          .where(and(
            eq(couponUsages.couponId, coupon.id),
            eq(couponUsages.userId, userId)
          ));

        if ((usageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
          return conflict('Anda sudah menggunakan kupon ini sebelumnya');
        }
      } else if (!userId && email && coupon.maxUsesPerUser) {
        // For guest users, check usage by email via orders join
        const guestUsageCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(couponUsages)
          .innerJoin(orders, eq(couponUsages.orderId, orders.id))
          .where(and(
            eq(couponUsages.couponId, coupon.id),
            eq(orders.recipientEmail, email.toLowerCase())
          ));

        if ((guestUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
          return conflict('Kupon ini sudah digunakan dengan email yang sama');
        }
      }
      // NOTE: Further guest email-based check is enforced at checkout/initiate

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
        const cartCategoryIds = cartProducts.map((p: { categoryId: string | null }) => p.categoryId).filter((cid): cid is string => cid !== null);
        const hasApplicableCategory = cartCategoryIds.some((cid: string) =>
          coupon.applicableCategoryIds!.includes(cid)
        );
        if (!hasApplicableCategory) {
          return conflict('Kupon ini tidak berlaku untuk kategori produk yang dipilih');
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
        type: coupon.type,
        discountAmount,
        freeShipping: coupon.freeShipping,
        buyXgetY,
      });
    } catch (error) {
      logger.error('[Coupon Validate]', { error: error instanceof Error ? error.message : String(error) });
      return serverError(error);
    }
  },
  'money'
);