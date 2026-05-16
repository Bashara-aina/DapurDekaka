import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, gte, lt, count } from 'drizzle-orm';
import { success, serverError, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

    const [packedTodayResult, shippedToday, pendingPickup] = await Promise.all([
      db
        .select({ count: count() })
        .from(orderStatusHistory)
        .where(
          and(
            eq(orderStatusHistory.toStatus, 'packed'),
            gte(orderStatusHistory.createdAt, startOfDay),
            lt(orderStatusHistory.createdAt, endOfDay)
          )
        ),
      db.query.orders.findMany({
        where: and(
          eq(orders.status, 'shipped'),
          gte(orders.shippedAt, startOfDay),
          lt(orders.shippedAt, endOfDay)
        ),
      }),
      db.query.orders.findMany({
        where: and(
          eq(orders.status, 'packed'),
          eq(orders.deliveryMethod, 'pickup'),
        ),
      }),
    ]);

    return success({
      packedToday: packedTodayResult[0]?.count ?? 0,
      shippedToday: shippedToday.length,
      pendingPickup: pendingPickup.length,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[admin/field/today-summary GET]', error);
    return serverError(error);
  }
}