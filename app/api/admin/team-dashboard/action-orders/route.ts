import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, users, orderItems } from '@/lib/db/schema';
import { sql, desc, gte, lt, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') ?? '8', 10)));

    // Orders that need action: pending_payment, paid, processing
    const actionOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        recipientName: orders.recipientName,
        totalItems: sql<number>`0::int`,
        totalAmount: orders.totalAmount,
        courierName: orders.courierName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(sql`${orders.status} IN ('pending_payment','paid','processing')`)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return success(actionOrders.map(order => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('[admin/team-dashboard/action-orders]', error);
    return serverError(error);
  }
}