import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { savedCarts, productVariants, products } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { CartItem } from '@/store/cart.store';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(async (_req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const userId = session.user.id;

    const rows = await db
      .select({
        variantId: savedCarts.variantId,
        quantity: savedCarts.quantity,
        variantNameId: productVariants.nameId,
        variantNameEn: productVariants.nameEn,
        sku: productVariants.sku,
        price: productVariants.price,
        stock: productVariants.stock,
        weightGram: productVariants.weightGram,
        productId: products.id,
        productNameId: products.nameId,
        productNameEn: products.nameEn,
        imageUrl: sql<string>`(
          SELECT pi.cloudinary_url
          FROM product_images pi
          WHERE pi.product_id = ${products.id}
          ORDER BY pi.sort_order ASC
          LIMIT 1
        )`,
      })
      .from(savedCarts)
      .innerJoin(productVariants, eq(savedCarts.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(savedCarts.userId, userId),
          eq(productVariants.isActive, true)
        )
      );

    const items: CartItem[] = rows
      .filter((row) => row.stock > 0)
      .map((row) => ({
        variantId: row.variantId,
        productId: row.productId,
        productNameId: row.productNameId,
        productNameEn: row.productNameEn,
        variantNameId: row.variantNameId,
        variantNameEn: row.variantNameEn,
        sku: row.sku,
        imageUrl: row.imageUrl ?? '',
        unitPrice: row.price,
        quantity: row.quantity,
        weightGram: row.weightGram,
        stock: row.stock,
      }));

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    return success({ items, totalQuantity, subtotal });
  } catch (error) {
    logger.error('[GET /api/auth/cart]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(new Error('Gagal memuat keranjang'));
  }
}, 'money');