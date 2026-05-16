import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  coupons,
  couponUsages,
  users,
  productVariants,
  products,
  addresses,
  orderDailyCounters,
  pointsHistory,
  orderStatusHistory,
  b2bProfiles,
} from '@/lib/db/schema';
import { eq, and, inArray, sql, or, desc, gte } from 'drizzle-orm';
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

    let isB2bOrder = false;

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

      // Use B2B price if user is B2B role and variant has b2bPrice
      const unitPrice = (session?.user?.role === 'b2b' && variant.b2bPrice && variant.b2bPrice > 0)
        ? variant.b2bPrice
        : variant.price;

      if (session?.user?.role === 'b2b') {
        isB2bOrder = true;
      }

      const itemSubtotal = unitPrice * item.quantity;
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
        unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        weightGram: item.weightGram,
      });
    }

    // ── Step 2: Validate coupon ───────────────────────────────────────────
    let discountAmount = parsed.data.discountAmount ?? 0;
    let couponId: string | null = null;
    let coupon: Awaited<ReturnType<typeof db.query.coupons.findFirst>> = undefined;
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
      coupon = await db.query.coupons.findFirst({
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

        // If qualifyingVariants is empty (all variants already in cart), pick lowest-priced anyway as free item
        const selectedVariants = qualifyingVariants.length >= getQty
          ? qualifyingVariants.slice(0, getQty)
          : qualifyingVariants.slice(0, getQty);

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
    const requestedPointsDiscount = parsed.data.pointsDiscount ?? 0;
    // Enforce 50% of subtotal cap server-side (client may try to exceed)
    const maxPointsDiscount = Math.floor(subtotal * 0.5);
    const pointsDiscount = Math.min(requestedPointsDiscount, maxPointsDiscount);
    let pointsDeducted = false;
    const userId = session?.user?.id ?? null;

    // FIX 3: Guest checkout idempotency — check for very recent order (30 seconds) with same email + subtotal for guest users
    // NOTE: totalAmount cannot be used here because it requires coupon validation (discountAmount) first.
    // Using subtotal as a proxy for amount since shipping is 0 for guests at this stage.
    if (!userId && recipientEmail) {
      const thirtySecsAgo = new Date(Date.now() - 30 * 1000);
      const recentGuestOrder = await db.query.orders.findFirst({
        where: and(
          eq(orders.recipientEmail, recipientEmail.toLowerCase()),
          eq(orders.status, 'pending_payment'),
          gte(orders.createdAt, thirtySecsAgo),
          eq(orders.subtotal, subtotal)
        ),
        orderBy: [desc(orders.createdAt)],
      });

      if (recentGuestOrder?.midtransSnapToken) {
        return success({
          orderId: recentGuestOrder.id,
          orderNumber: recentGuestOrder.orderNumber,
          snapToken: recentGuestOrder.midtransSnapToken,
        });
      }
    }

    // Idempotency: return existing pending order if same user checks out within 30 seconds with same subtotal
    if (userId) {
      const existingPending = await db.query.orders.findFirst({
        where: and(
          eq(orders.userId, userId),
          eq(orders.status, 'pending_payment'),
          gte(orders.createdAt, new Date(Date.now() - 30 * 1000)),
          eq(orders.subtotal, subtotal)
        ),
        orderBy: [desc(orders.createdAt)],
      });

      if (existingPending?.midtransSnapToken) {
        return success({
          orderId: existingPending.id,
          orderNumber: existingPending.orderNumber,
          snapToken: existingPending.midtransSnapToken,
        });
      }
    }

    if (userId && pointsUsed && pointsUsed > 0) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user || user.pointsBalance < pointsUsed) {
        return conflict('Saldo poin tidak mencukupi');
      }
      pointsDeducted = true;
    }

    // ── B2B Net-30 Check: skip Midtrans for Net-30 approved B2B users ─
    let isNet30Order = false;
    let net30PaymentDueAt: Date | null = null;

    if (userId && session?.user?.role === 'b2b') {
      const b2bProfile = await db.query.b2bProfiles.findFirst({
        where: eq(b2bProfiles.userId, userId),
      });

      if (b2bProfile?.isNet30Approved) {
        isNet30Order = true;
        net30PaymentDueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      }
    }

    // FIX 10: Coupon per-user limit — check by userId for logged-in, by email for guests
    if (coupon && coupon.maxUsesPerUser) {
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
        // For guest users, check by email via orders join
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

    const baseShippingCost = deliveryMethod === 'pickup' ? 0 : (addressData.courierCode ? (parsed.data.shippingCost ?? 0) : 0);
    const shippingCost = (coupon && (coupon.type === 'free_shipping' || coupon.freeShipping)) && deliveryMethod === 'delivery'
      ? 0
      : baseShippingCost;
    const totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost;
    const pointsEarnedBase = Math.floor(subtotal / 1000) * POINTS_EARN_RATE;
    const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;

    // ── Step 5: Generate order number using atomic DB counter ───────────
    const today = new Date().toISOString().slice(0, 10); // "2026-05-14"

    const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;
    const paymentExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // ── Step 6: Create order + deduct points in single transaction ───────
    // Atomic upsert: INSERT new counter or increment existing counter in a single statement
    const counterResult = await db.transaction(async (tx) => {
      const result = await tx
        .insert(orderDailyCounters)
        .values({
          date: today,
          lastSequence: 1,
        })
        .onConflictDoUpdate({
          target: orderDailyCounters.date,
          set: {
            lastSequence: sql`${orderDailyCounters.lastSequence} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ newSequence: orderDailyCounters.lastSequence });

      const seq = result[0]?.newSequence ?? 1;
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

        // Deduct from user balance using conditional update (prevents negative balance)
        const updatedUsers = await tx
          .update(users)
          .set({ pointsBalance: sql`points_balance - ${pointsUsed}` })
          .where(and(
            eq(users.id, userId),
            gte(users.pointsBalance, pointsUsed)
          ))
          .returning({ pointsBalance: users.pointsBalance });

        if (updatedUsers.length === 0) {
          throw new Error('Poin tidak mencukupi atau terjadi kesalahan');
        }

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

      // Determine order status based on payment method
    // For Net-30 B2B orders: status is 'paid' directly (no Midtrans needed)
    // For regular orders: status is 'pending_payment' (needs Midtrans payment)
    const orderStatus: 'pending_payment' | 'paid' = isNet30Order ? 'paid' : 'pending_payment';

    const [created] = await tx
        .insert(orders)
        .values({
          orderNumber,
          pickupCode: deliveryMethod === 'pickup' ? orderNumber : null,
          userId: session?.user?.id ?? null,
          status: orderStatus,
          isB2b: isB2bOrder,
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
          paymentExpiresAt: isNet30Order ? null : paymentExpiresAt,
          paymentRetryCount: 0,
          paymentMethod: isNet30Order ? 'net30' : 'midtrans',
          paymentDueAt: net30PaymentDueAt,
          // For Net-30 orders, mark as paid immediately
          paidAt: isNet30Order ? new Date() : null,
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

      // FIX 2: Back-fill orderId on points redeem records created during this transaction
      if (userId && pointsDeducted) {
        await tx
          .update(pointsHistory)
          .set({ orderId: created.id })
          .where(
            and(
              eq(pointsHistory.userId, userId),
              eq(pointsHistory.type, 'redeem'),
              sql`${pointsHistory.orderId} IS NULL`,
              gte(pointsHistory.createdAt, sql`NOW() - INTERVAL '30 seconds'`)
            )
          );
      }

      return [created];
    });

    // Write initial status history
    const order = counterResult[0]!;

    // For Net-30 orders, write 'paid' status history; otherwise 'pending_payment'
    const initialStatus: 'pending_payment' | 'paid' = isNet30Order ? 'paid' : 'pending_payment';
    const initialNote = isNet30Order
      ? 'Pesanan B2B Net-30, langsung lunas'
      : 'Pesanan dibuat, menunggu pembayaran';

    await db.transaction(async (tx) => {
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: null,
        toStatus: initialStatus,
        changedByUserId: userId,
        changedByType: 'system',
        note: initialNote,
      });
    });

    // ── Step 8: For Net-30 B2B orders, skip Midtrans and return immediately ─
    if (isNet30Order) {
      return success({
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        snapToken: null,
        net30: true,
        paymentDueAt: net30PaymentDueAt?.toISOString() ?? null,
      });
    }

    // ── Step 8b: Create Midtrans transaction ─────────────────────────────
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
        price: 1,
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
      orderNumber: order.orderNumber,
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
      .where(eq(orders.id, order.id));

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      snapToken,
    });
    } catch (error) {
      console.error('[checkout/initiate]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 10 }
);