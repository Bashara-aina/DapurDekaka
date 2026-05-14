import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderStatusHistory, inventoryLogs, productVariants, products } from '@/lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
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

    const activityLogs = await db.query.orderStatusHistory.findMany({
      where: and(
        eq(orderStatusHistory.changedByUserId, userId),
        gte(orderStatusHistory.createdAt, today)
      ),
      orderBy: [desc(orderStatusHistory.createdAt)],
    });

    const inventoryUpdates = await db.query.inventoryLogs.findMany({
      where: and(
        eq(inventoryLogs.changedByUserId, userId),
        gte(inventoryLogs.createdAt, today)
      ),
      orderBy: [desc(inventoryLogs.createdAt)],
    });

    const variantIds = [...new Set(inventoryUpdates.map(log => log.variantId))];
    const variantRecords = variantIds.length > 0 
      ? await db.query.productVariants.findMany({
          where: sql`${productVariants.id} IN (${sql.join(variantIds.map(id => sql`${id}`), sql`, `)})`,
        })
      : [];

    const variantMap = new Map(variantRecords.map(v => [v.id, v]));

    const packedCount = activityLogs.filter(l => l.toStatus === 'packed').length;
    const shippedCount = activityLogs.filter(l => l.toStatus === 'shipped').length;
    const deliveredCount = activityLogs.filter(l => l.toStatus === 'delivered').length;

    return success({
      packedCount,
      shippedCount,
      deliveredCount,
      inventoryUpdateCount: inventoryUpdates.length,
      activityLogs: activityLogs.slice(0, 20).map(log => ({
        id: log.id,
        orderId: log.orderId,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        createdAt: log.createdAt,
        note: log.note,
      })),
      inventoryUpdates: inventoryUpdates.slice(0, 10).map(log => {
        const variant = variantMap.get(log.variantId);
        return {
          id: log.id,
          variantId: log.variantId,
          productName: variant?.productId ? 'Produk' : 'Unknown',
          variantName: variant?.nameId ?? 'Unknown',
          quantityBefore: log.quantityBefore,
          quantityAfter: log.quantityAfter,
          quantityDelta: log.quantityDelta,
          changeType: log.changeType,
          note: log.note,
          createdAt: log.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('[admin/field/worker-activity]', error);
    return serverError(error);
  }
}