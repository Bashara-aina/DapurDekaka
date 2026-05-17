import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';

export async function deductStock(
  variantId: string,
  quantity: number,
  orderId: string,
  note?: string
): Promise<{ success: boolean; newStock: number }> {
  const [current] = await db
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  const previousStock = current?.stock ?? 0;
  const newStock = Math.max(previousStock - quantity, 0);

  const result = await db
    .update(productVariants)
    .set({ stock: newStock })
    .where(and(
      eq(productVariants.id, variantId),
      gte(productVariants.stock, quantity)
    ))
    .returning({ stock: productVariants.stock });

  if (result.length === 0) {
    return { success: false, newStock: previousStock };
  }

  await db.insert(inventoryLogs).values({
    variantId,
    changeType: 'sale',
    quantityBefore: previousStock,
    quantityAfter: newStock,
    quantityDelta: -quantity,
    orderId,
    note: note ?? `Stock sold via order ${orderId.slice(0, 8)}`,
  });

  return { success: true, newStock };
}

export async function restoreStock(
  variantId: string,
  quantity: number,
  orderId: string,
  note?: string
): Promise<{ success: boolean; newStock: number }> {
  const [current] = await db
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  const previousStock = current?.stock ?? 0;
  const newStock = previousStock + quantity;

  await db
    .update(productVariants)
    .set({ stock: newStock })
    .where(eq(productVariants.id, variantId));

  await db.insert(inventoryLogs).values({
    variantId,
    changeType: 'reversal',
    quantityBefore: previousStock,
    quantityAfter: newStock,
    quantityDelta: quantity,
    orderId,
    note: note ?? `Stock restored for cancelled order ${orderId.slice(0, 8)}`,
  });

  return { success: true, newStock };
}

export async function adjustStock(
  variantId: string,
  newStock: number,
  changedByUserId: string,
  note: string
): Promise<{ success: boolean; previousStock: number; newStock: number }> {
  const [current] = await db
    .select({ stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  const previousStock = current?.stock ?? 0;
  const delta = newStock - previousStock;

  await db
    .update(productVariants)
    .set({ stock: newStock })
    .where(eq(productVariants.id, variantId));

  await db.insert(inventoryLogs).values({
    variantId,
    changeType: 'adjustment',
    quantityBefore: previousStock,
    quantityAfter: newStock,
    quantityDelta: delta,
    note,
  });

  return { success: true, previousStock, newStock };
}
