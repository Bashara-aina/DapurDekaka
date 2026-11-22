/**
 * Remap temporary DDK SKUs → Seller Centre SKUs.
 *
 * 1. Copy data/shopee-sku-remap.template.json → data/shopee-sku-remap.json
 * 2. Fill shopeeSku fields
 * 3. Run: npx tsx --env-file=.env scripts/remap-shopee-skus.ts
 */
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/index';
import * as schema from '../lib/db/schema';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '.env.local'), override: true });

interface RemapEntry {
  tempSku: string;
  shopeeSku: string;
  productSlug: string;
  variantName: string;
  price: number;
}

interface RemapFile {
  mappings: RemapEntry[];
}

async function main(): Promise<void> {
  const path = join(process.cwd(), 'data/shopee-sku-remap.json');
  if (!existsSync(path)) {
    console.error(
      'Missing data/shopee-sku-remap.json\n' +
        'Copy data/shopee-sku-remap.template.json → data/shopee-sku-remap.json and fill shopeeSku values.'
    );
    process.exit(1);
  }

  const file = JSON.parse(readFileSync(path, 'utf8')) as RemapFile;
  const ready = file.mappings.filter((m) => m.shopeeSku && m.shopeeSku.trim().length > 0);

  if (ready.length === 0) {
    console.error('No shopeeSku values filled yet. Nothing to remap.');
    process.exit(1);
  }

  console.log(`Remapping ${ready.length} / ${file.mappings.length} SKUs...\n`);

  let updated = 0;
  let skipped = 0;

  for (const entry of ready) {
    const newSku = entry.shopeeSku.trim();
    if (newSku === entry.tempSku) {
      console.log(`= ${entry.tempSku} already matches — skip`);
      skipped++;
      continue;
    }

    const [current] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.sku, entry.tempSku))
      .limit(1);

    if (!current) {
      console.warn(`⚠ tempSku not found: ${entry.tempSku}`);
      skipped++;
      continue;
    }

    const [conflict] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.sku, newSku))
      .limit(1);

    if (conflict && conflict.id !== current.id) {
      console.error(`✗ Conflict: ${newSku} already used by variant ${conflict.id}`);
      skipped++;
      continue;
    }

    await db
      .update(schema.productVariants)
      .set({ sku: newSku })
      .where(eq(schema.productVariants.id, current.id));

    console.log(`✓ ${entry.tempSku} → ${newSku} (${entry.productSlug} / ${entry.variantName})`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
