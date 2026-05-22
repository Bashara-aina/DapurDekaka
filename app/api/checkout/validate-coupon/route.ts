import { NextRequest, NextResponse } from 'next/server';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { coupons, couponUsages, products } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { CheckoutCouponValidationSchema } from '@/lib/validations/coupon.schema';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const parsed = CheckoutCouponValidationSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { code, subtotal, userId, items } = parsed.data;
    const resolvedUserId = userId ?? session?.user?.id ?? null;

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(and(
        eq(coupons.code, code.toUpperCase().trim()),
        eq(coupons.isActive, true)
      ))
      .limit(1);

    if (!coupon) {
      return NextResponse.json({
        success: false,
        error: 'Kode kupon tidak ditemukan atau sudah tidak aktif',
        code: 'COUPON_NOT_FOUND',
      }, { status: 404 });
    }

    const now = new Date();

    if (coupon.startsAt && new Date(coupon.startsAt) > now) {
      return NextResponse.json({
        success: false,
        error: 'Kupon belum berlaku',
        code: 'COUPON_NOT_STARTED',
      }, { status: 400 });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      return NextResponse.json({
        success: false,
        error: 'Kupon sudah kedaluwarsa',
        code: 'COUPON_EXPIRED',
      }, { status: 400 });
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({
        success: false,
        error: 'Kupon sudah mencapai batas penggunaan',
        code: 'COUPON_MAX_USES_REACHED',
      }, { status: 400 });
    }

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return NextResponse.json({
        success: false,
        error: `Minimal belanja Rp ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk menggunakan kupon ini`,
        code: 'MIN_ORDER_NOT_MET',
      }, { status: 400 });
    }

    if (resolvedUserId && coupon.maxUsesPerUser) {
      const [usageCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponUsages)
        .where(and(
          eq(couponUsages.couponId, coupon.id),
          eq(couponUsages.userId, resolvedUserId)
        ))
        .limit(1);

      if ((usageCount?.count ?? 0) >= coupon.maxUsesPerUser) {
        return NextResponse.json({
          success: false,
          error: 'Anda sudah menggunakan kupon ini sebelumnya',
          code: 'COUPON_ALREADY_USED_BY_USER',
        }, { status: 400 });
      }
    }

    if (items && items.length > 0 && (coupon.applicableProductIds || coupon.applicableCategoryIds)) {
      const productIds = items.map(i => i.productId);
      const cartProducts = await db.query.products.findMany({
        where: inArray(products.id, productIds),
        with: { category: true },
      });

      const productCategoryMap = new Map<string, string | null>();
      for (const p of cartProducts) {
        productCategoryMap.set(p.id, p.categoryId);
      }

      if (coupon.applicableProductIds && coupon.applicableProductIds.length > 0) {
        const hasApplicableProduct = items.some(
          item => coupon.applicableProductIds!.includes(item.productId)
        );
        if (!hasApplicableProduct) {
          return NextResponse.json({
            success: false,
            error: 'Kupon ini tidak berlaku untuk produk di keranjang Anda',
            code: 'COUPON_NOT_APPLICABLE_TO_PRODUCTS',
          }, { status: 400 });
        }
      }

      if (coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0) {
        const hasApplicableCategory = items.some(
          item => {
            const catId = productCategoryMap.get(item.productId);
            return catId && coupon.applicableCategoryIds!.includes(catId);
          }
        );
        if (!hasApplicableCategory) {
          return NextResponse.json({
            success: false,
            error: 'Kupon ini tidak berlaku untuk kategori produk di keranjang Anda',
            code: 'COUPON_NOT_APPLICABLE_TO_CATEGORY',
          }, { status: 400 });
        }
      }
    }

    let discountAmount = 0;
    switch (coupon.type) {
      case 'percentage': {
        discountAmount = Math.floor((coupon.discountValue ?? 0) / 100 * subtotal);
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
        break;
      }
      case 'fixed':
        discountAmount = Math.min(coupon.discountValue ?? 0, subtotal);
        break;
      case 'buy_x_get_y':
        discountAmount = 0;
        break;
      case 'free_shipping':
        discountAmount = 0;
        break;
    }

    return success({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      discountAmount,
      minOrderAmount: coupon.minOrderAmount ?? 0,
      descriptionId: coupon.descriptionId,
      descriptionEn: coupon.descriptionEn,
    });

  } catch (error) {
    console.error('[checkout/validate-coupon]', error);
    return serverError(error);
  }
}
