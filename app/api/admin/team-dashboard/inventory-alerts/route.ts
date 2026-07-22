import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const [outOfStock, lowStock] = await Promise.all([
      db.select({
        id: productVariants.id,
        nameId: productVariants.nameId,
        sku: productVariants.sku,
        stock: productVariants.stock,
        productNameId: products.nameId,
      })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(eq(productVariants.stock, 0), eq(productVariants.isActive, true)))
        .orderBy(desc(productVariants.updatedAt))
        .limit(10),

      db.select({
        id: productVariants.id,
        nameId: productVariants.nameId,
        sku: productVariants.sku,
        stock: productVariants.stock,
        productNameId: products.nameId,
      })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(
          sql`${productVariants.stock} > 0 AND ${productVariants.stock} < 5`,
          eq(productVariants.isActive, true)
        ))
        .orderBy(productVariants.stock)
        .limit(10),
    ]);

    return success({ outOfStock, lowStock });
  } catch (error) {
    console.error('[admin/team-dashboard/inventory-alerts]', error);
    return serverError(error);
  }
}
