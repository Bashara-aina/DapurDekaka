import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));

    const recentOrders = await db.query.orders.findMany({
      with: { items: true },
      orderBy: [desc(orders.createdAt)],
      limit,
    });

    const formatted = recentOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      recipientName: order.recipientName,
      totalItems: order.items.length,
      totalAmount: order.totalAmount,
      courierName: order.courierName,
      createdAt: order.createdAt.toISOString(),
    }));

    return success(formatted);
  } catch (error) {
    console.error('[admin/team-dashboard/recent-orders]', error);
    return serverError(error);
  }
}