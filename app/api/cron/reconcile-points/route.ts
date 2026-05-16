import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, pointsHistory } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { serverError, success } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

/**
 * Reconcile users.pointsBalance with calculated SUM from pointsHistory.
 * Runs daily via Vercel Cron to ensure points balance integrity.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const results = await db
      .select({
        userId: pointsHistory.userId,
        // Include all records: expire records carry negative amounts to cancel out earn records.
        // The isExpired filter on earn records is an optimization flag only — it does NOT
        // affect the running total. Filtering out expired markers would double-count expiries.
        calculatedBalance: sql<number>`COALESCE(SUM(${pointsHistory.pointsAmount}), 0)`,
      })
      .from(pointsHistory)
      .groupBy(pointsHistory.userId);

    let reconciled = 0;
    let drifted = 0;

    for (const row of results) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, row.userId),
      });

      if (user && user.pointsBalance !== row.calculatedBalance) {
        await db
          .update(users)
          .set({ pointsBalance: row.calculatedBalance })
          .where(eq(users.id, row.userId));
        drifted++;
        logger.warn('[ReconcilePoints] Balance drift corrected', {
          userId: row.userId,
          oldBalance: user.pointsBalance,
          newBalance: row.calculatedBalance,
        });
      }
      reconciled++;
    }

    logger.info('[ReconcilePoints] Completed', { reconciled, drifted });
    return success({ reconciled, drifted });
  } catch (error) {
    logger.error('[ReconcilePoints] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}