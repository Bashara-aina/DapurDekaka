import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, forbidden, notFound, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const restockSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1, 'Jumlah harus lebih dari 0'),
  note: z.string().min(1, 'Alasan restock harus diisi'),
});

export async function POST(req: NextRequest) {
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
    const parsed = restockSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { variantId, quantity, note } = parsed.data;

    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
    });

    if (!variant) {
      return notFound('Variant tidak ditemukan');
    }

    const quantityBefore = variant.stock;
    const quantityAfter = quantityBefore + quantity;

    await db.update(productVariants).set({ stock: quantityAfter, updatedAt: new Date() }).where(eq(productVariants.id, variantId));

    await db.insert(inventoryLogs).values({
      variantId,
      changedByUserId: session.user.id,
      changeType: 'restock',
      quantityBefore,
      quantityAfter,
      quantityDelta: quantity,
      note: `[Restock] ${note}`,
    });

    return success({ variantId, stockBefore: quantityBefore, stockAfter: quantityAfter, added: quantity });
  } catch (error) {
    console.error('[admin/field/inventory/restock POST]', error);
    return serverError(error);
  }
}