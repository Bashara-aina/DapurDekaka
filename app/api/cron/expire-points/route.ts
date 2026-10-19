import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { eq, and, lt, gt, inArray, sql } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { serverError, success, unauthorized } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Expire points older than POINTS_EXPIRY_DAYS.
 *
 * P2: only the unspent remainder (`points_remaining`) expires — a partially
 * redeemed earn row keeps its remainder usable until its expiry date.
 * P7: one transaction per user so a single bad row cannot abort the whole run.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return unauthorized('Cron auth diperlukan');
    }

    const now = new Date();

    const expiringRecords = await db.query.pointsHistory.findMany({
      where: and(
        eq(pointsHistory.type, 'earn'),
        eq(pointsHistory.isExpired, false),
        lt(pointsHistory.expiresAt, now),
        gt(pointsHistory.pointsRemaining, 0)
      ),
      columns: { id: true, userId: true, pointsRemaining: true },
      orderBy: (h, { asc }) => [asc(h.expiresAt)],
      limit: 1000,
    });

    if (expiringRecords.length === 0) {
      return success({ expiredUsers: 0, expiredPoints: 0, errors: [] });
    }

    const byUser = new Map<string, { ids: string[]; total: number }>();
    for (const record of expiringRecords) {
      const entry = byUser.get(record.userId) ?? { ids: [], total: 0 };
      entry.ids.push(record.id);
      entry.total += record.pointsRemaining;
      byUser.set(record.userId, entry);
    }

    let expiredUsers = 0;
    let expiredPoints = 0;
    const errors: string[] = [];

    for (const [userId, entry] of byUser) {
      try {
        await db.transaction(async (tx) => {
          // Lock the user row so concurrent redeems cannot interleave.
          const [user] = await tx
            .select({ pointsBalance: users.pointsBalance })
            .from(users)
            .where(eq(users.id, userId))
            .for('update');

          const actualExpiry = Math.min(entry.total, user?.pointsBalance ?? 0);

          // Mark rows expired and zero their remaining balance regardless.
          await tx
            .update(pointsHistory)
            .set({ isExpired: true, pointsRemaining: 0 })
            .where(
              and(
                eq(pointsHistory.userId, userId),
                inArray(pointsHistory.id, entry.ids)
              )
            );

          if (actualExpiry > 0) {
            const [updated] = await tx
              .update(users)
              .set({
                pointsBalance: sql`GREATEST(points_balance - ${actualExpiry}, 0)`,
              })
              .where(eq(users.id, userId))
              .returning({ pointsBalance: users.pointsBalance });

            await tx.insert(pointsHistory).values({
              userId,
              type: 'expire',
              pointsAmount: -actualExpiry,
              pointsBalanceAfter: updated?.pointsBalance ?? 0,
              descriptionId: 'Poin hangus karena melewati masa berlaku',
              descriptionEn: 'Points expired after the validity period',
              isExpired: true,
            });

            expiredPoints += actualExpiry;
          }

          expiredUsers++;
        });
      } catch (userError) {
        const message = userError instanceof Error ? userError.message : String(userError);
        errors.push(`Failed to expire points for user ${userId}: ${message}`);
        logger.error('[ExpirePoints] Error for user', { userId, error: message });
      }
    }

    logger.info('[ExpirePoints] Completed', { expiredUsers, expiredPoints, errorsCount: errors.length });
    return success({ expiredUsers, expiredPoints, errors });
  } catch (error) {
    logger.error('[ExpirePoints] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}
