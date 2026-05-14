import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, products, productVariants } from '@/lib/db/schema';
import { eq, sql, and, inArray, desc, asc, gte } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role ?? '')) {
      return forbidden();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const actionOrders = await db.query.orders.findMany({
      where: and(
        gte(orders.updatedAt, new Date(today.getTime() - 24 * 60 * 60 * 1000))
      ),
      orderBy: [desc(orders.createdAt)],
      limit: 15,
      with: {
        items: true,
      },
    });

    const result = actionOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      recipientName: order.recipientName,
      items: order.items.map(item => ({
        productNameId: item.productNameId,
        quantity: item.quantity,
      })),
      totalItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: order.totalAmount,
      courierName: order.courierName,
    }));

    return success(result);
  } catch (error) {
    console.error('[admin/team-dashboard/action-orders]', error);
    return serverError(error);
  }
}