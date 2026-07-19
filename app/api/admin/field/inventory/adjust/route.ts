import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, serverError, forbidden, notFound, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int().min(-10000, 'Penyesuaian maksimal -10.000').max(10000, 'Penyesuaian maksimal +10.000').refine((val) => val !== 0, {
    message: 'Delta tidak boleh nol',
  }),
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
    let quantityAfter = 0;
    let actualDelta = 0;

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(productVariants)
        .set({ stock: sql`GREATEST(stock + ${delta}, 0)`, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId))
        .returning({ newStock: productVariants.stock });

      if (!updated) {
        throw new Error('Gagal memperbarui stok');
      }

      quantityAfter = updated.newStock;
      actualDelta = quantityAfter - quantityBefore;

      await tx.insert(inventoryLogs).values({
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
    });

    return success({ variantId, stockBefore: quantityBefore, stockAfter: quantityAfter, actualDelta });
  } catch (error) {
    logger.error('[admin/field/inventory/adjust]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}