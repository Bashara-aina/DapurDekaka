import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { db } from '@/lib/db';
import { coupons, couponUsages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { success, serverError, conflict, validationError } from '@/lib/utils/api-response';
import { CouponValidationSchema } from '@/lib/validations/coupon.schema';

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = CouponValidationSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { code, subtotal, userId, productIds } = parsed.data;
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
        return conflict('Kupon sudah expired');
      }

      if (coupon.startsAt && coupon.startsAt > now) {
        return conflict('Kupon belum berlaku');
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return conflict('Kupon tidak valid');
      }

      if (subtotal < coupon.minOrderAmount) {
        return conflict('Kupon tidak valid untuk pesanan ini');
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
          return conflict('Kupon tidak valid');
        }
      }

      // Validate applicable_category_ids — check if cart products belong to allowed categories
      if (coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0 && productIds && productIds.length > 0) {
        const cartProducts = await db.query.products.findMany({
          where: (products, { inArray }) => inArray(products.id, productIds),
        });

        const cartCategoryIds = cartProducts
          .map((p) => p.categoryId)
          .filter((cid): cid is string => cid !== null);

        const hasMatchingCategory = cartCategoryIds.some((cid) =>
          coupon.applicableCategoryIds!.includes(cid)
        );

        if (!hasMatchingCategory) {
          return conflict('Kupon tidak berlaku untuk produk di keranjang');
        }
      }

      // Validate applicable_product_ids — check if cart contains allowed products
      if (coupon.applicableProductIds && coupon.applicableProductIds.length > 0 && productIds && productIds.length > 0) {
        const hasMatchingProduct = productIds.some((pid) =>
          coupon.applicableProductIds!.includes(pid)
        );

        if (!hasMatchingProduct) {
          return conflict('Kupon tidak berlaku untuk produk di keranjang');
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
      console.error('[Coupon Validate]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 20 }
);
