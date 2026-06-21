import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getLiveFeed = cache(async () => {
  const recentOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      recipientName: orders.recipientName,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
      isB2b: orders.isB2b,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(20);

  if (recentOrders.length === 0) {
    return [];
  }

  const orderIds = recentOrders.map(o => o.id);
  const items = await db
    .select({
      orderId: orderItems.orderId,
      productNameId: orderItems.productNameId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const itemsByOrder = new Map<string, { name: string; quantity: number }[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({ name: item.productNameId, quantity: item.quantity });
    itemsByOrder.set(item.orderId, list);
  }

  return recentOrders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    recipientName: order.recipientName,
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    isB2b: order.isB2b,
    itemSummary: itemsByOrder.get(order.id) ?? [],
    totalItems: itemsByOrder.get(order.id)?.reduce((sum, i) => sum + i.quantity, 0) ?? 0,
  }));
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner' && role !== 'warehouse') {
      return forbidden();
    }

    const feed = await getLiveFeed();
    return success({
      orders: feed,
      count: feed.length,
    });
  } catch (error) {
    console.error('[admin/dashboard/live-feed]', error);
    return serverError(error);
  }
}