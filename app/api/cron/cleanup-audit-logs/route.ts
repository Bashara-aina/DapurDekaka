import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';
import { lt } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { logger } from '@/lib/utils/logger';

/**
 * Cleanup old audit logs.
 * Deletes admin_activity_logs older than 365 days.
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

    const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(adminActivityLogs)
      .where(lt(adminActivityLogs.createdAt, cutoffDate));

    logger.info('[Cron] Cleanup audit logs', {
      deletedBefore: cutoffDate.toISOString(),
    });

    return success({
      message: 'Audit logs older than 365 days deleted',
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    logger.error('[Cron] Audit log cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}