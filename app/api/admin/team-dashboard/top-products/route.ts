import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orderItems, products, productVariants } from '@/lib/db/schema';
import { sql, desc, eq, gte, and } from 'drizzle-orm';
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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const topProducts = await db
      .select({
        productNameId: orderItems.productNameId,
        variantNameId: orderItems.variantNameId,
        unitsSold: sql<number>`sum(${orderItems.quantity})::int`,
        revenue: sql<number>`sum(${orderItems.subtotal})::int`,
        stock: productVariants.stock,
      })
      .from(orderItems)
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(gte(orderItems.createdAt, monthStart))
      .groupBy(orderItems.variantId, orderItems.productNameId, orderItems.variantNameId, productVariants.stock)
      .orderBy(desc(sql`sum(${orderItems.subtotal})`))
      .limit(limit);

    const totalRevenue = topProducts.reduce((sum, p) => sum + p.revenue, 0);

    const withPercent = topProducts.map(p => ({
      ...p,
      revenuePercent: totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 1000) / 10 : 0,
    }));

    return success(withPercent);
  } catch (error) {
    console.error('[admin/team-dashboard/top-products]', error);
    return serverError(error);
  }
}