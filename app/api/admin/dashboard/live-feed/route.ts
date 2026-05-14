import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin') {
      return forbidden();
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const todayOnly = url.searchParams.get('today') === 'true';
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let whereClause;
    if (todayOnly) {
      whereClause = eq(orders.createdAt, today);
    }

    const recentOrders = await db.query.orders.findMany({
      where: whereClause,
      orderBy: [desc(orders.createdAt)],
      limit,
      with: {
        items: true,
      },
    });

    const result = recentOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      recipientName: order.recipientName,
      email: order.recipientEmail,
      phone: order.recipientPhone ? `${order.recipientPhone.slice(0, 4)}****` : null,
      totalAmount: order.totalAmount,
      courierCode: order.courierCode,
      courierName: order.courierName,
      courierService: order.courierService,
      itemSummary: order.items.slice(0, 2).map(item => ({
        name: item.productNameId,
        quantity: item.quantity,
      })),
      totalItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
    }));

    return success(result);
  } catch (error) {
    console.error('[admin/dashboard/live-feed]', error);
    return serverError(error);
  }
}