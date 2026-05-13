import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { serverError, success } from '@/lib/utils/api-response';

/**
 * Expire points older than 365 days.
 * Runs daily at 1AM WIB (18:00 UTC) via Vercel Cron.
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const now = new Date();
    const expiryThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Find all non-expired, non-redeemed earn points past expiry
    const expiringRecords = await db.query.pointsHistory.findMany({
      where: and(
        eq(pointsHistory.type, 'earn'),
        eq(pointsHistory.isExpired, false),
        lt(pointsHistory.expiresAt, now)
      ),
      with: {
        user: true,
      },
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
          // Mark all expiring records as expired
          const recordIds = entry.records.map((r) => r.id);
          await tx
            .update(pointsHistory)
            .set({ isExpired: true })
            .where(
              and(
                eq(pointsHistory.userId, entry.userId),
                sql`id IN (${sql.raw(recordIds.map((id) => `'${id}'`).join(','))})`
              )
            );

          // Deduct from user's points balance
          if (entry.userId) {
            await tx
              .update(users)
              .set({ pointsBalance: sql`GREATEST(points_balance - ${entry.totalPoints}, 0)` })
              .where(eq(users.id, entry.userId));

            // Record the expiration in points history
            await tx.insert(pointsHistory).values({
              userId: entry.userId,
              type: 'expire',
              pointsAmount: -entry.totalPoints,
              pointsBalanceAfter: sql`GREATEST(points_balance - ${entry.totalPoints}, 0)`,
              descriptionId: `Poin hangus karena melewati 1 tahun`,
              descriptionEn: `Points expired after 1 year`,
              expiresAt: null,
              isExpired: true,
            });
          }
        });

        expired++;
        console.log(
          `[ExpirePoints] User ${entry.userId}: expired ${entry.totalPoints} points across ${entry.records.length} records`
        );
      } catch (userError) {
        const message = userError instanceof Error ? userError.message : String(userError);
        errors.push(`Failed to expire points for user ${entry.userId}: ${message}`);
        console.error(`[ExpirePoints] Error for user ${entry.userId}:`, userError);
      }
    }

    console.log(`[ExpirePoints] Completed: ${expired} users processed, ${errors.length} errors`);
    if (errors.length > 0) {
      errors.forEach((e) => console.error(`[ExpirePoints] ${e}`));
    }

    return success({ expired, errors });
  } catch (error) {
    console.error('[ExpirePoints] Fatal error:', error);
    return serverError(error);
  }
}