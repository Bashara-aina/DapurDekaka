import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const AdjustSchema = z.object({
  variantId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.string().min(1).max(500),
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
    const parsed = AdjustSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Data tidak valid', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { variantId, newQuantity, reason } = parsed.data;

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

    const quantityDelta = newQuantity - variant.stock;

    await db.transaction(async (tx) => {
      await tx
        .update(productVariants)
        .set({ stock: newQuantity, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));

      await tx.insert(inventoryLogs).values({
        variantId,
        changedByUserId: session.user.id,
        changeType: 'adjustment',
        quantityBefore: variant.stock,
        quantityAfter: newQuantity,
        quantityDelta,
        note: reason,
      });
    });

    return success({
      variantId,
      previousStock: variant.stock,
      newStock: newQuantity,
      quantityDelta,
      message: `Stok dikoreksi: ${variant.stock} → ${newQuantity}`,
    });
  } catch (error) {
    console.error('[admin/field/inventory/adjust]', error);
    return serverError(error);
  }
}
