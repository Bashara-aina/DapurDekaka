import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  coupons,
  users,
  productVariants,
  products,
  addresses,
  orderDailyCounters,
  pointsHistory,
} from '@/lib/db/schema';
import { eq, and, inArray, sql, or } from 'drizzle-orm';
import { success, serverError, validationError, conflict, unauthorized } from '@/lib/utils/api-response';
import { z } from 'zod';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { POINTS_EARN_RATE } from '@/lib/constants/points';
import { getSetting } from '@/lib/settings/get-settings';
import { withRateLimit } from '@/lib/utils/rate-limit';

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

export const POST = withRateLimit(
  async (req: NextRequest) => {
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
    const orderItemsData: Array<{
      orderId: string;
      variantId: string;
      productId: string;
      productNameId: string;
      productNameEn: string;
      variantNameId: string;
      variantNameEn: string;
      sku: string;
      productImageUrl: string | null | undefined;
      unitPrice: number;
      quantity: number;
      subtotal: number;
      weightGram: number;
    }> = [];

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
    let freeItems: Array<{
      variantId: string;
      productId: string;
      productNameId: string;
      productNameEn: string;
      variantNameId: string;
      variantNameEn: string;
      sku: string;
      productImageUrl: string | null;
      unitPrice: number;
      quantity: number;
      subtotal: number;
      weightGram: number;
    }> = [];

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
      } else if (coupon.type === 'buy_x_get_y') {
        // buy_x_get_y: no monetary discount, add free items to order
        const buyQty = coupon.buyQuantity ?? 1;
        const getQty = coupon.getQuantity ?? 1;

        // Check if cart has qualifying quantity
        const cartByProduct: Record<string, number> = {};
        for (const item of items) {
          cartByProduct[item.productId] = (cartByProduct[item.productId] ?? 0) + item.quantity;
        }

        let qualifies = false;
        for (const [pid, qty] of Object.entries(cartByProduct)) {
          if (qty >= buyQty) {
            qualifies = true;
            break;
          }
        }

        if (!qualifies) {
          return conflict(`Beli minimal ${buyQty} item untuk menggunakan kupon ini`);
        }

        // Find the product with most quantity in cart to attach free items to
        let qualifyingProductId = '';
        let maxQty = 0;
        for (const [pid, qty] of Object.entries(cartByProduct)) {
          if (qty >= buyQty && qty > maxQty) {
            maxQty = qty;
            qualifyingProductId = pid;
          }
        }

        // Get lowest-priced active variants of qualifying product
        const qualifyingVariants = await db.query.productVariants.findMany({
          where: and(
            eq(productVariants.productId, qualifyingProductId),
            eq(productVariants.isActive, true)
          ),
          orderBy: (variants, { asc }) => [asc(variants.price)],
        });

        // Exclude variants already in cart
        const cartVariantIds = new Set(items.map((i) => i.variantId));
        const eligibleVariants = qualifyingVariants.filter((v) => !cartVariantIds.has(v.id));

        // Pick lowest-priced variants up to getQty
        const selectedVariants = eligibleVariants.slice(0, getQty);

        // Find product info for free items
        const productInfo = await db.query.products.findFirst({
          where: eq(products.id, qualifyingProductId),
        });

        // Find a cart item to copy image/sku/weight info from
        const refItem = items.find((i) => i.productId === qualifyingProductId);

        for (const variant of selectedVariants) {
          freeItems.push({
            variantId: variant.id,
            productId: qualifyingProductId,
            productNameId: productInfo?.nameId ?? 'Produk Gratis',
            productNameEn: productInfo?.nameEn ?? 'Free Product',
            variantNameId: variant.nameId,
            variantNameEn: variant.nameEn,
            sku: variant.sku,
            productImageUrl: refItem?.imageUrl ?? null,
            unitPrice: 0,
            quantity: 1,
            subtotal: 0,
            weightGram: variant.weightGram,
          });
        }
      }
    }

    // ── Step 3: Validate + deduct points inside transaction ────────────
    const pointsDiscount = parsed.data.pointsDiscount ?? 0;
    let pointsDeducted = false;
    const userId = session?.user?.id ?? null;

    if (userId && pointsUsed && pointsUsed > 0) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user || user.pointsBalance < pointsUsed) {
        return conflict('Saldo poin tidak mencukupi');
      }
      pointsDeducted = true;
    }

    // ── Step 4: Calculate totals ────────────────────────────────────────
    const shippingCost = deliveryMethod === 'pickup' ? 0 : (addressData.courierCode ? (parsed.data.shippingCost ?? 0) : 0);
    const totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost;
    const pointsEarned = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;

    // ── Step 5: Generate order number using atomic DB counter ───────────
    const today = new Date().toISOString().slice(0, 10); // "2026-05-14"

    const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;
    const paymentExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // ── Step 6: Create order + deduct points in single transaction ───────
    const [newOrder] = await db.transaction(async (tx) => {
      // Get or create daily counter for today
      const [counterRow] = await tx
        .insert(orderDailyCounters)
        .values({
          date: today,
          lastSequence: 0,
        })
        .onConflictDoUpdate({
          target: orderDailyCounters.date,
          set: {
            updatedAt: new Date(),
          },
        })
        .returning({ id: orderDailyCounters.id });

      // Atomic increment: increment and return new sequence
      const updatedCounters = await tx
        .update(orderDailyCounters)
        .set({
          lastSequence: sql`last_sequence + 1`,
          updatedAt: new Date(),
        })
        .where(eq(orderDailyCounters.id, counterRow!.id))
        .returning({ newSequence: orderDailyCounters.lastSequence });

      const seq = (updatedCounters[0]?.newSequence ?? 1) + 1; // +1 because increment hasn't committed yet in same tx
      const orderNumber = generateOrderNumber(seq);

      // Deduct points using FIFO inside transaction (rollback-safe)
      if (pointsDeducted && userId && pointsUsed) {
        // Find oldest unconsumed, unexpired earn records (FIFO order)
        const earnRecords = await tx
          .select()
          .from(pointsHistory)
          .where(
            and(
              eq(pointsHistory.userId, userId),
              eq(pointsHistory.type, 'earn'),
              sql`${pointsHistory.consumedAt} IS NULL`,
              or(
                sql`${pointsHistory.expiresAt} IS NULL`,
                sql`${pointsHistory.expiresAt} > NOW()`
              )
            )
          )
          .orderBy(pointsHistory.createdAt)
          .limit(pointsUsed);

        // Deduct from user balance
        await tx
          .update(users)
          .set({ pointsBalance: sql`points_balance - ${pointsUsed}` })
          .where(eq(users.id, userId));

        // Create redeem records referencing specific earn IDs (FIFO)
        let remainingToDeduct = pointsUsed;
        for (const earnRecord of earnRecords) {
          if (remainingToDeduct <= 0) break;
          const deductFromThis = Math.min(earnRecord.pointsAmount, remainingToDeduct);
          remainingToDeduct -= deductFromThis;

          // Mark the earn record as consumed
          await tx
            .update(pointsHistory)
            .set({ consumedAt: new Date() })
            .where(eq(pointsHistory.id, earnRecord.id));

          // Create redeem record referencing this earn
          await tx.insert(pointsHistory).values({
            userId,
            type: 'redeem',
            pointsAmount: -deductFromThis,
            pointsBalanceAfter: sql`points_balance`,
            orderId: null,
            descriptionId: `Tukar poin untuk pesanan (FIFO)`,
            descriptionEn: `Redeem points for order (FIFO)`,
            referencedEarnId: earnRecord.id,
          });
        }
      }

      const [created] = await tx
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
          paymentExpiresAt,
          paymentRetryCount: 0,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create order');
      }

      // Create order items
      const itemsWithOrderId = orderItemsData.map((item) => ({
        ...item,
        orderId: created.id,
      }));
      await tx.insert(orderItems).values(itemsWithOrderId);

      // Add free items for buy_x_get_y coupon
      if (freeItems.length > 0) {
        const freeItemsWithOrderId = freeItems.map((item) => ({
          ...item,
          orderId: created.id,
        }));
        await tx.insert(orderItems).values(freeItemsWithOrderId);
      }

      return [created];
    });

    // ── Step 8: Create Midtrans transaction ─────────────────────────────
    const itemDetails = items.map((item) => ({
      id: item.variantId,
      price: item.unitPrice,
      quantity: item.quantity,
      name: `${item.productNameId.substring(0, 45)} - ${item.variantNameId}`.substring(0, 50),
    }));

    // Add free items to Midtrans item details
    for (const freeItem of freeItems) {
      itemDetails.push({
        id: freeItem.variantId,
        price: 0,
        quantity: freeItem.quantity,
        name: `FREE: ${freeItem.productNameId.substring(0, 40)} - ${freeItem.variantNameId}`.substring(0, 50),
      });
    }

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
      orderNumber: newOrder.orderNumber,
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
  },
  { windowMs: 60000, maxRequests: 10 }
);