import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { requireActiveUser } from '@/lib/auth/require-active';
import { db } from '@/lib/db';
import { addresses, orders, pointsHistory, users } from '@/lib/db/schema';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { isSameOriginRequest, sameOriginRejected } from '@/lib/utils/same-origin';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * UU PDP — data subject export of personal account data.
 * Financial order rows are included as the customer's purchase history.
 */
export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    if (!isSameOriginRequest(req)) return sameOriginRejected();

    const session = await auth();
    if (!session?.user?.id) return unauthorized('Silakan masuk terlebih dahulu');

    const activeUser = await requireActiveUser();
    if (!activeUser) return unauthorized('Akun Anda dinonaktifkan');

    const userId = session.user.id;
    const [profile, userAddresses, userOrders, points] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          name: true,
          email: true,
          phone: true,
          languagePreference: true,
          pointsBalance: true,
          createdAt: true,
        },
      }),
      db.query.addresses.findMany({ where: eq(addresses.userId, userId) }),
      db.query.orders.findMany({
        where: eq(orders.userId, userId),
        columns: {
          orderNumber: true,
          status: true,
          totalAmount: true,
          deliveryMethod: true,
          createdAt: true,
          paidAt: true,
        },
        with: {
          items: {
            columns: {
              productNameId: true,
              variantNameId: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
            },
          },
        },
      }),
      db.query.pointsHistory.findMany({
        where: eq(pointsHistory.userId, userId),
        columns: {
          type: true,
          pointsAmount: true,
          descriptionId: true,
          descriptionEn: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ]);

    if (!profile) return unauthorized('Silakan masuk terlebih dahulu');

    return success({
      exportedAt: new Date().toISOString(),
      profile,
      addresses: userAddresses,
      orders: userOrders,
      pointsHistory: points,
    });
  } catch (error) {
    logger.error('[account/export]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}, 'auth');
