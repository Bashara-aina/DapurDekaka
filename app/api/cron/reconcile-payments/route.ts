import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  productVariants,
  inventoryLogs,
  users,
  pointsHistory,
  coupons,
  couponUsages,
  orderStatusHistory,
} from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { logger } from '@/lib/utils/logger';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { formatWIB } from '@/lib/utils/format-date';

/**
 * Payment reconciliation cron job.
 * Finds pending orders older than 30 minutes and checks Midtrans status.
 * Handles the case where Midtrans says paid but our DB still shows pending_payment.
 * Runs every 10 minutes via Vercel Cron.
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

    const pendingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'pending_payment'),
        lt(orders.createdAt, thirtyMinsAgo)
      ),
      with: { user: true },
    });

    const results = { checked: 0, reconciled: 0, cancelled: 0, errors: 0 };

    for (const order of pendingOrders) {
      let orderStatus: 'settlement' | 'cancel' | 'skip' | 'error' = 'skip';
      try {
        results.checked++;

        if (!order.midtransOrderId) {
          continue;
        }

        const midtransStatus = await checkMidtransStatus(order.midtransOrderId);

        if (midtransStatus === 'settlement') {
          logger.warn('[Reconcile] Recovering missed settlement', { orderNumber: order.orderNumber });

          const fullOrder = await db.query.orders.findFirst({
            where: eq(orders.id, order.id),
            with: { items: true },
          });

          if (!fullOrder || fullOrder.status !== 'pending_payment') {
            continue;
          }

          await db.transaction(async (tx) => {
            // BUG-11: Use conditional WHERE to prevent race with webhook
            const [updated] = await tx.update(orders).set({
              status: 'paid',
              paidAt: new Date(),
            }).where(and(
              eq(orders.id, fullOrder.id),
              eq(orders.status, 'pending_payment')
            )).returning();

            if (!updated) {
              // Another process already handled this order — rollback
              throw new Error('ORDER_ALREADY_PROCESSED');
            }

            for (const item of fullOrder.items) {
              const result = await tx
                .update(productVariants)
                .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)`, updatedAt: new Date() })
                .where(and(
                  eq(productVariants.id, item.variantId),
                ))
                .returning({ newStock: productVariants.stock });

              const updatedItem = result[0];
              await tx.insert(inventoryLogs).values({
                variantId: item.variantId,
                changeType: 'sale',
                quantityBefore: (updatedItem?.newStock ?? 0) + item.quantity,
                quantityAfter: updatedItem?.newStock ?? 0,
                quantityDelta: -item.quantity,
                orderId: fullOrder.id,
                note: '[Reconcile] Stock deducted via cron recovery',
              });
            }

            if (fullOrder.userId && fullOrder.pointsEarned && fullOrder.pointsEarned > 0) {
              await tx.update(users)
                .set({ pointsBalance: sql`points_balance + ${fullOrder.pointsEarned}` })
                .where(eq(users.id, fullOrder.userId));

              await tx.insert(pointsHistory).values({
                userId: fullOrder.userId,
                type: 'earn',
                pointsAmount: fullOrder.pointsEarned,
                pointsBalanceAfter: sql`(SELECT points_balance FROM users WHERE id = ${fullOrder.userId})`,
                descriptionId: `Pembelian ${fullOrder.orderNumber} (reconcile)`,
                descriptionEn: `Purchase ${fullOrder.orderNumber} (reconcile)`,
                orderId: fullOrder.id,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              });
            }

            if (fullOrder.couponId) {
              await tx.update(coupons)
                .set({ usedCount: sql`used_count + 1` })
                .where(eq(coupons.id, fullOrder.couponId));

              await tx.insert(couponUsages).values({
                couponId: fullOrder.couponId,
                orderId: fullOrder.id,
                userId: fullOrder.userId ?? null,
                discountApplied: fullOrder.discountAmount,
              });
            }

            await tx.insert(orderStatusHistory).values({
              orderId: fullOrder.id,
              fromStatus: 'pending_payment',
              toStatus: 'paid',
              changedByType: 'system',
              note: 'Pembayaran dikonfirmasi via reconcile cron',
            });
          });

          sendEmail({
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
            }),
          }).catch(console.error);

          orderStatus = 'settlement';
        } else if (['cancel', 'deny', 'expire'].includes(midtransStatus)) {
          // Midtrans says cancelled, we say pending — trigger cancellation with full reversal
          await db.transaction(async (tx) => {
            await tx
              .update(orders)
              .set({
                status: 'cancelled',
                cancelledAt: new Date(),
              })
              .where(eq(orders.id, order.id));

            if (order.userId) {
              if (order.pointsUsed > 0) {
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
                    await tx.update(pointsHistory)
                      .set({ consumedAt: null })
                      .where(eq(pointsHistory.id, redeem.referencedEarnId));
                  }
                }

                await tx.update(users)
                  .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
                  .where(eq(users.id, order.userId));
              }
            }

            if (order.couponId) {
              await tx.update(coupons)
                .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
                .where(eq(coupons.id, order.couponId));

              await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
            }
          });

          orderStatus = 'cancel';
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'ORDER_ALREADY_PROCESSED') {
          logger.info('[Reconcile] Order already processed by webhook, skipping', { orderNumber: order.orderNumber });
          orderStatus = 'skip';
        } else {
          logger.error('[Reconcile] Error processing order', {
            orderNumber: order.orderNumber,
            error: message,
          });
          orderStatus = 'error';
        }
      }

      if (orderStatus === 'settlement') results.reconciled++;
      else if (orderStatus === 'cancel') results.cancelled++;
      else if (orderStatus === 'error') results.errors++;
    }

    logger.info('[Reconcile] Payment reconciliation complete', results);
    return success(results);
  } catch (error) {
    logger.error('[Reconcile] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

async function checkMidtransStatus(midtransOrderId: string): Promise<string> {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const auth = Buffer.from(serverKey + ':').toString('base64');

    const res = await fetch(
      `https://api.midtrans.com/v2/${midtransOrderId}/status`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) return 'unknown';
    const data = await res.json() as { transaction_status?: string };
    return data.transaction_status ?? 'unknown';
  } catch {
    return 'unknown';
  }
}