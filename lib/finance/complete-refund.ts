import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, pointsHistory, users, orderStatusHistory } from '@/lib/db/schema';

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

  const earned = await tx.query.pointsHistory.findMany({
    where: and(eq(pointsHistory.orderId, input.orderId), eq(pointsHistory.type, 'earn')),
    columns: { id: true, pointsAmount: true },
  });

  const totalEarned = earned.reduce((s, r) => s + r.pointsAmount, 0);
  if (totalEarned <= 0) return;

  const clawRatio = input.isFullRefund
    ? 1
    : Math.min(1, input.refundAmount / Math.max(input.totalAmount, 1));
  const clawPoints = Math.floor(totalEarned * clawRatio);
  if (clawPoints <= 0) return;

  const [updatedUser] = await tx
    .update(users)
    .set({ pointsBalance: sql`GREATEST(points_balance - ${clawPoints}, 0)` })
    .where(eq(users.id, input.userId))
    .returning({ pointsBalance: users.pointsBalance });

  await tx.insert(pointsHistory).values({
    userId: input.userId,
    type: 'adjust',
    pointsAmount: -clawPoints,
    pointsBalanceAfter: updatedUser?.pointsBalance ?? 0,
    orderId: input.orderId,
    descriptionId: `Clawback poin refund ${input.orderNumber}`,
    descriptionEn: `Refund points clawback ${input.orderNumber}`,
  });
}
