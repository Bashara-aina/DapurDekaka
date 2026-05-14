import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, products } from '@/lib/db/schema';
import { eq, asc, sql, lt, or } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner', 'warehouse'].includes(role ?? '')) {
      return forbidden();
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get('filter');

    let whereClause;
    if (filter === 'low') {
      whereClause = sql`${productVariants.stock} < 10 AND ${productVariants.stock} > 0`;
    } else if (filter === 'out') {
      whereClause = eq(productVariants.stock, 0);
    }

    const variants = await db.query.productVariants.findMany({
      where: whereClause,
      orderBy: [asc(productVariants.stock)],
      with: {
        product: true,
      },
    });

    const result = variants.map(v => ({
      id: v.id,
      nameId: v.nameId,
      nameEn: v.nameEn,
      sku: v.sku,
      stock: v.stock,
      weightGram: v.weightGram,
      sortOrder: v.sortOrder,
      productNameId: v.product?.nameId,
      productNameEn: v.product?.nameEn,
      isActive: v.isActive,
    }));

    return success(result);
  } catch (error) {
    console.error('[admin/field/inventory]', error);
    return serverError(error);
  }
}
