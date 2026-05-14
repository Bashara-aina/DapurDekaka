import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orderItems, orders, productVariants, products } from '@/lib/db/schema';
import { sql, and, inArray, gte, desc, eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role ?? '')) {
      return forbidden();
    }

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const topProducts = await db
      .select({
        productId: orderItems.productId,
        productNameId: orderItems.productNameId,
        variantId: orderItems.variantId,
        variantNameId: orderItems.variantNameId,
        unitsSold: sql<number>`sum(${orderItems.quantity})::int`,
        revenue: sql<number>`sum(${orderItems.subtotal})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, sql`${orderItems.orderId} = ${orders.id}`)
      .where(
        and(
          gte(orders.paidAt, firstDayOfMonth),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      )
      .groupBy(orderItems.productId, orderItems.productNameId, orderItems.variantId, orderItems.variantNameId)
      .orderBy(desc(sql`sum(${orderItems.subtotal})::int`))
      .limit(10);

    const totalRevenueResult = await db
      .select({ total: sql<number>`coalesce(sum(total_amount), 0)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.paidAt, firstDayOfMonth),
          sql`${orders.status} IN ('paid','processing','packed','shipped','delivered')`
        )
      );

    const totalRevenue = totalRevenueResult[0]?.total ?? 0;

    const productsWithStock = await Promise.all(
      topProducts.map(async (p) => {
        const variant = await db
          .select({ stock: productVariants.stock })
          .from(productVariants)
          .where(sql`${productVariants.id} = ${p.variantId}`)
          .limit(1);
        return {
          ...p,
          stock: variant[0]?.stock ?? 0,
          revenuePercent: totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 10000) / 100 : 0,
        };
      })
    );

    return success(productsWithStock);
  } catch (error) {
    console.error('[admin/team-dashboard/top-products]', error);
    return serverError(error);
  }
}