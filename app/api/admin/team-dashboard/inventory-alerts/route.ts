import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { asc, sql, or, eq } from 'drizzle-orm';
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

    const outOfStock = await db.query.productVariants.findMany({
      where: eq(productVariants.stock, 0),
      orderBy: [asc(productVariants.stock)],
      with: { product: true },
    });

    const lowStock = await db.query.productVariants.findMany({
      where: sql`${productVariants.stock} > 0 AND ${productVariants.stock} < 10`,
      orderBy: [asc(productVariants.stock)],
      with: { product: true },
    });

    return success({
      outOfStock: outOfStock.map(v => ({
        id: v.id,
        nameId: v.nameId,
        sku: v.sku,
        stock: v.stock,
        productNameId: v.product?.nameId,
      })),
      lowStock: lowStock.map(v => ({
        id: v.id,
        nameId: v.nameId,
        sku: v.sku,
        stock: v.stock,
        productNameId: v.product?.nameId,
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/inventory-alerts]', error);
    return serverError(error);
  }
}