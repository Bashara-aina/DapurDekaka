import { NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { GET as cancelExpiredOrders } from '@/app/api/cron/cancel-expired-orders/route';
import { GET as reconcilePayments } from '@/app/api/cron/reconcile-payments/route';
import { GET as retryDispatch } from '@/app/api/cron/retry-dispatch/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type JobResult = {
  name: string;
  ok: boolean;
  status: number;
  body: unknown;
};

/**
 * Single hourly wake for Neon bill control.
 * Runs cancel-expired → reconcile-payments → retry-dispatch sequentially
 * so three Vercel cron hits become one compute wake.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) {
      return unauthorized('Cron auth diperlukan');
    }

    const jobs: Array<{
      name: string;
      run: (r: NextRequest) => Promise<Response>;
    }> = [
      { name: 'cancel-expired-orders', run: cancelExpiredOrders },
      { name: 'reconcile-payments', run: reconcilePayments },
      { name: 'retry-dispatch', run: retryDispatch },
    ];

    const results: JobResult[] = [];

    for (const job of jobs) {
      try {
        const res = await job.run(req);
        let body: unknown = null;
        try {
          body = await res.clone().json();
        } catch {
          body = null;
        }
        results.push({
          name: job.name,
          ok: res.ok,
          status: res.status,
          body,
        });
        if (!res.ok) {
          logger.warn('[cron/hourly] sub-job non-OK', {
            job: job.name,
            status: res.status,
          });
        }
      } catch (err) {
        logger.error('[cron/hourly] sub-job threw', {
          job: job.name,
          error: err instanceof Error ? err.message : String(err),
        });
        results.push({
          name: job.name,
          ok: false,
          status: 500,
          body: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    const allOk = results.every((r) => r.ok);
    return success({ allOk, results });
  } catch (error) {
    return serverError(error);
  }
}
