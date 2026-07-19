import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { getWalletFloorCheck } from '@/lib/shipping/wallet-floor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SEVEN_DAYS_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

/**
 * GET /api/admin/health/wallet — exposes the wallet-floor check (L2 Rule 9)
 * to the operator. Read-only; safe to leave on for the daily ops card.
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner', 'warehouse'].includes(session.user.role)) return forbidden();

    const [weeklyDispatchRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(${orders.shippingCost}),0)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, SEVEN_DAYS_AGO())));

    const check = getWalletFloorCheck(weeklyDispatchRow?.total ?? 0);
    return success(check);
  } catch (error) {
    logger.error('[admin/health/wallet]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, { windowMs: 60_000, maxRequests: 30 });
