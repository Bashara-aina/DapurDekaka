import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { z } from 'zod';

const RestockSchema = z.object({
  variantId: z.string().uuid(),
  quantityAdded: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner', 'warehouse'].includes(role ?? '')) {
      return forbidden();
    }

    const body = await req.json();
    const parsed = RestockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Data tidak valid', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { variantId, quantityAdded, note } = parsed.data;

    const [variant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Varian tidak ditemukan' },
        { status: 404 }
      );
    }

    const newStock = variant.stock + quantityAdded;

    await db.transaction(async (tx) => {
      await tx
        .update(productVariants)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));

      await tx.insert(inventoryLogs).values({
        variantId,
        changedByUserId: session.user.id,
        changeType: 'restock',
        quantityBefore: variant.stock,
        quantityAfter: newStock,
        quantityDelta: quantityAdded,
        note: note ?? null,
      });
    });

    return success({
      variantId,
      previousStock: variant.stock,
      quantityAdded,
      newStock,
      message: `Stok berhasil ditambahkan: ${variant.stock} → ${newStock}`,
    });
  } catch (error) {
    console.error('[admin/field/inventory/restock]', error);
    return serverError(error);
  }
}
