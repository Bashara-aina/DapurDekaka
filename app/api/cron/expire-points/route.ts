import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { serverError, success } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Expire points older than 365 days.
 * Runs daily at midnight WIB (18:00 UTC) via Vercel Cron.
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

    // Find all non-expired, non-redeemed earn points past expiry using atomic UPDATE…RETURNING
    // This avoids TOCTOU race between SELECT and UPDATE outside transaction
    const expiringRecords = await db.transaction(async (tx) => {
      const rows = await tx
        .update(pointsHistory)
        .set({ isExpired: true })
        .where(
          and(
            eq(pointsHistory.type, 'earn'),
            eq(pointsHistory.isExpired, false),
            lt(pointsHistory.expiresAt, now),
            sql`${pointsHistory.consumedAt} IS NULL`
          )
        )
        .returning();

      return rows;
    });

    if (expiringRecords.length === 0) {
      return success({ expired: 0, errors: [] });
    }

    // Group by user to calculate total to expire
    const userExpiryMap = new Map<string, { userId: string; totalPoints: number; records: typeof expiringRecords }>();

    for (const record of expiringRecords) {
      if (!userExpiryMap.has(record.userId)) {
        userExpiryMap.set(record.userId, {
          userId: record.userId,
          totalPoints: 0,
          records: [],
        });
      }
      const entry = userExpiryMap.get(record.userId)!;
      entry.totalPoints += record.pointsAmount;
      entry.records.push(record);
    }

    let expired = 0;
    const errors: string[] = [];

    for (const [, entry] of userExpiryMap) {
      try {
        await db.transaction(async (tx) => {
          // Deduct from user's points balance using relative SQL decrement.
          // This is safe against concurrent modifications — each call subtracts atomically
          // rather than setting an absolute value computed from a stale read.
          const updatedUsers = await tx
            .update(users)
            .set({
              pointsBalance: sql`GREATEST(points_balance - ${entry.totalPoints}, 0)`,
            })
            .where(eq(users.id, entry.userId))
            .returning({ pointsBalance: users.pointsBalance });

          const newBalanceAfter = updatedUsers[0]?.pointsBalance ?? 0;

          // Record the expiration in points history.
          // pointsAmount is NEGATIVE to represent a debit: expiring entry reduces balance.
          // pointsBalanceAfter is the balance AFTER this deduction (already updated above).
          await tx.insert(pointsHistory).values({
            userId: entry.userId,
            type: 'expire',
            pointsAmount: -entry.totalPoints,
            pointsBalanceAfter: newBalanceAfter,
            descriptionId: `Poin hangus karena melewati 1 tahun`,
            descriptionEn: `Points expired after 1 year`,
            expiresAt: null,
            isExpired: true,
          });
        });

        expired++;
        logger.info('[ExpirePoints] User expired', {
          userId: entry.userId,
          pointsExpired: entry.totalPoints,
          recordsCount: entry.records.length,
        });
      } catch (userError) {
        const message = userError instanceof Error ? userError.message : String(userError);
        errors.push(`Failed to expire points for user ${entry.userId}: ${message}`);
        logger.error('[ExpirePoints] Error for user', { userId: entry.userId, error: message });
      }
    }

    logger.info('[ExpirePoints] Completed', { expired, errorsCount: errors.length });
    if (errors.length > 0) {
      errors.forEach((e) => logger.error('[ExpirePoints] Error', { message: e }));
    }

    return success({ expired, errors });
  } catch (error) {
    logger.error('[ExpirePoints] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}