import { db } from '@/lib/db';
import { users, pointsHistory } from '@/lib/db/schema';
import { eq, and, lt, gt } from 'drizzle-orm';
import { addYears } from 'date-fns';

/**
 * Earn points after order is paid
 * Rate: 1 point per IDR 1,000 (floor division)
 */
export async function earnPoints(
  userId: string,
  orderId: string,
  subtotalIDR: number
): Promise<number> {
  const pointsEarned = Math.floor(subtotalIDR / 1000);
  if (pointsEarned === 0) return 0;

  const expiresAt = addYears(new Date(), 1);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ pointsBalance: users.pointsBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const newBalance = (user?.pointsBalance ?? 0) + pointsEarned;

    await tx.insert(pointsHistory).values({
      userId,
      orderId,
      type: 'earn',
      pointsAmount: pointsEarned,
      pointsBalanceAfter: newBalance,
      expiresAt,
      descriptionId: `Poin dari pesanan #${orderId.slice(0, 8)}`,
      descriptionEn: `Points from order #${orderId.slice(0, 8)}`,
    });

    await tx
      .update(users)
      .set({ pointsBalance: newBalance })
      .where(eq(users.id, userId));
  });

  return pointsEarned;
}

/**
 * Points value: 100 pts = IDR 1,000 (10 IDR per point)
 */
export function pointsToIDR(points: number): number {
  return Math.floor(points / 100) * 1000;
}

export function idrToPoints(idr: number): number {
  return Math.floor(idr / 10);
}

/**
 * Validate points redemption — max 50% of subtotal
 */
export function validatePointsRedemption(
  pointsBalance: number,
  pointsToRedeem: number,
  subtotalIDR: number
): { valid: boolean; error?: string } {
  if (pointsToRedeem <= 0) return { valid: false, error: 'Poin tidak valid' };
  if (pointsToRedeem > pointsBalance) {
    return { valid: false, error: 'Saldo poin tidak cukup' };
  }

  const pointsValueIDR = pointsToRedeem * 10; // 10 IDR per point
  const maxAllowedIDR = Math.floor(subtotalIDR * 0.5);

  if (pointsValueIDR > maxAllowedIDR) {
    return {
      valid: false,
      error: `Maksimal penggunaan poin adalah 50% dari subtotal (${Math.floor(maxAllowedIDR / 10)} poin)`,
    };
  }

  return { valid: true };
}

/**
 * Deduct points during checkout
 */
export async function redeemPoints(
  userId: string,
  orderId: string,
  points: number,
  description: string,
  tx: any
): Promise<void> {
  const [user] = await tx
    .select({ pointsBalance: users.pointsBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const newBalance = (user?.pointsBalance ?? 0) - points;

  await tx.insert(pointsHistory).values({
    userId,
    orderId,
    type: 'redeem',
    pointsAmount: -points,
    pointsBalanceAfter: newBalance,
    descriptionId: description,
    descriptionEn: description,
  });

  await tx
    .update(users)
    .set({ pointsBalance: newBalance })
    .where(eq(users.id, userId));
}

/**
 * Expire points — run as cron job
 */
export async function expireOverduePoints(): Promise<number> {
  const now = new Date();

  const expiredRows = await db
    .select()
    .from(pointsHistory)
    .where(
      and(
        eq(pointsHistory.type, 'earn'),
        lt(pointsHistory.expiresAt, now),
        gt(pointsHistory.pointsAmount, 0),
        eq(pointsHistory.isExpired, false)
      )
    );

  if (expiredRows.length === 0) return 0;

  const byUser = new Map<string, number>();
  for (const row of expiredRows) {
    const current = byUser.get(row.userId) ?? 0;
    byUser.set(row.userId, current + row.pointsAmount);
  }

  let totalExpiredCount = 0;

  for (const [userId, totalExpired] of byUser) {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ pointsBalance: users.pointsBalance })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const actualExpiry = Math.min(totalExpired, user?.pointsBalance ?? 0);
      if (actualExpiry <= 0) return;

      const newBalance = (user?.pointsBalance ?? 0) - actualExpiry;

      await tx.insert(pointsHistory).values({
        userId,
        type: 'expire',
        pointsAmount: -actualExpiry,
        pointsBalanceAfter: newBalance,
        descriptionId: 'Poin kedaluwarsa',
        descriptionEn: 'Points expired',
      });

      await tx
        .update(users)
        .set({ pointsBalance: newBalance })
        .where(eq(users.id, userId));

      // Mark earned records as expired
      for (const row of expiredRows.filter(r => r.userId === userId)) {
        await tx
          .update(pointsHistory)
          .set({ isExpired: true })
          .where(eq(pointsHistory.id, row.id));
      }
    });
    totalExpiredCount++;
  }

  return totalExpiredCount;
}
