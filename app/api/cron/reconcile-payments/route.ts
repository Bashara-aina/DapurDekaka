import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, pointsHistory, users, couponUsages } from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { logger } from '@/lib/utils/logger';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { formatWIB } from '@/lib/utils/format-date';
import { settleOrderTx, InsufficientStockError } from '@/lib/finance/settle-order';
import { sendWhatsApp } from '@/lib/services/fonnte';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Payment reconciliation cron job.
 * Finds pending orders older than 30 minutes and checks Midtrans status.
 * Handles the case where Midtrans says paid but our DB still shows pending_payment.
 * Runs every 10 minutes via Vercel Cron.
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

        const midtransStatus = await checkMidtransStatus(order.midtransOrderId);

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
          notifyOps(`Oversell saat reconcile: ${order.orderNumber}. Perlu tindakan manual.`);
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
  }).catch((err) => logger.error('[Reconcile] confirmation email', { error: err instanceof Error ? err.message : String(err) }));

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

    if (order.userId && order.pointsUsed > 0) {
      const redeemRecords = await tx
        .select()
        .from(pointsHistory)
        .where(
          and(
            eq(pointsHistory.userId, order.userId),
            eq(pointsHistory.type, 'redeem'),
            eq(pointsHistory.orderId, order.id)
          )
        );

      for (const redeem of redeemRecords) {
        if (redeem.referencedEarnId) {
          await tx.update(pointsHistory).set({ consumedAt: null }).where(eq(pointsHistory.id, redeem.referencedEarnId));
        }
      }

      await tx
        .update(users)
        .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
        .where(eq(users.id, order.userId));
    }

    // Delete provisional couponUsages row; do NOT decrement used_count (never
    // incremented for an unpaid order).
    if (order.couponId) {
      await tx.delete(couponUsages).where(eq(couponUsages.orderId, order.id));
    }
  });
}

function notifyOps(message: string): void {
  const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!storePhone) return;
  sendWhatsApp({ phone: storePhone, message }).catch(() => undefined);
}

async function checkMidtransStatus(midtransOrderId: string): Promise<string> {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? '';
    const auth = Buffer.from(serverKey + ':').toString('base64');

    const res = await fetch(`https://api.midtrans.com/v2/${midtransOrderId}/status`, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) return 'unknown';
    const data = (await res.json()) as { transaction_status?: string };
    return data.transaction_status ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
