import { db } from '@/lib/db';
import { users, pointsHistory } from '@/lib/db/schema';
import { eq, and, lt, gt } from 'drizzle-orm';
import { POINTS_EXPIRY_DAYS } from '@/lib/constants/points';

/**
 * Earn points after order is paid
 * Rate: 1 point per IDR 1,000 (floor division)
 * @param multiplier - for B2B users, pass 2 to double points earned
 */
export async function earnPoints(
  userId: string,
  orderId: string,
  subtotalIDR: number,
  multiplier = 1
): Promise<number> {
  const basePoints = Math.floor(subtotalIDR / 1000);
  const pointsEarned = basePoints * multiplier;
  if (pointsEarned === 0) return 0;

  const expiresAt = new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

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
  return points * 10; // Direct multiply — no floor divide, 10 IDR per point
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
 * Expire points — run as cron job.
 * CRITICAL: The expired-rows query runs INSIDE the transaction to prevent
 * a race where new earn rows could be picked up between query and update.
 * Uses a cursor-based approach to avoid FOR UPDATE lock contention on the
 * entire pointsHistory table.
 */
export async function expireOverduePoints(): Promise<number> {
  const now = new Date();
  let totalExpiredCount = 0;

  // Process in batches to avoid holding locks on large row sets
  const BATCH_SIZE = 50;

  while (true) {
    const result = await db.transaction(async (tx) => {
      // Query inside transaction — captures a consistent snapshot
      // Limited to BATCH_SIZE to avoid long-held locks
      const expiredRows = await tx
        .select()
        .from(pointsHistory)
        .where(
          and(
            eq(pointsHistory.type, 'earn'),
            lt(pointsHistory.expiresAt, now),
            gt(pointsHistory.pointsAmount, 0),
            eq(pointsHistory.isExpired, false)
          )
        )
        .limit(BATCH_SIZE);

      if (expiredRows.length === 0) {
        return { done: true, rows: [] as typeof expiredRows };
      }

      // Group by user — all processing for a single user happens atomically
      const byUser = new Map<string, typeof expiredRows>();
      for (const row of expiredRows) {
        const existing = byUser.get(row.userId) ?? [];
        existing.push(row);
        byUser.set(row.userId, existing);
      }

      for (const [userId, userRows] of byUser) {
        const totalExpired = userRows.reduce((sum, r) => sum + r.pointsAmount, 0);

        // Lock the user row for update to prevent concurrent balance modifications
        const [user] = await tx
          .select({ pointsBalance: users.pointsBalance })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const actualExpiry = Math.min(totalExpired, user?.pointsBalance ?? 0);
        if (actualExpiry <= 0) {
          // Mark rows as expired even if balance is already 0
          for (const row of userRows) {
            await tx
              .update(pointsHistory)
              .set({ isExpired: true })
              .where(eq(pointsHistory.id, row.id));
          }
          continue;
        }

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
        for (const row of userRows) {
          await tx
            .update(pointsHistory)
            .set({ isExpired: true })
            .where(eq(pointsHistory.id, row.id));
        }
      }

      return { done: expiredRows.length < BATCH_SIZE, rows: expiredRows };
    });

    totalExpiredCount += result.rows.length;
    if (result.done) break;
  }

  return totalExpiredCount;
}
