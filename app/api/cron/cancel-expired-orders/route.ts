import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, inventoryLogs, coupons, pointsHistory, users } from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { checkTransactionStatus } from '@/lib/midtrans/status';
import { serverError, success } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

/**
 * Cancel orders that have exceeded payment expiry time.
 * Runs every 5 minutes via Vercel Cron.
 * Checks Midtrans as fallback to avoid cancelling orders that paid concurrently.
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const now = new Date();
    let cancelled = 0;
    let errors: string[] = [];

    // Find all pending_payment orders past their expiry time
    const expiredOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'pending_payment'),
        lt(orders.paymentExpiresAt, now)
      ),
      with: {
        items: true,
      },
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
            // If we can't reach Midtrans, proceed with cancellation
            // to avoid stuck pending orders
            logger.warn('[CancelExpired] Could not verify Midtrans status — proceeding with cancel', {
              orderNumber: order.orderNumber,
            });
          }
        }

        // Cancel the order
        await db.transaction(async (tx) => {
          // Update order status
          await tx
            .update(orders)
            .set({
              status: 'cancelled',
              cancelledAt: now,
            })
            .where(eq(orders.id, order.id));

          // Restore stock from order items
          for (const item of order.items) {
            const result = await tx
              .update(productVariants)
              .set({
                stock: sql`stock + ${item.quantity}`,
                updatedAt: now,
              })
              .where(eq(productVariants.id, item.variantId))
              .returning({ newStock: productVariants.stock });

            if (result[0]) {
              await tx.insert(inventoryLogs).values({
                variantId: item.variantId,
                changeType: 'reversal',
                quantityBefore: result[0].newStock - item.quantity,
                quantityAfter: result[0].newStock,
                quantityDelta: item.quantity,
                orderId: order.id,
                note: `Pembatalan otomatis: pesanan tidak dibayar dalam waktu yang ditentukan`,
              });
            }
          }

          // Reverse points if used
          if (order.userId && order.pointsUsed > 0) {
            await tx
              .update(users)
              .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
              .where(eq(users.id, order.userId));

            await tx.insert(pointsHistory).values({
              userId: order.userId,
              type: 'expire',
              pointsAmount: -order.pointsUsed,
              pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`,
              descriptionId: `Pembatalan pesanan ${order.orderNumber} — poin dikembalikan`,
              descriptionEn: `Order ${order.orderNumber} cancelled — points returned`,
              expiresAt: null,
              isExpired: false,
            });
          }

          // Reverse coupon usage (decrement used_count)
          if (order.couponId) {
            await tx
              .update(coupons)
              .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
              .where(eq(coupons.id, order.couponId));
          }
        });

        cancelled++;
        logger.info('[CancelExpired] Order cancelled', { orderNumber: order.orderNumber });
      } catch (orderError) {
        const message = orderError instanceof Error ? orderError.message : String(orderError);
        errors.push(`Failed to cancel order ${order.orderNumber}: ${message}`);
        logger.error('[CancelExpired] Error cancelling order', { orderNumber: order.orderNumber, error: message });
      }
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