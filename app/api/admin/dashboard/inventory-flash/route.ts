import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq, sql, asc, and } from 'drizzle-orm';
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

    const outOfStock = await db.query.productVariants.findMany({
      where: eq(productVariants.stock, 0),
      orderBy: [asc(productVariants.stock)],
      with: { product: true },
    });

    const lowStock = await db.query.productVariants.findMany({
      where: and(
        sql`${productVariants.stock} > 0 AND ${productVariants.stock} < 10`,
        eq(productVariants.isActive, true)
      ),
      orderBy: [asc(productVariants.stock)],
      with: { product: true },
    });

    const healthy = await db.query.productVariants.findMany({
      where: and(
        sql`${productVariants.stock} >= 10`,
        eq(productVariants.isActive, true)
      ),
    });

    const outOfStockItems = outOfStock.slice(0, 5).map(v => ({
      id: v.id,
      nameId: v.nameId,
      sku: v.sku,
      stock: v.stock,
      productNameId: v.product?.nameId,
    }));

    const lowStockItems = lowStock.slice(0, 5).map(v => ({
      id: v.id,
      nameId: v.nameId,
      sku: v.sku,
      stock: v.stock,
      productNameId: v.product?.nameId,
    }));

    return success({
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      healthyCount: healthy.length,
      outOfStock: outOfStockItems,
      lowStock: lowStockItems,
    });
  } catch (error) {
    console.error('[admin/dashboard/inventory-flash]', error);
    return serverError(error);
  }
}