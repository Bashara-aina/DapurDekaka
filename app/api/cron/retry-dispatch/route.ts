import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, and, lt, gte, lte } from 'drizzle-orm';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { dispatchOrder } from '@/lib/shipping/dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Retry failed Biteship dispatches (max 3 attempts, within 24h of payment).
 * P0#9: calls the shared `dispatchOrder()` directly with CRON_SECRET-verified
 * auth — no empty-cookie self-fetch that always 403'd.
 */
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return unauthorized('Cron auth diperlukan');

    // Recover orders stuck in 'booking' (process crash between status update and API call)
    const stuckOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'packed'),
        eq(orders.deliveryMethod, 'delivery'),
        eq(orders.dispatchStatus, 'booking'),
        lte(orders.updatedAt, new Date(Date.now() - 30 * 60 * 1000))
      ),
      columns: { id: true, orderNumber: true },
    });

    for (const stuck of stuckOrders) {
      await db
        .update(orders)
        .set({ dispatchStatus: 'pending', dispatchLastError: 'Pulih dari status booking stuck', updatedAt: new Date() })
        .where(eq(orders.id, stuck.id));
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const candidates = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'packed'),
        eq(orders.deliveryMethod, 'delivery'),
        eq(orders.dispatchStatus, 'retrying'),
        lt(orders.dispatchAttempts, 3),
        gte(orders.paidAt, twentyFourHoursAgo)
      ),
      columns: { id: true, orderNumber: true },
    });

    let retried = 0;
    for (const order of candidates) {
      try {
        const outcome = await dispatchOrder(order.id, null);
        if (outcome.ok) retried += 1;
      } catch (err) {
        logger.error('[cron/retry-dispatch]', {
          orderNumber: order.orderNumber,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return success({ retried, candidates: candidates.length });
  } catch (error) {
    return serverError(error);
  }
}
