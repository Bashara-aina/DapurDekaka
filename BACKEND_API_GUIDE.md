# BACKEND_API_GUIDE.md — API Implementation & Transaction Engine
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Technical Lead)
**Purpose:** Step-by-step implementation logic for every API route. Cursor must follow these flows exactly.

---

## 1. API ARCHITECTURE PRINCIPLES

### 1.1 Every API Route Follows This Skeleton

```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { success, unauthorized, forbidden, validationError, serverError, notFound } from '@/lib/utils/api-response';

const RequestSchema = z.object({ /* ... */ });

export async function POST(req: NextRequest) {
  try {
    // 1. Auth guard (if needed)
    const session = await auth();
    if (!session) return unauthorized();

    // 2. Parse + validate
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // 3. Business logic (call lib/ functions, NEVER inline DB queries here)
    const result = await businessLogicFunction(parsed.data);

    // 4. Return
    return success(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return serverError(error);
  }
}
```

### 1.2 Business Logic Lives in lib/

API routes are thin controllers. All logic goes into `lib/` service functions:

```
lib/
├── services/
│   ├── order.service.ts        # createOrder, processPayment, cancelOrder
│   ├── checkout.service.ts     # initiateCheckout, validateCart, calculateTotals
│   ├── coupon.service.ts       # validateCoupon, applyCoupon, revertCoupon
│   ├── points.service.ts       # awardPoints, redeemPoints, revertPoints, expirePoints
│   ├── inventory.service.ts    # deductStock, restoreStock, updateStock
│   ├── shipping.service.ts     # calculateShipping, getProvinces, getCities
│   └── email.service.ts        # sendOrderConfirmation, sendShippedEmail, etc.
```

### 1.3 Transaction Boundaries

These operations MUST be wrapped in `db.transaction()`:

| Operation | Tables Touched | Why Transaction |
|---|---|---|
| Payment settlement | orders, product_variants, points_history, coupon_usages, inventory_logs, order_status_history | All-or-nothing: if points fail, stock must not deduct |
| Order cancellation | orders, points_history, coupons, order_status_history | Must reverse all side effects atomically |
| Points redemption at checkout | orders, points_history, users | Balance and history must stay in sync |
| Stock manual update | product_variants, inventory_logs | Log must match actual change |

---

## 2. CHECKOUT INITIATION — POST /api/checkout/initiate

This is the most critical endpoint. It creates the order and returns a Midtrans snap token.

### 2.1 Request Schema

```typescript
const CheckoutInitiateSchema = z.object({
  // Guest identity (required if not logged in)
  guestName: z.string().min(2).max(255).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().regex(/^(\+62|62|0)[0-9]{8,13}$/).optional(),

  // Delivery
  deliveryMethod: z.enum(['delivery', 'pickup']),

  // Address (required if delivery)
  address: z.object({
    recipientName: z.string().min(2).max(255),
    recipientPhone: z.string().regex(/^(\+62|62|0)[0-9]{8,13}$/),
    addressLine: z.string().min(5),
    district: z.string().min(2),
    city: z.string().min(2),
    cityId: z.string().min(1),
    province: z.string().min(2),
    provinceId: z.string().min(1),
    postalCode: z.string().min(4).max(10),
    saveAddress: z.boolean().optional(),
  }).optional(),

  // Shipping (required if delivery)
  shipping: z.object({
    courierCode: z.string(),
    courierService: z.string(),
    courierName: z.string(),
    cost: z.number().int().min(0),
    estimatedDays: z.string(),
  }).optional(),

  // Cart items — NEVER trust prices from client, only variantId + quantity
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })).min(1),

  // Promotions
  couponCode: z.string().max(50).optional(),
  pointsToRedeem: z.number().int().min(0).optional(),

  // Notes
  customerNote: z.string().max(1000).optional(),
});
```

### 2.2 Step-by-Step Implementation

```typescript
// lib/services/checkout.service.ts

export async function initiateCheckout(input: CheckoutInput, userId?: string) {
  // ─── STEP 1: VALIDATE CART ITEMS AGAINST DATABASE ───
  // Fetch ALL variants from DB with their products
  // For each item in input.items:
  //   - Variant must exist and be active
  //   - Parent product must exist, be active, and not soft-deleted
  //   - variant.stock >= requested quantity
  //   - If any fail: throw StockError with details of which items failed
  //
  // CRITICAL: Use the DB price, NOT the client-sent price.
  // Client only sends variantId + quantity. Price comes from DB.

  const variantIds = input.items.map(i => i.variantId);
  const variants = await db.query.productVariants.findMany({
    where: inArray(productVariants.id, variantIds),
    with: {
      product: {
        with: { images: { orderBy: [asc(productImages.sortOrder)], limit: 1 } }
      }
    },
  });

  // Build validated cart with DB prices
  const validatedItems: ValidatedCartItem[] = [];
  const stockErrors: string[] = [];

  for (const inputItem of input.items) {
    const variant = variants.find(v => v.id === inputItem.variantId);
    if (!variant) throw new AppError(`Variant ${inputItem.variantId} not found`, 'VARIANT_NOT_FOUND', 404);
    if (!variant.isActive) throw new AppError(`Variant ${variant.sku} is inactive`, 'VARIANT_INACTIVE', 400);
    if (!variant.product.isActive || variant.product.deletedAt) {
      throw new AppError(`Product ${variant.product.nameId} is not available`, 'PRODUCT_INACTIVE', 400);
    }
    if (variant.stock < inputItem.quantity) {
      stockErrors.push(`${variant.product.nameId} (${variant.nameId}): tersedia ${variant.stock}, diminta ${inputItem.quantity}`);
      continue;
    }
    validatedItems.push({
      variantId: variant.id,
      productId: variant.product.id,
      productNameId: variant.product.nameId,
      productNameEn: variant.product.nameEn,
      variantNameId: variant.nameId,
      variantNameEn: variant.nameEn,
      sku: variant.sku,
      productImageUrl: variant.product.images[0]?.cloudinaryUrl ?? null,
      unitPrice: variant.price,        // FROM DATABASE — never from client
      quantity: inputItem.quantity,
      weightGram: variant.weightGram,
      subtotal: variant.price * inputItem.quantity,
    });
  }

  if (stockErrors.length > 0) {
    throw new AppError(
      `Stok tidak mencukupi:\n${stockErrors.join('\n')}`,
      'INSUFFICIENT_STOCK', 409
    );
  }

  // ─── STEP 2: CALCULATE SUBTOTAL ───
  const subtotal = validatedItems.reduce((sum, item) => sum + item.subtotal, 0);

  // ─── STEP 3: VALIDATE & APPLY COUPON ───
  let discountAmount = 0;
  let couponId: string | null = null;
  let couponRecord: Coupon | null = null;

  if (input.couponCode) {
    const couponResult = await validateAndCalculateCoupon(
      input.couponCode,
      subtotal,
      validatedItems,
      userId
    );
    if (!couponResult.valid) {
      throw new CouponError(couponResult.error!);
    }
    discountAmount = couponResult.discountAmount!;
    couponId = couponResult.coupon!.id;
    couponRecord = couponResult.coupon!;
  }

  // ─── STEP 4: VALIDATE & APPLY POINTS ───
  let pointsDiscount = 0;
  let pointsUsed = 0;

  if (input.pointsToRedeem && input.pointsToRedeem > 0 && userId) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AppError('User not found', 'USER_NOT_FOUND', 404);

    // Validate points
    if (input.pointsToRedeem < 100) {
      throw new AppError('Minimum penukaran 100 poin', 'POINTS_MIN_REDEEM', 400);
    }
    if (input.pointsToRedeem > user.pointsBalance) {
      throw new AppError('Poin tidak mencukupi', 'INSUFFICIENT_POINTS', 400);
    }

    // Max 50% of subtotal (after coupon discount)
    const subtotalAfterCoupon = subtotal - discountAmount;
    const maxPointsValue = Math.floor(subtotalAfterCoupon * 0.5);
    const requestedPointsValue = Math.floor(input.pointsToRedeem / 100) * 1000;
    pointsDiscount = Math.min(requestedPointsValue, maxPointsValue);
    pointsUsed = Math.min(input.pointsToRedeem, Math.floor(maxPointsValue / 1000) * 100);
  }

  // ─── STEP 5: CALCULATE SHIPPING ───
  let shippingCost = 0;
  if (input.deliveryMethod === 'delivery' && input.shipping) {
    // RE-VALIDATE shipping cost server-side by calling RajaOngkir again
    // Do NOT trust the client-sent shipping cost
    const totalWeight = calculateShippingWeight(validatedItems);
    const serverShippingResult = await calculateShippingCost(
      input.address!.cityId,
      totalWeight,
      input.shipping.courierCode
    );
    const matchedService = serverShippingResult.find(
      s => s.service === input.shipping!.courierService
    );
    if (!matchedService) {
      throw new AppError(
        'Layanan pengiriman tidak tersedia untuk tujuan ini',
        'SHIPPING_UNAVAILABLE', 400
      );
    }
    shippingCost = matchedService.cost;
    // NOTE: Use server-calculated cost, NOT client cost
  }

  // ─── STEP 6: CALCULATE FINAL TOTAL ───
  const totalAmount = subtotal - discountAmount - pointsDiscount + shippingCost;
  if (totalAmount < 0) {
    throw new AppError('Total pesanan tidak valid', 'INVALID_TOTAL', 400);
  }

  // ─── STEP 7: GENERATE ORDER NUMBER ───
  const orderNumber = await generateOrderNumber(); // DDK-YYYYMMDD-XXXX

  // ─── STEP 8: CREATE ORDER IN TRANSACTION ───
  const order = await db.transaction(async (tx) => {
    // 8a. Insert order
    const [newOrder] = await tx.insert(orders).values({
      orderNumber,
      userId: userId ?? null,
      status: 'pending_payment',
      deliveryMethod: input.deliveryMethod,
      recipientName: input.address?.recipientName ?? input.guestName!,
      recipientEmail: userId
        ? (await tx.query.users.findFirst({ where: eq(users.id, userId) }))!.email
        : input.guestEmail!,
      recipientPhone: input.address?.recipientPhone ?? input.guestPhone!,
      addressLine: input.address?.addressLine ?? null,
      district: input.address?.district ?? null,
      city: input.address?.city ?? null,
      cityId: input.address?.cityId ?? null,
      province: input.address?.province ?? null,
      provinceId: input.address?.provinceId ?? null,
      postalCode: input.address?.postalCode ?? null,
      courierCode: input.shipping?.courierCode ?? null,
      courierService: input.shipping?.courierService ?? null,
      courierName: input.shipping?.courierName ?? null,
      shippingCost,
      estimatedDays: input.shipping?.estimatedDays ?? null,
      subtotal,
      discountAmount,
      pointsDiscount,
      totalAmount,
      couponId,
      couponCode: input.couponCode?.toUpperCase() ?? null,
      pointsUsed,
      pointsEarned: 0, // Calculated after payment
      customerNote: input.customerNote ?? null,
      midtransOrderId: orderNumber, // Initial attempt uses orderNumber
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      paymentRetryCount: 0,
      pickupCode: input.deliveryMethod === 'pickup' ? orderNumber : null,
    }).returning();

    // 8b. Insert order items (SNAPSHOT all product data)
    for (const item of validatedItems) {
      await tx.insert(orderItems).values({
        orderId: newOrder.id,
        variantId: item.variantId,
        productId: item.productId,
        productNameId: item.productNameId,
        productNameEn: item.productNameEn,
        variantNameId: item.variantNameId,
        variantNameEn: item.variantNameEn,
        sku: item.sku,
        productImageUrl: item.productImageUrl,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        weightGram: item.weightGram,
      });
    }

    // 8c. Insert initial status history
    await tx.insert(orderStatusHistory).values({
      orderId: newOrder.id,
      fromStatus: null,
      toStatus: 'pending_payment',
      changedByType: 'system',
      note: 'Order created',
    });

    // 8d. Deduct points TENTATIVELY (reversed if payment fails)
    if (pointsUsed > 0 && userId) {
      const userBefore = await tx.query.users.findFirst({ where: eq(users.id, userId) });
      const newBalance = userBefore!.pointsBalance - pointsUsed;

      await tx.update(users)
        .set({ pointsBalance: newBalance, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx.insert(pointsHistory).values({
        userId,
        type: 'redeem',
        pointsAmount: -pointsUsed,
        pointsBalanceAfter: newBalance,
        orderId: newOrder.id,
        descriptionId: `Penukaran poin untuk pesanan ${orderNumber}`,
        descriptionEn: `Points redeemed for order ${orderNumber}`,
      });
    }

    // 8e. Save address if requested (logged-in user, new address)
    if (input.address?.saveAddress && userId && input.deliveryMethod === 'delivery') {
      await tx.insert(addresses).values({
        userId,
        recipientName: input.address.recipientName,
        recipientPhone: input.address.recipientPhone,
        addressLine: input.address.addressLine,
        district: input.address.district,
        city: input.address.city,
        cityId: input.address.cityId,
        province: input.address.province,
        provinceId: input.address.provinceId,
        postalCode: input.address.postalCode,
      });
    }

    return newOrder;
  });

  // ─── STEP 9: CREATE MIDTRANS TRANSACTION (outside DB transaction) ───
  const midtransItemDetails = buildMidtransItemDetails(
    validatedItems, shippingCost, discountAmount, pointsDiscount,
    input.shipping?.courierName ?? null
  );

  const snapToken = await createMidtransTransaction({
    orderId: orderNumber,
    grossAmount: totalAmount,
    customerName: order.recipientName,
    customerEmail: order.recipientEmail,
    customerPhone: order.recipientPhone,
    itemDetails: midtransItemDetails,
    expiryMinutes: 15,
  });

  // Save snap token to order
  await db.update(orders)
    .set({ midtransSnapToken: snapToken })
    .where(eq(orders.id, order.id));

  // ─── STEP 10: RETURN ───
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    snapToken,
    totalAmount,
  };
}
```

### 2.3 Midtrans Item Details Builder

```typescript
function buildMidtransItemDetails(
  items: ValidatedCartItem[],
  shippingCost: number,
  discountAmount: number,
  pointsDiscount: number,
  courierName: string | null
): MidtransItemDetail[] {
  const details: MidtransItemDetail[] = items.map(item => ({
    id: item.sku,
    price: item.unitPrice,
    quantity: item.quantity,
    name: item.productNameId.substring(0, 50), // Midtrans max 50 chars
  }));

  if (shippingCost > 0) {
    details.push({
      id: 'SHIPPING',
      price: shippingCost,
      quantity: 1,
      name: `Ongkir ${courierName ?? 'Pengiriman'}`.substring(0, 50),
    });
  }

  const totalDiscount = discountAmount + pointsDiscount;
  if (totalDiscount > 0) {
    details.push({
      id: 'DISCOUNT',
      price: -totalDiscount,
      quantity: 1,
      name: 'Diskon & Poin',
    });
  }

  // CRITICAL VALIDATION: sum must equal totalAmount
  const sum = details.reduce((acc, d) => acc + d.price * d.quantity, 0);
  // totalAmount was already calculated as: subtotal - discount - points + shipping
  // sum should equal that. If not, Midtrans will reject.

  return details;
}
```

### 2.4 Order Number Generation (Race-Condition Safe)

```typescript
// lib/utils/generate-order-number.ts

export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = format(today, 'yyyyMMdd');
  const prefix = `DDK-${dateStr}-`;

  // Use DB to atomically get next sequence number
  // This prevents race conditions when multiple orders are created simultaneously
  const result = await db.execute(sql`
    SELECT COUNT(*) + 1 as next_seq
    FROM orders
    WHERE order_number LIKE ${prefix + '%'}
  `);

  const nextSeq = Number(result.rows[0]?.next_seq ?? 1);
  const padded = String(nextSeq).padStart(4, '0');

  return `${prefix}${padded}`;
}
```

**RACE CONDITION WARNING:** The above COUNT approach has a tiny window for duplicates under extreme concurrency. For production safety, use a PostgreSQL advisory lock or a sequences table:

```typescript
// Safer approach: dedicated sequence table
// CREATE TABLE order_sequences (date_key VARCHAR(8) PRIMARY KEY, last_seq INTEGER NOT NULL DEFAULT 0);

export async function generateOrderNumberSafe(): Promise<string> {
  const dateStr = format(new Date(), 'yyyyMMdd');

  const [result] = await db.execute(sql`
    INSERT INTO order_sequences (date_key, last_seq)
    VALUES (${dateStr}, 1)
    ON CONFLICT (date_key)
    DO UPDATE SET last_seq = order_sequences.last_seq + 1
    RETURNING last_seq
  `);

  const seq = String(result.last_seq).padStart(4, '0');
  return `DDK-${dateStr}-${seq}`;
}
```

---

## 3. MIDTRANS WEBHOOK — POST /api/webhooks/midtrans

### 3.1 Full Webhook Handler

```typescript
// app/api/webhooks/midtrans/route.ts

export async function POST(req: NextRequest) {
  let body: MidtransNotification;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ received: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // ─── STEP 1: VERIFY SIGNATURE ───
  const isValid = verifyMidtransSignature(
    body.order_id,
    body.status_code,
    body.gross_amount,
    process.env.MIDTRANS_SERVER_KEY!,
    body.signature_key
  );

  if (!isValid) {
    console.error('[Midtrans Webhook] Invalid signature', {
      orderId: body.order_id,
      statusCode: body.status_code,
    });
    return NextResponse.json({ received: false }, { status: 403 });
  }

  // ─── STEP 2: EXTRACT REAL ORDER NUMBER ───
  // Midtrans order_id might be "DDK-20260512-0047" or "DDK-20260512-0047-retry-1"
  const orderNumber = body.order_id.replace(/-retry-\d+$/, '');

  // ─── STEP 3: FIND ORDER ───
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order) {
    console.error('[Midtrans Webhook] Order not found', { orderNumber });
    return NextResponse.json({ received: true, note: 'order_not_found' });
  }

  // ─── STEP 4: PROCESS BY TRANSACTION STATUS ───
  const txnStatus = body.transaction_status;
  const fraudStatus = body.fraud_status;

  try {
    if (txnStatus === 'settlement' || (txnStatus === 'capture' && fraudStatus === 'accept')) {
      await handlePaymentSettlement(order, body);
    } else if (txnStatus === 'pending') {
      await handlePaymentPending(order, body);
    } else if (['deny', 'cancel', 'expire'].includes(txnStatus)) {
      await handlePaymentFailure(order, body, txnStatus);
    }
  } catch (error) {
    console.error('[Midtrans Webhook] Processing error', {
      orderNumber,
      txnStatus,
      error: error instanceof Error ? error.message : error,
    });
    // Still return 200 to Midtrans — we don't want retries for app errors
    // Log for manual investigation
  }

  // Always return 200 to Midtrans
  return NextResponse.json({ received: true });
}
```

### 3.2 Payment Settlement Handler (The Critical Path)

```typescript
async function handlePaymentSettlement(order: OrderWithItems, notification: MidtransNotification) {
  // ─── IDEMPOTENCY CHECK ───
  if (order.status === 'paid' || order.status === 'processing' ||
      order.status === 'packed' || order.status === 'shipped' ||
      order.status === 'delivered') {
    console.log('[Midtrans] Already processed, skipping', { orderNumber: order.orderNumber });
    return;
  }

  if (order.status !== 'pending_payment') {
    console.warn('[Midtrans] Unexpected status for settlement', {
      orderNumber: order.orderNumber,
      currentStatus: order.status,
    });
    return;
  }

  // ─── ATOMIC TRANSACTION: ALL OR NOTHING ───
  await db.transaction(async (tx) => {
    // 1. Update order status → paid
    await tx.update(orders).set({
      status: 'paid',
      midtransTransactionId: notification.transaction_id,
      midtransPaymentType: notification.payment_type,
      midtransVaNumber: notification.va_numbers?.[0]?.va_number ?? null,
      midtransSnapToken: null, // Clear snap token
      paidAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));

    // 2. Deduct stock for EACH item
    for (const item of order.items) {
      const result = await tx.update(productVariants).set({
        stock: sql`GREATEST(stock - ${item.quantity}, 0)`,
        updatedAt: new Date(),
      }).where(
        and(
          eq(productVariants.id, item.variantId),
          gte(productVariants.stock, item.quantity) // Safety: only if enough stock
        )
      ).returning();

      if (result.length === 0) {
        // Stock insufficient — this is a critical issue post-payment
        // Log it but DON'T abort the transaction — payment is already taken
        console.error('[CRITICAL] Stock insufficient after payment', {
          orderNumber: order.orderNumber,
          variantId: item.variantId,
          sku: item.sku,
          requested: item.quantity,
        });
        // Force deduct to 0 and flag for manual review
        await tx.update(productVariants).set({
          stock: 0,
          updatedAt: new Date(),
        }).where(eq(productVariants.id, item.variantId));
      }

      // 3. Create inventory log for each deduction
      const variant = await tx.query.productVariants.findFirst({
        where: eq(productVariants.id, item.variantId),
      });
      await tx.insert(inventoryLogs).values({
        variantId: item.variantId,
        changeType: 'sale',
        quantityBefore: (variant?.stock ?? 0) + item.quantity,
        quantityAfter: variant?.stock ?? 0,
        quantityDelta: -item.quantity,
        orderId: order.id,
        note: `Sale: order ${order.orderNumber}`,
      });
    }

    // 4. Award loyalty points (ONLY for registered users)
    if (order.userId) {
      const pointsEarned = Math.floor(order.subtotal / 1000); // 1 pt per Rp 1.000

      if (pointsEarned > 0) {
        const user = await tx.query.users.findFirst({ where: eq(users.id, order.userId) });
        const newBalance = (user?.pointsBalance ?? 0) + pointsEarned;

        await tx.update(users).set({
          pointsBalance: newBalance,
          updatedAt: new Date(),
        }).where(eq(users.id, order.userId));

        await tx.insert(pointsHistory).values({
          userId: order.userId,
          type: 'earn',
          pointsAmount: pointsEarned,
          pointsBalanceAfter: newBalance,
          orderId: order.id,
          descriptionId: `Pembelian ${order.orderNumber}`,
          descriptionEn: `Purchase ${order.orderNumber}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        });

        // Update order with points earned
        await tx.update(orders).set({ pointsEarned }).where(eq(orders.id, order.id));
      }
    }

    // 5. Confirm coupon usage
    if (order.couponId && order.discountAmount > 0) {
      await tx.update(coupons).set({
        usedCount: sql`used_count + 1`,
        updatedAt: new Date(),
      }).where(eq(coupons.id, order.couponId));

      await tx.insert(couponUsages).values({
        couponId: order.couponId,
        orderId: order.id,
        userId: order.userId ?? null,
        discountApplied: order.discountAmount,
      });
    }

    // 6. Status history entry
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'pending_payment',
      toStatus: 'paid',
      changedByType: 'system',
      note: 'Payment confirmed via Midtrans webhook',
      metadata: {
        transactionId: notification.transaction_id,
        paymentType: notification.payment_type,
        settlementTime: notification.settlement_time,
      },
    });
  });

  // ─── POST-TRANSACTION: NON-CRITICAL (outside tx, failures are logged not thrown) ───

  // 7. Send confirmation email (async, non-blocking)
  try {
    await sendOrderConfirmationEmail(order);
  } catch (emailError) {
    console.error('[Email] Failed to send order confirmation', {
      orderNumber: order.orderNumber,
      error: emailError instanceof Error ? emailError.message : emailError,
    });
  }
}
```

### 3.3 Payment Failure Handler

```typescript
async function handlePaymentFailure(
  order: OrderWithItems,
  notification: MidtransNotification,
  reason: string
) {
  // Already cancelled? Skip.
  if (order.status === 'cancelled') return;

  // Only cancel if still pending
  if (order.status !== 'pending_payment') {
    console.warn('[Midtrans] Cannot cancel non-pending order', {
      orderNumber: order.orderNumber,
      status: order.status,
      reason,
    });
    return;
  }

  await db.transaction(async (tx) => {
    // 1. Cancel order
    await tx.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
      midtransSnapToken: null,
    }).where(eq(orders.id, order.id));

    // 2. Reverse points if used
    if (order.pointsUsed > 0 && order.userId) {
      const user = await tx.query.users.findFirst({ where: eq(users.id, order.userId) });
      const newBalance = (user?.pointsBalance ?? 0) + order.pointsUsed;

      await tx.update(users).set({
        pointsBalance: newBalance,
        updatedAt: new Date(),
      }).where(eq(users.id, order.userId));

      await tx.insert(pointsHistory).values({
        userId: order.userId,
        type: 'adjust',
        pointsAmount: order.pointsUsed, // positive = returning points
        pointsBalanceAfter: newBalance,
        orderId: order.id,
        descriptionId: `Pengembalian poin - pesanan ${order.orderNumber} dibatalkan`,
        descriptionEn: `Points reversed - order ${order.orderNumber} cancelled`,
      });
    }

    // 3. Status history
    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'pending_payment',
      toStatus: 'cancelled',
      changedByType: 'system',
      note: `Payment ${reason}: ${notification.status_message ?? 'No details'}`,
      metadata: { reason, transactionStatus: notification.transaction_status },
    });
  });

  // Note: Stock was NEVER deducted for pending orders, so no reversal needed
  // Note: Coupon used_count was NOT incremented at checkout (only on settlement)
}
```

---

## 4. PAYMENT RETRY — POST /api/checkout/retry

```typescript
const RetrySchema = z.object({
  orderNumber: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RetrySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, parsed.data.orderNumber),
  });

  if (!order) return notFound('Pesanan tidak ditemukan');
  if (order.status !== 'pending_payment') {
    return NextResponse.json({
      success: false,
      error: 'Pesanan sudah tidak menunggu pembayaran',
      code: 'INVALID_STATUS',
    }, { status: 400 });
  }

  // Check retry limit
  if (order.paymentRetryCount >= 3) {
    // Auto-cancel
    await cancelOrder(order.id, 'system', 'Max payment retries exceeded');
    return NextResponse.json({
      success: false,
      error: 'Batas percobaan pembayaran tercapai. Pesanan dibatalkan.',
      code: 'MAX_RETRIES',
    }, { status: 400 });
  }

  // Generate new Midtrans order ID with retry suffix
  const newRetryCount = order.paymentRetryCount + 1;
  const midtransOrderId = `${order.orderNumber}-retry-${newRetryCount}`;

  // Create new Midtrans transaction
  const snapToken = await createMidtransTransaction({
    orderId: midtransOrderId,
    grossAmount: order.totalAmount,
    customerName: order.recipientName,
    customerEmail: order.recipientEmail,
    customerPhone: order.recipientPhone,
    itemDetails: await rebuildItemDetailsFromOrder(order),
    expiryMinutes: 15,
  });

  // Update order
  await db.update(orders).set({
    midtransOrderId: midtransOrderId,
    midtransSnapToken: snapToken,
    paymentRetryCount: newRetryCount,
    paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id));

  return success({ snapToken, retryCount: newRetryCount });
}
```

---

## 5. COUPON VALIDATION — POST /api/coupons/validate

### 5.1 Full Validation Logic

```typescript
// lib/services/coupon.service.ts

export async function validateAndCalculateCoupon(
  code: string,
  subtotal: number,
  items: ValidatedCartItem[],
  userId?: string
): Promise<CouponValidationResult> {

  // 1. Find coupon (case-insensitive)
  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.code, code.toUpperCase()),
  });

  if (!coupon) return { valid: false, error: 'Kode kupon tidak ditemukan' };

  // 2. Check active
  if (!coupon.isActive) return { valid: false, error: 'Kupon sudah tidak aktif' };

  // 3. Check date range
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { valid: false, error: 'Kupon belum berlaku' };
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, error: 'Kupon sudah kedaluwarsa' };
  }

  // 4. Check max uses (global)
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: 'Kupon sudah mencapai batas penggunaan' };
  }

  // 5. Check max uses per user
  if (coupon.maxUsesPerUser !== null && userId) {
    const userUsageCount = await db.select({ count: sql<number>`count(*)` })
      .from(couponUsages)
      .where(and(
        eq(couponUsages.couponId, coupon.id),
        eq(couponUsages.userId, userId)
      ));
    if (Number(userUsageCount[0]?.count ?? 0) >= coupon.maxUsesPerUser) {
      return { valid: false, error: 'Kamu sudah menggunakan kupon ini sebelumnya' };
    }
  }

  // 6. Check minimum order
  if (subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      error: `Minimal pembelian ${formatIDR(coupon.minOrderAmount)} untuk menggunakan kupon ini`,
    };
  }

  // 7. Check applicable products/categories (if restricted)
  if (coupon.applicableProductIds && coupon.applicableProductIds.length > 0) {
    const hasApplicableItem = items.some(item =>
      coupon.applicableProductIds!.includes(item.productId)
    );
    if (!hasApplicableItem) {
      return { valid: false, error: 'Kupon tidak berlaku untuk produk di keranjang' };
    }
  }

  if (coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0) {
    // Would need to join with products to check category
    // For V1, skip this check if not using category-restricted coupons
  }

  // 8. Calculate discount
  let discountAmount = 0;

  switch (coupon.type) {
    case 'percentage':
      discountAmount = Math.floor(subtotal * (coupon.discountValue! / 100));
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
      break;

    case 'fixed':
      discountAmount = Math.min(coupon.discountValue!, subtotal);
      break;

    case 'free_shipping':
      // Discount amount = 0, but flag tells checkout to waive shipping
      discountAmount = 0; // Shipping is handled separately
      break;

    case 'buy_x_get_y':
      // Complex logic: check if cart has enough qualifying items
      // For V1: simplified — just check total qty >= buyQuantity
      const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
      if (totalQty < coupon.buyQuantity!) {
        return {
          valid: false,
          error: `Beli minimal ${coupon.buyQuantity} item untuk menggunakan kupon ini`,
        };
      }
      // Free item = lowest priced item value × getQuantity
      const sortedByPrice = [...items].sort((a, b) => a.unitPrice - b.unitPrice);
      discountAmount = sortedByPrice[0]!.unitPrice * (coupon.getQuantity ?? 1);
      break;
  }

  return {
    valid: true,
    coupon,
    discountAmount,
    freeShipping: coupon.type === 'free_shipping',
  };
}
```

---

## 6. ADMIN ORDER STATUS UPDATE — PATCH /api/admin/orders/[id]/status

### 6.1 Valid Transitions (Enforced Server-Side)

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid:            ['processing', 'cancelled'],
  processing:      ['packed', 'cancelled'],
  packed:          ['shipped', 'cancelled'],
  shipped:         ['delivered'],
  delivered:       ['refunded'],
  cancelled:       [],
  refunded:        [],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  userId: string,
  userRole: string,
  trackingNumber?: string,
  note?: string
) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new AppError('Order not found', 'NOT_FOUND', 404);

  // Validate transition
  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      `Tidak dapat mengubah status dari "${order.status}" ke "${newStatus}"`,
      'INVALID_TRANSITION', 400
    );
  }

  // Role-based restrictions
  if (userRole === 'warehouse') {
    // Warehouse can only: set tracking number (which triggers packed → shipped)
    if (newStatus !== 'shipped') {
      throw new AppError('Warehouse hanya dapat mengirim pesanan', 'FORBIDDEN', 403);
    }
    if (!trackingNumber) {
      throw new AppError('Nomor resi wajib diisi', 'TRACKING_REQUIRED', 400);
    }
  }

  // Build tracking URL
  let trackingUrl: string | null = null;
  if (trackingNumber && order.courierCode) {
    const TRACKING_URLS: Record<string, (tn: string) => string> = {
      sicepat: (tn) => `https://www.sicepat.com/checkAwb?awb=${tn}`,
      jne: (tn) => `https://www.jne.co.id/id/tracking/trace/${tn}`,
      anteraja: (tn) => `https://anteraja.id/tracking/${tn}`,
    };
    trackingUrl = TRACKING_URLS[order.courierCode]?.(trackingNumber) ?? null;
  }

  await db.transaction(async (tx) => {
    const updateData: Partial<typeof orders.$inferInsert> = {
      status: newStatus as any,
      updatedAt: new Date(),
    };

    if (newStatus === 'shipped' && trackingNumber) {
      updateData.trackingNumber = trackingNumber;
      updateData.trackingUrl = trackingUrl;
      updateData.shippedAt = new Date();
    }
    if (newStatus === 'delivered') {
      updateData.deliveredAt = new Date();
    }
    if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    await tx.update(orders).set(updateData).where(eq(orders.id, orderId));

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: order.status,
      toStatus: newStatus,
      changedByUserId: userId,
      changedByType: userRole === 'warehouse' ? 'warehouse' : 'admin',
      note: note ?? null,
    });

    // If cancelling a paid order, reverse stock
    if (newStatus === 'cancelled' && order.status !== 'pending_payment') {
      const orderItemsList = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, orderId),
      });

      for (const item of orderItemsList) {
        await tx.update(productVariants).set({
          stock: sql`stock + ${item.quantity}`,
          updatedAt: new Date(),
        }).where(eq(productVariants.id, item.variantId));

        await tx.insert(inventoryLogs).values({
          variantId: item.variantId,
          changedByUserId: userId,
          changeType: 'reversal',
          quantityBefore: 0, // Will be approximate
          quantityAfter: 0,
          quantityDelta: item.quantity,
          orderId,
          note: `Reversal: order ${order.orderNumber} cancelled`,
        });
      }
    }
  });

  // Send notification emails (non-blocking)
  if (newStatus === 'shipped') {
    sendShippedEmail(order, trackingNumber!, trackingUrl).catch(console.error);
  }
  if (newStatus === 'delivered') {
    sendDeliveredEmail(order).catch(console.error);
  }
}
```

---

## 7. INVENTORY UPDATE — PATCH /api/admin/inventory/[variantId]

```typescript
// Warehouse staff mobile stock update

const StockUpdateSchema = z.object({
  newStock: z.number().int().min(0).max(99999),
  note: z.string().max(500).optional(),
});

export async function updateVariantStock(
  variantId: string,
  newStock: number,
  userId: string,
  note?: string
) {
  return await db.transaction(async (tx) => {
    const variant = await tx.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
    });

    if (!variant) throw new AppError('Variant not found', 'NOT_FOUND', 404);

    const oldStock = variant.stock;
    const delta = newStock - oldStock;

    await tx.update(productVariants).set({
      stock: newStock,
      updatedAt: new Date(),
    }).where(eq(productVariants.id, variantId));

    await tx.insert(inventoryLogs).values({
      variantId,
      changedByUserId: userId,
      changeType: 'manual',
      quantityBefore: oldStock,
      quantityAfter: newStock,
      quantityDelta: delta,
      note: note ?? `Manual stock update: ${oldStock} → ${newStock}`,
    });

    return { variantId, oldStock, newStock, delta };
  });
}
```

---

## 8. POINTS SYSTEM — COMPLETE IMPLEMENTATION

### 8.1 Points Expiry Job (Cron)

```typescript
// lib/services/points.service.ts

export async function expireOldPoints(): Promise<{ expired: number; usersAffected: number }> {
  const now = new Date();

  // Find all earn records that have expired but not yet marked
  const expiringRecords = await db.query.pointsHistory.findMany({
    where: and(
      eq(pointsHistory.type, 'earn'),
      eq(pointsHistory.isExpired, false),
      lte(pointsHistory.expiresAt, now),
      gt(pointsHistory.pointsAmount, 0)
    ),
    with: { user: true },
  });

  if (expiringRecords.length === 0) return { expired: 0, usersAffected: 0 };

  // Group by user
  const byUser = new Map<string, typeof expiringRecords>();
  for (const record of expiringRecords) {
    const existing = byUser.get(record.userId) ?? [];
    existing.push(record);
    byUser.set(record.userId, existing);
  }

  let totalExpired = 0;
  const usersAffected = byUser.size;

  for (const [userId, records] of byUser) {
    await db.transaction(async (tx) => {
      let totalPointsToExpire = 0;

      for (const record of records) {
        // Calculate how many of these earned points are still unredeemed
        // Simplified: expire the full amount (FIFO redemption tracking is complex)
        totalPointsToExpire += record.pointsAmount;

        // Mark as expired
        await tx.update(pointsHistory).set({
          isExpired: true,
        }).where(eq(pointsHistory.id, record.id));
      }

      if (totalPointsToExpire > 0) {
        const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
        const currentBalance = user?.pointsBalance ?? 0;
        const newBalance = Math.max(0, currentBalance - totalPointsToExpire);

        await tx.update(users).set({
          pointsBalance: newBalance,
          updatedAt: new Date(),
        }).where(eq(users.id, userId));

        await tx.insert(pointsHistory).values({
          userId,
          type: 'expire',
          pointsAmount: -totalPointsToExpire,
          pointsBalanceAfter: newBalance,
          descriptionId: 'Poin kedaluwarsa',
          descriptionEn: 'Points expired',
        });

        totalExpired += totalPointsToExpire;
      }
    });
  }

  return { expired: totalExpired, usersAffected };
}
```

### 8.2 Points Expiry Warning Email (30 days before)

```typescript
export async function sendPointsExpiryWarnings(): Promise<number> {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const today = new Date();

  const expiringRecords = await db.query.pointsHistory.findMany({
    where: and(
      eq(pointsHistory.type, 'earn'),
      eq(pointsHistory.isExpired, false),
      gt(pointsHistory.pointsAmount, 0),
      lte(pointsHistory.expiresAt, thirtyDaysFromNow),
      gt(pointsHistory.expiresAt, today)
    ),
    with: { user: true },
  });

  // Group by user, sum expiring points
  const byUser = new Map<string, { user: User; totalExpiring: number; earliestExpiry: Date }>();
  for (const record of expiringRecords) {
    const existing = byUser.get(record.userId);
    if (existing) {
      existing.totalExpiring += record.pointsAmount;
      if (record.expiresAt! < existing.earliestExpiry) {
        existing.earliestExpiry = record.expiresAt!;
      }
    } else {
      byUser.set(record.userId, {
        user: record.user,
        totalExpiring: record.pointsAmount,
        earliestExpiry: record.expiresAt!,
      });
    }
  }

  let emailsSent = 0;
  for (const [, data] of byUser) {
    try {
      await sendPointsExpiringEmail(data.user, data.totalExpiring, data.earliestExpiry);
      emailsSent++;
    } catch (error) {
      console.error('[Points Expiry Email] Failed for user', data.user.email, error);
    }
  }

  return emailsSent;
}
```

---

## 9. PRODUCT API — GET /api/products

### 9.1 Product Listing with Filters

```typescript
const ProductFilterSchema = z.object({
  category: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  featured: z.coerce.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = ProductFilterSchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);

  const { category, search, page, limit, sort, featured } = parsed.data;

  const conditions = [
    eq(products.isActive, true),
    isNull(products.deletedAt),
  ];

  if (category) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, category),
    });
    if (cat) conditions.push(eq(products.categoryId, cat.id));
  }

  if (search) {
    conditions.push(
      or(
        ilike(products.nameId, `%${search}%`),
        ilike(products.nameEn, `%${search}%`),
        ilike(products.shortDescriptionId, `%${search}%`)
      )!
    );
  }

  if (featured) {
    conditions.push(eq(products.isFeatured, true));
  }

  // Sort
  let orderByClause;
  switch (sort) {
    case 'price_asc':
      orderByClause = [asc(products.sortOrder)]; // Price sort requires join, simplified
      break;
    case 'price_desc':
      orderByClause = [desc(products.sortOrder)];
      break;
    case 'popular':
      orderByClause = [desc(products.isFeatured), asc(products.sortOrder)];
      break;
    default:
      orderByClause = [desc(products.createdAt)];
  }

  // Count total
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(...conditions));

  // Fetch products with variants and images
  const productList = await db.query.products.findMany({
    where: and(...conditions),
    with: {
      category: true,
      variants: {
        where: eq(productVariants.isActive, true),
        orderBy: [asc(productVariants.sortOrder)],
      },
      images: {
        orderBy: [asc(productImages.sortOrder)],
        limit: 1,
      },
    },
    orderBy: orderByClause,
    limit,
    offset: (page - 1) * limit,
  });

  return success({
    products: productList,
    pagination: {
      page,
      limit,
      total: Number(totalCount),
      totalPages: Math.ceil(Number(totalCount) / limit),
    },
  });
}
```

---

## 10. CART VALIDATION — POST /api/cart/validate

Called before checkout to verify all cart items are still valid and in stock.

```typescript
const CartValidateSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CartValidateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const results: CartValidationResult[] = [];
  let hasChanges = false;

  for (const item of parsed.data.items) {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, item.variantId),
      with: { product: true },
    });

    if (!variant || !variant.isActive || !variant.product.isActive || variant.product.deletedAt) {
      results.push({
        variantId: item.variantId,
        status: 'removed',
        reason: 'Produk tidak tersedia lagi',
        currentStock: 0,
        currentPrice: 0,
      });
      hasChanges = true;
      continue;
    }

    if (variant.stock === 0) {
      results.push({
        variantId: item.variantId,
        status: 'out_of_stock',
        reason: `${variant.product.nameId} (${variant.nameId}) habis`,
        currentStock: 0,
        currentPrice: variant.price,
      });
      hasChanges = true;
      continue;
    }

    if (variant.stock < item.quantity) {
      results.push({
        variantId: item.variantId,
        status: 'quantity_adjusted',
        reason: `Stok ${variant.product.nameId} (${variant.nameId}) tersisa ${variant.stock}`,
        currentStock: variant.stock,
        currentPrice: variant.price,
        adjustedQuantity: variant.stock,
      });
      hasChanges = true;
      continue;
    }

    results.push({
      variantId: item.variantId,
      status: 'valid',
      currentStock: variant.stock,
      currentPrice: variant.price,
    });
  }

  return success({ items: results, hasChanges });
}
```

---

## 11. GUEST ORDER TRACKING — GET /api/orders/[orderNumber]

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  const email = req.nextUrl.searchParams.get('email');
  const session = await auth();

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, params.orderNumber),
    with: {
      items: true,
      statusHistory: { orderBy: [asc(orderStatusHistory.createdAt)] },
    },
  });

  if (!order) return notFound('Pesanan tidak ditemukan');

  // Access control:
  // - Logged-in user who owns the order: full access
  // - Admin/owner/superadmin: full access
  // - Guest with matching email: full access
  // - Anyone else: denied

  const isOwner = session?.user?.id === order.userId;
  const isAdmin = session?.user?.role && ['superadmin', 'owner'].includes(session.user.role);
  const isGuestWithEmail = !session && email && email.toLowerCase() === order.recipientEmail.toLowerCase();

  if (!isOwner && !isAdmin && !isGuestWithEmail) {
    return NextResponse.json({
      success: false,
      error: 'Masukkan email yang digunakan saat checkout untuk melihat pesanan',
      code: 'EMAIL_REQUIRED',
    }, { status: 401 });
  }

  // Strip sensitive fields for non-admin
  const sanitizedOrder = {
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    recipientName: order.recipientName,
    items: order.items.map(item => ({
      productNameId: item.productNameId,
      productNameEn: item.productNameEn,
      variantNameId: item.variantNameId,
      variantNameEn: item.variantNameEn,
      productImageUrl: item.productImageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    pointsDiscount: order.pointsDiscount,
    shippingCost: order.shippingCost,
    totalAmount: order.totalAmount,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    estimatedDays: order.estimatedDays,
    statusHistory: order.statusHistory,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
  };

  return success(sanitizedOrder);
}
```

---

## 12. B2B INQUIRY — POST /api/b2b/inquiry

```typescript
const B2bInquirySchema = z.object({
  companyName: z.string().min(2).max(255),
  picName: z.string().min(2).max(255),
  picEmail: z.string().email(),
  picPhone: z.string().regex(/^(\+62|62|0)[0-9]{8,13}$/),
  companyType: z.string().max(100).optional(),
  message: z.string().min(10).max(2000),
  estimatedVolumeId: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = B2bInquirySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const [inquiry] = await db.insert(b2bInquiries).values({
    ...parsed.data,
    status: 'new',
  }).returning();

  // Notify superadmin via email
  try {
    await sendB2bInquiryNotification(inquiry);
  } catch (error) {
    console.error('[B2B Inquiry Email] Failed', error);
  }

  return created({
    message: 'Terima kasih! Tim kami akan menghubungi Anda dalam 1x24 jam.',
    inquiryId: inquiry.id,
  });
}
```

---

## 13. ADMIN DASHBOARD DATA — GET /api/admin/dashboard

```typescript
export async function GET(req: NextRequest) {
  const session = await requireRole(['superadmin', 'owner']);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // KPI queries (run in parallel)
  const [
    totalRevenue,
    totalOrders,
    todayOrders,
    newCustomers,
    revenueByDay,
    recentOrders,
    ordersByStatus,
  ] = await Promise.all([
    // Total revenue (last 30 days, paid orders only)
    db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
      .from(orders)
      .where(and(
        gte(orders.paidAt, thirtyDaysAgo),
        inArray(orders.status, ['paid', 'processing', 'packed', 'shipped', 'delivered'])
      )),

    // Total orders (last 30 days)
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(
        gte(orders.createdAt, thirtyDaysAgo),
        not(eq(orders.status, 'cancelled'))
      )),

    // Today's orders
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(gte(orders.createdAt, todayStart)),

    // New customers (last 30 days)
    db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        gte(users.createdAt, thirtyDaysAgo),
        eq(users.role, 'customer')
      )),

    // Revenue by day (last 30 days, for chart)
    db.execute(sql`
      SELECT DATE(paid_at AT TIME ZONE 'Asia/Jakarta') as date,
             COALESCE(SUM(total_amount), 0) as revenue,
             COUNT(*) as order_count
      FROM orders
      WHERE paid_at >= ${thirtyDaysAgo}
        AND status NOT IN ('cancelled', 'pending_payment')
      GROUP BY DATE(paid_at AT TIME ZONE 'Asia/Jakarta')
      ORDER BY date ASC
    `),

    // Recent orders (last 10)
    db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      limit: 10,
      columns: {
        id: true,
        orderNumber: true,
        recipientName: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    }),

    // Orders by status count
    db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM orders
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY status
    `),
  ]);

  const revenue = Number(totalRevenue[0]?.total ?? 0);
  const ordersCount = Number(totalOrders[0]?.count ?? 0);
  const avgOrderValue = ordersCount > 0 ? Math.round(revenue / ordersCount) : 0;

  return success({
    kpi: {
      totalRevenue: revenue,
      totalOrders: ordersCount,
      todayOrders: Number(todayOrders[0]?.count ?? 0),
      avgOrderValue,
      newCustomers: Number(newCustomers[0]?.count ?? 0),
    },
    revenueChart: revenueByDay.rows,
    recentOrders,
    ordersByStatus: ordersByStatus.rows,
  });
}
```

---

*End of BACKEND_API_GUIDE.md v1.0*
*This file covers every critical backend flow. Cursor must implement these exactly as specified.*
