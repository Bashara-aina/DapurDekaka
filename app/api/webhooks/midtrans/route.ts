import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import {
  orders,
  productVariants,
  inventoryLogs,
  coupons,
  couponUsages,
  orderStatusHistory,
  refunds,
  webhookEvents,
} from '@/lib/db/schema';
import { eq, and, sql, gte, count } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { formatWIB } from '@/lib/utils/format-date';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { verifyMidtransSignature, parseMidtransGrossAmount } from '@/lib/midtrans/verify-signature';
import { settleOrderTx, InsufficientStockError } from '@/lib/finance/settle-order';
import { reverseRedeemedPointsTx } from '@/lib/finance/points-ledger';
import { handleOversellAtSettlement } from '@/lib/finance/oversell';
import { recordWebhookEvent } from '@/lib/utils/webhook-events';
import { sendWhatsApp } from '@/lib/services/fonnte';
import { getSetting } from '@/lib/settings/get-settings';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';
import { stripRetrySuffix } from '@/lib/utils/generate-order-number';
import { scheduleBackground } from '@/lib/utils/background';
import { isAlreadyProcessed, markProcessed, buildWebhookIdempotencyKey } from '@/lib/utils/webhook-idempotency';

export const runtime = 'nodejs';

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (err) {
      // Never log rawBody — may contain PII. Length suffices for triage.
      logger.warn('[Midtrans Webhook] invalid JSON payload', {
        bodyLength: rawBody.length,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
      fraud_status?: string;
    };

    // ── P0#1: verify Midtrans body signature (NOT a header) ──────────────
    // S10: verify before the Redis idempotency lookup so unauthenticated
    // requests cannot probe which events have been processed.
    const valid = verifyMidtransSignature(
      { orderId: order_id, statusCode: status_code, grossAmount: gross_amount, signatureKey: signature_key },
      process.env.MIDTRANS_SERVER_KEY
    );
    if (!valid) {
      logger.warn('[Midtrans Webhook] Invalid or missing signature', { orderId: order_id });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const eventId = buildWebhookIdempotencyKey('midtrans', order_id ?? '', transaction_status ?? '');
    if (await isAlreadyProcessed(eventId)) {
      return success({ received: true, note: 'already_processed_idempotent' });
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

    // ── Step 3: Idempotency (DB-level dedup) ────────────────────────────
    // H6: dedup per (transaction_id, transaction_status), NOT transaction_id
    // alone — refund/chargeback notifications share the original transaction.
    if (order.status === 'paid' && transaction_status === 'settlement') {
      // Stale Snap/VA from a retry can still settle after the order is paid on
      // a newer midtransOrderId — that is a second payment, not a no-op.
      const webhookMidtransId = order_id ?? '';
      const currentMidtransId = order.midtransOrderId ?? '';
      if (
        webhookMidtransId &&
        currentMidtransId &&
        webhookMidtransId !== currentMidtransId
      ) {
        logger.warn('[Midtrans Webhook] Duplicate settlement on alternate Midtrans id', {
          orderNumber: order.orderNumber,
          webhookMidtransId,
          currentMidtransId,
        });
        await createRefundObligation(
          order.id,
          order.totalAmount,
          order.orderNumber,
          'late_settlement',
          `duplicate_settlement:${webhookMidtransId}`
        );
        await flagNeedsAttention(
          order.id,
          'duplicate_settlement',
          `paid twice: ${webhookMidtransId} vs ${currentMidtransId}`
        );
        await recordWebhookEvent({
          source: 'midtrans',
          eventType: 'duplicate_settlement',
          externalId: order_id ?? null,
          payload: body,
          errorMessage: 'duplicate_settlement_manual_review',
        });
        await markProcessed(eventId);
        return success({ received: true, note: 'duplicate_settlement_manual_review' });
      }
      await markProcessed(eventId);
      return success({ received: true, note: 'already_processed' });
    }
    if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status ?? '')) {
      await markProcessed(eventId);
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
      await createRefundObligation(order.id, order.totalAmount, order.orderNumber, 'late_settlement', transaction_status);
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
      // AUDIT-05 #2 hardening: normalise "236000.00" / "236000" to integer.
      const webhookAmount = parseMidtransGrossAmount(gross_amount);
      if (webhookAmount === null || webhookAmount !== expectedAmount) {
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

      // H5: card capture with fraud_status=challenge must be held for review,
      // not treated as paid.
      if (transaction_status === 'capture' && fraud_status === 'challenge') {
        await flagNeedsAttention(
          order.id,
          'gross_mismatch_spam',
          'Midtrans capture held for fraud review (challenge)'
        );
        await recordWebhookEvent({
          source: 'midtrans',
          eventType: 'capture_challenge',
          externalId: order_id ?? null,
          payload: body,
          errorMessage: 'fraud_challenge_manual_review',
        });
        return NextResponse.json(
          { received: true, note: 'capture_challenge_manual_review' },
          { status: 200 }
        );
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
          // H3(b): money was received but stock is gone. Flip the order to paid
          // with needsAttention and create a refund obligation so it surfaces in
          // the Refunds queue instead of retrying forever as pending_payment.
          logger.error('[Midtrans Webhook] Oversell at settlement', {
            orderNumber: order.orderNumber,
            variantId: settleError.variantId,
          });
          await handleOversellAtSettlement(order, settleError.message, transactionId);
          await recordWebhookEvent({
            source: 'midtrans',
            eventType: 'settlement_insufficient_stock',
            externalId: order_id ?? null,
            payload: body,
            errorMessage: settleError.message,
          });
          notifyOps(`Oversell saat settlement: ${order.orderNumber} (stok habis). Refund wajib dibuat.`);
          return NextResponse.json({ received: true, note: 'insufficient_stock_refund_queued' }, { status: 200 });
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
    } else if (['refund', 'partial_refund', 'chargeback'].includes(transaction_status ?? '')) {
      // H6: refunds initiated from the Midtrans dashboard must be reflected in
      // the refunds queue/order state, not silently ignored.
      await handleRefundNotification(
        order,
        transaction_status ?? 'refund',
        transactionId,
        body as Record<string, unknown>
      );
      await recordWebhookEvent({
        source: 'midtrans',
        eventType: transaction_status ?? 'refund',
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

    await markProcessed(eventId);
    return success({ received: true });
  } catch (error) {
    // Money path — always report, not just log.
    Sentry.captureException(error);
    logger.error('[Midtrans Webhook] Error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, 'webhook');

async function findWebhookOrder(midtransOrderId: string) {
  // Fast path: the current Midtrans id.
  const direct = await db.query.orders.findFirst({
    where: eq(orders.midtransOrderId, midtransOrderId),
    with: { items: true, user: true },
  });
  if (direct) return direct;

  // C3: an old VA/QRIS transaction can notify after a retry replaced the id.
  // Resolve the canonical order number (`DDK-…-retry-N` → `DDK-…`); the old
  // transaction id has no suffix but its orderNumber does match.
  const canonicalOrderNumber = stripRetrySuffix(midtransOrderId);

  return db.query.orders.findFirst({
    where: eq(orders.orderNumber, canonicalOrderNumber),
    with: { items: true, user: true },
  });
}

type WebhookOrder = NonNullable<Awaited<ReturnType<typeof findWebhookOrder>>>;

type RefundReason =
  | 'customer_request'
  | 'late_settlement'
  | 'payment_cancelled'
  | 'oversell'
  | 'cold_chain_failure'
  | 'stock_out'
  | 'fraud'
  | 'other';

async function createRefundObligation(
  orderId: string,
  amount: number,
  orderNumber: string,
  reason: RefundReason,
  context: string
): Promise<void> {
  if (amount <= 0) return;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(eq(refunds.orderId, orderId), eq(refunds.status, 'pending')))
      .limit(1);
    if (existing.length > 0) return;
    await tx.insert(refunds).values({
      orderId,
      amount,
      reason,
      method: 'midtrans',
      status: 'pending',
      notes: `Auto-created on Midtrans ${context} for ${orderNumber}`,
    });
  });
}

/**
 * H6: reflect Midtrans dashboard refunds/chargebacks in our refund queue.
 */
async function handleRefundNotification(
  order: WebhookOrder,
  transactionStatus: string,
  transactionId: string | null,
  body: Record<string, unknown>
): Promise<void> {
  const rawAmount = body.refund_amount ?? body.gross_amount;
  const parsedAmount =
    typeof rawAmount === 'string' || typeof rawAmount === 'number'
      ? parseMidtransGrossAmount(String(rawAmount))
      : null;
  const refundAmount = Math.max(
    0,
    Math.min(order.totalAmount, parsedAmount ?? order.totalAmount)
  );
  const isFull = transactionStatus === 'chargeback' || refundAmount >= order.totalAmount;
  const refundId =
    (typeof body.refund_id === 'string' && body.refund_id) ||
    (typeof body.refund_key === 'string' && body.refund_key) ||
    null;

  let partialMismatchNote: string | null = null;

  await db.transaction(async (tx) => {
    const existing = await tx.query.refunds.findFirst({
      where: eq(refunds.orderId, order.id),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    if (existing) {
      // Only auto-complete when Midtrans amount covers the stored obligation.
      // A smaller partial_refund must not close a full-order refund row.
      const coversObligation = refundAmount >= existing.amount;
      await tx
        .update(refunds)
        .set({
          status: coversObligation ? 'completed' : existing.status,
          processedAt: coversObligation ? new Date() : existing.processedAt,
          midtransRefundId: refundId ?? existing.midtransRefundId,
          notes: `${existing.notes ?? ''}\nMidtrans ${transactionStatus} amount=${refundAmount}${coversObligation ? '' : ' (partial — obligation still open)'}`.trim(),
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, existing.id));
      if (!coversObligation) {
        partialMismatchNote = `Midtrans refunded ${refundAmount} but obligation is ${existing.amount}`;
      }
    } else if (refundAmount > 0) {
      await tx.insert(refunds).values({
        orderId: order.id,
        amount: refundAmount,
        reason: transactionStatus === 'chargeback' ? 'fraud' : 'other',
        method: 'midtrans',
        status: 'completed',
        processedAt: new Date(),
        midtransRefundId: refundId ?? transactionId ?? undefined,
        notes: `Midtrans ${transactionStatus} notification for ${order.orderNumber}`,
      });
    }

    if (isFull && order.status !== 'refunded') {
      await tx
        .update(orders)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: 'refunded',
        changedByType: 'system',
        note: `Midtrans ${transactionStatus} — refund penuh`,
      });
    }
  });

  if (partialMismatchNote) {
    await flagNeedsAttention(order.id, 'partial_refund_mismatch', partialMismatchNote);
  }
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
  const wasPaidBefore = order.paidAt !== null;

  // H4: never auto-cancel an order the courier already has.
  if (order.status === 'shipped' || order.status === 'delivered') {
    await flagNeedsAttention(
      order.id,
      'refund_failed',
      `Midtrans ${transactionStatus} on ${order.status} order — manual review`
    );
    logger.warn('[Midtrans Webhook] Refusing to auto-cancel shipped order', {
      orderNumber: order.orderNumber,
      status: order.status,
    });
    return;
  }

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        refundDueDate: wasPaidBefore ? sevenDaysOut : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, order.id),
          sql`${orders.status} NOT IN ('cancelled', 'refunded')`
        )
      )
      .returning({ id: orders.id });

    if (!updated) return;

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: 'cancelled',
      changedByType: 'system',
      note: `Midtrans ${transactionStatus}`,
    });

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
          reason: 'payment_cancelled',
          method: 'midtrans',
          status: 'pending',
          notes: `Auto-created on Midtrans ${transactionStatus} for ${order.orderNumber}`,
        });
      }
    }

    // Restore stock ONLY if it was deducted (i.e. the order was paid).
    if (wasPaidBefore) {
      for (const item of order.items) {
        const [row] = await tx
          .update(productVariants)
          .set({ stock: sql`GREATEST(stock + ${item.quantity}, 0)`, updatedAt: new Date() })
          .where(eq(productVariants.id, item.variantId))
          .returning({ newStock: productVariants.stock });

        if (row && row.newStock !== undefined) {
          await tx.insert(inventoryLogs).values({
            variantId: item.variantId,
            changeType: 'reversal',
            quantityBefore: row.newStock - item.quantity,
            quantityAfter: row.newStock,
            quantityDelta: item.quantity,
            orderId: order.id,
            note: `Pembatalan pesanan ${order.orderNumber} — stok dikembalikan`,
          });
        }
      }
    }

    // P1: refund redeemed points through the ledger helper (idempotent).
    await reverseRedeemedPointsTx(tx, order);

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

  scheduleBackground(
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
    }),
    'midtrans cancellation email'
  );
}

function buildConfirmationEmail(order: WebhookOrder) {
  return OrderConfirmationEmail({
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
    deliveryMethod: order.deliveryMethod as 'delivery' | 'pickup',
    courierName: order.courierName ?? undefined,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    addressLine: order.addressLine ?? undefined,
    city: order.city ?? undefined,
    province: order.province ?? undefined,
    paidAt: formatWIB(new Date()),
    pointsEarned: order.pointsEarned ?? 0,
  });
}

async function sendSettlementNotifications(order: WebhookOrder): Promise<void> {
  // M12: "siap diambil" is sent when the warehouse marks the order packed, not
  // at payment time. Here the customer only gets a payment confirmation.
  scheduleBackground(
    sendEmail({
      to: order.recipientEmail,
      subject: `Pesanan ${order.orderNumber} telah dikonfirmasi!`,
      react: buildConfirmationEmail(order),
    }),
    'midtrans confirmation email'
  );

  // New-order alert for the owner (Fonnte is optional; email is the backstop).
  try {
    const adminEmail = await getSetting<string>('admin_email', 'string');
    if (adminEmail) {
      scheduleBackground(
        sendEmail({
          to: adminEmail,
          subject: `[Pesanan Baru] ${order.orderNumber} — ${order.deliveryMethod === 'pickup' ? 'Pickup' : order.courierName ?? 'Kirim'}`,
          react: buildConfirmationEmail(order),
        }),
        'owner new-order email'
      );
    }

    const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
    if (storePhone) {
      scheduleBackground(
        sendWhatsApp({
          phone: storePhone,
          message:
            `PESANAN BARU ${order.orderNumber} — ${order.recipientName} — ` +
            `Rp ${order.totalAmount.toLocaleString('id-ID')} — ` +
            `${order.deliveryMethod === 'pickup' ? 'PICKUP' : `${order.courierName ?? 'kurir'}`}. Cek dashboard.`,
        }),
        'owner new-order WhatsApp'
      );
    }
  } catch (alertError) {
    logger.warn('[Midtrans Webhook] owner alert failed', {
      orderNumber: order.orderNumber,
      error: alertError instanceof Error ? alertError.message : String(alertError),
    });
  }
}
