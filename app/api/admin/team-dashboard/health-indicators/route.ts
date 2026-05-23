import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, productVariants } from '@/lib/db/schema';
import { gte, sql, and, lt, eq } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const [pendingOrders, todayPaidOrders, outOfStockVariants, recentOrders] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(orders)
        .where(eq(orders.status, 'pending_payment')),
      db.select({ count: sql<number>`count(*)::int` }).from(orders)
        .where(and(gte(orders.paidAt, todayStart), sql`${orders.status} IN ('paid','processing')`)),
      db.select({ count: sql<number>`count(*)::int` }).from(productVariants)
        .where(and(eq(productVariants.stock, 0), eq(productVariants.isActive, true))),
      db.select({ count: sql<number>`count(*)::int` }).from(orders)
        .where(gte(orders.createdAt, todayStart)),
    ]);

    const healthIndicators = [
      {
        indicator: 'pending_orders',
        status: (pendingOrders[0]?.count ?? 0) > 10 ? 'critical' as const
          : (pendingOrders[0]?.count ?? 0) > 5 ? 'attention' as const : 'good' as const,
        message: `${pendingOrders[0]?.count ?? 0} pesanan menunggu pembayaran`,
      },
      {
        indicator: 'today_paid',
        status: 'good' as const,
        message: `${todayPaidOrders[0]?.count ?? 0} pesanan berhasil dibayar hari ini`,
      },
      {
        indicator: 'inventory',
        status: (outOfStockVariants[0]?.count ?? 0) > 0 ? 'attention' as const : 'good' as const,
        message: (outOfStockVariants[0]?.count ?? 0) > 0
          ? `${outOfStockVariants[0]?.count} varian habis stok`
          : 'Semua stok produk dalam kondisi baik',
      },
      {
        indicator: 'daily_orders',
        status: (recentOrders[0]?.count ?? 0) > 20 ? 'good' as const
          : (recentOrders[0]?.count ?? 0) > 5 ? 'attention' as const : 'critical' as const,
        message: `${recentOrders[0]?.count ?? 0} pesanan masuk hari ini`,
      },
    ];

    return success(healthIndicators);
  } catch (error) {
    console.error('[admin/team-dashboard/health-indicators]', error);
    return serverError(error);
  }
}