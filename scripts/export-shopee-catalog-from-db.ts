import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db/index';
import * as schema from '../lib/db/schema';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '.env.local'), override: true });

async function main(): Promise<void> {
  const products = await db.query.products.findMany({
    where: and(eq(schema.products.isActive, true), sql`${schema.products.deletedAt} IS NULL`),
    with: {
      variants: {
        where: eq(schema.productVariants.isActive, true),
        orderBy: [asc(schema.productVariants.sortOrder)],
      },
      images: { orderBy: [asc(schema.productImages.sortOrder)] },
      category: true,
    },
    orderBy: [asc(schema.products.sortOrder)],
  });

  const catalog = {
    scrapedAt: '2026-11-22T13:50:00.000Z',
    shopId: 20069111,
    shopUrl: 'https://shopee.co.id/dapurdekaka',
    pricingRule: 'exact_base_price',
    notes:
      'Synced from live Shopee shop. Prices = Shopee normal/base. Temporary DDK SKUs until Seller Centre remap.',
    products: products.map((p) => ({
      itemId: Number((p.shopeeUrl || '').split('/').pop() || 0),
      slug: p.slug,
      nameId: p.nameId,
      nameEn: p.nameEn,
      rawName: p.nameId,
      shopeeUrl: p.shopeeUrl,
      categorySlug: p.category?.slug || 'dimsum-klasik',
      isPreOrder: p.isPreOrder,
      isHalal: p.isHalal,
      isFeatured: p.isFeatured,
      descriptionId: p.descriptionId || '',
      descriptionEn: p.descriptionEn || '',
      shortDescriptionId: p.shortDescriptionId || '',
      shortDescriptionEn: p.shortDescriptionEn || '',
      imageIds: (p.images || []).map((img) => img.cloudinaryPublicId),
      cloudinaryFolder: (p.images?.[0]?.cloudinaryPublicId.includes('/sauces/')
        ? 'sauces'
        : 'products') as 'products' | 'sauces',
      weightGramDefault: p.weightGram,
      variants: (p.variants || []).map((v) => ({
        nameId: v.nameId,
        nameEn: v.nameEn,
        tempSku: v.sku,
        price: v.price,
        stock: v.stock,
        weightGram: v.weightGram,
        modelId: 0,
      })),
    })),
    deactivateSlugsNotOnShopee: [
      'dimsum-crabstick',
      'dimsum-jamur',
      'dimsum-mozarella',
      'dimsum-golden',
      'dimsum-tuna',
      'ekado',
      'chili-oil',
      'dimsum-full-crabstick',
      'dimsum-mix-luar-kota',
    ],
  };

  const out = join(process.cwd(), 'data/shopee-catalog.json');
  writeFileSync(out, JSON.stringify(catalog, null, 2));
  console.log(`Wrote ${out} with ${catalog.products.length} products`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
