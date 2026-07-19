import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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
  inventoryLogs,
} from '@/lib/db/schema';
import { eq, and, inArray, sql, or, desc, gte, gt } from 'drizzle-orm';
import { success, serverError, validationError, conflict, unauthorized, serviceUnavailable, unprocessableEntity } from '@/lib/utils/api-response';
import { z } from 'zod';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { POINTS_EARN_RATE, POINTS_EXPIRY_DAYS } from '@/lib/constants/points';
import { calculatePointsEarned } from '@/lib/finance/points-calculator';
import { getSetting } from '@/lib/settings/get-settings';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';
import {
  validateSelectedQuote,
  calculateInsuranceFee,
  verifyInsuranceFee,
  getMarkupAmount,
} from '@/lib/shipping';
import { enforceShippingPhaseGates } from '@/lib/shipping/phase-gate';
import { MIN_ORDER_FOR_COUPON_IDR, B2B_CREDIT_ENABLED_DEFAULT } from '@/lib/constants/financial-rules';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { enforceCouponCap } from '@/lib/finance/points-calculator';
import { parseQuoteId } from '@/lib/shipping/get-rates';
import type { InsuranceType, ShippingItemInput, ShippingTier } from '@/lib/shipping/types';

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
    )
    .min(1, 'Minimal 1 item di keranjang'),
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
  shippingTier: z.enum(['express', 'frozen_same_day', 'frozen_express', 'pickup']).optional(),
  selectedQuoteId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  biteshipAreaId: z.string().optional(),
  insuranceType: z.enum(['none', 'basic', 'premium']).optional(),
  insuranceFee: z.number().int().min(0).optional(),
  courierInstantAck: z.boolean().optional(),
  biteshipActualCost: z.number().int().min(0).optional(),
  customerShippingCost: z.number().int().min(0).optional(),
  couponCode: z.string().optional(),
  pointsUsed: z.number().int().min(0).optional(),
  customerNote: z.string().optional(),
  subtotal: z.number().int().positive(),
  discountAmount: z.number().int().min(0).optional(),
  pointsDiscount: z.number().int().min(0).optional(),
}).superRefine((data, ctx) => {
  // Delivery orders MUST carry a full destination address (P2/P0#6).
  if (data.deliveryMethod === 'delivery') {
    if (!data.addressLine || data.addressLine.trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['addressLine'],
        message: 'Alamat lengkap wajib diisi untuk pengiriman',
      });
    }
    if (!data.postalCode || !/^\d{5}$/.test(data.postalCode.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postalCode'],
        message: 'Kode pos 5 digit wajib diisi untuk pengiriman',
      });
    }
  }
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

      // L2 Rule 6: free_shipping coupons banned for 90 days
      if (coupon.type === 'free_shipping') {
        return conflict('Kupon free shipping belum tersedia (aturan L2)');
      }
      // L2 Rule 6: minimum order before any coupon applies
      const minOrderRequired = MIN_ORDER_FOR_COUPON_IDR;
      if (subtotal < minOrderRequired) {
        return conflict(`Minimal pembelian Rp ${minOrderRequired.toLocaleString('id-ID')} untuk kupon`);
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

        // FIX 2B: Filter to only in-stock variants before selecting free items
        const inStockVariants = qualifyingVariants.filter((v) => v.stock > 0);
        if (inStockVariants.length === 0) {
          return conflict('Tidak ada stok untuk item gratis dengan kupon ini');
        }

        const selectedVariants = inStockVariants.slice(0, getQty);

        // Warn if requested free quantity exceeds available in-stock variants
        if (selectedVariants.length < getQty) {
          logger.warn('[checkout/initiate] buy_x_get_y', {
            productId: qualifyingProductId,
            requested: getQty,
            available: selectedVariants.length,
          });
        }

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

    // L2 Rule 6 cap: enforce ceiling on monetary discount across percentage/fixed coupons.
    if (coupon && (coupon.type === 'percentage' || coupon.type === 'fixed')) {
      discountAmount = enforceCouponCap(subtotal, discountAmount);
    }

    // ── Step 3: Validate + deduct points inside transaction ────────────
    const requestedPointsDiscount = parsed.data.pointsDiscount ?? 0;
    // Enforce 50% of subtotal cap server-side (client may try to exceed)
    const maxPointsDiscount = Math.floor(subtotal * 0.5);
    const pointsDiscount = Math.min(requestedPointsDiscount, maxPointsDiscount);
    let pointsDeducted = false;
    const userId = session?.user?.id ?? null;

    // FIX 6: Guest checkout idempotency — 60-second dedup window
    if (!userId && recipientEmail) {
      const sixtySecsAgo = new Date(Date.now() - 60 * 1000);
      const recentGuestOrder = await db.query.orders.findFirst({
        where: and(
          eq(orders.recipientEmail, recipientEmail.toLowerCase()),
          eq(orders.status, 'pending_payment'),
          gte(orders.createdAt, sixtySecsAgo),
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
      pointsDeducted = true;
    }

    // ── B2B Net-30 Check: skip Midtrans for Net-30 approved B2B users ─
    let isNet30Order = false;
    let net30PaymentDueAt: Date | null = null;

    if (userId && session?.user?.role === 'b2b') {
      // Net-30 kill switch (L2): B2B credit is prepaid-only by default. The
      // credit path only runs when explicitly enabled via system setting
      // `b2b_credit_enabled`, falling back to B2B_CREDIT_ENABLED_DEFAULT (false).
      const b2bCreditEnabled =
        (await getSetting<boolean>('b2b_credit_enabled', 'boolean')) ?? B2B_CREDIT_ENABLED_DEFAULT;

      if (b2bCreditEnabled) {
        const b2bProfile = await db.query.b2bProfiles.findFirst({
          where: eq(b2bProfiles.userId, userId),
        });

        if (b2bProfile?.isNet30Approved) {
          isNet30Order = true;
          net30PaymentDueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        }
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
    let shippingCost = (coupon && coupon.type === 'free_shipping' && deliveryMethod === 'delivery')
      ? 0
      : baseShippingCost;

    let insuranceFee = 0;
    let resolvedInsuranceType: InsuranceType = 'none';
    let biteshipActualCost: number | null = null;
    let shippingMarkupAmount = 0;
    let shippingTier: ShippingTier | null = null;
    let estimatedDaysFromQuote: string | null = null;
    let originLat: string | null = null;
    let originLng: string | null = null;

    if (deliveryMethod === 'delivery') {
      const {
        selectedQuoteId,
        latitude,
        longitude,
        insuranceType = 'none',
        courierInstantAck,
        customerShippingCost,
        biteshipActualCost: clientActualCost,
      } = parsed.data;

      if (!selectedQuoteId || latitude === undefined || longitude === undefined) {
        return conflict('Alamat pengiriman dan opsi kurir wajib diisi');
      }

      shippingTier = parsed.data.shippingTier ?? parseQuoteId(selectedQuoteId).tier;

      if (shippingTier === 'express' && !courierInstantAck) {
        return conflict('Anda harus menyetujui ketentuan pengiriman express');
      }

      const shippingItems: ShippingItemInput[] = orderItemsData.map((item) => {
        const variant = dbVariants.find((v) => v.id === item.variantId);
        return {
          variantId: item.variantId,
          quantity: item.quantity,
          weightGram: item.weightGram,
          lengthCm: variant?.lengthCm ?? 30,
          widthCm: variant?.widthCm ?? 22,
          heightCm: variant?.heightCm ?? 12,
          name: `${item.productNameId} - ${item.variantNameId}`,
          value: item.subtotal,
        };
      });

      originLat = await getSetting<string>('biteship_origin_lat', 'string');
      originLng = await getSetting<string>('biteship_origin_lng', 'string');

      const validatedQuote = await validateSelectedQuote(
        selectedQuoteId,
        {
          destLat: latitude,
          destLng: longitude,
          items: shippingItems,
          subtotal,
          originLat: originLat ? parseFloat(originLat) : undefined,
          originLng: originLng ? parseFloat(originLng) : undefined,
        },
        customerShippingCost ?? 0,
        clientActualCost ?? 0
      );

      if (!validatedQuote) {
        return conflict('Tarif ongkir tidak valid. Silakan refresh halaman checkout.');
      }

      // FD#3: insurance is hidden at launch — force 'none' server-side while the
      // insuranceUI flag is off so a crafted payload cannot add an insurance fee.
      const effectiveInsuranceType: InsuranceType = isFlagEnabled('insuranceUI')
        ? (insuranceType as InsuranceType)
        : 'none';
      insuranceFee = calculateInsuranceFee(effectiveInsuranceType, subtotal);
      if (
        isFlagEnabled('insuranceUI') &&
        !verifyInsuranceFee(effectiveInsuranceType, subtotal, parsed.data.insuranceFee ?? 0)
      ) {
        return conflict('Biaya asuransi tidak valid');
      }
      resolvedInsuranceType = effectiveInsuranceType;

      shippingCost = validatedQuote.customerCost;
      biteshipActualCost = validatedQuote.actualCost;
      shippingMarkupAmount = getMarkupAmount(validatedQuote.actualCost, validatedQuote.customerCost);
      addressData.courierCode = validatedQuote.courierCode;
      addressData.courierService = validatedQuote.courierType;
      addressData.courierName = validatedQuote.displayName;
      estimatedDaysFromQuote = validatedQuote.estimatedDuration;

      if (coupon && coupon.type === 'free_shipping') {
        shippingCost = 0;
        shippingMarkupAmount = 0;
      }
    } else {
      shippingTier = 'pickup';
    }

    // L3 phase-criteria gate — frozen tiers require the configured phase to be
    // active AND the numeric criteria (orders / spoilage / dispatch failures)
    // to have been met. Runs after stock validation and after shipping tier is
    // known, but before we open a Midtrans transaction.
    if (shippingTier) {
      const gate = await enforceShippingPhaseGates(shippingTier, subtotal);
      if (!gate.ok) {
        if (gate.httpStatus === 503) {
          return serviceUnavailable(gate.message ?? 'Service unavailable', 'PHASE_NOT_READY');
        }
        if (gate.httpStatus === 422) {
          return unprocessableEntity(gate.message ?? 'Unprocessable entity', 'INTERCITY_MIN_ORDER');
        }
      }
    }

    const totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost + insuranceFee;
    // L2 Rule 3: points earn on net product payment (subtotal - coupon - points redeemed).
    // L2 Rule 10: B2B customers earn the same rate as retail (no 2x multiplier).
    const pointsEarned = isNet30Order
      ? calculatePointsEarned({
          subtotal,
          couponDiscount: discountAmount,
          pointsDiscount,
          shippingCost,
          isB2b: isB2bOrder,
        })
      : 0; // non-Net-30 orders: points are awarded at webhook settlement, computed from net-of-discount base.

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
      const redeemRecords: { earnId: string; amountUsed: number }[] = [];
      let pointsBalanceForRedeem = 0;
      if (pointsDeducted && userId && pointsUsed) {
        // Lock user row to prevent concurrent points redemption race condition
        const [balanceRecord] = await tx
          .select({ balance: users.pointsBalance })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');

        if (!balanceRecord || balanceRecord.balance < pointsUsed) {
          throw new Error('Saldo poin tidak mencukupi');
        }

        // Fetch ALL eligible earn records without a row limit.
        // .limit(pointsUsed) limits by row count, not points total — the accumulating
        // loop below determines how many records are needed to cover pointsUsed.
        const earnRecords = await tx
          .select()
          .from(pointsHistory)
          .where(
            and(
              eq(pointsHistory.userId, userId),
              eq(pointsHistory.type, 'earn'),
              sql`${pointsHistory.consumedAt} IS NULL`,
              sql`${pointsHistory.isExpired} = false`,
              gt(pointsHistory.pointsAmount, 0),
            )
          )
          .orderBy(pointsHistory.expiresAt, pointsHistory.createdAt); // FIFO: earliest-expiring first

        // Accumulating loop: walk through records until we cover all of pointsUsed
        let remaining = pointsUsed;
        const toConsume: { id: string; amountUsed: number }[] = [];
        for (const record of earnRecords) {
          if (remaining <= 0) break;
          const amountUsed = Math.min(record.pointsAmount, remaining);
          toConsume.push({ id: record.id, amountUsed });
          remaining -= amountUsed;
        }

        if (remaining > 0) {
          throw new Error('Poin tidak mencukupi atau terjadi kesalahan');
        }

        // Deduct from user balance using GREATEST guard (prevents negative balance)
        const updatedUsers = await tx
          .update(users)
          .set({ pointsBalance: sql`GREATEST(points_balance - ${pointsUsed}, 0)` })
          .where(and(
            eq(users.id, userId),
            gte(users.pointsBalance, pointsUsed)
          ))
          .returning({ pointsBalance: users.pointsBalance });

        if (updatedUsers.length === 0) {
          throw new Error('Poin tidak mencukupi atau terjadi kesalahan');
        }
        const pointsBalanceAfterDeduct = updatedUsers[0]!.pointsBalance;
        pointsBalanceForRedeem = pointsBalanceAfterDeduct;

        // Create redeem records referencing specific earn IDs (FIFO)
        // Collect data first — insert AFTER order is created so orderId is available
        for (const { id, amountUsed } of toConsume) {
          // Mark the earn record as consumed
          await tx
            .update(pointsHistory)
            .set({ consumedAt: new Date() })
            .where(eq(pointsHistory.id, id));

          redeemRecords.push({ earnId: id, amountUsed });
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
          estimatedDays: estimatedDaysFromQuote,
          shippingCost,
          shippingTier: shippingTier ?? undefined,
          latitude: parsed.data.latitude?.toString(),
          longitude: parsed.data.longitude?.toString(),
          originLatitude: originLat,
          originLongitude: originLng,
          biteshipAreaId: parsed.data.biteshipAreaId,
          biteshipActualCost: biteshipActualCost,
          shippingMarkupAmount,
          insuranceType: resolvedInsuranceType,
          insuranceFee,
          dispatchStatus: deliveryMethod === 'pickup' ? 'not_required' : 'pending',
          courierInstantAck: parsed.data.courierInstantAck ?? false,
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

      // Insert redeem records now that orderId is available (FIFO consume)
      for (const { earnId, amountUsed } of redeemRecords) {
        await tx.insert(pointsHistory).values({
          userId: userId!,
          type: 'redeem',
          pointsAmount: -amountUsed,
          pointsBalanceAfter: pointsBalanceForRedeem,
          orderId: created.id,
          descriptionId: `Tukar poin untuk pesanan ${created.orderNumber}`,
          descriptionEn: `Redeem points for order ${created.orderNumber}`,
          referencedEarnId: earnId,
        });
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

      // For Net-30 B2B orders: deduct stock + award points in same transaction
      // Net-30 skips Midtrans so no webhook fires — award points immediately here.
      if (isNet30Order) {
        const allOrderItems = [...orderItemsData, ...freeItems];
        for (const item of allOrderItems) {
          if (item.quantity <= 0) continue;
          const [updated] = await tx
            .update(productVariants)
            .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
            .where(
              and(
                eq(productVariants.id, item.variantId),
                gte(productVariants.stock, item.quantity)
              )
            )
            .returning({ newStock: productVariants.stock });

          if (!updated) {
            throw new Error(`Stok tidak mencukupi untuk variant ${item.variantId}`);
          }

          // Log inventory movement for Net-30 B2B sale
          await tx.insert(inventoryLogs).values({
            variantId: item.variantId,
            changeType: 'sale',
            quantityBefore: updated.newStock + item.quantity,
            quantityAfter: updated.newStock,
            quantityDelta: -item.quantity,
            orderId: created.id,
          });
        }

        // Award loyalty points immediately for Net-30 (same FIFO pattern as settlement webhook).
        // Net-30 skips Midtrans so there is no webhook to award points later.
        if (userId && pointsEarned > 0) {
          const updatedUsers = await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${pointsEarned}` })
            .where(eq(users.id, userId))
            .returning({ pointsBalance: users.pointsBalance });

          const newBalance = updatedUsers[0]?.pointsBalance ?? pointsEarned;

          await tx.insert(pointsHistory).values({
            userId,
            type: 'earn',
            pointsAmount: pointsEarned,
            pointsBalanceAfter: newBalance,
            descriptionId: `Pembelian B2B Net-30 ${created.orderNumber}`,
            descriptionEn: `B2B Net-30 purchase ${created.orderNumber}`,
            orderId: created.id,
            expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
          });
        }

        // Confirm coupon usage for Net-30 (upsert the provisional row if per-user limit was enforced)
        if (coupon && coupon.maxUsesPerUser && userId) {
          await tx
            .insert(couponUsages)
            .values({
              couponId: coupon.id,
              orderId: created.id,
              userId,
              discountApplied: discountAmount,
            })
            .onConflictDoNothing();
        }

        // Increment coupon used_count for Net-30
        if (coupon) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`used_count + 1` })
            .where(eq(coupons.id, coupon.id));
        }
      }

      // BUG-08: Insert provisional couponUsages row to enforce per-user limit under concurrency
      // If order is cancelled, this row is deleted by the cancel/expire webhook handler
      // NOTE: For Net-30 orders, we already inserted/confirmed above, skip duplicate
      if (coupon && coupon.maxUsesPerUser && userId && !isNet30Order) {
        await tx.insert(couponUsages).values({
          couponId: coupon.id,
          orderId: created.id,
          userId,
          discountApplied: discountAmount,
        });
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
    let midtransOrderId: string | null = null;
    let snapToken: string | null = null;

    try {
      const itemDetails = orderItemsData.map((item) => ({
        id: item.variantId,
        price: item.unitPrice,
        quantity: item.quantity,
        name: `${item.productNameId.substring(0, 45)} - ${item.variantNameId}`.substring(0, 50),
      }));

      // Add free items to Midtrans item details (price must be 0 for Midtrans gross_amount validation)
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

      if (insuranceFee > 0) {
        itemDetails.push({
          id: 'insurance',
          price: insuranceFee,
          quantity: 1,
          name: 'Asuransi Pengiriman',
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

      const midtransResult = await createMidtransTransaction({
        orderNumber: order.orderNumber,
        retryCount: 0,
        grossAmount: totalAmount,
        customerName: recipientName,
        customerEmail: recipientEmail,
        customerPhone: recipientPhone,
        items: itemDetails,
      });
      midtransOrderId = midtransResult.midtransOrderId;
      snapToken = midtransResult.snapToken;
    } catch (midtransError) {
      // BUG-07 FIX: If Midtrans fails, roll back the order so there's no orphaned record
      await db.transaction(async (tx) => {
        await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
        await tx.delete(orders).where(eq(orders.id, order.id));
        if (coupon && coupon.maxUsesPerUser && userId) {
          await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
        }
      });
      throw midtransError;
    }

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
      logger.error('[checkout/initiate]', { error: error instanceof Error ? error.message : String(error) });
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 10 }
);
