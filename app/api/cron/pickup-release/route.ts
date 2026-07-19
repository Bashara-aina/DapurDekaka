import { NextRequest, NextResponse } from 'next/server';
import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { success, serverError } from '@/lib/utils/api-response';
import { PICKUP_AUTO_RELEASE_HOURS } from '@/lib/constants/financial-rules';
import { flagNeedsAttention } from '@/lib/ops/needs-attention';
import { sendWhatsApp, pickupReminderMessage } from '@/lib/services/fonnte';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWENTY_FOUR_HOURS_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
const RELEASE_CUTOFF = () =>
  new Date(Date.now() - PICKUP_AUTO_RELEASE_HOURS * 60 * 60 * 1000);

/**
 * Pickup SLA cron (P4 backlog #7): 24h reminder WA + 48h needs_attention flag.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const stalePickups = await db.query.orders.findMany({
      where: and(
        eq(orders.deliveryMethod, 'pickup'),
        eq(orders.status, 'paid'),
        lte(orders.paidAt, TWENTY_FOUR_HOURS_AGO())
      ),
      columns: {
        id: true,
        orderNumber: true,
        recipientName: true,
        recipientPhone: true,
        paidAt: true,
        needsAttention: true,
      },
    });

    let reminders = 0;
    let flagged = 0;

    for (const order of stalePickups) {
      if (!order.paidAt) continue;

      if (order.paidAt <= RELEASE_CUTOFF() && !order.needsAttention) {
        await flagNeedsAttention(
          order.id,
          'pickup_no_show',
          `Pickup belum diambil >${PICKUP_AUTO_RELEASE_HOURS}j — ${order.orderNumber}`
        );
        flagged++;
        continue;
      }

      if (order.paidAt <= TWENTY_FOUR_HOURS_AGO() && order.paidAt > RELEASE_CUTOFF()) {
        try {
          await sendWhatsApp({
            phone: order.recipientPhone,
            message: pickupReminderMessage(order.recipientName, order.orderNumber),
          });
          reminders++;
        } catch (err) {
          logger.warn('[pickup-release] WA reminder failed', {
            orderNumber: order.orderNumber,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return success({ reminders, flagged, checked: stalePickups.length });
  } catch (error) {
    logger.error('[cron/pickup-release]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}
