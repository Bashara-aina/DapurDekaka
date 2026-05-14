import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, productVariants, coupons } from '@/lib/db/schema';
import { eq, gte, sql, and, lt } from 'drizzle-orm';
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts: { priority: number; message: string; link: string; dismissKey?: string }[] = [];

    const stuckPaidResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          lt(orders.paidAt, new Date(today.getTime() - 2 * 60 * 60 * 1000))
        )
      );

    const stuckPaidCount = stuckPaidResult[0]?.count ?? 0;
    if (stuckPaidCount > 0) {
      alerts.push({
        priority: 1,
        message: `${stuckPaidCount} pesanan stuck di 'paid' lebih dari 2 jam`,
        link: '/admin/orders?status=paid',
        dismissKey: 'stuck_paid_orders',
      });
    }

    const outOfStockResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.stock, 0),
          eq(productVariants.isActive, true)
        )
      );

    const outOfStockCount = outOfStockResult[0]?.count ?? 0;
    if (outOfStockCount > 0) {
      alerts.push({
        priority: 1,
        message: `${outOfStockCount} produk habis stok`,
        link: '/admin/inventory?stock=0',
        dismissKey: 'out_of_stock',
      });
    }

    const lowStockResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(
        and(
          sql`${productVariants.stock} < 10 AND ${productVariants.stock} > 0`,
          eq(productVariants.isActive, true)
        )
      );

    const lowStockCount = lowStockResult[0]?.count ?? 0;
    if (lowStockCount > 0) {
      alerts.push({
        priority: 2,
        message: `${lowStockCount} produk stok menipis (< 10 unit)`,
        link: '/admin/inventory?stock=low',
        dismissKey: 'low_stock',
      });
    }

    const expiringCoupons = await db.query.coupons.findMany({
      where: eq(coupons.isActive, true),
    });

    const soonExpiringCoupons = expiringCoupons.filter(c => {
      if (!c.expiresAt) return false;
      const hoursUntilExpiry = (new Date(c.expiresAt).getTime() - today.getTime()) / (1000 * 60 * 60);
      return hoursUntilExpiry > 0 && hoursUntilExpiry < 24;
    });

    for (const coupon of soonExpiringCoupons.slice(0, 3)) {
      alerts.push({
        priority: 3,
        message: `Kupon ${coupon.code} akan expire dalam 24 jam`,
        link: `/admin/coupons/${coupon.id}`,
        dismissKey: `coupon_expiry_${coupon.id}`,
      });
    }

    alerts.sort((a, b) => a.priority - b.priority);

    return success(alerts);
  } catch (error) {
    console.error('[admin/dashboard/alerts]', error);
    return serverError(error);
  }
}