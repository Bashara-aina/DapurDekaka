import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  orders,
  productVariants,
  inventoryLogs,
  coupons,
  couponUsages,
  pointsHistory,
  users,
  orderStatusHistory,
  refunds,
  webhookEvents,
} from '@/lib/db/schema';
import { eq, and, sql, gte, count } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { PickupReadyEmail } from '@/lib/resend/templates/PickupReady';
import { formatWIB } from '@/lib/utils/format-date';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { verifyMidtransSignature } from '@/lib/midtrans/verify-signature';
import { settleOrderTx, InsufficientStockError } from '@/lib/finance/settle-order';
import { recordWebhookEvent } from '@/lib/utils/webhook-events';
import { sendWhatsApp, pickupReadyMessage } from '@/lib/services/fonnte';
import { getSetting } from '@/lib/settings/get-settings';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEBHOOK_RATE_LIMIT = { windowMs: 60000, maxRequests: 30 };

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
    } = body as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
    };

    // ── P0#1: verify Midtrans body signature (NOT a header) ──────────────
    const valid = verifyMidtransSignature(
      { orderId: order_id, statusCode: status_code, grossAmount: gross_amount, signatureKey: signature_key },
      process.env.MIDTRANS_SERVER_KEY
    );
    if (!valid) {
      logger.warn('[Midtrans Webhook] Invalid or missing signature', { orderId: order_id });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const transactionId = typeof body.transaction_id === 'string' ? body.transaction_id : null;
    const paymentType = typeof body.payment_type === 'string' ? body.payment_type : null;
    const vaNumbers = body.va_numbers as Array<{ va_number?: string }> | undefined;
    const vaNumber = vaNumbers?.[0]?.va_number ?? null;

    // ── Step 2: Find order ───────────────────────────────────────────────
    const order = await findWebhookOrder(order_id ?? '');

    if (!order) {
      logger.warn('[Midtrans Webhook] Order not found', { orderId: order_id });
      await recordWebhookEvent({
        source: 'midtrans',
        eventType: transaction_status ?? 'unknown',
        externalId: order_id ?? null,
        payload: body,
        errorMessage: 'order_not_found',
      });
      return NextResponse.json({ received: false }, { status: 404 });
    }

    // ── Step 3: Idempotency ──────────────────────────────────────────────
    if (transactionId && order.midtransTransactionId === transactionId) {
      return success({ received: true, note: 'already_processed' });
    }
    if (order.status === 'paid' && transaction_status === 'settlement') {
      return success({ received: true, note: 'already_processed' });
    }
    if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status ?? '')) {
      return success({ received: true, note: 'already_cancelled' });
    }

    // Late settlement on a cancelled/refunded order — money arrived outside the
    // happy path. FD#4: do NOT silently re-open; create a refund obligation and
    // leave the order state as-is for manual handling.
    if (
      (order.status === 'cancelled' || order.status === 'refunded') &&
      (transaction_status === 'settlement' || transaction_status === 'capture')
    ) {
      logger.warn('[Midtrans Webhook] Settlement for non-open order — refund obligation', {
        orderNumber: order.orderNumber,
        status: order.status,
      });
      await createRefundObligation(order.id, order.totalAmount, order.orderNumber, transaction_status);
      await flagNeedsAttention(order.id, 'late_settlement', `late settlement on ${order.status}`);
      await recordWebhookEvent({
        source: 'midtrans',
        eventType: `late_settlement_${order.status}`,
        externalId: order_id ?? null,
        payload: body,
        errorMessage: 'late_settlement_manual_review',
      });
      return NextResponse.json(
        { received: true, note: `${order.status}_but_payment_received_manual_review_needed` },
        { status: 200 }
      );
    }

    // ── Step 4: Settlement ───────────────────────────────────────────────
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      const expectedAmount = order.totalAmount;
      const webhookAmount = Math.round(parseFloat(gross_amount ?? '0'));
      if (webhookAmount !== expectedAmount) {
        logger.error('[Midtrans Webhook] Amount mismatch', { orderId: order_id, expectedAmount, webhookAmount });
        await recordWebhookEvent({
          source: 'midtrans',
          eventType: 'amount_mismatch',
          externalId: order_id ?? null,
          payload: body,
          errorMessage: `expected ${expectedAmount} got ${webhookAmount}`,
        });
        try {
          const mismatchRows = await db
            .select({ value: count() })
            .from(webhookEvents)
            .where(
              and(
                eq(webhookEvents.externalId, order_id ?? ''),
                eq(webhookEvents.eventType, 'amount_mismatch'),
                gte(webhookEvents.createdAt, new Date(Date.now() - 60 * 60 * 1000))
              )
            );
          if ((mismatchRows[0]?.value ?? 0) >= 5) {
            notifyOps(`Gross mismatch ×5 untuk ${order.orderNumber} — cek Midtrans dashboard.`);
            await flagNeedsAttention(order.id, 'gross_mismatch_spam', 'amount_mismatch repeated');
          }
        } catch (alertErr) {
          logger.warn('[Midtrans Webhook] mismatch alert check failed', {
            error: alertErr instanceof Error ? alertErr.message : String(alertErr),
          });
        }
        return NextResponse.json({ received: false }, { status: 400 });
      }

      let settled = false;
      try {
        await db.transaction(async (tx) => {
          settled = await settleOrderTx(tx, order, {
            source: 'webhook',
            note: 'Pembayaran berhasil dikonfirmasi via Midtrans',
            paymentType,
            vaNumber,
            transactionId,
          });
        });
      } catch (settleError) {
        if (settleError instanceof InsufficientStockError) {
          // Oversell at settlement — money received but stock gone. Return 200 so
          // Midtrans stops retrying; flag for manual attention (P3 red-team #2).
          logger.error('[Midtrans Webhook] Oversell at settlement', {
            orderNumber: order.orderNumber,
            variantId: settleError.variantId,
          });
          await recordWebhookEvent({
            source: 'midtrans',
            eventType: 'settlement_insufficient_stock',
            externalId: order_id ?? null,
            payload: body,
            errorMessage: settleError.message,
          });
          notifyOps(`Oversell saat settlement: ${order.orderNumber} (stok habis). Perlu tindakan manual.`);
          await flagNeedsAttention(order.id, 'oversell_at_settlement', settleError.message);
          return NextResponse.json({ received: true, note: 'insufficient_stock_manual_review' }, { status: 200 });
        }
        throw settleError;
      }

      if (!settled) {
        return success({ received: true, note: 'already_processed' });
      }

      await recordWebhookEvent({
        source: 'midtrans',
        eventType: transaction_status,
        externalId: order_id ?? null,
        payload: body,
      });
      logger.info('[Midtrans Webhook] Order paid successfully', { orderNumber: order.orderNumber });

      await sendSettlementNotifications(order);
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status ?? '')) {
      await handleCancellation(order, transaction_status ?? 'cancel');
      await recordWebhookEvent({
        source: 'midtrans',
        eventType: transaction_status ?? 'cancel',
        externalId: order_id ?? null,
        payload: body,
      });
    } else {
      await recordWebhookEvent({
        source: 'midtrans',
        eventType: transaction_status ?? 'unknown',
        externalId: order_id ?? null,
        payload: body,
      });
    }

    return success({ received: true });
  } catch (error) {
    logger.error('[Midtrans Webhook] Error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, WEBHOOK_RATE_LIMIT);

function findWebhookOrder(midtransOrderId: string) {
  return db.query.orders.findFirst({
    where: eq(orders.midtransOrderId, midtransOrderId),
    with: { items: true, user: true },
  });
}

type WebhookOrder = NonNullable<Awaited<ReturnType<typeof findWebhookOrder>>>;

async function createRefundObligation(
  orderId: string,
  amount: number,
  orderNumber: string,
  reason: string
): Promise<void> {
  if (amount <= 0) return;
  const existing = await db.select({ id: refunds.id }).from(refunds).where(eq(refunds.orderId, orderId)).limit(1);
  if (existing.length > 0) return;
  await db.insert(refunds).values({
    orderId,
    amount,
    reason: 'customer_request',
    method: 'midtrans',
    status: 'pending',
    notes: `Auto-created on late Midtrans ${reason} for ${orderNumber}`,
  });
}

function notifyOps(message: string): void {
  const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!storePhone) return;
  sendWhatsApp({ phone: storePhone, message }).catch(() => undefined);
}

/**
 * Payment failed — cancel + reverse ONLY what was actually applied.
 *
 * P0#2 (P3 Decision 1): stock and coupon `used_count` are only touched at
 * settlement, so we restore/decrement them ONLY when the order was already
 * paid. Points (deducted at initiate) and provisional couponUsages rows are
 * reversed regardless of paid state.
 */
async function handleCancellation(order: WebhookOrder, transactionStatus: string): Promise<void> {
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const wasPaidBefore = order.status === 'paid';

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        refundDueDate: wasPaidBefore ? sevenDaysOut : null,
      })
      .where(eq(orders.id, order.id));

    // L2 Rule 7: paid-order cancellation creates a refund obligation.
    if (wasPaidBefore && order.totalAmount > 0) {
      const existing = await tx
        .select({ id: refunds.id })
        .from(refunds)
        .where(eq(refunds.orderId, order.id))
        .limit(1);
      if (existing.length === 0) {
        await tx.insert(refunds).values({
          orderId: order.id,
          amount: order.totalAmount,
          reason: 'customer_request',
          method: 'midtrans',
          status: 'pending',
          notes: `Auto-created on Midtrans ${transactionStatus} for ${order.orderNumber}`,
        });
      }
    }

    // Restore stock ONLY if it was deducted (i.e. the order was paid).
    if (wasPaidBefore) {
      for (const item of order.items) {
        const [updated] = await tx
          .update(productVariants)
          .set({ stock: sql`GREATEST(stock + ${item.quantity}, 0)`, updatedAt: new Date() })
          .where(eq(productVariants.id, item.variantId))
          .returning({ newStock: productVariants.stock });

        if (updated && updated.newStock !== undefined) {
          await tx.insert(inventoryLogs).values({
            variantId: item.variantId,
            changeType: 'reversal',
            quantityBefore: updated.newStock - item.quantity,
            quantityAfter: updated.newStock,
            quantityDelta: item.quantity,
            orderId: order.id,
            note: `Pembatalan pesanan ${order.orderNumber} — stok dikembalikan`,
          });
        }
      }
    }

    // Reverse redeemed points (deducted at initiate regardless of paid state).
    if (order.userId && order.pointsUsed > 0) {
      const redeemRecords = await tx
        .select()
        .from(pointsHistory)
        .where(
          and(
            eq(pointsHistory.userId, order.userId),
            eq(pointsHistory.type, 'redeem'),
            eq(pointsHistory.orderId, order.id),
            sql`${pointsHistory.referencedEarnId} IS NOT NULL`
          )
        )
        .orderBy(pointsHistory.createdAt);

      for (const redeem of redeemRecords) {
        if (redeem.referencedEarnId) {
          await tx
            .update(pointsHistory)
            .set({ consumedAt: null })
            .where(eq(pointsHistory.id, redeem.referencedEarnId));
        }
      }

      await tx
        .update(users)
        .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
        .where(eq(users.id, order.userId));
    }

    // Coupon: decrement used_count ONLY if it was incremented (paid). The
    // provisional couponUsages row (inserted at initiate) is deleted regardless.
    if (order.couponId) {
      if (wasPaidBefore) {
        await tx
          .update(coupons)
          .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
          .where(eq(coupons.id, order.couponId));
      }
      await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
    }
  });

  logger.info('[Midtrans Webhook] Order cancelled', { orderNumber: order.orderNumber, reason: transactionStatus });

  const cancelReason =
    transactionStatus === 'expire'
      ? 'Pembayaran kadaluarsa (maksimal waktu pembayaran terlampaui)'
      : transactionStatus === 'cancel'
        ? 'Pembayaran dibatalkan oleh sistem Midtrans'
        : 'Pembayaran ditolak oleh bank atau provider';

  sendEmail({
    to: order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} dibatalkan`,
    react: OrderCancellationEmail({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      items: order.items.map((item) => ({
        name: item.productNameId,
        variant: item.variantNameId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      reason: cancelReason,
      cancelledAt: formatWIB(new Date()),
      refundAmount: wasPaidBefore ? order.totalAmount : 0,
      refundInfo: wasPaidBefore ? 'Pengembalian dana akan diproses 1-7 hari kerja' : '',
    }),
  }).catch((emailError) => {
    logger.error('[Email] Failed to send cancellation email', {
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
  });
}

async function sendSettlementNotifications(order: WebhookOrder): Promise<void> {
  if (order.deliveryMethod === 'pickup') {
    const pickupAddress =
      (await getSetting<string>('store_address', 'string')) ?? 'Jl. Sinom V No. 7, Turangga, Bandung';
    const openingHours =
      (await getSetting<string>('store_opening_hours', 'string')) ?? 'Senin-Sabtu: 08.00 - 17.00 WIB';

    sendEmail({
      to: order.recipientEmail,
      subject: `Pesanan ${order.orderNumber} siap diambil!`,
      react: PickupReadyEmail({
        orderNumber: order.orderNumber,
        customerName: order.recipientName,
        pickupCode: order.orderNumber,
        pickupAddress,
        openingHours,
      }),
    }).catch((emailError) => {
      logger.error('[Email] Failed to send pickup ready', {
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    });

    sendWhatsApp({
      phone: order.recipientPhone,
      message: pickupReadyMessage({
        orderNumber: order.orderNumber,
        address: pickupAddress,
        pickupCode: order.orderNumber,
      }),
    }).catch(() => undefined);
    return;
  }

  sendEmail({
    to: order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} telah dikonfirmasi!`,
    react: OrderConfirmationEmail({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      items: order.items.map((item) => ({
        name: item.productNameId,
        variant: item.variantNameId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      deliveryMethod: 'delivery',
      courierName: order.courierName ?? undefined,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      addressLine: order.addressLine ?? undefined,
      city: order.city ?? undefined,
      province: order.province ?? undefined,
      paidAt: formatWIB(new Date()),
      pointsEarned: order.pointsEarned ?? 0,
    }),
  }).catch((emailError) => {
    logger.error('[Email] Failed to send confirmation', {
      error: emailError instanceof Error ? emailError.message : String(emailError),
    });
  });
}
