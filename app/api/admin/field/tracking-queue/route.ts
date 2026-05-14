import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
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

    const packedOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'packed'),
        isNull(orders.trackingNumber)
      ),
      orderBy: (orders, { asc }) => [asc(orders.updatedAt)],
      with: {
        items: true,
      },
    });

    const result = packedOrders.map(order => {
      const totalWeight = order.items.reduce((sum, item) => {
        return sum + (item.weightGram * item.quantity);
      }, 0);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        packedAt: order.updatedAt,
        items: order.items.map(item => ({
          productNameId: item.productNameId,
          variantNameId: item.variantNameId,
          quantity: item.quantity,
        })),
        totalWeight,
        courierCode: order.courierCode,
        courierService: order.courierService,
        courierName: order.courierName,
        district: order.district,
        city: order.city,
        recipientName: order.recipientName ? order.recipientName.split(' ')[0] : 'Pelanggan',
        deliveryMethod: order.deliveryMethod,
      };
    });

    return success(result);
  } catch (error) {
    console.error('[admin/field/tracking-queue]', error);
    return serverError(error);
  }
}
