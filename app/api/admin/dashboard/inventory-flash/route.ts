import { NextRequest } from 'next/server';
import { cache } from 'react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, productVariants, orderItems } from '@/lib/db/schema';
import { eq, sql, and, lt, gt, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

const getInventoryFlash = cache(async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    outOfStockResult,
    lowStockResult,
    topSellingResult,
    totalActiveVariantsResult,
  ] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(productVariants)
      .where(and(eq(productVariants.stock, 0), eq(productVariants.isActive, true))),

    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(productVariants)
      .where(and(lt(productVariants.stock, 5), gt(productVariants.stock, 0), eq(productVariants.isActive, true))),

    db
      .select({
        variantId: orderItems.variantId,
        productNameId: sql<string>`max(${orderItems.productNameId})`,
        variantNameId: sql<string>`max(${orderItems.variantNameId})`,
        totalQuantity: sql<number>`sum(${orderItems.quantity})::int`,
        totalRevenue: sql<number>`sum(${orderItems.subtotal})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, sql`${orderItems.orderId} = ${orders.id}`)
      .where(sql`${orders.paidAt} >= ${thirtyDaysAgo} AND ${orders.status} IN ('paid','processing','packed','shipped','delivered')`)
      .groupBy(orderItems.variantId)
      .orderBy(desc(sql`sum(${orderItems.quantity})::int`))
      .limit(10),

    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(productVariants)
      .where(eq(productVariants.isActive, true)),
  ]);

  return {
    outOfStock: {
      count: outOfStockResult[0]?.count ?? 0,
    },
    lowStock: {
      count: lowStockResult[0]?.count ?? 0,
    },
    topSelling: topSellingResult.map(row => ({
      variantId: row.variantId,
      productName: row.productNameId,
      variantName: row.variantNameId,
      totalQuantity: row.totalQuantity,
      totalRevenue: row.totalRevenue,
    })),
    totalActiveVariants: totalActiveVariantsResult[0]?.count ?? 0,
  };
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

    const flash = await getInventoryFlash();
    return success(flash);
  } catch (error) {
    console.error('[admin/dashboard/inventory-flash]', error);
    return serverError(error);
  }
}