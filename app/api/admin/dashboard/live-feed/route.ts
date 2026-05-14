import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

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

  return recentOrders.map(order => {
    const minutesAgo = Math.floor(
      (Date.now() - new Date(order.createdAt).getTime()) / 60000
    );
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      total: order.totalAmount,
      status: order.status,
      isB2b: order.isB2b,
      timeAgo: minutesAgo < 1 ? ' baru' : `${minutesAgo}m lalu`,
    };
  });
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