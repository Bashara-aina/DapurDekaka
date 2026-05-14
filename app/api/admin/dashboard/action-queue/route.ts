import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, productVariants, b2bInquiries } from '@/lib/db/schema';
import { eq, sql, and, lt, gt, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

interface ActionItem {
  priority: number;
  type: string;
  label: string;
  count: number;
  oldestMinutes?: number;
  link: string;
}

const getActionQueue = cache(async (): Promise<ActionItem[]> => {
  const queue: ActionItem[] = [];

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const [stuckPaidOrders, lowStockItems, criticalLowStock, pendingB2B] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        oldestPaidAt: sql<Date | null>`min(${orders.paidAt})`,
      })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), lt(orders.paidAt, thirtyMinutesAgo))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(and(lt(productVariants.stock, 5), gt(productVariants.stock, 0), eq(productVariants.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(and(eq(productVariants.stock, 0), eq(productVariants.isActive, true))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(b2bInquiries)
      .where(eq(b2bInquiries.status, 'new')),
  ]);

  const stuckCount = stuckPaidOrders[0]?.count ?? 0;
  if (stuckCount > 0) {
    const oldestPaidAt = stuckPaidOrders[0]?.oldestPaidAt;
    const oldestMinutes = oldestPaidAt
      ? Math.floor((Date.now() - oldestPaidAt.getTime()) / 60000)
      : undefined;
    queue.push({
      priority: 1,
      type: 'stuck_paid_orders',
      label: 'Pesanan stuck di paid',
      count: stuckCount,
      oldestMinutes,
      link: '/admin/orders?status=paid',
    });
  }

  const oosCount = criticalLowStock[0]?.count ?? 0;
  if (oosCount > 0) {
    queue.push({
      priority: 1,
      type: 'out_of_stock',
      label: 'Produk habis stok',
      count: oosCount,
      link: '/admin/inventory?stock=0',
    });
  }

  const lowCount = lowStockItems[0]?.count ?? 0;
  if (lowCount > 0) {
    queue.push({
      priority: 2,
      type: 'low_stock',
      label: 'Stok menipis (< 5 unit)',
      count: lowCount,
      link: '/admin/inventory?stock=low',
    });
  }

  const b2bCount = pendingB2B[0]?.count ?? 0;
  if (b2bCount > 0) {
    queue.push({
      priority: 2,
      type: 'pending_b2b_inquiries',
      label: 'Inquiry B2B baru',
      count: b2bCount,
      link: '/admin/b2b',
    });
  }

  return queue.sort((a, b) => a.priority - b.priority);
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

    const queue = await getActionQueue();
    return success({
      items: queue,
      totalItems: queue.reduce((sum, item) => sum + item.count, 0),
      criticalCount: queue.filter(i => i.priority === 1).length,
    });
  } catch (error) {
    console.error('[admin/dashboard/action-queue]', error);
    return serverError(error);
  }
}