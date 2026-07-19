import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, refunds, webhookEvents, disputes } from '@/lib/db/schema';
import { and, eq, gte, sql, lte, desc, count } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { getWalletFloorCheck } from '@/lib/shipping/wallet-floor';
import {
  DEFAULT_REFUND_RESERVE_PERCENT,
  SOLO_OPS_CEILING_ORDERS_PER_WEEK,
  HELPER_TRIGGER_ORDERS_PER_WEEK,
} from '@/lib/constants/financial-rules';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ONE_HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000);
const TWENTY_FOUR_HOURS_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
const THREE_DAYS_AGO = () => new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const SEVEN_DAYS_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const TWO_HOURS_AGO = () => new Date(Date.now() - 2 * 60 * 60 * 1000);
const SIX_HOURS_AGO = () => new Date(Date.now() - 6 * 60 * 60 * 1000);

interface CountRow { value: number; }
interface TotalRow { total: number; }

/**
 * GET /api/admin/ops — daily ops card data (L4). Returns the 15-minute
 * morning checklist as a typed JSON so the page can render with checkboxes.
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner', 'warehouse'].includes(session.user.role)) return forbidden();

    const [
      webhookErrRows,
      pendingOldRows,
      paidNotPackedRows,
      refundsOverdueRows,
      weeklyGrossRows,
      weeklyDispatchRows,
      lastRefunds,
      disputesOpenRows,
      pendingRefundTotalRows,
      weeklyOrderRows,
      needsAttentionRows,
      packedUnbookedRows,
      shippedNoScanRows,
      pickupStaleRows,
      paidTodayRows,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(webhookEvents)
        .where(
          and(
            gte(webhookEvents.createdAt, TWENTY_FOUR_HOURS_AGO()),
            sql`${webhookEvents.errorMessage} IS NOT NULL`
          )
        ),
      db
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.status, 'pending_payment'), lte(orders.createdAt, ONE_HOUR_AGO()))),
      db
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), eq(orders.dispatchStatus, 'pending'))),
      // Refunds still pending AND created more than 3 days ago (overdue vs L2 Rule 7).
      db
        .select({ value: count() })
        .from(refunds)
        .where(
          and(
            eq(refunds.status, 'pending'),
            lte(refunds.createdAt, THREE_DAYS_AGO())
          )
        ),
      db
        .select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}),0)::int` })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, SEVEN_DAYS_AGO()))),
      // Wallet floor basis = actual Biteship dispatch spend over the last 7 days
      // (NOT gross revenue). This is what the 2× floor must cover (L2 Rule 9).
      db
        .select({ total: sql<number>`COALESCE(SUM(${orders.biteshipActualCost}),0)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.deliveryMethod, 'delivery'),
            gte(orders.createdAt, SEVEN_DAYS_AGO()),
            sql`${orders.dispatchStatus} IN ('booking','booked')`
          )
        ),
      db.query.refunds.findMany({
        orderBy: [desc(refunds.createdAt)],
        limit: 5,
      }),
      db
        .select({ value: count() })
        .from(disputes)
        .where(and(eq(disputes.status, 'open'), lte(disputes.createdAt, TWENTY_FOUR_HOURS_AGO()))),
      db
        .select({ total: sql<number>`COALESCE(SUM(${refunds.amount}),0)::int` })
        .from(refunds)
        .where(eq(refunds.status, 'pending')),
      db
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), gte(orders.paidAt, SEVEN_DAYS_AGO()))),
      db
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.needsAttention, true)),
      db
        .select({ value: count() })
        .from(orders)
        .where(
          and(
            eq(orders.status, 'packed'),
            eq(orders.deliveryMethod, 'delivery'),
            sql`${orders.dispatchStatus} IN ('pending','failed')`,
            lte(orders.updatedAt, TWO_HOURS_AGO())
          )
        ),
      db
        .select({ value: count() })
        .from(orders)
        .where(
          and(
            eq(orders.status, 'shipped'),
            lte(orders.shippedAt, SIX_HOURS_AGO()),
            sql`${orders.trackingNumber} IS NULL`
          )
        ),
      db
        .select({ value: count() })
        .from(orders)
        .where(
          and(
            eq(orders.deliveryMethod, 'pickup'),
            eq(orders.status, 'paid'),
            lte(orders.paidAt, TWENTY_FOUR_HOURS_AGO())
          )
        ),
      db
        .select({ value: count() })
        .from(orders)
        .where(and(eq(orders.status, 'paid'), gte(orders.paidAt, sql`CURRENT_DATE`))),
    ]);

    const webhookErrCountRow: CountRow = webhookErrRows[0] ?? { value: 0 };
    const pendingOldRow: CountRow = pendingOldRows[0] ?? { value: 0 };
    const paidNotPackedRow: CountRow = paidNotPackedRows[0] ?? { value: 0 };
    const refundsOverdueRow: CountRow = refundsOverdueRows[0] ?? { value: 0 };
    const weeklyGrossRow: TotalRow = weeklyGrossRows[0] ?? { total: 0 };
    const weeklyDispatchRow: TotalRow = weeklyDispatchRows[0] ?? { total: 0 };
    const pendingRefundTotal = pendingRefundTotalRows[0]?.total ?? 0;
    const reserveTarget = Math.floor(weeklyGrossRow.total * (DEFAULT_REFUND_RESERVE_PERCENT / 100));

    const wallet = getWalletFloorCheck(weeklyDispatchRow.total);

    return success({
      webhookErrorCount24h: webhookErrCountRow.value,
      pendingOrdersOver1h: pendingOldRow.value,
      paidNotPacked: paidNotPackedRow.value,
      refundsOverdue3d: refundsOverdueRow.value,
      weeklyGrossIdr: weeklyGrossRow.total,
      weeklyDispatchCostIdr: weeklyDispatchRow.total,
      wallet,
      recentRefunds: lastRefunds,
      disputesOpenOver24h: disputesOpenRows[0]?.value ?? 0,
      pendingRefundsTotalIdr: pendingRefundTotal,
      refundReserveTargetIdr: reserveTarget,
      refundReserveOk: pendingRefundTotal <= reserveTarget,
      ordersThisWeek: weeklyOrderRows[0]?.value ?? 0,
      soloOpsCeiling: SOLO_OPS_CEILING_ORDERS_PER_WEEK,
      helperTriggerCeiling: HELPER_TRIGGER_ORDERS_PER_WEEK,
      needsAttentionCount: needsAttentionRows[0]?.value ?? 0,
      packedUnbookedOver2h: packedUnbookedRows[0]?.value ?? 0,
      shippedNoScanOver6h: shippedNoScanRows[0]?.value ?? 0,
      pickupUnclaimedOver24h: pickupStaleRows[0]?.value ?? 0,
      paidOrdersToday: paidTodayRows[0]?.value ?? 0,
    });
  } catch (error) {
    logger.error('[admin/ops]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, { windowMs: 60_000, maxRequests: 30 });