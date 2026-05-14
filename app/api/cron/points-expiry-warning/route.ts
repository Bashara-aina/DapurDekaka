import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { serverError, success } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

/**
 * Send warning emails for points expiring in 30 days.
 * Runs daily at 9AM WIB (02:00 UTC) via Vercel Cron.
 * Delegates to the existing checkExpiringPoints function in lib/points/expiry-check.ts
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Dynamic import to avoid issues with module loading in edge runtime
    const { checkExpiringPoints } = await import('@/lib/points/expiry-check');

    const result = await checkExpiringPoints();

    logger.info('[PointsExpiryWarning] Completed', {
      processed: result.processed,
      errorsCount: result.errors.length,
    });
    if (result.errors.length > 0) {
      result.errors.forEach((e) => logger.error('[PointsExpiryWarning]', { message: e }));
    }

    return success({
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('[PointsExpiryWarning] Fatal error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}