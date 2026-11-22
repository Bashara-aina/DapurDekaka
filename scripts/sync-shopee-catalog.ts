/**
 * Sync dapurdekaka.com catalog from data/shopee-catalog.json.
 * Downloads Shopee images → Cloudinary, upserts products/variants/images.
 *
 * Usage: npx tsx --env-file=.env scripts/sync-shopee-catalog.ts
 * Flags: --skip-upload
 */
import { config } from 'dotenv';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../lib/db/index';
import * as schema from '../lib/db/schema';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '.env.local'), override: true });

const SKIP_UPLOAD = process.argv.includes('--skip-upload');
const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME === 'Root'
    ? 'dsnhwfuxh'
    : process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsnhwfuxh';

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

interface CatalogVariant {
  nameId: string;
  nameEn: string;
  tempSku: string;
  price: number;
  stock: number;
  weightGram: number;
  modelId: number;
}

interface CatalogProduct {
  itemId: number;
  slug: string;
  nameId: string;
  nameEn: string;
  shopeeUrl: string;
  categorySlug: string;
  isPreOrder: boolean;
  isHalal: boolean;
  isFeatured: boolean;
  descriptionId: string;
  descriptionEn: string;
  shortDescriptionId: string;
  shortDescriptionEn: string;
  imageIds: string[];
  cloudinaryFolder: 'products' | 'sauces';
  weightGramDefault: number;
  variants: CatalogVariant[];
}

interface CatalogFile {
  scrapedAt: string;
  products: CatalogProduct[];
  deactivateSlugsNotOnShopee: string[];
}

interface UploadMap {
  [slug: string]: { publicIds: string[]; urls: string[] };
}

function shopeeImageUrl(imageId: string): string {
  if (imageId.includes('/')) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${imageId}`;
  }
  return `https://down-id.img.susercontent.com/file/${imageId}`;
}

function cloudinaryDisplayUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_800/${publicId}`;
}

async function downloadImage(imageId: string, destPath: string): Promise<void> {
  const res = await fetch(shopeeImageUrl(imageId), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Referer: 'https://shopee.co.id/',
    },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${imageId}: HTTP ${res.status}`);
  }
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream);
  await pipeline(nodeStream, createWriteStream(destPath));
}

async function uploadToCloudinary(
  filePath: string,
  folder: string,
  publicIdLeaf: string
): Promise<{ publicId: string; url: string }> {
  const publicId = `dapurdekaka/${folder}/${publicIdLeaf}`;
  const result = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    overwrite: true,
    unique_filename: false,
    resource_type: 'image',
    invalidate: true,
  });
  return { publicId: result.public_id, url: cloudinaryDisplayUrl(result.public_id) };
}

async function ensureSauceCategory(): Promise<void> {
  const [existing] = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, 'sauce'))
    .limit(1);
  if (existing) {
    if (!existing.isActive) {
      await db
        .update(schema.categories)
        .set({ isActive: true })
        .where(eq(schema.categories.id, existing.id));
    }
    return;
  }
  await db.insert(schema.categories).values({
    nameId: 'Saus & Dressing',
    nameEn: 'Sauces & Dressing',
    slug: 'sauce',
    descriptionId: 'Saos pelengkap dimsum Dapur Dekaka',
    descriptionEn: 'Dapur Dekaka dipping sauces',
    sortOrder: 60,
    isActive: true,
  });
}

async function ensurePremiumCategoryActive(): Promise<void> {
  await db
    .update(schema.categories)
    .set({ isActive: true })
    .where(eq(schema.categories.slug, 'dimsum-premium'));
}

async function getCategoryId(slug: string): Promise<string> {
  const [cat] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(schema.categories.slug, slug))
    .limit(1);
  if (!cat) throw new Error(`Category not found: ${slug}`);
  return cat.id;
}

async function syncImages(
  productId: string,
  product: CatalogProduct,
  uploadMap: UploadMap
): Promise<void> {
  const mapped = uploadMap[product.slug];
  if (!mapped || mapped.urls.length === 0) {
    console.warn(`  ⚠ No uploaded images for ${product.slug}`);
    return;
  }
  const existing = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.productId, productId));
  for (const img of existing) {
    await db.delete(schema.productImages).where(eq(schema.productImages.id, img.id));
  }
  for (let i = 0; i < mapped.urls.length; i++) {
    await db.insert(schema.productImages).values({
      productId,
      cloudinaryUrl: mapped.urls[i]!,
      cloudinaryPublicId: mapped.publicIds[i]!,
      altTextId: `${product.nameId} foto ${i + 1}`,
      altTextEn: `${product.nameEn} photo ${i + 1}`,
      sortOrder: i,
    });
  }
  console.log(`  → ${mapped.urls.length} image(s) set`);
}

async function syncVariants(productId: string, product: CatalogProduct): Promise<void> {
  const keepSkus = product.variants.map((v) => v.tempSku);
  const existing = await db
    .select()
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, productId));

  for (const legacy of existing) {
    if (!keepSkus.includes(legacy.sku)) {
      await db
        .update(schema.productVariants)
        .set({ isActive: false })
        .where(eq(schema.productVariants.id, legacy.id));
      console.log(`  → Deactivated legacy variant ${legacy.sku}`);
    }
  }

  for (let i = 0; i < product.variants.length; i++) {
    const v = product.variants[i]!;
    const [bySku] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.sku, v.tempSku))
      .limit(1);

    const values = {
      productId,
      nameId: v.nameId,
      nameEn: v.nameEn,
      price: v.price,
      b2bPrice: Math.floor(v.price * 0.85),
      stock: v.stock,
      weightGram: v.weightGram,
      sortOrder: i + 1,
      isActive: true,
    };

    if (bySku) {
      await db
        .update(schema.productVariants)
        .set(values)
        .where(eq(schema.productVariants.id, bySku.id));
      console.log(`  → Updated variant ${v.tempSku} @ Rp ${v.price.toLocaleString('id-ID')}`);
    } else {
      await db.insert(schema.productVariants).values({ ...values, sku: v.tempSku });
      console.log(`  → Created variant ${v.tempSku} @ Rp ${v.price.toLocaleString('id-ID')}`);
    }
  }
}

async function syncProduct(
  product: CatalogProduct,
  uploadMap: UploadMap,
  sortOrder: number
): Promise<void> {
  console.log(`\n[${sortOrder}] ${product.nameId} (${product.slug})`);
  const categoryId = await getCategoryId(product.categorySlug);
  const [existing] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.slug, product.slug))
    .limit(1);

  const productValues = {
    categoryId,
    nameId: product.nameId,
    nameEn: product.nameEn,
    descriptionId: product.descriptionId,
    descriptionEn: product.descriptionEn,
    shortDescriptionId: (product.shortDescriptionId || '').slice(0, 500),
    shortDescriptionEn: (product.shortDescriptionEn || '').slice(0, 500),
    weightGram: product.weightGramDefault,
    isHalal: product.isHalal,
    isActive: true,
    isFeatured: product.isFeatured,
    isB2bAvailable: true,
    isPreOrder: product.isPreOrder,
    sortOrder,
    metaTitleId: `${product.nameId} | Dapur Dekaka`,
    metaTitleEn: `${product.nameEn} | Dapur Dekaka`,
    metaDescriptionId: (product.shortDescriptionId || '').slice(0, 500),
    metaDescriptionEn: (product.shortDescriptionEn || '').slice(0, 500),
    shopeeUrl: product.shopeeUrl,
    updatedAt: new Date(),
    deletedAt: null,
  };

  let productId: string;
  if (existing) {
    await db.update(schema.products).set(productValues).where(eq(schema.products.id, existing.id));
    productId = existing.id;
    console.log('  → Updated product');
  } else {
    const [inserted] = await db
      .insert(schema.products)
      .values({ ...productValues, slug: product.slug })
      .returning({ id: schema.products.id });
    productId = inserted!.id;
    console.log('  → Created product');
  }

  await syncVariants(productId, product);
  await syncImages(productId, product, uploadMap);
}

async function deactivateOffShopee(slugs: string[], keepSlugs: string[]): Promise<void> {
  const toDeactivate = [...new Set(slugs)].filter((s) => !keepSlugs.includes(s));
  if (toDeactivate.length > 0) {
    await db
      .update(schema.products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(schema.products.slug, toDeactivate));
    console.log(`\nDeactivated listed off-Shopee: ${toDeactivate.join(', ')}`);
  }
  await db
    .update(schema.products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.products.isActive, true),
        notInArray(schema.products.slug, keepSlugs),
        sql`${schema.products.deletedAt} IS NULL`
      )
    );
}

async function uploadAllImages(catalog: CatalogFile): Promise<UploadMap> {
  const tmpDir = join(process.cwd(), 'tmp/shopee-images');
  mkdirSync(tmpDir, { recursive: true });
  const mapPath = join(process.cwd(), 'data/shopee-upload-map.json');

  if (SKIP_UPLOAD && existsSync(mapPath)) {
    console.log('Skipping upload — using existing upload map');
    return JSON.parse(readFileSync(mapPath, 'utf8')) as UploadMap;
  }

  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Missing CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
  }

  const uploadMap: UploadMap = {};
  console.log(`Cloudinary cloud: ${CLOUD_NAME}`);

  for (const product of catalog.products) {
    console.log(`\nUploading images for ${product.slug}...`);
    const publicIds: string[] = [];
    const urls: string[] = [];

    for (let i = 0; i < product.imageIds.length; i++) {
      const imageId = product.imageIds[i]!;
      if (imageId.startsWith('dapurdekaka/')) {
        publicIds.push(imageId);
        urls.push(cloudinaryDisplayUrl(imageId));
        console.log(`  [${i + 1}] reuse Cloudinary ${imageId}`);
        continue;
      }
      const leaf = i === 0 ? product.slug : `${product.slug}-${i + 1}`;
      const dest = join(tmpDir, `${leaf}.jpg`);
      process.stdout.write(`  [${i + 1}/${product.imageIds.length}] ${imageId}... `);
      try {
        await downloadImage(imageId, dest);
        const uploaded = await uploadToCloudinary(dest, product.cloudinaryFolder, leaf);
        publicIds.push(uploaded.publicId);
        urls.push(uploaded.url);
        console.log('OK');
      } catch (err) {
        console.log(`FAIL ${(err as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    uploadMap[product.slug] = { publicIds, urls };
  }

  writeFileSync(mapPath, JSON.stringify(uploadMap, null, 2));
  return uploadMap;
}

async function main(): Promise<void> {
  const catalogPath = join(process.cwd(), 'data/shopee-catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogFile;
  console.log(`Loaded ${catalog.products.length} products from ${catalogPath}`);

  const uploadMap = await uploadAllImages(catalog);
  await ensureSauceCategory();
  await ensurePremiumCategoryActive();

  const keepSlugs = catalog.products.map((p) => p.slug);
  for (let i = 0; i < catalog.products.length; i++) {
    await syncProduct(catalog.products[i]!, uploadMap, i + 1);
  }
  await deactivateOffShopee(catalog.deactivateSlugsNotOnShopee || [], keepSlugs);

  console.log('\n=== Sync complete ===');
  const active = await db
    .select({ slug: schema.products.slug, pre: schema.products.isPreOrder })
    .from(schema.products)
    .where(and(eq(schema.products.isActive, true), sql`${schema.products.deletedAt} IS NULL`));
  console.log(`Active products: ${active.length}`);
  for (const p of active) console.log(`  - ${p.slug}${p.pre ? ' [pre-order]' : ''}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
