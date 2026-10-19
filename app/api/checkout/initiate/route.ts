import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
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
import { eq, and, inArray, sql, gte, gt } from 'drizzle-orm';
import { success, serverError, validationError, conflict, unauthorized, serviceUnavailable, unprocessableEntity } from '@/lib/utils/api-response';
import { z } from 'zod';
import { generateOrderNumber, generatePickupCode } from '@/lib/utils/generate-order-number';
import { formatDateForOrder } from '@/lib/utils/format-date';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { POINTS_EXPIRY_DAYS, POINTS_VALUE_IDR } from '@/lib/constants/points';
import { calculatePointsEarned } from '@/lib/finance/points-calculator';
import { getPointsRuntimeRules } from '@/lib/settings/runtime-rules';
import { getSetting } from '@/lib/settings/get-settings';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';
import {
  validateSelectedQuote,
  calculateInsuranceFee,
  verifyInsuranceFee,
  getMarkupAmount,
} from '@/lib/shipping';
import { enforceShippingPhaseGates, resolveEffectivePhase } from '@/lib/shipping/phase-gate';
import { isServiceable } from '@/lib/shipping/geo-policy';
import { MIN_ORDER_FOR_COUPON_IDR, B2B_CREDIT_ENABLED_DEFAULT } from '@/lib/constants/financial-rules';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { isMaintenanceModeEnv } from '@/lib/ops/maintenance';
import { enforceCouponCap } from '@/lib/finance/points-calculator';
import { parseQuoteId } from '@/lib/shipping/get-rates';
import { requireActiveUser } from '@/lib/auth/require-active';
import { isSameOriginRequest, sameOriginRejected } from '@/lib/utils/same-origin';
import type { InsuranceType, ShippingItemInput, ShippingTier } from '@/lib/shipping/types';

const initiateSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        // Legacy client fields are accepted for backwards compatibility but
        // ignored — names, SKU, price, weight and image always come from the DB.
        productId: z.string().uuid().optional(),
        productNameId: z.string().optional(),
        productNameEn: z.string().optional(),
        variantNameId: z.string().optional(),
        variantNameEn: z.string().optional(),
        sku: z.string().optional(),
        imageUrl: z.string().optional(),
        unitPrice: z.number().int().positive().optional(),
        weightGram: z.number().int().positive().optional(),
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
  cashOnDelivery: z.boolean().optional(),
  biteshipActualCost: z.number().int().min(0).optional(),
  customerShippingCost: z.number().int().min(0).optional(),
  couponCode: z.string().optional(),
  pointsUsed: z.number().int().min(0).optional(),
  customerNote: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
  subtotal: z.number().int().positive(),
  discountAmount: z.number().int().min(0).optional(),
  pointsDiscount: z.number().int().min(0).optional(),
}).superRefine((data, ctx) => {
  // Delivery orders MUST carry a full destination address (P2/P0#6).
  if (data.deliveryMethod === 'delivery') {
    if (!data.addressLine || data.addressLine.trim().length < 10) {
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
      // CSRF: cookie-authed mutation — reject verifiable cross-origin calls.
      if (!isSameOriginRequest(req)) return sameOriginRejected();

      const session = await auth();

      if (session?.user?.id) {
        const active = await requireActiveUser();
        if (!active) return unauthorized('Akun Anda dinonaktifkan');
      }

      if (isMaintenanceModeEnv()) {
        return serviceUnavailable('Toko sedang dalam mode pemeliharaan. Silakan coba lagi nanti.', 'MAINTENANCE_MODE');
      }

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
    // O(1) lookup per cart line instead of O(n) .find per iteration.
    const variantById = new Map(dbVariants.map((v) => [v.id, v]));

    // Products supply names, image and active/deleted state. Nothing the client
    // sends for these fields is trusted (H1/H2).
    const dbProducts = await db.query.products.findMany({
      where: inArray(products.id, dbVariants.map((v) => v.productId)),
      with: { images: { limit: 1 } },
    });
    const productById = new Map(dbProducts.map((p) => [p.id, p]));

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
      const variant = variantById.get(item.variantId);
      if (!variant) {
        return conflict(`Variant tidak ditemukan`);
      }
      if (!variant.isActive) {
        return conflict('Produk sudah tidak tersedia');
      }
      const product = productById.get(variant.productId);
      if (!product || !product.isActive || product.deletedAt) {
        return conflict('Produk sudah tidak tersedia');
      }
      if (variant.stock < item.quantity) {
        return conflict(
          `Stok tidak mencukupi untuk ${variant.nameId} (tersisa ${variant.stock})`
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
        productNameId: product.nameId,
        productNameEn: product.nameEn,
        variantNameId: variant.nameId,
        variantNameEn: variant.nameEn,
        sku: variant.sku,
        productImageUrl: product.images[0]?.cloudinaryUrl ?? null,
        unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        weightGram: variant.weightGram,
      });
    }

    // ── Step 2: Validate coupon ───────────────────────────────────────────
    // Never trust a client-supplied discount: it is always derived from the
    // coupon row below (C1).
    let discountAmount = 0;
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

      if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) {
        return conflict('Kupon belum berlaku');
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
        const activeCoupon = coupon;
        const buyQty = activeCoupon.buyQuantity ?? 1;
        const getQty = activeCoupon.getQuantity ?? 1;

        // K6: only products the coupon targets may qualify (falling back to the
        // whole catalog when no product/category targeting is configured).
        const isApplicableProduct = (productId: string): boolean => {
          const p = productById.get(productId);
          if (!p || !p.isActive || p.deletedAt) return false;
          if (
            activeCoupon.applicableProductIds &&
            activeCoupon.applicableProductIds.length > 0 &&
            !activeCoupon.applicableProductIds.includes(productId)
          ) {
            return false;
          }
          if (
            activeCoupon.applicableCategoryIds &&
            activeCoupon.applicableCategoryIds.length > 0 &&
            (!p.categoryId || !activeCoupon.applicableCategoryIds.includes(p.categoryId))
          ) {
            return false;
          }
          return true;
        };

        const cartByProduct: Record<string, number> = {};
        const cartQtyByVariant: Record<string, number> = {};
        for (const item of orderItemsData) {
          if (!isApplicableProduct(item.productId)) continue;
          cartByProduct[item.productId] = (cartByProduct[item.productId] ?? 0) + item.quantity;
          cartQtyByVariant[item.variantId] = (cartQtyByVariant[item.variantId] ?? 0) + item.quantity;
        }

        // Find the targeted product with the most qualifying quantity.
        let qualifyingProductId = '';
        let maxQty = 0;
        for (const [pid, qty] of Object.entries(cartByProduct)) {
          if (qty >= buyQty && qty > maxQty) {
            maxQty = qty;
            qualifyingProductId = pid;
          }
        }

        if (!qualifyingProductId) {
          return conflict(`Beli minimal ${buyQty} item untuk menggunakan kupon ini`);
        }

        // Get lowest-priced active variants of qualifying product.
        const qualifyingVariants = await db.query.productVariants.findMany({
          where: and(
            eq(productVariants.productId, qualifyingProductId),
            eq(productVariants.isActive, true)
          ),
          orderBy: (variants, { asc }) => [asc(variants.price)],
        });

        // K5: a free unit needs stock beyond what the cart already consumes.
        const inStockVariants = qualifyingVariants.filter(
          (v) => v.stock > (cartQtyByVariant[v.id] ?? 0)
        );
        const selectedVariants = inStockVariants.slice(0, getQty);

        if (selectedVariants.length < getQty) {
          return conflict('Stok item gratis tidak mencukupi untuk kupon ini');
        }

        const productInfo = productById.get(qualifyingProductId);

        for (const variant of selectedVariants) {
          freeItems.push({
            variantId: variant.id,
            productId: qualifyingProductId,
            productNameId: productInfo?.nameId ?? 'Produk Gratis',
            productNameEn: productInfo?.nameEn ?? 'Free Product',
            variantNameId: variant.nameId,
            variantNameEn: variant.nameEn,
            sku: variant.sku,
            productImageUrl: productInfo?.images[0]?.cloudinaryUrl ?? null,
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
    const pointsRules = await getPointsRuntimeRules();
    const requestedPointsUsed = parsed.data.pointsUsed ?? 0;
    const requestedPointsDiscount = parsed.data.pointsDiscount ?? 0;
    // P0: guests can never redeem points. Reject crafted payloads outright.
    if (!session?.user?.id && (requestedPointsUsed > 0 || requestedPointsDiscount > 0)) {
      return unprocessableEntity('Poin hanya tersedia untuk pengguna terdaftar. Silakan masuk untuk menukar poin.', 'POINTS_GUEST_FORBIDDEN');
    }
    // Runtime rules (P6): minimum redeem and 50% cap are admin-configurable.
    if (requestedPointsUsed > 0 && requestedPointsUsed < pointsRules.minRedeem) {
      return unprocessableEntity(
        `Penukaran poin minimal ${pointsRules.minRedeem} poin.`,
        'POINTS_MIN_REDEEM'
      );
    }
    if (requestedPointsUsed > 0 && requestedPointsDiscount !== requestedPointsUsed * POINTS_VALUE_IDR) {
      return unprocessableEntity('Nilai diskon poin tidak valid.', 'POINTS_DISCOUNT_MISMATCH');
    }
    if (requestedPointsUsed === 0 && requestedPointsDiscount > 0) {
      return unprocessableEntity('Nilai diskon poin tidak valid.', 'POINTS_DISCOUNT_MISMATCH');
    }
    // PRD §6.5: points apply to remaining subtotal AFTER coupon.
    const maxPointsDiscount = Math.floor(
      Math.max(0, subtotal - discountAmount) * (pointsRules.maxRedeemPct / 100)
    );
    const pointsDiscount = Math.min(requestedPointsDiscount, maxPointsDiscount);
    // If client requested more than the cap, reject rather than silently trim
    // so totals stay predictable between client and server.
    if (requestedPointsDiscount > maxPointsDiscount) {
      return unprocessableEntity(
        `Penukaran poin maksimal ${pointsRules.maxRedeemPct}% dari subtotal setelah kupon.`,
        'POINTS_MAX_EXCEEDED'
      );
    }
    let pointsDeducted = false;
    const userId = session?.user?.id ?? null;

    // Idempotency (M10): a client-generated UUID is the ONLY dedup key. The
    // old email+subtotal window could return an unrelated order. The unique
    // index on orders.idempotency_key makes concurrent retries safe.
    const idempotencyKey = parsed.data.idempotencyKey;
    if (idempotencyKey) {
      const existingOrder = await db.query.orders.findFirst({
        where: eq(orders.idempotencyKey, idempotencyKey),
        with: { items: true },
      });
      if (existingOrder?.midtransSnapToken) {
        return success({
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          snapToken: existingOrder.midtransSnapToken,
        });
      }
      // Key already claimed but Snap never persisted — resume Midtrans instead
      // of inserting again (unique index on idempotency_key would 500).
      if (existingOrder && existingOrder.status === 'pending_payment') {
        const resumeItems = existingOrder.items.map((item) => ({
          id: item.variantId,
          price: item.unitPrice,
          quantity: item.quantity,
          name: (item.productNameId || item.variantNameId || 'Item').slice(0, 50),
        }));
        // Midtrans requires item_details to sum to gross_amount — include
        // shipping/discount lines already baked into totalAmount via a single
        // adjustment row when unit prices alone don't match.
        const itemsSum = resumeItems.reduce((s, i) => s + i.price * i.quantity, 0);
        const delta = existingOrder.totalAmount - itemsSum;
        if (delta !== 0) {
          resumeItems.push({
            id: 'adjust',
            price: delta,
            quantity: 1,
            name: delta > 0 ? 'Biaya lain' : 'Diskon',
          });
        }
        try {
          const midtransResult = await createMidtransTransaction({
            orderNumber: existingOrder.orderNumber,
            retryCount: existingOrder.paymentRetryCount ?? 0,
            grossAmount: existingOrder.totalAmount,
            customerName: existingOrder.recipientName,
            customerEmail: existingOrder.recipientEmail,
            customerPhone: existingOrder.recipientPhone,
            items: resumeItems,
          });
          await db
            .update(orders)
            .set({
              midtransOrderId: midtransResult.midtransOrderId,
              midtransSnapToken: midtransResult.snapToken,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, existingOrder.id));
          return success({
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            snapToken: midtransResult.snapToken,
          });
        } catch (resumeErr) {
          logger.error('[checkout/initiate] idempotency resume failed', {
            orderId: existingOrder.id,
            error: resumeErr instanceof Error ? resumeErr.message : String(resumeErr),
          });
          return conflict(
            'Pesanan sudah dibuat tetapi pembayaran belum siap. Muat ulang dan coba lagi.'
          );
        }
      }
      if (existingOrder) {
        return conflict('Pesanan dengan kunci ini sudah ada.');
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

      // K5: free buy_x_get_y units weigh the same as paid units and must be
      // included in the courier quote, otherwise Biteship re-prices the booking.
      const shippingItems: ShippingItemInput[] = [...orderItemsData, ...freeItems].map((item) => {
        const variant = variantById.get(item.variantId);
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

      // COD is disabled at launch (C2): the Midtrans payment already charges
      // the full amount, and Biteship would collect it again at the door.

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

    // L3 geo-policy gate — reject destinations outside our polygon before
    // phase gating.
    if (shippingTier && shippingTier !== 'pickup') {
      const totalWeightGram = orderItemsData.reduce(
        (sum, item) => sum + item.weightGram * item.quantity,
        0
      );
      const effectivePhase = await resolveEffectivePhase();
      const geoCheck = isServiceable(
        parsed.data.latitude ?? 0,
        parsed.data.longitude ?? 0,
        shippingTier,
        totalWeightGram || 0,
        effectivePhase,
        subtotal
      );
      if (!geoCheck.ok) {
        if (geoCheck.reason === 'beyond_polygon_contact_whatsapp') {
          return conflict('Maaf, wilayah tujuan belum didukung untuk pengiriman ' + shippingTier + '. Silakan hubungi kami via WhatsApp.');
        }
        if (geoCheck.reason && geoCheck.reason.startsWith('tier_locked')) {
          // Already handled by phase gate; skip
        } else if (geoCheck.reason) {
          return conflict('Pengiriman tidak tersedia: ' + geoCheck.reason);
        }
      }
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
    // M7: never send a zero/negative gross_amount to Midtrans.
    if (totalAmount < 1) {
      return conflict('Total pembayaran tidak valid. Periksa kembali keranjang Anda.');
    }
    if (discountAmount > subtotal) {
      return conflict('Diskon melebihi subtotal pesanan.');
    }
    // L2 Rule 3: points earn on net product payment (subtotal - coupon - points redeemed).
    // L2 Rule 10: B2B customers earn the same rate as retail (no 2x multiplier).
    const pointsEarned = isNet30Order
      ? calculatePointsEarned({
          subtotal,
          couponDiscount: discountAmount,
          pointsDiscount,
          shippingCost,
          isB2b: isB2bOrder,
          earnRate: pointsRules.earnRate,
        })
      : 0; // non-Net-30 orders: points are awarded at webhook settlement, computed from net-of-discount base.

    // ── Step 5: Generate order number using atomic DB counter ───────────
    // M13: the counter key and order number must use the same WIB calendar day
    // (server runs in UTC; 00:00–07:00 WIB would otherwise get yesterday).
    const today = formatDateForOrder(new Date()); // "2026-05-14"

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
              gt(pointsHistory.pointsRemaining, 0),
            )
          )
          .orderBy(pointsHistory.expiresAt, pointsHistory.createdAt); // FIFO: earliest-expiring first

        // Accumulating loop: walk through records until we cover all of pointsUsed.
        // P2: consume only what is needed from each row (pointsRemaining), so a
        // partially-used earn row keeps its remainder redeemable.
        let remaining = pointsUsed;
        const toConsume: { id: string; amountUsed: number }[] = [];
        for (const record of earnRecords) {
          if (remaining <= 0) break;
          const amountUsed = Math.min(record.pointsRemaining, remaining);
          if (amountUsed <= 0) continue;
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
        const balanceRow = updatedUsers[0];
        if (!balanceRow) {
          throw new Error('Poin tidak mencukupi atau terjadi kesalahan');
        }
        const pointsBalanceAfterDeduct = balanceRow.pointsBalance;
        pointsBalanceForRedeem = pointsBalanceAfterDeduct;

        // Create redeem records referencing specific earn IDs (FIFO).
        // Decrement each earn row's remaining balance; only mark it consumed
        // when the remainder reaches zero.
        if (toConsume.length > 0) {
          for (const { id, amountUsed } of toConsume) {
            await tx
              .update(pointsHistory)
              .set({
                pointsRemaining: sql`GREATEST(${pointsHistory.pointsRemaining} - ${amountUsed}, 0)`,
                consumedAt: sql`CASE WHEN ${pointsHistory.pointsRemaining} - ${amountUsed} <= 0 THEN NOW() ELSE NULL END`,
              })
              .where(eq(pointsHistory.id, id));

            redeemRecords.push({ earnId: id, amountUsed });
          }
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
          pickupCode: deliveryMethod === 'pickup' ? generatePickupCode() : null,
          userId: session?.user?.id ?? null,
          idempotencyKey: idempotencyKey ?? null,
          status: orderStatus,
          isB2b: isB2bOrder,
          deliveryMethod,
          recipientName,
          recipientEmail: recipientEmail.toLowerCase(),
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
          // C2: COD is disabled — Midtrans already collects the full amount.
          cashOnDelivery: false,
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

      // Insert redeem records now that orderId is available (FIFO consume).
      // P8: each row records the running balance after that redemption.
      if (redeemRecords.length > 0) {
        let runningBalance = pointsBalanceForRedeem + pointsUsed!;
        await tx.insert(pointsHistory).values(
          redeemRecords.map(({ earnId, amountUsed }) => {
            runningBalance -= amountUsed;
            return {
              userId: userId!,
              type: 'redeem' as const,
              pointsAmount: -amountUsed,
              pointsBalanceAfter: runningBalance,
              orderId: created.id,
              descriptionId: `Tukar poin untuk pesanan ${created.orderNumber}`,
              descriptionEn: `Redeem points for order ${created.orderNumber}`,
              referencedEarnId: earnId,
            };
          })
        );
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
            pointsRemaining: pointsEarned,
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

        // Increment coupon used_count for Net-30 (atomic, respects max_uses).
        if (coupon) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`used_count + 1` })
            .where(
              and(
                eq(coupons.id, coupon.id),
                sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`
              )
            );
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

      // M11: initial status history belongs in the same transaction as the order.
      await tx.insert(orderStatusHistory).values({
        orderId: created.id,
        fromStatus: null,
        toStatus: isNet30Order ? 'paid' : 'pending_payment',
        changedByUserId: userId,
        changedByType: 'system',
        note: isNet30Order
          ? 'Pesanan B2B Net-30, langsung lunas'
          : 'Pesanan dibuat, menunggu pembayaran',
      });

      return [created];
    });

    const order = counterResult[0];
    if (!order) {
      throw new Error('Failed to create order');
    }

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
          name: 'Ongkir & Penanganan Frozen (ice gel + kemasan)',
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
      // BUG-07 FIX: If Midtrans fails, roll back the order and all side effects
      await db.transaction(async (tx) => {
        // Restore points that were deducted at initiate (FIFO redeem)
        if (userId && pointsDeducted && pointsUsed && pointsUsed > 0) {
          const redeemRecords = await tx
            .select()
            .from(pointsHistory)
            .where(
              and(
                eq(pointsHistory.userId, userId),
                eq(pointsHistory.type, 'redeem'),
                eq(pointsHistory.orderId, order.id)
              )
            );
          // Restore each referenced earn row's remaining balance.
          for (const redeem of redeemRecords) {
            if (!redeem.referencedEarnId) continue;
            const restored = Math.abs(redeem.pointsAmount);
            await tx
              .update(pointsHistory)
              .set({
                pointsRemaining: sql`${pointsHistory.pointsRemaining} + ${restored}`,
                consumedAt: null,
              })
              .where(eq(pointsHistory.id, redeem.referencedEarnId));
          }
          await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${pointsUsed}` })
            .where(eq(users.id, userId));
        }
        // Delete redeemed pointsHistory entries (non-cascade FK)
        await tx.delete(pointsHistory).where(
          and(eq(pointsHistory.orderId, order.id), eq(pointsHistory.type, 'redeem'))
        );
        // Delete coupon usages (non-cascade FK)
        if (coupon && coupon.maxUsesPerUser && userId) {
          await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
        }
        // Delete order items (cascade FK)
        await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
        // Delete order status history (cascade FK)
        await tx.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id));
        // Delete the order last
        await tx.delete(orders).where(eq(orders.id, order.id));
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
      Sentry.captureException(error);
      logger.error('[checkout/initiate]', { error: error instanceof Error ? error.message : String(error) });
      return serverError(error);
    }
  },
  'money'
);
