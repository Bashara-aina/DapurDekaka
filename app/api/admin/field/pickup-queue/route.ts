import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

    const pickupOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.deliveryMethod, 'pickup'),
        inArray(orders.status, ['paid', 'packed'])
      ),
      orderBy: (orders, { asc }) => [asc(orders.createdAt)],
      with: {
        items: true,
      },
    });

    const result = pickupOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      pickupCode: order.pickupCode,
      status: order.status,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        productNameId: item.productNameId,
        variantNameId: item.variantNameId,
        quantity: item.quantity,
      })),
      recipientName: order.recipientName ? order.recipientName.split(' ')[0] : 'Pelanggan',
      recipientPhone: order.recipientPhone ? `${order.recipientPhone.slice(0, 4)}****` : null,
    }));

    return success(result);
  } catch (error) {
    console.error('[admin/field/pickup-queue]', error);
    return serverError(error);
  }
}
