import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { success, serverError, forbidden, notFound, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().min(1, 'Alasan penyesuaian harus diisi'),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Hanya owner, superadmin, atau warehouse yang dapat melakukan penyesuaian manual');
    }

    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { variantId, delta, reason, note } = parsed.data;

    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
    });

    if (!variant) {
      return notFound('Variant tidak ditemukan');
    }

    const quantityBefore = variant.stock;
    const capped = delta < 0 && Math.abs(delta) > quantityBefore;

    const result = await db
      .update(productVariants)
      .set({ stock: sql`GREATEST(stock + ${delta}, 0)`, updatedAt: new Date() })
      .where(and(
        eq(productVariants.id, variantId),
        delta >= 0 ? sql`true` : gte(productVariants.stock, Math.abs(delta))
      ))
      .returning({ newStock: productVariants.stock });

    if (result.length === 0) {
      return validationError(new z.ZodError([{
        message: 'STOCK_UPDATE_CONFLICT: Stok tidak mencukupi untuk pengurangan yang diminta',
        path: ['delta'],
        code: 'custom',
        fatal: true,
      }]));
    }

    const quantityAfter = result[0]!.newStock;
    const actualDelta = quantityAfter - quantityBefore;

    await db.insert(inventoryLogs).values({
      variantId,
      changedByUserId: session.user.id,
      changeType: 'adjustment',
      quantityBefore,
      quantityAfter,
      quantityDelta: actualDelta,
      note: actualDelta !== delta
        ? `[Manual Adjust] ${reason}${note ? ` - ${note}` : ''}\n(permintaan ${delta > 0 ? '+' : ''}${delta}, real ${actualDelta > 0 ? '+' : ''}${actualDelta} — dibatasi stok tersedia)`
        : `[Manual Adjust] ${reason}${note ? ` - ${note}` : ''}`,
    });

    return success({ variantId, stockBefore: quantityBefore, stockAfter: quantityAfter, actualDelta, capped });
  } catch (error) {
    console.error('[admin/field/inventory/adjust POST]', error);
    return serverError(error);
  }
}