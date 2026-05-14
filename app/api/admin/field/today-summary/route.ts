import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderStatusHistory, inventoryLogs } from '@/lib/db/schema';
import { eq, and, gte, sql, ne } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner', 'warehouse'].includes(role ?? '')) {
      return forbidden();
    }

    const userId = session.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const packedToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'packed'),
          gte(orders.updatedAt, today)
        )
      );

    const shippedToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'shipped'),
          gte(orders.shippedAt, today)
        )
      );

    const deliveredPickupToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'delivered'),
          eq(orders.deliveryMethod, 'pickup'),
          gte(orders.deliveredAt, today)
        )
      );

    const workerActivity = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderStatusHistory)
      .where(
        and(
          eq(orderStatusHistory.changedByUserId, userId),
          eq(orderStatusHistory.toStatus, 'packed'),
          gte(orderStatusHistory.createdAt, today)
        )
      );

    const inventoryUpdatesToday = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryLogs)
      .where(
        and(
          eq(inventoryLogs.changedByUserId, userId),
          gte(inventoryLogs.createdAt, today)
        )
      );

    const recentPacked = await db.query.orders.findMany({
      where: and(
        gte(orders.updatedAt, today),
        ne(orders.status, 'cancelled')
      ),
      orderBy: (orders, { desc }) => [desc(orders.updatedAt)],
      limit: 10,
    });

    const packedByWorker = recentPacked.filter(o => o.status === 'packed' || o.status === 'shipped' || o.status === 'delivered');

    return success({
      packedToday: packedToday[0]?.count ?? 0,
      shippedToday: shippedToday[0]?.count ?? 0,
      deliveredPickupToday: deliveredPickupToday[0]?.count ?? 0,
      workerPackedCount: workerActivity[0]?.count ?? 0,
      inventoryUpdatesToday: inventoryUpdatesToday[0]?.count ?? 0,
      recentActivity: packedByWorker.slice(0, 5).map(order => ({
        orderNumber: order.orderNumber,
        status: order.status,
        updatedAt: order.updatedAt,
        courierCode: order.courierCode,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        deliveryMethod: order.deliveryMethod,
      })),
    });
  } catch (error) {
    console.error('[admin/field/today-summary]', error);
    return serverError(error);
  }
}
