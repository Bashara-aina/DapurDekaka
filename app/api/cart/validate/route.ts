import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const { searchParams } = new URL(req.url);
    const variantIdsParam = searchParams.get('variantIds');

    if (!variantIdsParam) {
      return success({ items: [] });
    }

    const variantIds = variantIdsParam.split(',').filter(Boolean);

    if (variantIds.length === 0) {
      return success({ items: [] });
    }

    const cartQtysParam = searchParams.get('quantities');
    const cartQtys = cartQtysParam
      ? cartQtysParam.split(',').map(Number)
      : [];

    const variants = await db.query.productVariants.findMany({
      where: inArray(productVariants.id, variantIds),
      columns: {
        id: true,
        stock: true,
        isActive: true,
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const items = variantIds.map((variantId, index) => {
      const variant = variantMap.get(variantId);
      const cartQty = cartQtys[index] ?? 1;

      if (!variant) {
        return {
          variantId,
          cartQty,
          availableStock: 0,
          available: false,
        };
      }

      const availableStock = variant.isActive ? variant.stock : 0;
      const available = availableStock >= cartQty;

      return {
        variantId,
        cartQty,
        availableStock,
        available,
      };
    });

    return success({ items });
  } catch (error) {
    console.error('[cart/validate GET]', error);
    return serverError(error);
  }
}