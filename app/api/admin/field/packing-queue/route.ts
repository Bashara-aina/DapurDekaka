import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, products } from '@/lib/db/schema';
import { eq, and, asc, isNull, inArray } from 'drizzle-orm';
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

    const url = new URL(req.url);
    const courierFilter = url.searchParams.get('courier');
    const searchQuery = url.searchParams.get('search');
    const sortOrder = url.searchParams.get('sort') === 'newest' ? 'desc' : 'asc';

    const packingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'paid'),
        courierFilter ? eq(orders.courierCode, courierFilter) : undefined
      ),
      orderBy: sortOrder === 'desc' 
        ? [asc(orders.paidAt)]
        : [asc(orders.paidAt)],
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: true,
              },
            },
          },
        },
      },
    });

    let filteredOrders = packingOrders;
    
    if (searchQuery) {
      filteredOrders = packingOrders.filter(o => 
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const result = filteredOrders.map(order => {
      const totalWeight = order.items.reduce((sum, item) => {
        return sum + (item.weightGram * item.quantity);
      }, 0);

      const isOutsideJakarta = order.province && 
        !order.province.toLowerCase().includes('jakarta') &&
        !order.province.toLowerCase().includes('jabodetabek');

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        paidAt: order.paidAt,
        items: order.items.map(item => ({
          productNameId: item.productNameId,
          variantNameId: item.variantNameId,
          quantity: item.quantity,
          sku: item.sku,
          weightGram: item.weightGram,
        })),
        totalWeight,
        courierCode: order.courierCode,
        courierService: order.courierService,
        courierName: order.courierName,
        district: order.district,
        city: order.city,
        province: order.province,
        addressLine: order.addressLine,
        customerNote: order.customerNote,
        deliveryMethod: order.deliveryMethod,
        requiresColdChain: isOutsideJakarta,
        recipientName: order.recipientName ? order.recipientName.split(' ')[0] : 'Pelanggan',
        pickupCode: order.pickupCode,
      };
    });

    return success(result);
  } catch (error) {
    console.error('[admin/field/packing-queue]', error);
    return serverError(error);
  }
}
