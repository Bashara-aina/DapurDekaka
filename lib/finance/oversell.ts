import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderStatusHistory, refunds } from '@/lib/db/schema';
import { reverseRedeemedPointsTx } from '@/lib/finance/points-ledger';
import { logger } from '@/lib/utils/logger';

export interface OversellOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly userId: string | null;
  readonly pointsUsed: number;
  readonly totalAmount: number;
  readonly midtransTransactionId: string | null;
}

/**
 * H3(b): settle an oversold order as paid + attention + refund obligation.
 *
 * The settle transaction rolled back (no stock deducted, no points awarded).
 * Money is with Midtrans, so the order must move out of `pending_payment`
 * (otherwise reconcile retries forever) and a full refund obligation must
 * surface in the Refunds queue.
 */
export async function handleOversellAtSettlement(
  order: OversellOrder,
  detail: string,
  transactionId: string | null
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({
        status: 'paid',
        paidAt: new Date(),
        midtransTransactionId: transactionId ?? order.midtransTransactionId,
        needsAttention: true,
        needsAttentionReason: 'oversell_at_settlement',
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'pending_payment')))
      .returning({ id: orders.id });

    if (!updated) return;

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'pending_payment',
      toStatus: 'paid',
      changedByType: 'system',
      note: `Pembayaran diterima tetapi stok habis — refund wajib. ${detail}`,
    });

    const existing = await tx
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.orderId, order.id))
      .limit(1);
    if (existing.length === 0) {
      await tx.insert(refunds).values({
        orderId: order.id,
        amount: order.totalAmount,
        reason: 'oversell',
        method: 'midtrans',
        status: 'pending',
        notes: `Oversell at settlement for ${order.orderNumber}: ${detail}`,
      });
    }

    await reverseRedeemedPointsTx(tx, order);
  });

  logger.warn('[oversell] order flagged paid + refund queued', {
    orderNumber: order.orderNumber,
  });
}
