import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory, orderItems, productVariants, inventoryLogs, coupons, couponUsages, pointsHistory, users } from '@/lib/db/schema';
import { eq, and, lt, sql, gte } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { checkTransactionStatus } from '@/lib/midtrans/status';
import { serverError, success } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Reconcile pending_payment orders whose payment_expires_at has passed.
 * Queries Midtrans for their current transaction status and updates accordingly.
 * Runs every 15 minutes via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

    // Find pending orders whose expiry window has closed but are still pending
    const stuckOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'pending_payment'),
        lt(orders.paymentExpiresAt, windowStart)
      ),
    });

    let updated = 0;
    let errors: string[] = [];

    for (const order of stuckOrders) {
      if (!order.midtransOrderId) continue;

      try {
        const midtransStatus = await checkTransactionStatus(order.midtransOrderId);

        if (
          midtransStatus.transactionStatus === 'settlement' ||
          midtransStatus.transactionStatus === 'capture'
        ) {
          // Payment actually went through — the webhook may have been missed.
          // Perform full settlement processing: update order + deduct stock + award points + confirm coupon.
          await db.transaction(async (tx) => {
            // 1. Update order status to paid
            await tx
              .update(orders)
              .set({
                status: 'paid',
                paidAt: new Date(),
                midtransPaymentType: midtransStatus.paymentType ?? null,
              })
              .where(eq(orders.id, order.id));

            // 2. Deduct stock for each item (atomic with GREATEST guard)
            const orderItemsData = await tx
              .select()
              .from(orderItems)
              .where(eq(orderItems.orderId, order.id));

            for (const item of orderItemsData) {
              const [updated] = await tx
                .update(productVariants)
                .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
                .where(and(
                  eq(productVariants.id, item.variantId),
                  gte(productVariants.stock, item.quantity)
                ))
                .returning({ newStock: productVariants.stock });

              if (!updated) {
                // Log but don't fail — order is paid, stock can be reconciled manually
                logger.warn('[ReconcilePayments] Insufficient stock for variant during reconcile', {
                  orderNumber: order.orderNumber,
                  variantId: item.variantId,
                });
              } else {
                // Log inventory movement
                await tx.insert(inventoryLogs).values({
                  variantId: item.variantId,
                  changeType: 'sale',
                  quantityBefore: updated.newStock + item.quantity,
                  quantityAfter: updated.newStock,
                  quantityDelta: -item.quantity,
                  orderId: order.id,
                });
              }
            }

            // 3. Award loyalty points if user has points earned
            if (order.userId && order.pointsEarned && order.pointsEarned > 0) {
              const earnedPoints = order.pointsEarned;
              const updatedUsers = await tx
                .update(users)
                .set({ pointsBalance: sql`points_balance + ${earnedPoints}` })
                .where(eq(users.id, order.userId))
                .returning({ pointsBalance: users.pointsBalance });

              const newBalance = updatedUsers[0]?.pointsBalance ?? earnedPoints;
              await tx.insert(pointsHistory).values({
                userId: order.userId,
                type: 'earn',
                pointsAmount: earnedPoints,
                pointsBalanceAfter: newBalance,
                descriptionId: `Pembelian ${order.orderNumber} (reconcile)`,
                descriptionEn: `Purchase ${order.orderNumber} (reconcile)`,
                orderId: order.id,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              });
            }

            // 4. Confirm coupon usage (upsert)
            if (order.couponId) {
              await tx
                .update(coupons)
                .set({ usedCount: sql`used_count + 1` })
                .where(eq(coupons.id, order.couponId));

              await tx
                .insert(couponUsages)
                .values({
                  couponId: order.couponId,
                  orderId: order.id,
                  userId: order.userId ?? null,
                  discountApplied: order.discountAmount ?? 0,
                })
                .onConflictDoNothing();
            }

            // 5. Record status history
            await tx.insert(orderStatusHistory).values({
              orderId: order.id,
              fromStatus: 'pending_payment',
              toStatus: 'paid',
              changedByUserId: null,
              changedByType: 'system',
              note: `Reconcile: Midtrans status ${midtransStatus.transactionStatus}`,
            });
          });

          updated++;
          logger.info('[ReconcilePayments] Marked paid via Midtrans', {
            orderNumber: order.orderNumber,
            midtransStatus: midtransStatus.transactionStatus,
          });
        } else if (['expire', 'cancel', 'deny'].includes(midtransStatus.transactionStatus)) {
          // Payment definitely failed — cancel and restore everything
          await db.transaction(async (tx) => {
            await tx
              .update(orders)
              .set({
                status: 'cancelled',
                cancelledAt: new Date(),
              })
              .where(eq(orders.id, order.id));

            await tx.insert(orderStatusHistory).values({
              orderId: order.id,
              fromStatus: 'pending_payment',
              toStatus: 'cancelled',
              changedByUserId: null,
              changedByType: 'system',
              note: `Reconcile: Midtrans status ${midtransStatus.transactionStatus}`,
            });

            // Restore stock if items were actually sold (check inventory logs)
            const [salesLog] = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(inventoryLogs)
              .where(and(
                eq(inventoryLogs.orderId, order.id),
                eq(inventoryLogs.changeType, 'sale')
              ));

            if ((salesLog?.count ?? 0) > 0) {
              // Fetch items for this order
              const orderItemsData = await tx
                .select()
                .from(orderItems)
                .where(eq(orderItems.orderId, order.id));

              for (const item of orderItemsData) {
                const [updated] = await tx
                  .update(productVariants)
                  .set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
                  .where(eq(productVariants.id, item.variantId))
                  .returning({ newStock: productVariants.stock });

                if (updated) {
                  await tx.insert(inventoryLogs).values({
                    variantId: item.variantId,
                    changeType: 'reversal',
                    quantityBefore: updated.newStock - item.quantity,
                    quantityAfter: updated.newStock,
                    quantityDelta: item.quantity,
                    orderId: order.id,
                    note: `Pembatalan reconcile ${order.orderNumber} — stok dikembalikan`,
                  });
                }
              }
            }

            // Reverse points if used (FIFO reversal)
            if (order.userId && order.pointsUsed > 0) {
              const redeemRecords = await tx
                .select()
                .from(pointsHistory)
                .where(and(
                  eq(pointsHistory.userId, order.userId),
                  eq(pointsHistory.type, 'redeem'),
                  eq(pointsHistory.orderId, order.id)
                ));

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

            // Reverse coupon usage: decrement used_count and delete couponUsage row
            if (order.couponId) {
              await tx
                .update(coupons)
                .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
                .where(eq(coupons.id, order.couponId));

              await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
            }
          });

          updated++;
          logger.info('[ReconcilePayments] Cancelled via Midtrans', {
            orderNumber: order.orderNumber,
            midtransStatus: midtransStatus.transactionStatus,
          });
        }
        // 'pending' status — no action, still waiting
      } catch (orderError) {
        const message = orderError instanceof Error ? orderError.message : String(orderError);
        errors.push(`Failed to reconcile ${order.orderNumber}: ${message}`);
        logger.error('[ReconcilePayments] Error', { orderNumber: order.orderNumber, error: message });
      }
    }

    logger.info('[ReconcilePayments] Completed', { updated, errorsCount: errors.length });
    if (errors.length > 0) {
      errors.forEach((e) => logger.error('[ReconcilePayments] Error', { message: e }));
    }

    return success({ updated, errors });
  } catch (error) {
    logger.error('[ReconcilePayments] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}