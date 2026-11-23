/**
 * Soft-launch inventory audit + optional restock floor for OOS sellable SKUs.
 * WHY: Live catalog had Habis ATC while products stayed active — soft launch needs sellable stock.
 */
import { db } from '../lib/db';
import { inventoryLogs, products, productVariants } from '../lib/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

const RESTOCK_FLOOR = 10;
const APPLY = process.argv.includes('--apply');

async function restockVariant(
  variantId: string,
  sku: string,
  from: number,
  to: number
): Promise<void> {
  await db
    .update(productVariants)
    .set({ stock: to, updatedAt: sql`now()` })
    .where(eq(productVariants.id, variantId));
  await db.insert(inventoryLogs).values({
    variantId,
    changeType: 'restock',
    quantityBefore: from,
    quantityAfter: to,
    quantityDelta: to - from,
    note: 'Soft-launch floor restock (audit-inventory) — warehouse must physical-count',
  });
  console.log(`restocked ${sku} ${from} → ${to}`);
}

async function main(): Promise<void> {
  const rows = await db
    .select({
      productId: products.id,
      name: products.nameId,
      slug: products.slug,
      featured: products.isFeatured,
      halal: products.isHalal,
      shopeeUrl: products.shopeeUrl,
      variantId: productVariants.id,
      variant: productVariants.nameId,
      sku: productVariants.sku,
      stock: productVariants.stock,
      price: productVariants.price,
      weight: productVariants.weightGram,
      l: productVariants.lengthCm,
      w: productVariants.widthCm,
      h: productVariants.heightCm,
      sortOrder: productVariants.sortOrder,
      variantActive: productVariants.isActive,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(isNull(products.deletedAt), eq(products.isActive, true), eq(productVariants.isActive, true)))
    .orderBy(products.nameId);

  const oos = rows.filter((r) => r.stock <= 0);
  const low = rows.filter((r) => r.stock > 0 && r.stock < 5);
  const missingDims = rows.filter((r) => !r.weight || !r.l || !r.w || !r.h);
  const missingShopee = rows.filter((r) => !r.shopeeUrl);

  console.log(JSON.stringify({
    totalVariants: rows.length,
    oos: oos.length,
    low: low.length,
    missingDims: missingDims.length,
    missingShopee: missingShopee.length,
    oosSkus: oos.map((r) => ({ sku: r.sku, name: r.name, variant: r.variant, stock: r.stock })),
    lowSkus: low.map((r) => ({ sku: r.sku, name: r.name, stock: r.stock })),
    missingDimSkus: missingDims.map((r) => r.sku),
  }, null, 2));

  if (!APPLY) {
    console.log('\nDry run. Pass --apply to restock OOS+low (<5) active variants to floor', RESTOCK_FLOOR);
    return;
  }

  const toRestock = rows.filter((r) => r.stock < RESTOCK_FLOOR);
  for (const row of toRestock) {
    await restockVariant(row.variantId, row.sku, row.stock, RESTOCK_FLOOR);
  }

  console.log('Apply done. Warehouse must still physical-count before hard launch.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
