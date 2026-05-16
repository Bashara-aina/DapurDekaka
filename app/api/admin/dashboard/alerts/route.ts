import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, productVariants, b2bInquiries } from '@/lib/db/schema';
import { eq, sql, and, lt, gt } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { getSetting } from '@/lib/settings/get-settings';

interface Alert {
  priority: number;
  type: string;
  message: string;
  count: number;
  link: string;
}

const getAlerts = cache(async (): Promise<Alert[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alerts: Alert[] = [];

  // Fetch configurable threshold
  const lowStockThreshold = await getSetting<number>('low_stock_threshold', 'integer') ?? 5;

  const [stuckPaidResult, outOfStockResult, lowStockResult, pendingOrdersResult, pendingB2BResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          lt(orders.paidAt, new Date(Date.now() - 30 * 60 * 1000))
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(and(eq(productVariants.stock, 0), eq(productVariants.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(and(lt(productVariants.stock, lowStockThreshold), gt(productVariants.stock, 0), eq(productVariants.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, 'pending_payment')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bInquiries)
      .where(eq(b2bInquiries.status, 'new')),
  ]);

  const stuckPaidCount = stuckPaidResult[0]?.count ?? 0;
  if (stuckPaidCount > 0) {
    alerts.push({
      priority: 1,
      type: 'stuck_orders',
      message: `${stuckPaidCount} pesanan stuck di 'paid' lebih dari 30 menit`,
      count: stuckPaidCount,
      link: '/admin/orders?status=paid',
    });
  }

  const outOfStockCount = outOfStockResult[0]?.count ?? 0;
  if (outOfStockCount > 0) {
    alerts.push({
      priority: 1,
      type: 'out_of_stock',
      message: `${outOfStockCount} varian produk habis stok`,
      count: outOfStockCount,
      link: '/admin/inventory?stock=0',
    });
  }

  const lowStockCount = lowStockResult[0]?.count ?? 0;
  if (lowStockCount > 0) {
    alerts.push({
      priority: 2,
      type: 'low_stock',
      message: `${lowStockCount} varian stok menipis (< ${lowStockThreshold} unit)`,
      count: lowStockCount,
      link: '/admin/inventory?stock=low',
    });
  }

  const pendingOrdersCount = pendingOrdersResult[0]?.count ?? 0;
  if (pendingOrdersCount > 0) {
    alerts.push({
      priority: 2,
      type: 'pending_orders',
      message: `${pendingOrdersCount} pesanan menunggu pembayaran`,
      count: pendingOrdersCount,
      link: '/admin/orders?status=pending_payment',
    });
  }

  const pendingB2BCount = pendingB2BResult[0]?.count ?? 0;
  if (pendingB2BCount > 0) {
    alerts.push({
      priority: 2,
      type: 'pending_b2b',
      message: `${pendingB2BCount} inquiry B2B baru belum diproses`,
      count: pendingB2BCount,
      link: '/admin/b2b',
    });
  }

  return alerts.sort((a, b) => a.priority - b.priority);
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') {
      return forbidden();
    }

    const alerts = await getAlerts();
    return success({
      alerts,
      totalAlerts: alerts.length,
      criticalCount: alerts.filter(a => a.priority === 1).length,
    });
  } catch (error) {
    console.error('[admin/dashboard/alerts]', error);
    return serverError(error);
  }
}