import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role ?? '';

  const allOrders = await db.query.orders.findMany({
    orderBy: [desc(orders.createdAt)],
    limit: 50,
  });

  const orderItems = allOrders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    recipientName: o.recipientName,
    recipientEmail: o.recipientEmail,
    totalAmount: o.totalAmount,
    createdAt: o.createdAt.toISOString(),
    deliveryMethod: o.deliveryMethod,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pesanan</h1>
      </div>

      <OrdersClient initialOrders={orderItems} userRole={userRole} />
    </div>
  );
}
