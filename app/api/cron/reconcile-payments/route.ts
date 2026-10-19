import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, couponUsages } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { logger } from '@/lib/utils/logger';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { formatWIB } from '@/lib/utils/format-date';
import { settleOrderTx, InsufficientStockError } from '@/lib/finance/settle-order';
import { handleOversellAtSettlement } from '@/lib/finance/oversell';
import { reverseRedeemedPointsTx } from '@/lib/finance/points-ledger';
import { checkTransactionStatus } from '@/lib/midtrans/status';
import { sendWhatsApp } from '@/lib/services/fonnte';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';
import { scheduleBackground } from '@/lib/utils/background';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Payment reconciliation cron job.
 * Finds pending orders older than 30 minutes and checks Midtrans status.
 * Handles the case where Midtrans says paid but our DB still shows pending_payment.
 * Runs hourly via Vercel Cron (backstop for missed webhooks; hourly keeps Neon asleep longer).
 *
 * P0#3: settlement recovery uses the SAME `settleOrderTx()` as the webhook so
 * stock IS deducted and points are recomputed net-of-discount (never the stale
 * `pointsEarned` column).
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const BATCH_LIMIT = 100;

    const pendingOrders = await db.query.orders.findMany({
      where: and(eq(orders.status, 'pending_payment'), lt(orders.createdAt, thirtyMinsAgo)),
      with: { user: true },
      limit: BATCH_LIMIT,
    });

    const results = { checked: 0, reconciled: 0, cancelled: 0, errors: 0, hasMore: pendingOrders.length === BATCH_LIMIT };

    for (const order of pendingOrders) {
      let outcome: 'settlement' | 'cancel' | 'skip' | 'error' = 'skip';
      try {
        results.checked++;
        if (!order.midtransOrderId) continue;

        // M9: shared helper respects MIDTRANS_IS_PRODUCTION (sandbox vs prod).
        const midtrans = await checkTransactionStatus(order.midtransOrderId);
        const midtransStatus = midtrans.transactionStatus;

        if (midtransStatus === 'settlement' || midtransStatus === 'capture') {
          outcome = await recoverSettlement(order.id);
        } else if (['cancel', 'deny', 'expire'].includes(midtransStatus)) {
          await cancelReconciled(order.id);
          outcome = 'cancel';
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'ORDER_ALREADY_PROCESSED') {
          logger.info('[Reconcile] Already processed, skipping', { orderNumber: order.orderNumber });
          outcome = 'skip';
        } else if (err instanceof InsufficientStockError) {
          logger.error('[Reconcile] Oversell at recovery', { orderNumber: order.orderNumber, variantId: err.variantId });
          await handleOversellAtSettlement(order, err.message, order.midtransTransactionId);
          notifyOps(`Oversell saat reconcile: ${order.orderNumber}. Refund otomatis masuk queue.`);
          outcome = 'error';
        } else {
          logger.error('[Reconcile] Error processing order', { orderNumber: order.orderNumber, error: message });
          outcome = 'error';
        }
      }

      if (outcome === 'settlement') results.reconciled++;
      else if (outcome === 'cancel') results.cancelled++;
      else if (outcome === 'error') results.errors++;
    }

    logger.info('[Reconcile] Payment reconciliation complete', results);
    if (results.hasMore) {
      logger.warn('[Reconcile] More pending orders than BATCH_LIMIT — backlog exists', { batchLimit: BATCH_LIMIT });
    }
    return success(results);
  } catch (error) {
    logger.error('[Reconcile] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

async function recoverSettlement(orderId: string): Promise<'settlement' | 'skip'> {
  const fullOrder = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });

  if (!fullOrder || fullOrder.status !== 'pending_payment') return 'skip';

  logger.warn('[Reconcile] Recovering missed settlement', { orderNumber: fullOrder.orderNumber });

  let settled = false;
  await db.transaction(async (tx) => {
    settled = await settleOrderTx(tx, fullOrder, {
      source: 'reconcile',
      note: 'Pembayaran dikonfirmasi via reconcile cron',
    });
  });

  if (!settled) return 'skip';

  await flagNeedsAttention(
    fullOrder.id,
    'reconcile_recovery',
    'Settlement pulih via reconcile cron (webhook tidak pernah tiba)'
  );

  const orderForEmail = fullOrder as typeof fullOrder & { pointsEarned?: number };
  scheduleBackground(sendEmail({
    to: fullOrder.recipientEmail,
    subject: `Pesanan ${fullOrder.orderNumber} telah dikonfirmasi!`,
    react: OrderConfirmationEmail({
      orderNumber: fullOrder.orderNumber,
      customerName: fullOrder.recipientName,
      items: fullOrder.items.map((item) => ({
        name: item.productNameId,
        variant: item.variantNameId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      subtotal: fullOrder.subtotal,
      shippingCost: fullOrder.shippingCost,
      discountAmount: fullOrder.discountAmount,
      totalAmount: fullOrder.totalAmount,
      deliveryMethod: fullOrder.deliveryMethod as 'delivery' | 'pickup',
      courierName: fullOrder.courierName ?? undefined,
      recipientName: fullOrder.recipientName,
      recipientPhone: fullOrder.recipientPhone,
      addressLine: fullOrder.addressLine ?? undefined,
      city: fullOrder.city ?? undefined,
      province: fullOrder.province ?? undefined,
      paidAt: formatWIB(fullOrder.paidAt ?? new Date()),
      pointsEarned: orderForEmail.pointsEarned ?? 0,
    }),
  }), 'reconcile confirmation email');

  return 'settlement';
}

/**
 * Cancel a pending order Midtrans reports as failed. This order was never paid,
 * so stock and coupon `used_count` were never touched — reverse ONLY the points
 * redeemed at initiate and the provisional couponUsages row (P0#2).
 */
async function cancelReconciled(orderId: string): Promise<void> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order || order.status !== 'pending_payment') return;

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'pending_payment')))
      .returning({ id: orders.id });

    if (!updated) return;

    // P1: reverse redeemed points through the shared ledger helper.
    await reverseRedeemedPointsTx(tx, order);

    // Delete provisional couponUsages row; do NOT decrement used_count (never
    // incremented for an unpaid order).
    if (order.couponId) {
      await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
    }
  });
}

function notifyOps(message: string): void {
  const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!storePhone) {
    logger.warn('[cron/reconcile] WhatsApp number not configured, ops alert dropped', { message });
    return;
  }
  sendWhatsApp({ phone: storePhone, message }).catch((err: unknown) => {
    logger.error('[cron/reconcile] ops WhatsApp alert failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}


