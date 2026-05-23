import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');
    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const result = await db
      .select({ total: sql<number>`coalesce(sum(${productVariants.stock} * ${productVariants.price}), 0)::int` })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(productVariants.isActive, true), eq(products.isActive, true)));

    const totalValue = result[0]?.total ?? 0;
    const variantCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(eq(productVariants.isActive, true));

    return success({
      totalValue,
      variantCount: variantCount[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('[admin/team-dashboard/inventory-value]', error);
    return serverError(error);
  }
}