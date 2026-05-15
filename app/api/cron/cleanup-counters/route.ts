import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orderDailyCounters } from '@/lib/db/schema';
import { lt } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { logger } from '@/lib/utils/logger';

/**
 * Cleanup old order daily counters.
 * Deletes order_daily_counters records older than 90 days.
 * These are only needed for generating order numbers within a short window.
 * Runs monthly via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(orderDailyCounters)
      .where(lt(orderDailyCounters.date, cutoffDate.toISOString().slice(0, 10)));

    logger.info('[Cron] Cleanup order daily counters', {
      deletedBefore: cutoffDate.toISOString().slice(0, 10),
    });

    return success({
      message: 'Order daily counters older than 90 days deleted',
      cutoffDate: cutoffDate.toISOString().slice(0, 10),
    });
  } catch (error) {
    logger.error('[Cron] Order daily counters cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}