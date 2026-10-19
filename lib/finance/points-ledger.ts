import { and, eq, gt, sql } from 'drizzle-orm';
import { pointsHistory, users } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { logger } from '@/lib/utils/logger';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface LedgerOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly userId: string | null;
  readonly pointsUsed: number;
  readonly pointsEarned?: number;
}

/**
 * Reverse points redeemed at checkout.
 *
 * The ledger is the source of truth (`reconcile-points` overwrites the cached
 * balance with SUM(points_history)), so restoring a balance without a ledger
 * row silently disappears the next night. This helper:
 *   1. un-consumes the referenced earn rows (restoring `points_remaining`),
 *   2. inserts a positive `adjust` ledger row,
 *   3. restores the cached balance.
 *
 * Idempotent: a second call for the same order is a no-op when a positive
 * adjust row already exists.
 */
export async function reverseRedeemedPointsTx(
  tx: Tx,
  order: LedgerOrder
): Promise<boolean> {
  if (!order.userId || order.pointsUsed <= 0) return false;

  const alreadyReversed = await tx.query.pointsHistory.findFirst({
    where: and(
      eq(pointsHistory.orderId, order.id),
      eq(pointsHistory.type, 'adjust'),
      gt(pointsHistory.pointsAmount, 0)
    ),
    columns: { id: true },
  });
  if (alreadyReversed) return false;

  const redeemRecords = await tx.query.pointsHistory.findMany({
    where: and(
      eq(pointsHistory.orderId, order.id),
      eq(pointsHistory.type, 'redeem')
    ),
    columns: { id: true, pointsAmount: true, referencedEarnId: true },
  });

  if (redeemRecords.length === 0) return false;

  for (const redeem of redeemRecords) {
    if (!redeem.referencedEarnId) continue;
    const restored = Math.abs(redeem.pointsAmount);
    await tx
      .update(pointsHistory)
      .set({
        pointsRemaining: sql`${pointsHistory.pointsRemaining} + ${restored}`,
        consumedAt: null,
      })
      .where(eq(pointsHistory.id, redeem.referencedEarnId));
  }

  const [updatedUser] = await tx
    .update(users)
    .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
    .where(eq(users.id, order.userId))
    .returning({ pointsBalance: users.pointsBalance });

  await tx.insert(pointsHistory).values({
    userId: order.userId,
    type: 'adjust',
    pointsAmount: order.pointsUsed,
    pointsBalanceAfter: updatedUser?.pointsBalance ?? order.pointsUsed,
    orderId: order.id,
    descriptionId: `Pembatalan pesanan ${order.orderNumber} — poin dikembalikan`,
    descriptionEn: `Order ${order.orderNumber} cancelled — points returned`,
  });

  return true;
}

/**
 * Claw back points earned on an order that is being cancelled/refunded.
 *
 * Unlike the old implementation this does not require the earn row to be
 * untouched: if the customer already spent the points the balance is reduced
 * to zero and the shortfall is logged for manual review.
 *
 * Idempotent: skips when a negative adjust row already exists for the order.
 */
export async function clawbackEarnedPointsTx(
  tx: Tx,
  order: LedgerOrder,
  opts: { ratio?: number; reasonId: string; reasonEn: string }
): Promise<number> {
  if (!order.userId) return 0;

  const alreadyClawedBack = await tx.query.pointsHistory.findFirst({
    where: and(
      eq(pointsHistory.orderId, order.id),
      eq(pointsHistory.type, 'adjust'),
      sql`${pointsHistory.pointsAmount} < 0`
    ),
    columns: { id: true },
  });
  if (alreadyClawedBack) return 0;

  const earnRows = await tx.query.pointsHistory.findMany({
    where: and(
      eq(pointsHistory.orderId, order.id),
      eq(pointsHistory.type, 'earn')
    ),
    columns: { id: true, pointsAmount: true, pointsRemaining: true },
  });

  const totalEarned = earnRows.reduce((sum, row) => sum + row.pointsAmount, 0);
  if (totalEarned <= 0) return 0;

  const ratio = Math.max(0, Math.min(1, opts.ratio ?? 1));
  const clawPoints = Math.floor(totalEarned * ratio);
  if (clawPoints <= 0) return 0;

  // Lock the balance and claw back only what is actually there — the ledger
  // must always sum to the cached balance (reconcile-points enforces it).
  const [current] = await tx
    .select({ pointsBalance: users.pointsBalance })
    .from(users)
    .where(eq(users.id, order.userId))
    .for('update');

  const balanceBefore = current?.pointsBalance ?? 0;
  const actualClaw = Math.min(clawPoints, balanceBefore);
  const balanceAfter = balanceBefore - actualClaw;

  if (actualClaw < clawPoints) {
    logger.warn('[points] clawback shortfall (points already spent)', {
      orderNumber: order.orderNumber,
      userId: order.userId,
      requested: clawPoints,
      clawed: actualClaw,
      totalEarned,
    });
  }

  if (actualClaw <= 0) {
    // Nothing left to claw back; still mark the earn rows unusable below.
    for (const row of earnRows) {
      if (row.pointsRemaining > 0) {
        await tx
          .update(pointsHistory)
          .set({ pointsRemaining: 0, consumedAt: new Date() })
          .where(eq(pointsHistory.id, row.id));
      }
    }
    return 0;
  }

  await tx
    .update(users)
    .set({ pointsBalance: balanceAfter })
    .where(eq(users.id, order.userId));

  await tx.insert(pointsHistory).values({
    userId: order.userId,
    type: 'adjust',
    pointsAmount: -actualClaw,
    pointsBalanceAfter: balanceAfter,
    orderId: order.id,
    descriptionId: opts.reasonId,
    descriptionEn: opts.reasonEn,
  });

  // Points from this order can never be spent again, even if a portion of the
  // balance was already gone (the remaining ledger rows stay as history).
  for (const row of earnRows) {
    if (row.pointsRemaining > 0) {
      await tx
        .update(pointsHistory)
        .set({ pointsRemaining: 0, consumedAt: new Date() })
        .where(eq(pointsHistory.id, row.id));
    }
  }

  return actualClaw;
}
