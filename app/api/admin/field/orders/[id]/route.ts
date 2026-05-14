import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner', 'warehouse'].includes(role ?? '')) {
      return forbidden();
    }

    const { id: orderId } = await params;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
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

    if (!order) {
      return notFound('Pesanan tidak ditemukan');
    }

    const totalWeight = order.items.reduce((sum, item) => {
      return sum + (item.weightGram * item.quantity);
    }, 0);

    const isOutsideJakarta = order.province && 
      !order.province.toLowerCase().includes('jakarta') &&
      !order.province.toLowerCase().includes('jabodetabek');

    if (role === 'warehouse') {
      return success({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        deliveryMethod: order.deliveryMethod,
        recipientName: order.recipientName ? order.recipientName.split(' ')[0] : 'Pelanggan',
        addressLine: order.addressLine,
        district: order.district,
        city: order.city,
        province: order.province,
        postalCode: order.postalCode,
        courierCode: order.courierCode,
        courierService: order.courierService,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        pickupCode: order.pickupCode,
        customerNote: order.customerNote,
        items: order.items.map(item => ({
          productNameId: item.productNameId,
          variantNameId: item.variantNameId,
          sku: item.sku,
          quantity: item.quantity,
          weightGram: item.weightGram,
          unitPrice: undefined,
          subtotal: undefined,
        })),
        totalWeight,
        requiresColdChain: isOutsideJakarta,
      });
    }

    return success({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      deliveryMethod: order.deliveryMethod,
      recipientName: order.recipientName,
      addressLine: order.addressLine,
      district: order.district,
      city: order.city,
      province: order.province,
      postalCode: order.postalCode,
      courierCode: order.courierCode,
      courierService: order.courierService,
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      pickupCode: order.pickupCode,
      customerNote: order.customerNote,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      items: order.items.map(item => ({
        productNameId: item.productNameId,
        variantNameId: item.variantNameId,
        sku: item.sku,
        quantity: item.quantity,
        weightGram: item.weightGram,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      totalWeight,
      requiresColdChain: isOutsideJakarta,
    });
  } catch (error) {
    console.error('[admin/field/orders/:id]', error);
    return serverError(error);
  }
}
