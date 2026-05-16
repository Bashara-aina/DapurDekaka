import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants, products, inventoryLogs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, serverError, forbidden, notFound, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const variants = await db.query.productVariants.findMany({
      with: { product: true },
      where: eq(productVariants.isActive, true),
      orderBy: (pv, { asc }) => [asc(pv.sku)],
    });

    const inventory = variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      productName: v.product?.nameId ?? '',
      variantName: v.nameId,
      stock: v.stock,
      weightGram: v.weightGram,
      isActive: v.isActive,
    }));

    return success(inventory);
  } catch (error) {
    console.error('[admin/field/inventory GET]', error);
    return serverError(error);
  }
}

const adjustStockSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int(),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const body = await req.json();
    const parsed = adjustStockSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { variantId, delta, note } = parsed.data;

    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
    });

    if (!variant) {
      return notFound('Variant tidak ditemukan');
    }

    const quantityBefore = variant.stock;
    const quantityAfter = Math.max(0, quantityBefore + delta);
    const actualDelta = quantityAfter - quantityBefore;

    await db
      .update(productVariants)
      .set({ stock: sql`GREATEST(stock + ${delta}, 0)`, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId));

    await db.insert(inventoryLogs).values({
      variantId,
      changedByUserId: session.user.id,
      changeType: 'adjustment',
      quantityBefore,
      quantityAfter,
      quantityDelta: actualDelta,
      note: actualDelta !== delta
        ? `[Manual Adjust] ${note || 'Penyesuaian stok'}\n(permintaan ${delta > 0 ? '+' : ''}${delta}, real ${actualDelta > 0 ? '+' : ''}${actualDelta} — dibatasi stok tersedia)`
        : (note ? `[Manual Adjust] ${note}` : `Penyesuaian stok oleh ${session.user.name}`),
    });

    return success({ variantId, stockBefore: quantityBefore, stockAfter: quantityAfter, delta: actualDelta });
  } catch (error) {
    console.error('[admin/field/inventory PATCH]', error);
    return serverError(error);
  }
}