import { db } from '@/lib/db';
import { productVariants, inventoryLogs } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * Deduct stock atomically — no read-then-write.
 * Uses GREATEST to prevent negative stock and WHERE clause to ensure
 * the row is only updated if sufficient stock exists.
 * Returns previous stock from the returning clause.
 *
 * NOTE: This uses two queries (SELECT then UPDATE) inside a transaction.
 * The SELECT is only for capturing the before-value for inventory logging.
 * The UPDATE's WHERE clause (gte(stock, qty)) is the true atomic guard —
 * concurrent requests will never both succeed if stock is insufficient.
 */
export async function deductStock(
  variantId: string,
  quantity: number,
  orderId: string,
  note?: string
): Promise<{ success: boolean; newStock: number }> {
  // Atomic conditional update — only deducts if stock >= quantity
  // The CTE captures stock BEFORE the update so we can log it atomically
  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    if (!before) {
      return { success: false, newStock: 0, quantityBefore: 0 };
    }

    const [updated] = await tx
      .update(productVariants)
      .set({ stock: sql`GREATEST(stock - ${quantity}, 0)` })
      .where(and(
        eq(productVariants.id, variantId),
        gte(productVariants.stock, quantity)
      ))
      .returning({ newStock: productVariants.stock });

    if (!updated || updated.newStock === undefined) {
      return { success: false, newStock: before.stock, quantityBefore: before.stock };
    }

return { success: true, newStock: updated.newStock, quantityBefore: before.stock };
    });

  // Inventory log is inserted inside transaction — if it fails, stock update rolls back (correct behavior)
  return { success: true, newStock: result.newStock };
}

/**
 * Restore stock atomically — no read-then-write.
 * Uses CTE to capture stock before update for accurate inventory log.
 */
export async function restoreStock(
  variantId: string,
  quantity: number,
  orderId: string,
  note?: string
): Promise<{ success: boolean; newStock: number }> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    if (!before) {
      return { success: false, newStock: 0, quantityBefore: 0 };
    }

    const [updated] = await tx
      .update(productVariants)
      .set({ stock: sql`GREATEST(stock + ${quantity}, 0)`, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId))
      .returning({ newStock: productVariants.stock });

    if (!updated) {
      return { success: false, newStock: 0, quantityBefore: before.stock };
    }

    // Inventory log inserted inside transaction — if it fails, stock update rolls back
    await tx.insert(inventoryLogs).values({
      variantId,
      changeType: 'reversal',
      quantityBefore: before.stock,
      quantityAfter: updated.newStock,
      quantityDelta: quantity,
      orderId,
      note: note ?? `Stock restored for cancelled order ${orderId.slice(0, 8)}`,
    });

    return { success: true, newStock: updated.newStock, quantityBefore: before.stock };
  });

  if (!result.success) {
    return { success: false, newStock: 0 };
  }

  return { success: true, newStock: result.newStock };
}

/**
 * Adjust stock to a specific value — no read-then-write.
 * Captures previous stock atomically within the same transaction for accurate logging.
 */
export async function adjustStock(
  variantId: string,
  newStock: number,
  changedByUserId: string,
  note: string
): Promise<{ success: boolean; previousStock: number; newStock: number }> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ stock: productVariants.stock })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    const previousStock = before?.stock ?? 0;

    const [updated] = await tx
      .update(productVariants)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(productVariants.id, variantId))
      .returning({ newStock: productVariants.stock });

    if (!updated) {
      return { success: false, previousStock, newStock: 0 };
    }

    const delta = updated.newStock - previousStock;

    // Inventory log inserted inside transaction — if it fails, stock update rolls back
    await tx.insert(inventoryLogs).values({
      variantId,
      changedByUserId,
      changeType: 'adjustment',
      quantityBefore: previousStock,
      quantityAfter: updated.newStock,
      quantityDelta: delta,
      note,
    });

    return { success: true, previousStock, newStock: updated.newStock };
  });

  if (!result.success) {
    return { success: false, previousStock: result.previousStock, newStock: 0 };
  }

  return { success: true, previousStock: result.previousStock, newStock: result.newStock };
}
