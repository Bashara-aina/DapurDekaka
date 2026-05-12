import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  coupons,
  users,
  productVariants,
  addresses,
} from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { success, serverError, validationError, conflict, unauthorized } from '@/lib/utils/api-response';
import { z } from 'zod';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { POINTS_EARN_RATE } from '@/lib/constants/points';

const initiateSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        productId: z.string().uuid(),
        productNameId: z.string(),
        productNameEn: z.string(),
        variantNameId: z.string(),
        variantNameEn: z.string(),
        sku: z.string(),
        imageUrl: z.string().optional(),
        unitPrice: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
        weightGram: z.number().int().positive(),
      })
    ),
  deliveryMethod: z.enum(['delivery', 'pickup']),
  recipientName: z.string().min(2),
  recipientEmail: z.string().email(),
  recipientPhone: z.string().min(8),
  addressLine: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  cityId: z.string().optional(),
  province: z.string().optional(),
  provinceId: z.string().optional(),
  postalCode: z.string().optional(),
  courierCode: z.string().optional(),
  courierService: z.string().optional(),
  courierName: z.string().optional(),
  shippingCost: z.number().int().min(0).optional(),
  couponCode: z.string().optional(),
  pointsUsed: z.number().int().min(0).optional(),
  customerNote: z.string().optional(),
  subtotal: z.number().int().positive(),
  discountAmount: z.number().int().min(0).optional(),
  pointsDiscount: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const parsed = initiateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const {
      items,
      deliveryMethod,
      recipientName,
      recipientEmail,
      recipientPhone,
      couponCode,
      pointsUsed,
      ...addressData
    } = parsed.data;

    // ── Step 1: Validate stock + prices from DB ──────────────────────────
    const variantIds = items.map((i) => i.variantId);
    const dbVariants = await db.query.productVariants.findMany({
      where: inArray(productVariants.id, variantIds),
    });

    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const variant = dbVariants.find((v) => v.id === item.variantId);
      if (!variant) {
        return conflict(`Variant tidak ditemukan`);
      }
      if (variant.stock < item.quantity) {
        return conflict(
          `Stok tidak mencukupi untuk ${item.variantNameId} (tersisa ${variant.stock})`
        );
      }

      const itemSubtotal = variant.price * item.quantity;
      subtotal += itemSubtotal;

      orderItemsData.push({
        orderId: '', // set after order creation
        variantId: variant.id,
        productId: variant.productId,
        productNameId: item.productNameId,
        productNameEn: item.productNameEn,
        variantNameId: item.variantNameId,
        variantNameEn: item.variantNameEn,
        sku: item.sku,
        productImageUrl: item.imageUrl,
        unitPrice: variant.price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        weightGram: item.weightGram,
      });
    }

    // ── Step 2: Validate coupon ───────────────────────────────────────────
    let discountAmount = parsed.data.discountAmount ?? 0;
    let couponId: string | null = null;

    if (couponCode) {
      const coupon = await db.query.coupons.findFirst({
        where: and(
          eq(coupons.code, couponCode.toUpperCase()),
          eq(coupons.isActive, true)
        ),
      });

      if (!coupon) {
        return conflict('Kupon tidak ditemukan atau sudah tidak berlaku');
      }

      if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
        return conflict(
          `Minimal pembelian ${coupon.minOrderAmount.toLocaleString('id-ID')} untuk kupon ini`
        );
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return conflict('Kupon sudah expired');
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return conflict('Kupon sudah mencapai batas penggunaan');
      }

      couponId = coupon.id;

      if (coupon.type === 'percentage') {
        discountAmount = Math.floor((coupon.discountValue! / 100) * subtotal);
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
          discountAmount = coupon.maxDiscountAmount;
        }
      } else if (coupon.type === 'fixed') {
        discountAmount = coupon.discountValue!;
      }
    }

    // ── Step 3: Validate + deduct points ─────────────────────────────────
    const pointsDiscount = parsed.data.pointsDiscount ?? 0;

    if (session?.user && pointsUsed && pointsUsed > 0) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });

      if (!user || user.pointsBalance < pointsUsed) {
        return conflict('Saldo poin tidak mencukupi');
      }

      // Deduct points immediately (tentative — reversed on payment failure)
      await db
        .update(users)
        .set({ pointsBalance: sql`points_balance - ${pointsUsed}` })
        .where(eq(users.id, session.user.id));
    }

    // ── Step 4: Calculate totals ────────────────────────────────────────
    const shippingCost = deliveryMethod === 'pickup' ? 0 : (addressData.courierCode ? (parsed.data.shippingCost ?? 0) : 0);
    const totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost;
    const pointsEarned = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;

    // ── Step 5: Generate order number ───────────────────────────────────
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = generateOrderNumber(randomSeq);

    // ── Step 6: Create order ──────────────────────────────────────────────
    const [newOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        userId: session?.user?.id ?? null,
        status: 'pending_payment',
        deliveryMethod,
        recipientName,
        recipientEmail,
        recipientPhone,
        addressLine: addressData.addressLine,
        district: addressData.district,
        city: addressData.city,
        cityId: addressData.cityId,
        province: addressData.province,
        provinceId: addressData.provinceId,
        postalCode: addressData.postalCode,
        courierCode: addressData.courierCode,
        courierService: addressData.courierService,
        courierName: addressData.courierName,
        shippingCost,
        subtotal,
        discountAmount,
        pointsDiscount,
        totalAmount,
        couponId,
        couponCode: couponCode?.toUpperCase(),
        pointsUsed: pointsUsed ?? 0,
        pointsEarned,
        customerNote: parsed.data.customerNote,
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        paymentRetryCount: 0,
      })
      .returning();

    if (!newOrder) {
      throw new Error('Failed to create order');
    }

    // ── Step 7: Create order items ───────────────────────────────────────
    const itemsWithOrderId = orderItemsData.map((item) => ({
      ...item,
      orderId: newOrder.id,
    }));

    await db.insert(orderItems).values(itemsWithOrderId);

    // ── Step 8: Create Midtrans transaction ─────────────────────────────
    const itemDetails = items.map((item) => ({
      id: item.variantId,
      price: item.unitPrice,
      quantity: item.quantity,
      name: `${item.productNameId.substring(0, 45)} - ${item.variantNameId}`.substring(0, 50),
    }));

    if (shippingCost > 0) {
      itemDetails.push({
        id: 'shipping',
        price: shippingCost,
        quantity: 1,
        name: `Ongkir ${addressData.courierName ?? ''}`.substring(0, 50),
      });
    }

    if (discountAmount + pointsDiscount > 0) {
      itemDetails.push({
        id: 'discount',
        price: -(discountAmount + pointsDiscount),
        quantity: 1,
        name: 'Diskon & Poin',
      });
    }

    const { snapToken, midtransOrderId } = await createMidtransTransaction({
      orderNumber,
      retryCount: 0,
      grossAmount: totalAmount,
      customerName: recipientName,
      customerEmail: recipientEmail,
      customerPhone: recipientPhone,
      items: itemDetails,
    });

    // ── Step 9: Update order with Midtrans IDs ───────────────────────────
    await db
      .update(orders)
      .set({
        midtransOrderId,
        midtransSnapToken: snapToken,
      })
      .where(eq(orders.id, newOrder.id));

    return success({
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      totalAmount: newOrder.totalAmount,
      snapToken,
    });
  } catch (error) {
    console.error('[checkout/initiate]', error);
    return serverError(error);
  }
}