import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, orderStatusHistory, productVariants, products, users, coupons, couponUsages } from '@/lib/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { success, serverError, validationError, conflict, unauthorized } from '@/lib/utils/api-response';
import { CheckoutSchema } from '@/lib/validations/checkout.schema';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { validateCoupon } from '@/lib/services/coupon.service';
import { validatePointsRedemption, pointsToIDR, redeemPoints } from '@/lib/services/points.service';
import { calculateShippingCost } from '@/lib/services/shipping.service';
import { generateOrderNumber } from '@/lib/services/order.service';
import { POINTS_EARN_RATE } from '@/lib/constants/points';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const [user] = order.userId
    ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, order.userId)).limit(1)
    : [{ name: order.recipientName, email: order.recipientEmail }];

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const firstName = user?.name?.split(' ')[0] ?? order.recipientName;

  await resend.emails.send({
    from: 'Dapur Dekaka <pesanan@dapurdekaka.com>',
    to: user?.email ?? order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} Dikonfirmasi`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #C8102E; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #F0EAD6; margin: 0; font-size: 24px;">Dapur Dekaka</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px;">Hai <strong>${firstName}</strong></p>
          <p style="color: #6B6B6B;">Pesanan kamu sudah kami terima dan sedang kami proses dengan penuh cinta.</p>
          <p style="font-size: 14px; color: #6B6B6B;">Detail pesanan: <strong>${order.orderNumber}</strong></p>
          <p style="font-size: 14px;">Total: <strong style="color: #C8102E;">Rp ${order.totalAmount.toLocaleString('id-ID')}</strong></p>
          <p style="color: #6B6B6B; font-size: 12px;">Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
        </div>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized();
    }

    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { items, shippingAddress, courierCode, courierService, couponCode, pointsToRedeem, notes } = parsed.data;

    const variantIds = items.map((i) => i.variantId);
    const dbVariants = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        nameId: productVariants.nameId,
        nameEn: productVariants.nameEn,
        sku: productVariants.sku,
        price: productVariants.price,
        stock: productVariants.stock,
        weightGram: productVariants.weightGram,
        isActive: productVariants.isActive,
        productNameId: products.nameId,
        productNameEn: products.nameEn,
        productSlug: products.slug,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(productVariants.id, variantIds));

    for (const item of items) {
      const variant = dbVariants.find((v) => v.id === item.variantId);
      if (!variant || !variant.isActive) {
        return conflict('Produk tidak tersedia');
      }
      if ((variant.stock ?? 0) < item.quantity) {
        return conflict(
          `Stok tidak mencukupi untuk ${variant.productNameId} — ${variant.nameId} (tersisa ${variant.stock})`
        );
      }
    }

    const subtotalIDR = items.reduce((sum, item) => {
      const variant = dbVariants.find((v) => v.id === item.variantId)!;
      return sum + (variant.price ?? 0) * item.quantity;
    }, 0);

    const totalWeightGram = items.reduce((sum, item) => {
      const variant = dbVariants.find((v) => v.id === item.variantId)!;
      return sum + (variant.weightGram ?? 0) * item.quantity;
    }, 0);

    const originCityId = process.env.RAJAONGKIR_ORIGIN_CITY_ID ?? '23';
    const shippingOptions = await calculateShippingCost({
      originCityId,
      destinationCityId: shippingAddress.cityId,
      weightGram: totalWeightGram,
    });

    const selectedShipping = shippingOptions.find(
      (s) => s.courier === courierCode && s.service === courierService
    );

    if (!selectedShipping) {
      return conflict('Opsi pengiriman tidak valid. Silakan pilih ulang.');
    }

    const shippingCostIDR = selectedShipping.costIDR;

    let couponDiscountIDR = 0;
    let couponId: string | null = null;

    if (couponCode) {
      const couponResult = await validateCoupon({
        code: couponCode,
        userId: session.user.id,
        subtotalIDR,
        shippingCostIDR,
      });

      if (!couponResult.valid) {
        return conflict(couponResult.error ?? 'Kupon tidak valid');
      }

      couponDiscountIDR = couponResult.discountIDR ?? 0;
      couponId = couponResult.coupon?.id ?? null;
    }

    let pointsDiscountIDR = 0;

    if (pointsToRedeem > 0) {
      const [userData] = await db
        .select({ pointsBalance: users.pointsBalance })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      const pointsValidation = validatePointsRedemption(
        userData?.pointsBalance ?? 0,
        pointsToRedeem,
        subtotalIDR
      );

      if (!pointsValidation.valid) {
        return conflict(pointsValidation.error ?? 'Penukaran poin tidak valid');
      }

      pointsDiscountIDR = pointsToIDR(pointsToRedeem);
    }

    const totalDiscountIDR = couponDiscountIDR + pointsDiscountIDR;
    const totalAmountIDR = Math.max(subtotalIDR + shippingCostIDR - totalDiscountIDR, 1000);
    const pointsEarned = Math.floor(subtotalIDR / 1000) * POINTS_EARN_RATE;

    const orderNumber = await generateOrderNumber();

    const [newOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        userId: session.user.id,
        status: 'pending_payment',
        deliveryMethod: 'delivery',
        recipientName: shippingAddress.recipientName,
        recipientEmail: session.user.email ?? '',
        recipientPhone: shippingAddress.phone,
        addressLine: shippingAddress.fullAddress,
        district: shippingAddress.district,
        city: shippingAddress.city,
        cityId: shippingAddress.cityId,
        province: shippingAddress.province,
        provinceId: shippingAddress.provinceId,
        postalCode: shippingAddress.postalCode,
        courierCode,
        courierService,
        courierName: selectedShipping.name,
        shippingCost: shippingCostIDR,
        estimatedDays: selectedShipping.estimatedDays,
        subtotal: subtotalIDR,
        discountAmount: totalDiscountIDR,
        pointsDiscount: pointsDiscountIDR,
        totalAmount: totalAmountIDR,
        couponId,
        couponCode: couponCode?.toUpperCase() ?? null,
        pointsUsed: pointsToRedeem ?? 0,
        pointsEarned,
        customerNote: notes ?? null,
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        paymentRetryCount: 0,
      })
      .returning();

    if (!newOrder) {
      throw new Error('Failed to create order');
    }

    const newOrderId = newOrder.id;

    await db.insert(orderItems).values(
      items.map((item) => {
        const variant = dbVariants.find((v) => v.id === item.variantId)!;
        return {
          orderId: newOrderId,
          variantId: item.variantId,
          productId: variant.productId,
          productNameId: variant.productNameId ?? '',
          productNameEn: variant.productNameEn ?? '',
          variantNameId: variant.nameId,
          variantNameEn: variant.nameEn,
          sku: variant.sku,
          productImageUrl: null,
          unitPrice: variant.price ?? 0,
          quantity: item.quantity,
          subtotal: (variant.price ?? 0) * item.quantity,
          weightGram: variant.weightGram ?? 0,
        };
      })
    );

    await db.insert(orderStatusHistory).values({
      orderId: newOrderId,
      toStatus: 'pending_payment',
      changedByType: 'system',
      note: 'Pesanan dibuat, menunggu pembayaran',
    });

    if (pointsToRedeem > 0) {
      await db.transaction(async (tx) => {
        await redeemPoints(
          session.user.id,
          newOrderId,
          pointsToRedeem,
          `Penukaran poin untuk diskon Rp ${pointsDiscountIDR.toLocaleString('id-ID')}`,
          tx
        );
      });
    }

    if (couponId) {
      await db
        .update(coupons)
        .set({ usedCount: sql`used_count + 1` })
        .where(eq(coupons.id, couponId));

      await db.insert(couponUsages).values({
        couponId,
        orderId: newOrderId,
        userId: session.user.id,
        discountApplied: couponDiscountIDR,
      });
    }

    const itemDetails = items.map((item) => {
      const variant = dbVariants.find((v) => v.id === item.variantId)!;
      return {
        id: variant.id,
        price: variant.price ?? 0,
        quantity: item.quantity,
        name: `${(variant.productNameId ?? '').substring(0, 40)} - ${variant.nameId}`.substring(0, 50),
      };
    });

    itemDetails.push({
      id: `SHIPPING-${courierCode.toUpperCase()}`,
      price: shippingCostIDR,
      quantity: 1,
      name: `Ongkir ${selectedShipping.name}`.substring(0, 50),
    });

    if (totalDiscountIDR > 0) {
      itemDetails.push({
        id: 'DISCOUNT',
        price: -totalDiscountIDR,
        quantity: 1,
        name: 'Diskon (Kupon + Poin)',
      });
    }

    const { snapToken, midtransOrderId } = await createMidtransTransaction({
      orderNumber,
      retryCount: 0,
      grossAmount: totalAmountIDR,
      customerName: shippingAddress.recipientName,
      customerEmail: session.user.email ?? '',
      customerPhone: shippingAddress.phone,
      items: itemDetails,
    });

    await db
      .update(orders)
      .set({ midtransSnapToken: snapToken, midtransOrderId })
      .where(eq(orders.id, newOrderId));

    return success({
      orderId: newOrderId,
      orderNumber,
      totalAmount: totalAmountIDR,
      snapToken,
    });
  } catch (error) {
    console.error('[checkout/initiate]', error);
    return serverError(error);
  }
}