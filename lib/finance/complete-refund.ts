import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { clawbackEarnedPointsTx } from '@/lib/finance/points-ledger';

type OrderStatus = typeof orders.$inferSelect.status;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CompleteRefundInput {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly userId: string | null;
  readonly refundAmount: number;
  readonly totalAmount: number;
  readonly isFullRefund: boolean;
  readonly currentStatus: OrderStatus;
}

/**
 * Side-effects when a refund obligation is marked completed (P5 backlog #1).
 * Full refund → order `refunded` + points clawback. Partial → proportional clawback only.
 */
export async function applyRefundCompletionTx(
  tx: Tx,
  input: CompleteRefundInput
): Promise<void> {
  if (input.isFullRefund) {
    await tx
      .update(orders)
      .set({ status: 'refunded', updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));

    await tx.insert(orderStatusHistory).values({
      orderId: input.orderId,
      fromStatus: input.currentStatus,
      toStatus: 'refunded',
      changedByType: 'system',
      note: 'Refund penuh selesai',
    });
  }

  if (!input.userId) return;

  // Shared helper is idempotent: if the admin-cancel path already clawed back
  // (P5 double-clawback), this is a no-op.
  const clawRatio = input.isFullRefund
    ? 1
    : Math.min(1, input.refundAmount / Math.max(input.totalAmount, 1));

  await clawbackEarnedPointsTx(
    tx,
    {
      id: input.orderId,
      orderNumber: input.orderNumber,
      userId: input.userId,
      pointsUsed: 0,
      pointsEarned: 0,
    },
    {
      ratio: clawRatio,
      reasonId: `Clawback poin refund ${input.orderNumber}`,
      reasonEn: `Refund points clawback ${input.orderNumber}`,
    }
  );

  // Stock is NOT restored by default — P5 Decision 1: frozen returns are almost
  // never resellable. The optional stock-restore checkbox can be added to the
  // admin refund UI when needed.
}
