import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, forbidden, notFound, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';

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
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Hanya owner atau superadmin yang dapat melakukan penyesuaian manual');
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
    const quantityAfter = Math.max(0, quantityBefore + delta);

    await db.update(productVariants).set({ stock: quantityAfter, updatedAt: new Date() }).where(eq(productVariants.id, variantId));

    await db.insert(inventoryLogs).values({
      variantId,
      changedByUserId: session.user.id,
      changeType: 'manual',
      quantityBefore,
      quantityAfter,
      quantityDelta: delta,
      note: `[Manual Adjust] ${reason}${note ? ` - ${note}` : ''}`,
    });

    return success({ variantId, stockBefore: quantityBefore, stockAfter: quantityAfter, delta });
  } catch (error) {
    console.error('[admin/field/inventory/adjust POST]', error);
    return serverError(error);
  }
}