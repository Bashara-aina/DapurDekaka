import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc, eq, or, and, isNull } from 'drizzle-orm';
import ShipmentsClient from './ShipmentsClient';

export const dynamic = 'force-dynamic';

export default async function ShipmentsPage() {
  const shippableOrders = await db.query.orders.findMany({
    where: and(
      isNull(orders.trackingNumber),
      eq(orders.deliveryMethod, 'delivery'),
      or(
        eq(orders.status, 'processing'),
        eq(orders.status, 'packed')
      )
    ),
    orderBy: [desc(orders.createdAt)],
    limit: 50,
  });

  const serialized = shippableOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    courierCode: o.courierCode,
    courierService: o.courierService,
    courierName: o.courierName,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    status: o.status,
    totalAmount: o.totalAmount,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    city: o.city ?? null,
    province: o.province ?? null,
  }));

  return <ShipmentsClient initialOrders={serialized} />;
}