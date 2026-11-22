import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, couponUsages, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import {
  checkTransactionStatus,
  cancelTransaction,
  isMidtransTransactionMissing,
} from '@/lib/midtrans/status';
import { serverError, success, unauthorized } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { reverseRedeemedPointsTx } from '@/lib/finance/points-ledger';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { formatWIB } from '@/lib/utils/format-date';
import { scheduleBackground } from '@/lib/utils/background';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Cancel orders that have exceeded payment expiry time.
 * Invoked from `/api/cron/hourly` (single Neon wake). Direct route kept for manual runs.
 * Checks Midtrans as fallback to avoid cancelling orders that paid concurrently.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return unauthorized('Cron auth diperlukan');
    }

    const now = new Date();
    const BATCH_LIMIT = 200;
    let cancelled = 0;
    let errors: string[] = [];

    // Find all pending_payment orders past their expiry time (bounded).
    // NOTE: no `with: { items }` — cancellation only touches order-level
    // fields + points/coupon rows; loading up to 200 × full item lists was
    // pure waste (previously fetched and never read).
    const expiredOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'pending_payment'),
        lt(orders.paymentExpiresAt, now)
      ),
      with: { items: true },
      limit: BATCH_LIMIT,
    });

    for (const order of expiredOrders) {
      try {
        // Double-check with Midtrans before cancelling
        // to avoid race condition where payment came through milliseconds ago
        if (order.midtransOrderId) {
          try {
            const midtransStatus = await checkTransactionStatus(order.midtransOrderId);

            // If Midtrans says it's settled/paid, skip cancellation
            if (
              midtransStatus.transactionStatus === 'settlement' ||
              midtransStatus.transactionStatus === 'capture'
            ) {
              logger.info('[CancelExpired] Order paid via Midtrans — skipping cancel', { orderNumber: order.orderNumber });
              continue;
            }
          } catch (midtransError) {
            // 404 / "doesn't exist" = never paid → safe to cancel (stops forever-wake loops).
            // Network/5xx → skip this run; do not risk cancelling a just-paid order.
            if (isMidtransTransactionMissing(midtransError)) {
              logger.info('[CancelExpired] Midtrans txn missing — proceeding to cancel', {
                orderNumber: order.orderNumber,
              });
            } else {
              logger.warn('[CancelExpired] Could not verify Midtrans status — skipping this run', {
                orderNumber: order.orderNumber,
                error: midtransError instanceof Error ? midtransError.message : String(midtransError),
              });
              continue;
            }
          }
        }

        // Cancel the order — only if still pending_payment (conditional update prevents race with Midtrans webhook)
        await db.transaction(async (tx) => {
          const cancelResult = await tx
            .update(orders)
            .set({
              status: 'cancelled',
              cancelledAt: now,
            })
            .where(and(
              eq(orders.id, order.id),
              eq(orders.status, 'pending_payment')
            ))
            .returning({ id: orders.id });

          // If 0 rows affected, order is no longer pending — skip (Midtrans likely settled it)
          if (cancelResult.length === 0) {
            logger.info('[CancelExpired] Order no longer pending — skipping cancel', { orderNumber: order.orderNumber });
            return;
          }

          await tx.insert(orderStatusHistory).values({
            orderId: order.id,
            fromStatus: order.status,
            toStatus: 'cancelled',
            changedByUserId: null,
            changedByType: 'system',
            note: `Otomatis dibatalkan karena tidak dibayar dalam 15 menit`,
          });

          // P0#2 (P3 Decision 1): this order was never paid, so stock was NEVER
          // deducted (settlement-only deduction model). Restoring it here would
          // inflate inventory. No stock op.

          // P1: reverse points with a matching ledger row so the nightly
          // reconcile cannot claw them back.
          await reverseRedeemedPointsTx(tx, order);

          // Delete the provisional couponUsages row inserted at initiate. Do NOT
          // decrement used_count — it is only incremented at settlement, and this
          // order never settled (P0#2).
          if (order.couponId) {
            await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
          }
        });

        // Cancel the (unpaid) Midtrans transaction so the VA can no longer be paid.
        if (order.midtransOrderId) {
          const cancelledTx = await cancelTransaction(order.midtransOrderId);
          if (!cancelledTx.success) {
            logger.warn('[CancelExpired] Midtrans cancel failed', {
              orderNumber: order.orderNumber,
              error: cancelledTx.error,
            });
          }
        }

        // M15: tell the customer the order was cancelled (with a re-order path).
        // Email must never undo a successful cancel — wrap so template/runtime
        // failures don't report the order as failed after DB commit.
        try {
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
                reason: 'Pembayaran tidak diterima dalam batas waktu',
                cancelledAt: formatWIB(now),
                refundAmount: 0,
                refundInfo: '',
              }),
            }),
            'cancel-expired customer email'
          );
        } catch (emailErr) {
          logger.warn('[CancelExpired] customer email enqueue failed', {
            orderNumber: order.orderNumber,
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
        }

        cancelled++;
        logger.info('[CancelExpired] Order cancelled', { orderNumber: order.orderNumber });
      } catch (orderError) {
        const message = orderError instanceof Error ? orderError.message : String(orderError);
        errors.push(`Failed to cancel order ${order.orderNumber}: ${message}`);
        logger.error('[CancelExpired] Error cancelling order', { orderNumber: order.orderNumber, error: message });
      }
    }

    if (expiredOrders.length === BATCH_LIMIT) {
      logger.warn('[CancelExpired] Hit batch limit — may have more expired orders next run', { batchLimit: BATCH_LIMIT });
    }
    logger.info('[CancelExpired] Completed', { cancelled, errorsCount: errors.length });
    if (errors.length > 0) {
      errors.forEach((e) => logger.error('[CancelExpired] Error', { message: e }));
    }

    return success({ cancelled, errors });
  } catch (error) {
    logger.error('[CancelExpired] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}